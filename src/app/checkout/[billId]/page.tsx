
"use client";

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Printer, Smartphone, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react'; // useCallback removed
import type { OrderType } from '@/types';
import Script from 'next/script';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

const fetchBillTotalQueryFn = async (billId: string | undefined): Promise<number> => {
  if (!billId) throw new Error('Bill ID is required to fetch total.');
  const response = await fetch(`/api/orders?billId=${billId}`);
  if (!response.ok) throw new Error('Failed to fetch orders for bill total');
  const orders: OrderType[] = await response.json();
  const total = orders.reduce((sum, order) => sum + order.total, 0);
  return total;
};

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const billIdFromUrl = params.billId as string;
  
  const { 
    sessionId, 
    billId: authBillId, 
    tableId, 
    isAuthenticated, 
    currentPaymentStatus, 
    isAuthContextLoading, 
    confirmPaymentExternal, 
    sessionStatus,
    setHasExplicitlyRequestedBill
  } = useAuth();
  const { toast } = useToast();
  
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isRazorpayScriptLoaded, setIsRazorpayScriptLoaded] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const { 
    data: billTotal, 
    isLoading: isFetchingBillTotal, 
    error: billTotalError 
  } = useQuery<number, Error>({
    queryKey: ['billTotal', billIdFromUrl],
    queryFn: () => fetchBillTotalQueryFn(billIdFromUrl),
    enabled: !!billIdFromUrl && isAuthenticated && authBillId === billIdFromUrl && !isAuthContextLoading && currentPaymentStatus !== 'Confirmed',
    staleTime: 1000 * 60, // 1 minute
    onError: (err) => {
      console.error("[CheckoutPage Tanstack] Error fetching bill total:", err);
      toast({ title: "Error", description: "Could not fetch bill total.", variant: "destructive"});
    }
  });

  useEffect(() => {
    if (!billIdFromUrl) {
      setIsPageLoading(false); router.replace('/'); return;
    }
    if (isAuthenticated && authBillId && billIdFromUrl !== authBillId) {
      router.replace(tableId ? `/${tableId}` : '/'); return;
    }

    if (isAuthenticated && authBillId === billIdFromUrl && sessionId) {
        if (!isAuthContextLoading) { 
            if (currentPaymentStatus === 'Confirmed') { 
                router.replace(`/bill-status/${billIdFromUrl}`);
            } else {
                setIsPageLoading(false);
            }
        }
    } else if (sessionStatus === 'unauthenticated' && !isAuthContextLoading) { 
        router.replace(tableId ? `/${tableId}` : '/');
        return;
    }
    
    if (!isAuthContextLoading && isPageLoading) setIsPageLoading(false);

  }, [
    isAuthenticated, authBillId, billIdFromUrl, tableId, router, 
    currentPaymentStatus, isAuthContextLoading, sessionId, sessionStatus, isPageLoading
  ]);

  const handleRequestBill = async () => {
    if (billIdFromUrl) {
      setHasExplicitlyRequestedBill(true);
      router.push(`/bill-status/${billIdFromUrl}`);
    }
  };

  const handleMakePaymentOnline = async () => {
    if (!sessionId) {
      toast({ title: "Session Error", description: "No active session ID found.", variant: "destructive" });
      return;
    }
    if (!isRazorpayScriptLoaded || billTotal === null || billTotal === undefined || billTotal <= 0) {
      toast({ title: "Payment Error", description: "Gateway not ready or bill amount invalid.", variant: "destructive" });
      return;
    }
    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      toast({ title: "Config Error", description: "Online payment not configured.", variant: "destructive" });
      return;
    }

    setIsProcessingPayment(true);
    setHasExplicitlyRequestedBill(true);

    try {
      const createOrderResponse = await fetch('/api/payment/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId: billIdFromUrl, amount: billTotal }), 
      });
      if (!createOrderResponse.ok) {
        const errorData = await createOrderResponse.json();
        throw new Error(errorData.error || "Failed to create Razorpay order.");
      }
      const orderData = await createOrderResponse.json();
      if (!orderData.success || !orderData.order_id) {
        throw new Error(orderData.error || "Backend did not return Razorpay order ID.");
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount.toString(), 
        currency: orderData.currency || "INR",
        name: "SnapOrderEat",
        description: `Bill Payment for: ${billIdFromUrl}`,
        order_id: orderData.order_id,
        handler: async function (response: any) { 
          setIsProcessingPayment(true); 
          try {
            if (currentPaymentStatus === 'Confirmed') {
                toast({ title: "Already Confirmed", description: "This payment has already been confirmed." });
                router.push(`/bill-status/${billIdFromUrl}`);
                setIsProcessingPayment(false);
                return;
            }

            const paymentConfirmed = await confirmPaymentExternal(sessionId); 

            if (paymentConfirmed) {
              toast({ title: "Payment Successful!", description: `Payment ID: ${response.razorpay_payment_id}. Bill status updated.` });
              router.push(`/bill-status/${billIdFromUrl}`);
            } else {
              toast({ title: "Payment Confirmation Pending", description: "Payment processed, but final confirmation is pending. Check bill status or contact support."});
            }
          } catch (verifyError: any) {
            console.error("Payment confirmation API error (in Razorpay handler):", verifyError);
            if (verifyError?.message && 
                (verifyError.message.includes("Session payment status is Confirmed, not Pending") ||
                 verifyError.message.toLowerCase().includes("already confirmed"))) {
              toast({
                title: "Payment Already Confirmed",
                description: "This session's payment was already confirmed.",
              });
              router.push(`/bill-status/${billIdFromUrl}`);
            } else {
              toast({ 
                title: "Payment Confirmation Error", 
                description: verifyError.message || "Could not confirm payment with server.", 
                variant: "destructive" 
              });
            }
          } finally {
            setIsProcessingPayment(false);
          }
        },
        prefill: {},
        notes: { snap_order_eat_bill_id: billIdFromUrl, snap_order_eat_table_id: tableId || "N/A" },
        theme: { color: "#7C8363" }
      };
      
      if (!window.Razorpay) {
        throw new Error("Razorpay SDK not loaded.");
      }
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any){
          toast({ title: "Payment Failed", description: `Error: ${response.error.reason || response.error.description || 'Unknown Razorpay Error'}`, variant: "destructive" });
          setIsProcessingPayment(false);
      });
      rzp.open();

    } catch (error: any) {
      toast({ title: "Payment Initiation Error", description: error.message, variant: "destructive" });
      setIsProcessingPayment(false);
    }
  };
  
  if (isPageLoading || (isAuthenticated && isAuthContextLoading) ) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading checkout...</p>
      </div>
    );
  }

  if (!billIdFromUrl || (!isAuthenticated && !isAuthContextLoading)) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied or Invalid Link</h1>
        <p className="text-muted-foreground mb-6">No bill ID or session found.</p>
        <Button asChild variant="outline">
          <Link href={tableId ? `/${tableId}` : '/'}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Menu</Link>
        </Button>
      </div>
    );
  }
  
  return (
    <>
      <Script id="razorpay-checkout-js" src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setIsRazorpayScriptLoaded(true)}
        onError={(e) => toast({ title: "Gateway Error", description: "Could not load payment gateway.", variant: "destructive" })}
      />
      <div className="max-w-md mx-auto py-8 sm:py-12">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <CreditCard className="mx-auto h-12 w-12 text-primary mb-3" />
            <CardTitle className="text-3xl">Checkout</CardTitle>
            <CardDescription>Ready to settle your bill for Table {tableId || 'N/A'}?</CardDescription>
            {(billTotal !== null && billTotal !== undefined && !isFetchingBillTotal) && (<p className="text-lg font-semibold mt-2">Total: ₹{billTotal.toFixed(2)}</p>)}
            {isFetchingBillTotal && (<div className="flex items-center justify-center mt-2"><Loader2 className="mr-2 h-5 w-5 animate-spin" /><p>Fetching total...</p></div>)}
            {billTotalError && !isFetchingBillTotal && (<p className="text-xs text-center text-destructive mt-1">Could not load total. Try refreshing.</p>)}
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <Button onClick={handleRequestBill} className="w-full py-6 text-lg" variant="outline" disabled={isProcessingPayment}>
              <Printer className="mr-3 h-6 w-6" />Request Bill from Waiter</Button>
            <Button onClick={handleMakePaymentOnline} className="w-full py-6 text-lg"
              disabled={ !isRazorpayScriptLoaded || billTotal === null || billTotal === undefined || billTotal <= 0 || isFetchingBillTotal || isProcessingPayment || !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || !sessionId }>
              {isProcessingPayment ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : <Smartphone className="mr-3 h-6 w-6" />}
              {isProcessingPayment ? 'Processing...' : 'Make Payment Online'}
            </Button>
             {!isRazorpayScriptLoaded && billTotal !== null && billTotal !== undefined && billTotal > 0 && process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && <p className="text-xs text-center text-muted-foreground">Initializing payment gateway...</p>}
             {(billTotal === 0 && !isFetchingBillTotal) && <p className="text-xs text-center text-muted-foreground">No amount due. You can request the bill.</p>}
             {!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID && <p className="text-xs text-center text-destructive">Online payment unavailable (Key ID missing).</p>}
             {!sessionId && isAuthenticated && <p className="text-xs text-center text-destructive">Online payment unavailable (Session ID missing).</p>}
          </CardContent>
          <CardFooter className="flex flex-col items-center pt-6">
            <Button asChild variant="link" disabled={isProcessingPayment}>
              <Link href={tableId ? `/${tableId}` : '/'}><ArrowLeft className="mr-2 h-4 w-4" /> Continue Ordering</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
