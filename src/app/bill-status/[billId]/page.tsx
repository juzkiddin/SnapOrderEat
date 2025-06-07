
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Clock, Loader2, LogOutIcon, AlertCircle, XCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type PaymentStatusFromApi = "Pending" | "Confirmed" | "Failed" | "Expired" | "NotCompleted" | null;

export default function BillStatusPage() {
  const params = useParams();
  const router = useRouter();
  const billIdFromUrl = params.billId as string;
  const { toast } = useToast();
  
  const { 
    isAuthenticated, 
    billId: authBillId,
    sessionId: authSessionId,
    tableId,
    phoneNumber, // Added
    currentPaymentStatus,
    isAuthContextLoading,
    logout,
    createOrVerifyExternalSession // Added
  } = useAuth();
  
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  useEffect(() => {
    if (!billIdFromUrl) {
      router.replace('/'); 
      return;
    }

    if (isAuthContextLoading) {
      return;
    }

    if (!isAuthenticated || !authSessionId || (authBillId && authBillId !== billIdFromUrl)) {
      router.replace(tableId ? `/${tableId}` : '/');
    }
  }, [
    isAuthenticated, 
    authBillId, 
    authSessionId,
    billIdFromUrl, 
    router, 
    logout, 
    tableId,
    isAuthContextLoading
  ]);

  const handleExitOrNewOrder = () => {
    if (currentPaymentStatus === 'Confirmed') {
      logout(); 
      router.push(tableId ? `/${tableId}` : '/'); 
    } else {
      router.push(tableId ? `/${tableId}` : '/'); 
    }
  };

  const handleVerifyPayment = useCallback(async () => {
    if (!phoneNumber || !tableId) {
      toast({ title: "Error", description: "User or table details not found. Cannot verify.", variant: "destructive" });
      return;
    }
    setIsVerifyingPayment(true);
    try {
      // createOrVerifyExternalSession in AuthContext is now enhanced to call nextAuthUpdate if session matches
      const sessionData = await createOrVerifyExternalSession(phoneNumber, tableId);
      
      // AuthContext's successful call to createOrVerifyExternalSession (if session matches)
      // will trigger a nextAuthUpdate, which will then update the `currentPaymentStatus` from useAuth().
      // The page re-renders, and the UI will reflect the new status.
      // We just show a toast if it's still pending after the check.
      if (sessionData && 'paymentStatus' in sessionData) {
        if (sessionData.paymentStatus === 'Pending') {
          toast({ 
            title: "Payment Status", 
            description: "Payment is not yet confirmed. Please check with the Waiter.",
            duration: 5000 
          });
        }
        // If sessionData.paymentStatus is 'Confirmed', the page will re-render
        // and show the "Payment Confirmed!" state automatically.
      } else if (sessionData && 'sessionStatus' in sessionData && sessionData.sessionStatus !== 'Active') {
        // Handle cases like "Expired", "Completed" returned by createOrVerify if it couldn't establish an active session.
        // AuthContext will likely handle logout in these scenarios.
        toast({ title: "Session Issue", description: sessionData.message || "Could not re-verify session.", variant: "destructive" });
      } else if (!sessionData) {
        toast({ title: "Verification Error", description: "Failed to verify payment status. No response from server.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Verification Error", description: error.message || "An error occurred while verifying payment status.", variant: "destructive" });
    } finally {
      setIsVerifyingPayment(false);
    }
  }, [phoneNumber, tableId, createOrVerifyExternalSession, toast]);


  if (isAuthContextLoading || (!isAuthenticated && !isAuthContextLoading)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading bill status...</p>
      </div>
    );
  }

  if (!authBillId || billIdFromUrl !== authBillId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied or Session Invalid</h1>
        <p className="text-muted-foreground mb-6">Cannot view this bill's status.</p>
        <Button onClick={() => router.push(tableId ? `/${tableId}` : '/')}>Go to Menu</Button>
      </div>
    );
  }

  let StatusIcon = Clock;
  let statusTitle = "Bill Status";
  let statusDescription = `Your bill (ID: ${authBillId.slice(-6)}) status is currently ${currentPaymentStatus || 'being determined'}.`;
  let cardClass = "shadow-xl text-center";
  let iconClass = "text-yellow-500";

  let ActionButton: React.ReactNode;

  switch (currentPaymentStatus as PaymentStatusFromApi) {
    case 'Pending':
      StatusIcon = Clock;
      statusTitle = "Bill Requested / Payment Pending";
      statusDescription = "Your bill is active. You can verify payment or proceed to checkout.";
      iconClass = "text-yellow-500";
      ActionButton = (
        <Button onClick={handleVerifyPayment} className="w-full text-lg py-6" disabled={isVerifyingPayment || !phoneNumber || !tableId}>
          {isVerifyingPayment ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RefreshCw className="mr-2 h-5 w-5" />}
          Verify Payment Status
        </Button>
      );
      break;
    case 'Confirmed':
      StatusIcon = CheckCircle2;
      statusTitle = "Payment Confirmed!";
      statusDescription = "Payment Success. We are sad to see you go. Please visit again!!";
      iconClass = "text-green-500";
      ActionButton = (
        <Button onClick={handleExitOrNewOrder} className="w-full text-lg py-6">
          <LogOutIcon className="mr-2 h-5 w-5" /> Exit & Start New
        </Button>
      );
      break;
    case 'Failed':
      StatusIcon = XCircle;
      statusTitle = "Payment Failed";
      statusDescription = "There was an issue with your payment. Please try again or contact support.";
      iconClass = "text-destructive";
      ActionButton = (
        <Button onClick={() => router.push(tableId ? `/checkout/${authBillId}` : '/')} className="w-full text-lg py-6">
            Try Payment Again
        </Button>
      );
      break;
    case 'Expired':
    case 'NotCompleted':
      StatusIcon = AlertCircle;
      statusTitle = currentPaymentStatus === 'Expired' ? "Session Expired" : "Session Not Completed";
      statusDescription = currentPaymentStatus === 'Expired' 
        ? "This session has expired. Please start a new one from the table page."
        : "This session was not completed. Please start a new one if you wish to order.";
      iconClass = "text-orange-500";
      ActionButton = (
        <Button onClick={handleExitOrNewOrder} className="w-full text-lg py-6">
          <LogOutIcon className="mr-2 h-5 w-5" /> Start New Session
        </Button>
      );
      break;
    default:
      StatusIcon = Loader2;
      iconClass = "animate-spin text-muted-foreground";
      statusTitle = "Loading Status...";
      statusDescription = "Fetching the latest status for your bill...";
      ActionButton = (
         <Button className="w-full text-lg py-6" disabled>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading...
        </Button>
      );
      break;
  }

  return (
    <div className="max-w-md mx-auto py-8 sm:py-12">
      <Card className={cardClass}>
        <CardHeader>
          <StatusIcon className={`mx-auto h-16 w-16 ${iconClass} mb-4`} />
          <CardTitle className="text-3xl">{statusTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-lg mb-1">{statusDescription}</CardDescription>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-3 pt-6">
          {ActionButton}
          {currentPaymentStatus !== 'Confirmed' && (
            <Button onClick={() => router.push(tableId ? `/checkout/${authBillId}` : '/')} variant="outline" className="w-full" disabled={isVerifyingPayment}>
                Go to Checkout
            </Button>
          )}
           {currentPaymentStatus !== 'Confirmed' && currentPaymentStatus !== 'Pending' && (
             <Button onClick={() => router.push(tableId ? `/${tableId}` : '/')} variant="link" className="w-full">
                Back to Menu
            </Button>
           )}
        </CardFooter>
      </Card>
    </div>
  );
}
