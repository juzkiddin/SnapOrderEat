
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Clock, Loader2, LogOutIcon, AlertCircle, XCircle } from 'lucide-react'; // Added XCircle

// Type for payment status consistent with new API
type PaymentStatusFromApi = "Pending" | "Confirmed" | "Failed" | "Expired" | "NotCompleted" | null;

export default function BillStatusPage() {
  const params = useParams();
  const router = useRouter();
  const billIdFromUrl = params.billId as string;
  
  const { 
    isAuthenticated, 
    billId: authBillId, // From NextAuth session
    sessionId: authSessionId, // From NextAuth session
    tableId,
    currentPaymentStatus, // From NextAuth session (reflects external API status)
    isAuthContextLoading, // AuthContext loading (e.g., initial session check)
    logout 
  } = useAuth();
  
  // This page primarily reflects the status from AuthContext/NextAuth session.
  // No separate fetching needed here if AuthContext is kept up-to-date.

  useEffect(() => {
    if (!billIdFromUrl) {
      router.replace('/'); 
      return;
    }

    if (isAuthContextLoading) { // Wait for auth context to load session
      return;
    }

    if (!isAuthenticated || !authSessionId || (authBillId && authBillId !== billIdFromUrl)) {
      // Not authenticated for this bill, or session invalid
      // logout(); // Optional: force logout if navigating to a bill status page they don't own.
      router.replace(tableId ? `/${tableId}` : '/');
    }
    // If authenticated and ids match, page will render based on currentPaymentStatus from context.
    // If currentPaymentStatus is 'Pending' and they pay, CheckoutPage will update it,
    // and this page should reflect the change when navigated back or reloaded.

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
    // If payment is 'Confirmed', logout. Otherwise, go back to menu.
    if (currentPaymentStatus === 'Confirmed') {
      logout(); // Clears session, AuthContext handles redirect via its own effects or page effects
      router.push(tableId ? `/${tableId}` : '/'); // Redirect to table page (will show login)
    } else {
      router.push(tableId ? `/${tableId}` : '/'); // Go back to menu
    }
  };


  if (isAuthContextLoading || (!isAuthenticated && !isAuthContextLoading)) { // Show loader if auth is loading OR if not auth and not finished loading auth state
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading bill status...</p>
      </div>
    );
  }

  if (!authBillId || billIdFromUrl !== authBillId) { // Also check after loading
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied or Session Invalid</h1>
        <p className="text-muted-foreground mb-6">Cannot view this bill's status.</p>
        <Button onClick={() => router.push(tableId ? `/${tableId}` : '/')}>Go to Menu</Button>
      </div>
    );
  }

  // Render based on currentPaymentStatus from AuthContext
  let StatusIcon = Clock;
  let statusTitle = "Bill Status";
  let statusDescription = `Your bill (ID: ${authBillId.slice(-6)}) status is currently ${currentPaymentStatus || 'being determined'}.`;
  let cardClass = "shadow-xl text-center";
  let iconClass = "text-yellow-500"; // Default for Pending

  switch (currentPaymentStatus as PaymentStatusFromApi) {
    case 'Pending':
      StatusIcon = Clock;
      statusTitle = "Bill Requested / Payment Pending";
      statusDescription = "Your bill is active. Please proceed to checkout or ask waiter.";
      iconClass = "text-yellow-500";
      break;
    case 'Confirmed':
      StatusIcon = CheckCircle2;
      statusTitle = "Payment Confirmed!";
      statusDescription = "Thank you! Your payment has been successfully confirmed.";
      iconClass = "text-green-500";
      break;
    case 'Failed':
      StatusIcon = XCircle;
      statusTitle = "Payment Failed";
      statusDescription = "There was an issue with your payment. Please try again or contact support.";
      iconClass = "text-destructive";
      break;
    case 'Expired':
      StatusIcon = AlertCircle;
      statusTitle = "Session Expired";
      statusDescription = "This session has expired. Please start a new one from the table page.";
      iconClass = "text-orange-500";
      break;
    case 'NotCompleted':
       StatusIcon = AlertCircle;
      statusTitle = "Session Not Completed";
      statusDescription = "This session was not completed. Please start a new one if you wish to order.";
      iconClass = "text-orange-500";
      break;
    default:
      StatusIcon = Loader2;
      iconClass = "animate-spin text-muted-foreground";
      statusTitle = "Loading Status...";
      statusDescription = "Fetching the latest status for your bill...";
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
          {currentPaymentStatus === 'Confirmed' && <p className="text-muted-foreground mt-1">We hope to see you again soon at The Tasty Spoon!</p>}
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-3 pt-6">
          <Button onClick={handleExitOrNewOrder} className="w-full text-lg py-6">
            {currentPaymentStatus === 'Confirmed' ? <><LogOutIcon className="mr-2 h-5 w-5" /> Exit & Start New</> : "Back to Menu"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
