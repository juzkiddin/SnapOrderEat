
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
    sessionId: authSessionId, // Used for the new checkAndUpdateSessionStatus
    tableId,
    currentPaymentStatus,
    isAuthContextLoading,
    logout,
    checkAndUpdateSessionStatus, // New function from AuthContext
    externalSessionError // To react to logout triggered by AuthContext
  } = useAuth();

  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  useEffect(() => {
    if (!billIdFromUrl) {
      router.replace('/');
      return;
    }

    if (isAuthContextLoading) {
      return; // Wait for auth context to settle
    }

    // If externalSessionError is set, AuthContext might have initiated logout
    // or detected an issue that makes current session invalid.
    if (externalSessionError || !isAuthenticated || !authSessionId || (authBillId && authBillId !== billIdFromUrl)) {
      console.log(`[BillStatusPage Effect] Redirecting due to: externalError: ${externalSessionError}, !isAuthenticated: ${!isAuthenticated}, !authSessionId: ${!authSessionId}, billId mismatch: ${authBillId !== billIdFromUrl}`);
      router.replace(tableId ? `/${tableId}` : '/');
    }
  }, [
    isAuthenticated,
    authBillId,
    authSessionId,
    billIdFromUrl,
    router,
    tableId,
    isAuthContextLoading,
    externalSessionError // Added dependency
  ]);

  const handleExitOrNewOrder = () => {
    logout(); // AuthContext's logout handles NextAuth signOut and state resets
    router.push(tableId ? `/${tableId}` : '/');
  };

  const handleVerifyPayment = useCallback(async () => {
    if (!authSessionId || !tableId) {
      toast({ title: "Error", description: "Session or table details not found. Cannot verify.", variant: "destructive" });
      return;
    }
    setIsVerifyingPayment(true);
    try {
      console.log(`[BillStatusPage] Calling checkAndUpdateSessionStatus with SID: ${authSessionId}, TID: ${tableId}`);
      const result = await checkAndUpdateSessionStatus(authSessionId, tableId);
      console.log(`[BillStatusPage] Result from checkAndUpdateSessionStatus:`, result);

      if (result) {
        if (!result.success && result.message) {
           toast({ title: "Verification Info", description: result.message, variant: result.sessionStatus === "NotFound" || result.sessionStatus === "Expired" ? "destructive" : "default" });
        } else if (result.success && result.paymentStatus === 'Pending') {
          toast({
            title: "Payment Status",
            description: "Payment is not yet confirmed. Please check with the Waiter.",
            duration: 5000
          });
        }
        // If result.paymentStatus is 'Confirmed', AuthContext's update of NextAuth session
        // will cause `currentPaymentStatus` from `useAuth()` to change,
        // and this component will re-render, showing the success state.
        // If result.sessionStatus led to AuthContext calling logout(), the useEffect above handles redirection.
      } else {
         // This case means checkAndUpdateSessionStatus returned null, likely indicating a network error
         // or an internal error within AuthContext before/after the API call.
         // externalSessionError in AuthContext should be set.
        toast({ title: "Verification Error", description: "Failed to get payment status. Please try again.", variant: "destructive" });
      }
    } catch (error: any) {
      // This catch is for unexpected errors from checkAndUpdateSessionStatus if it throws.
      console.error("[BillStatusPage] Error calling checkAndUpdateSessionStatus:", error);
      toast({ title: "Verification Error", description: error.message || "An error occurred while verifying payment status.", variant: "destructive" });
    } finally {
      setIsVerifyingPayment(false);
    }
  }, [authSessionId, tableId, checkAndUpdateSessionStatus, toast]);


  if (isAuthContextLoading || (!isAuthenticated && !isAuthContextLoading && !externalSessionError)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading bill status...</p>
      </div>
    );
  }

  // If externalSessionError is present AFTER loading, it implies a problem that should lead to redirection (handled by useEffect) or an error display
  // This might be redundant if useEffect handles redirection correctly, but can act as a fallback.
  if (externalSessionError && !isAuthContextLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Session Issue</h1>
        <p className="text-muted-foreground mb-6">{externalSessionError}</p>
        <Button onClick={() => router.push(tableId ? `/${tableId}` : '/')}>Go to Menu</Button>
      </div>
    );
  }


  if (!authBillId || billIdFromUrl !== authBillId) {
    // This case should ideally be caught by the main useEffect redirecting.
    // Kept as a safeguard if redirection logic in useEffect isn't immediate.
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

  switch (currentPaymentStatus) { // No 'as PaymentStatusFromApi' needed if type is already correct
    case 'Pending':
      StatusIcon = Clock;
      statusTitle = "Bill Requested / Payment Pending";
      statusDescription = "Your bill is active. You can verify payment or proceed to checkout.";
      iconClass = "text-yellow-500";
      ActionButton = (
        <Button onClick={handleVerifyPayment} className="w-full text-lg py-6" disabled={isVerifyingPayment || !authSessionId || !tableId}>
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
    default: // Catches null or any other unexpected status
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
