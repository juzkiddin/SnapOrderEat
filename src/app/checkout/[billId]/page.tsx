
"use client";

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Printer, Smartphone, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import type { OrderType } from '@/types';
import Script from 'next/script';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const billIdFromUrl = params.billId as string;
  const { 
    billId: authBillId, 
    tableId, 
    isAuthenticated, 
    currentBillPaymentStatus, 
    isLoadingBillStatus,
    fetchAndSetBillStatus,
    setPaymentStatusForBill 
  } = useAuth();
  const { toast } = useToast();
  
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isRazorpayScriptLoaded, setIsRazorpayScriptLoaded] = useState(false);
  const [billTotal, setBillTotal] = useState<number | null>(null);
  const [isFetchingBillTotal, setIsFetchingBillTotal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);


  const fetchBillTotal = useCallback(async (billId: string) => {
    if (!billId) return;
    setIsFetchingBillTotal(true);
    try {
      const response = await fetch(`/api/orders?billId=${billId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch orders for bill total');
      }
      const orders: OrderType[] = await response.json();
      const total = orders.reduce((sum, order) => sum + order.total, 0);
      setBillTotal(total);
    } catch (error) {
      console.error("Error fetching bill total:", error);
      setBillTotal(0); 
    } finally {
      setIsFetchingBillTotal(false);
    }
  }, []);

  useEffect(() => {
    if (!billIdFromUrl) {
      setIsPageLoading(false);
      router.replace('/');
      return;
    }
    if (isAuthenticated && authBillId && billIdFromUrl !== authBillId) {
      router.replace(tableId ? `/${tableId}` : '/');
      return;
    }
    if (isAuthenticated && authBillId === billIdFromUrl) {
        if (!isLoadingBillStatus) {
            if (currentBillPaymentStatus === 'Completed') {
                router.replace(`/bill-status/${billIdFromUrl}`);
            } else {
                setIsPageLoading(false);
                if (billTotal === null && !isFetchingBillTotal) {
                  fetchBillTotal(billIdFromUrl);
                }
            }
        }
    } else if (!isAuthenticated) {
        router.replace(tableId ? `/${tableId}` : '/');
        return;
    }
  }, [
    isAuthenticated, 
    authBillId, 
    billIdFromUrl, 
    tableId, 
    router, 
    currentBillPaymentStatus, 
    isLoadingBillStatus,
    fetchBillTotal,
    billTotal,
    isFetchingBillTotal
  ]);

  useEffect(() => {
    if (billIdFromUrl && isAuthenticated && authBillId === billIdFromUrl && currentBillPaymentStatus === null && !isLoadingBillStatus) {
        fetchAndSetBillStatus(billIdFromUrl);
    }
  }, [billIdFromUrl, isAuthenticated, authBillId, currentBillPaymentStatus, fetchAndSetBillStatus, isLoadingBillStatus]);


  const handleRequestBill = async () => {
    if (billIdFromUrl) {
      try {
        await setPaymentStatusForBill(billIdFromUrl, 'Pending'); 
        router.push(`/bill-status/${billIdFromUrl}`);
      } catch (error: any) {
        console.error("CheckoutPage: Failed to request bill:", error);
        toast({
          title: "Error Requesting Bill",
          description: error.message || "Could not update bill status. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleMakePaymentOnline = async () => {
    if (!isRazorpayScriptLoaded || billTotal === null || billTotal <= 0) {
      toast({ title: "Payment Error", description: "Payment gateway not ready or bill amount invalid.", variant: "destructive" });
      return;
    }
    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      toast({ title: "Configuration Error", description: "Online payment is not configured. Please contact support.", variant: "destructive" });
      console.error("NEXT_PUBLIC_RAZORPAY_KEY_ID is not set in environment variables.");
      return;
    }

    setIsProcessingPayment(true);

    try {
      const createOrderResponse = await fetch('/api/payment/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId: billIdFromUrl, amount: billTotal }),
      });

      if (!createOrderResponse.ok) {
        const errorData = await createOrderResponse.json();
        throw new Error(errorData.error || "Failed to create Razorpay order on backend.");
      }

      const orderData = await createOrderResponse.json();
      
      if (!orderData.success || !orderData.order_id) {
        throw new Error(orderData.error || "Backend did not return a valid Razorpay order ID.");
      }
      const razorpayOrderId = orderData.order_id; 
      const razorpayOrderAmount = orderData.amount;

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: razorpayOrderAmount.toString(), 
        currency: orderData.currency || "INR",
        name: "SnapOrderEat",
        description: `Bill Payment for: ${billIdFromUrl}`,
        order_id: razorpayOrderId,
        handler: async function (response: any) {
          setIsProcessingPayment(true); 
          try {
            const verificationData = {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id, 
              razorpay_signature: response.razorpay_signature,
              original_bill_id: billIdFromUrl, 
            };

            const verifyResponse = await fetch('/api/payment/razorpay/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(verificationData),
            });

            const verificationResult = await verifyResponse.json();

            if (verificationResult.isOk) {
              toast({ title: "Payment Successful!", description: `Payment ID: ${response.razorpay_payment_id}. ${verificationResult.message || ''}` });
              await fetchAndSetBillStatus(billIdFromUrl); 
              router.push(`/bill-status/${billIdFromUrl}`);
            } else {
              toast({ title: "Payment Verification Failed", description: verificationResult.message || 'Unknown error', variant: "destructive" });
            }
          } catch (verifyError: any) {
            console.error("Payment verification API error:", verifyError);
            toast({ title: "Payment Verification Error", description: verifyError.message, variant: "destructive" });
          } finally {
            setIsProcessingPayment(false);
          }
        },
        prefill: {},
        notes: {
            snap_order_eat_bill_id: billIdFromUrl,
            snap_order_eat_table_id: tableId || "N/A",
        },
        theme: {
            color: "#7C8363" 
        }
      };
      
      if (!window.Razorpay) {
        toast({ title: "Payment Error", description: "Payment gateway SDK not loaded. Please try again.", variant: "destructive" });
        setIsProcessingPayment(false);
        return;
      }

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any){
          console.error("Razorpay payment failed:", response.error);
          toast({ title: "Payment Failed", description: `Error: ${response.error.reason || response.error.description || 'Unknown Razorpay Error'}`, variant: "destructive" });
          setIsProcessingPayment(false);
      });
      rzp.open();

    } catch (error: any) {
      console.error("Error initiating Razorpay payment:", error);
      toast({ title: "Payment Initiation Error", description: error.message, variant: "destructive" });
      setIsProcessingPayment(false);
    }
  };
  
  if (isPageLoading || (isAuthenticated && authBillId === billIdFromUrl && (isLoadingBillStatus || isFetchingBillTotal))) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading checkout...</p>
      </div>
    );
  }

  if (!billIdFromUrl) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Invalid Checkout Link</h1>
        <p className="text-muted-foreground mb-6">No bill ID provided.</p>
        <Button asChild variant="outline">
          <Link href={tableId ? `/${tableId}` : '/'}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Menu</Link>
        </Button>
      </div>
    );
  }
  
  if (!isAuthenticated || (authBillId && billIdFromUrl !== authBillId)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You are not authorized to view this checkout page.</p>
         <Button asChild variant="outline">
          <Link href={tableId ? `/${tableId}` : '/'}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Menu</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <Script
        id="razorpay-checkout-js"
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => {
          setIsRazorpayScriptLoaded(true);
          console.log("Razorpay script loaded.");
        }}
        onError={(e) => {
          console.error("Failed to load Razorpay script:", e);
          toast({ title: "Payment Gateway Error", description: "Could not load payment gateway. Please try refreshing the page.", variant: "destructive" });
        }}
      />
      <div className="max-w-md mx-auto py-8 sm:py-12">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <CreditCard className="mx-auto h-12 w-12 text-primary mb-3" />
            <CardTitle className="text-3xl">Checkout</CardTitle>
            <CardDescription>
              Ready to settle your bill?
            </CardDescription>
            {billTotal !== null && !isFetchingBillTotal && (
              <p className="text-lg font-semibold mt-2">Total Amount: ₹{billTotal.toFixed(2)}</p>
            )}
            {isFetchingBillTotal && (
                <div className="flex items-center justify-center mt-2">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    <p className="text-muted-foreground">Fetching total...</p>
                </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <Button onClick={handleRequestBill} className="w-full py-6 text-lg" variant="outline" disabled={isProcessingPayment}>
              <Printer className="mr-3 h-6 w-6" />
              Request Bill from Waiter
            </Button>
            <Button 
              onClick={handleMakePaymentOnline} 
              className="w-full py-6 text-lg"
              disabled={
                !isRazorpayScriptLoaded || 
                billTotal === null || 
                billTotal <= 0 || 
                isFetchingBillTotal || 
                isProcessingPayment ||
                !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
              }
            >
              {isProcessingPayment ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : <Smartphone className="mr-3 h-6 w-6" />}
              {isProcessingPayment ? 'Processing...' : 'Make Payment Online'}
            </Button>
             { !isRazorpayScriptLoaded && billTotal !== null && billTotal > 0 && process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID &&
                <p className="text-xs text-center text-muted-foreground">Initializing payment gateway...</p>
             }
             { billTotal === 0 && !isFetchingBillTotal &&
                <p className="text-xs text-center text-muted-foreground">No amount due. You can request the bill from waiter.</p>
             }
             { !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID &&
                <p className="text-xs text-center text-destructive">Online payment is currently unavailable. Razorpay Key ID not configured.</p>
             }
          </CardContent>
          <CardFooter className="flex flex-col items-center pt-6">
            <Button asChild variant="link" disabled={isProcessingPayment}>
              <Link href={tableId ? `/${tableId}` : '/'}><ArrowLeft className="mr-2 h-4 w-4" /> Continue Ordering / Back to Menu</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
