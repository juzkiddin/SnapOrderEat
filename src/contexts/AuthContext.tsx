
"use client";

import type { ReactNode } from "react";
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSession, signOut as nextAuthSignOut, update as updateNextAuthSession } from 'next-auth/react';

// As per the new API documentation
type PaymentStatusFromApi = "Pending" | "Confirmed" | "Failed" | "Expired" | "NotCompleted";
type SessionStatusFromApi = "Active" | "Expired" | "Completed";

interface ExternalSessionData {
  sessionId: string;
  billId: string;
  paymentStatus: PaymentStatusFromApi;
}

interface ExternalSessionError {
  sessionStatus: "Expired"; // Only "Expired" is a non-error status that needs special handling
  message?: string; // Optional: for other errors
}

interface AuthContextType {
  // Derived from NextAuth session primarily
  isAuthenticated: boolean;
  sessionId: string | null;
  billId: string | null;
  tableId: string | null;
  phoneNumber: string | null;
  currentPaymentStatus: PaymentStatusFromApi | null;

  // Context-specific state
  isAuthContextLoading: boolean; // Loading state for context operations like external API calls
  externalSessionError: string | null; // For messages like "Your previous session has expired."

  // Functions
  createOrVerifyExternalSession: (mobileNum: string, tableId: string) => Promise<ExternalSessionData | ExternalSessionError | null>;
  confirmPaymentExternal: (sessionId: string) => Promise<boolean>; // Returns true on success
  logout: () => Promise<void>;
  clearExternalSessionError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const EXTERNAL_API_BASE_URL = "https://catalogue.snapordereat.in";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { data: session, status: sessionStatus, update: nextAuthUpdate } = useSession();
  const [isAuthContextLoading, setIsAuthContextLoading] = useState<boolean>(false);
  const [externalSessionError, setExternalSessionError] = useState<string | null>(null);

  const restaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID; // Use NEXT_PUBLIC_ for client-side access

  const clearExternalSessionError = useCallback(() => {
    setExternalSessionError(null);
  }, []);

  const createOrVerifyExternalSession = useCallback(async (mobileNum: string, tableId: string): Promise<ExternalSessionData | ExternalSessionError | null> => {
    if (!restaurantId) {
      console.error("[AuthContext] RESTAURANT_ID is not set. Cannot create/verify session.");
      setExternalSessionError("Restaurant configuration error. Please try again later.");
      return null;
    }
    setIsAuthContextLoading(true);
    setExternalSessionError(null);
    try {
      const response = await fetch(`${EXTERNAL_API_BASE_URL}/session/createsession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNum, restaurantId, tableId }),
      });

      const data = await response.json();

      if (!response.ok) {
        // For 400 or 500 errors from the external API
        throw new Error(data.message || `Failed to create/verify session. Status: ${response.status}`);
      }

      if (data.sessionStatus === "Expired") {
        setExternalSessionError("Your previous session has expired. Please start a new one.");
        return { sessionStatus: "Expired" };
      }

      if (data.sessionId && data.billId && data.paymentStatus) {
        // Successfully got an active session
        return {
          sessionId: data.sessionId,
          billId: data.billId,
          paymentStatus: data.paymentStatus as PaymentStatusFromApi,
        };
      }
      // Should not happen if API conforms to spec, but as a fallback
      throw new Error("Invalid session data received from server.");

    } catch (error: any) {
      console.error("[AuthContext] Error in createOrVerifyExternalSession:", error);
      setExternalSessionError(error.message || "Could not connect to session service.");
      return null;
    } finally {
      setIsAuthContextLoading(false);
    }
  }, [restaurantId]);

  const confirmPaymentExternal = useCallback(async (sessionIdToConfirm: string): Promise<boolean> => {
    if (!sessionIdToConfirm) {
      console.error("[AuthContext] Session ID is required to confirm payment.");
      // Potentially set an error to display via toast elsewhere
      return false;
    }
    setIsAuthContextLoading(true);
    try {
      const response = await fetch('/api/session/confirm-payment', { // Calls our internal Next.js API route
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdToConfirm }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || `Failed to confirm payment. Status: ${response.status}`);
      }

      // If payment is confirmed successfully by the external API (via our internal route)
      // Update NextAuth session to reflect the new payment status
      await nextAuthUpdate({ paymentStatus: data.paymentStatus || "Confirmed" });
      
      console.log("[AuthContext] Payment confirmed, session paymentStatus updated:", data.paymentStatus);
      return true;

    } catch (error: any) {
      console.error("[AuthContext] Error in confirmPaymentExternal:", error);
      // Display this error via toast in the calling component (CheckoutPage)
      throw error; // Re-throw to be caught by CheckoutPage
    } finally {
      setIsAuthContextLoading(false);
    }
  }, [nextAuthUpdate]);

  const logout = useCallback(async () => {
    setIsAuthContextLoading(true);
    setExternalSessionError(null);
    await nextAuthSignOut({ redirect: false });
    // Session state in context will automatically update via useSession hook
    setIsAuthContextLoading(false);
  }, []);
  
  // Derived state from NextAuth session
  const isAuthenticated = sessionStatus === 'authenticated';
  const currentSession = session?.user;

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      sessionId: currentSession?.sessionId || null,
      billId: currentSession?.billId || null,
      tableId: currentSession?.tableId || null,
      phoneNumber: currentSession?.phoneNumber || null,
      currentPaymentStatus: currentSession?.paymentStatus as PaymentStatusFromApi || null,
      isAuthContextLoading: isAuthContextLoading || sessionStatus === 'loading',
      externalSessionError,
      createOrVerifyExternalSession,
      confirmPaymentExternal,
      logout,
      clearExternalSessionError,
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
