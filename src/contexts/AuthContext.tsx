
"use client";

import type { ReactNode } from "react";
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';

type PaymentStatus = 'Pending' | 'Completed';

interface AuthState {
  // isAuthenticated, tableId, phoneNumber, billId will now primarily come from NextAuth session
  currentBillPaymentStatus: PaymentStatus | null;
  isLoadingBillStatus: boolean;
  // Keep a local loading state for the AuthContext itself, e.g. when transitioning or waiting for session
  isContextLoading: boolean; 
}

interface AuthContextType extends AuthState {
  // login is effectively handled by NextAuth's signIn, so we remove it from here.
  // onLoginSuccess in LoginFlow can trigger any necessary context updates.
  logout: () => void; // This will now call NextAuth's signOut
  setPaymentStatusForBill: (billId: string, status: PaymentStatus) => Promise<void>;
  fetchAndSetBillStatus: (billId: string) => Promise<void>;
  // Expose derived auth state for convenience, though direct useSession is preferred for primary auth checks
  isAuthenticated: boolean;
  tableId: string | null;
  phoneNumber: string | null;
  billId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const initialState: AuthState = {
  currentBillPaymentStatus: null,
  isLoadingBillStatus: false,
  isContextLoading: true, // Initially true until session is checked
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { data: session, status: sessionStatus } = useSession();
  const [authState, setAuthState] = useState<AuthState>(initialState);

  const billIdFromSession = session?.user?.billId || null;

  useEffect(() => {
    if (sessionStatus === 'loading') {
      setAuthState(prev => ({ ...prev, isContextLoading: true }));
      return;
    }
    // Session loaded (authenticated or unauthenticated)
    setAuthState(prev => ({ ...prev, isContextLoading: false }));

    if (sessionStatus === 'authenticated' && billIdFromSession) {
      // If authenticated and billId exists, fetch its status
      // Check if billId has changed or if status is null to avoid redundant fetches
      if (billIdFromSession !== authState.billId || authState.currentBillPaymentStatus === null) {
         fetchAndSetBillStatus(billIdFromSession);
      }
    } else if (sessionStatus === 'unauthenticated') {
      // Clear bill status if user is unauthenticated
      setAuthState(prev => ({ 
        ...prev, 
        currentBillPaymentStatus: null, 
        isLoadingBillStatus: false,
        // Reset other derived states
        isAuthenticated: false,
        tableId: null,
        phoneNumber: null,
        billId: null,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, billIdFromSession]); // Removed authState from deps to avoid loop, billIdFromSession handles the trigger


  const fetchAndSetBillStatus = useCallback(async (billIdToFetch: string) => {
    if (!billIdToFetch) return;
    setAuthState(prevState => ({ ...prevState, isLoadingBillStatus: true }));
    try {
      const response = await fetch(`/api/bills/${billIdToFetch}/status`);
      if (!response.ok) {
        if (response.status === 404) {
            setAuthState(prevState => ({
            ...prevState,
            currentBillPaymentStatus: 'Pending', 
            isLoadingBillStatus: false,
          }));
          return;
        }
        throw new Error(`Failed to fetch bill status: ${response.statusText}`);
      }
      const data = await response.json();
      setAuthState(prevState => ({
        ...prevState,
        currentBillPaymentStatus: data.paymentStatus,
        isLoadingBillStatus: false,
      }));
    } catch (error) {
      console.error("Error fetching bill status:", error);
      setAuthState(prevState => ({
        ...prevState,
        currentBillPaymentStatus: 'Pending', 
        isLoadingBillStatus: false,
      }));
    }
  }, []);

  const logout = useCallback(async () => {
    await nextAuthSignOut({ redirect: false }); // Perform NextAuth sign out
    // State update for AuthContext will be handled by the useEffect watching sessionStatus
    // No need to manually setAuthState to initialState here.
    // router.push('/') could be called here if a redirect is always desired post-logout
  }, []);

  const setPaymentStatusForBill = useCallback(async (billIdToUpdate: string, status: PaymentStatus) => {
    // Ensure this only happens if the billIdToUpdate matches the one in session, or handle accordingly.
    if (billIdFromSession !== billIdToUpdate) {
        console.warn("Attempting to update status for a bill not in current session.");
        // return; // Or allow if admin/different logic
    }
    try {
      const response = await fetch(`/api/bills/${billIdToUpdate}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update bill status: ${response.statusText}`);
      }
      const data = await response.json();
      // Only update context state if it's for the currently relevant bill
      if (billIdFromSession === billIdToUpdate) {
        setAuthState(prevState => ({
          ...prevState,
          currentBillPaymentStatus: data.paymentStatus,
        }));
      }
    } catch (error) {
      console.error("Error setting bill status:", error);
    }
  }, [billIdFromSession]);

  // Derive auth state from NextAuth session
  const isAuthenticated = sessionStatus === 'authenticated';
  const tableId = session?.user?.tableId || null;
  const phoneNumber = session?.user?.phoneNumber || null;
  // billId is already billIdFromSession

  return (
    <AuthContext.Provider value={{ 
      ...authState, 
      logout, 
      setPaymentStatusForBill, 
      fetchAndSetBillStatus,
      isAuthenticated,
      tableId,
      phoneNumber,
      billId: billIdFromSession 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
