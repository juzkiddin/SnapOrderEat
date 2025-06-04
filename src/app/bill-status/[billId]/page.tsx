
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Clock, Loader2, LogOutIcon, AlertCircle } from 'lucide-react';

export default function BillStatusPage() {
  const params = useParams();
  const router = useRouter();
  const billIdFromUrl = params.billId as string;
  const { 
    isAuthenticated, 
    billId: authBillId, 
    tableId,
    currentBillPaymentStatus,
    isLoadingBillStatus,
    fetchAndSetBillStatus,
    setPaymentStatusForBill, 
    logout 
  } = useAuth();
  
  const [isPageLoading, setIsPageLoading] = useState(true); // Local page loading state

  useEffect(() => {
    if (!billIdFromUrl) {
      setIsPageLoading(false);
      router.replace('/'); 
      return;
    }

    if (isAuthenticated) {
      if (authBillId === null) {
        // Still waiting for authBillId from context to propagate.
        // isPageLoading remains true.
        return;
      }
      if (authBillId !== billIdFromUrl) {
        // Authenticated for a different bill
        logout(); // Log out of current session
        router.replace(tableId ? `/${tableId}` : '/');
        return;
      }
      // Authenticated for the correct bill (authBillId === billIdFromUrl)
      // Now check context for bill status
      if (!isLoadingBillStatus) {
        // If bill status is loaded from context
        setIsPageLoading(false); // Ready to display page based on currentBillPaymentStatus
      } else {
        // Bill status is currently loading from context, wait.
        // isPageLoading remains true.
      }
      // If currentBillPaymentStatus is null and not loading, try fetching
      if (currentBillPaymentStatus === null && !isLoadingBillStatus) {
        fetchAndSetBillStatus(billIdFromUrl);
      }

    } else { // Not authenticated
      setIsPageLoading(false); // Stop local loading
      router.replace(tableId ? `/${tableId}` : '/'); // Redirect to table page or home
    }
  }, [
    isAuthenticated, 
    authBillId, 
    billIdFromUrl, 
    router, 
    logout, 
    tableId,
    currentBillPaymentStatus,
    isLoadingBillStatus,
    fetchAndSetBillStatus
  ]);


  const handleExit = () => {
    logout();
    if (tableId) {
      router.push(`/${tableId}`);
    } else {
      const derivedTableId = billIdFromUrl?.split('-')[2]; 
      router.push(derivedTableId ? `/${derivedTableId}` : '/');
    }
  };

  const handleMarkAsPaid = async () => {
    if (billIdFromUrl) {
      await setPaymentStatusForBill(billIdFromUrl, 'Completed');
      // The context update should trigger a re-render with the "Completed" view
    }
  };

  if (isPageLoading || (isAuthenticated && authBillId === billIdFromUrl && isLoadingBillStatus)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading bill status...</p>
      </div>
    );
  }

  if (!isAuthenticated || !billIdFromUrl || (authBillId && billIdFromUrl !== authBillId)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Access Denied or Session Invalid</h1>
        <p className="text-muted-foreground mb-6">You are not authorized to view this bill's status, it is invalid, or your session has changed.</p>
        <Button onClick={() => router.push(tableId ? `/${tableId}` : '/')}>Go to Menu</Button>
      </div>
    );
  }

  if (currentBillPaymentStatus === 'Completed') {
    return (
      <div className="max-w-md mx-auto py-8 sm:py-12">
        <Card className="shadow-xl text-center">
          <CardHeader>
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <CardTitle className="text-3xl">Payment Completed!</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-lg">
              Thanks for choosing The Tasty Spoon!
            </CardDescription>
            <p className="text-muted-foreground mt-1">We hope to see you again soon.</p>
          </CardContent>
          <CardFooter className="flex justify-center pt-6">
            <Button onClick={handleExit} className="text-lg py-6">
              <LogOutIcon className="mr-2 h-5 w-5" /> Exit
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Default to Pending status view
  return (
    <div className="max-w-md mx-auto py-8 sm:py-12">
      <Card className="shadow-xl text-center">
        <CardHeader>
          <Clock className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
          <CardTitle className="text-3xl">Bill Requested</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-lg">
            Your bill has been requested. A waiter will be with you shortly.
          </CardDescription>
          <p className="text-muted-foreground mt-2">Current Payment Status: <span className="font-semibold">{currentBillPaymentStatus || 'Pending'}</span></p>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-3 pt-6">
          {process.env.NODE_ENV === 'development' && (
            <Button onClick={handleMarkAsPaid} variant="secondary" className="w-full">
              (Dev: Mark Bill as Paid)
            </Button>
          )}
           <Button onClick={() => router.push(tableId ? `/${tableId}` : '/')} variant="outline" className="w-full">
              Back to Menu
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
