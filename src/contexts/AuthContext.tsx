
"use client";

import type { ReactNode } from "react";
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';

type PaymentStatusFromApi = "Pending" | "Confirmed" | "Failed" | "Expired" | "NotCompleted";
type SessionStatusFromApi = "Active" | "Expired" | "Completed";

interface ExternalSessionData {
  sessionId: string;
  billId: string;
  paymentStatus: PaymentStatusFromApi;
}

interface ExternalSessionErrorResponse {
  sessionStatus: "Expired" | "Completed";
  message?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  sessionId: string | null;
  billId: string | null;
  tableId: string | null;
  phoneNumber: string | null;
  currentPaymentStatus: PaymentStatusFromApi | null;
  isAuthContextLoading: boolean;
  isSessionValidationLoading: boolean; // Expose this for more granular control if needed
  externalSessionError: string | null;
  createOrVerifyExternalSession: (mobileNum: string, tableId: string) => Promise<ExternalSessionData | ExternalSessionErrorResponse | null>;
  confirmPaymentExternal: (sessionId: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearExternalSessionError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const EXTERNAL_API_BASE_URL = "https://catalogue.snapordereat.in";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { data: session, status: sessionStatus, update: nextAuthUpdate } = useSession();
  const [isAuthContextLoadingInternal, setIsAuthContextLoadingInternal] = useState<boolean>(false);
  const [externalSessionError, setExternalSessionError] = useState<string | null>(null);
  const [isSessionValidationLoading, setIsSessionValidationLoading] = useState<boolean>(false);
  const [validateCurrentSessionTrigger, setValidateCurrentSessionTrigger] = useState(0);

  const restaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID;

  const clearExternalSessionError = useCallback(() => {
    setExternalSessionError(null);
  }, []);

  const logout = useCallback(async () => {
    console.log('[AuthContext] logout called.');
    setIsAuthContextLoadingInternal(true); // Prevent other actions during logout
    setExternalSessionError(null);
    setIsSessionValidationLoading(false); // Reset validation loading on logout
    console.log('[AuthContext] Calling nextAuthSignOut...');
    await nextAuthSignOut({ redirect: false });
    console.log('[AuthContext] nextAuthSignOut finished.');
    // Session state in context will automatically update via useSession hook
    setIsAuthContextLoadingInternal(false);
  }, []);

  const createOrVerifyExternalSession = useCallback(async (mobileNum: string, tableId: string): Promise<ExternalSessionData | ExternalSessionErrorResponse | null> => {
    if (!restaurantId) {
      console.error("[AuthContext] createOrVerifyExternalSession: NEXT_PUBLIC_RESTAURANT_ID is not set.");
      setExternalSessionError("Restaurant configuration error. Please try again later.");
      return null;
    }
    setIsAuthContextLoadingInternal(true);
    setExternalSessionError(null);
    console.log(`[AuthContext] createOrVerifyExternalSession called with mobile: ${mobileNum}, tableId: ${tableId}, restaurantId: ${restaurantId}`);
    try {
      const response = await fetch(`${EXTERNAL_API_BASE_URL}/session/createsession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNum, restaurantId, tableId }),
      });
      const data = await response.json();
      console.log('[AuthContext] createOrVerifyExternalSession - External API response status:', response.status, 'Data:', data);

      if (!response.ok) {
        throw new Error(data.message || `Failed to create/verify session. Status: ${response.status}`);
      }
      if (data.sessionStatus === "Expired") {
        console.log('[AuthContext] createOrVerifyExternalSession: Received "Expired" session status.');
        setExternalSessionError("Your previous session has expired. Please start a new one.");
        return { sessionStatus: "Expired" };
      }
      if (data.sessionId && data.billId && data.paymentStatus) {
        console.log('[AuthContext] createOrVerifyExternalSession: Active session data received:', data);
        return { sessionId: data.sessionId, billId: data.billId, paymentStatus: data.paymentStatus as PaymentStatusFromApi };
      }
      throw new Error("Invalid session data received from server during create/verify.");
    } catch (error: any) {
      console.error("[AuthContext] Error in createOrVerifyExternalSession:", error);
      setExternalSessionError(error.message || "Could not connect to session service.");
      return null;
    } finally {
      setIsAuthContextLoadingInternal(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.sessionId) {
      console.log('[AuthContext] Session became authenticated, queueing validation for sessionId:', session.user.sessionId, 'Current trigger:', validateCurrentSessionTrigger);
      // Increment trigger only if it hasn't been triggered for this specific session instance yet,
      // or if session ID changes. For simplicity, let's trigger if not currently validating.
      // This check primarily prevents re-validation if other deps of the main validation effect change.
      // The actual validation will only run if isSessionValidationLoading is false.
      setValidateCurrentSessionTrigger(prev => prev + 1);
    } else if (sessionStatus === 'unauthenticated') {
        setValidateCurrentSessionTrigger(0); // Reset trigger if unauthenticated
        setIsSessionValidationLoading(false); // Ensure validation stops if logged out
    }
  }, [sessionStatus, session?.user?.sessionId]);

  useEffect(() => {
    const validate = async () => {
      if (!session?.user?.sessionId || !session.user.tableId) {
        console.log('[AuthContext] validate: Missing sessionId or tableId in session. Aborting validation.', session?.user);
        setIsSessionValidationLoading(false); // Ensure loading state is reset
        return;
      }
      // This client-side restaurantId is for constructing the call, but the API route uses its own server-side version
      if (!restaurantId) { // Check NEXT_PUBLIC_RESTAURANT_ID for client call setup
        console.error("[AuthContext] validate: NEXT_PUBLIC_RESTAURANT_ID is not set on client. Cannot construct validation call.");
        setExternalSessionError("Client restaurant configuration error for session validation. Please contact support.");
        setIsSessionValidationLoading(false);
        await logout(); // Critical: logout if config is missing
        return;
      }

      console.log(`[AuthContext] validate: Attempting to validate session. SessionID: ${session.user.sessionId}, TableID: ${session.user.tableId}`);
      setIsSessionValidationLoading(true);
      setExternalSessionError(null);

      try {
        const validationResponse = await fetch('/api/session/check-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.user.sessionId, tableId: session.user.tableId }),
        });

        console.log('[AuthContext] validate: Raw response from /api/session/check-status:', validationResponse.status);

        if (!validationResponse.ok) {
          const errorData = await validationResponse.json().catch(() => ({ message: `Session validation failed. Status: ${validationResponse.status}. Non-JSON response.` }));
          console.error('[AuthContext] validate: Session status check API call failed:', validationResponse.status, errorData);
          setExternalSessionError(errorData.message || `Session validation failed (status ${validationResponse.status}). Please log in again.`);
          await logout();
          return;
        }

        const validationData = await validationResponse.json();
        console.log('[AuthContext] validate: Parsed validation data from /api/session/check-status:', validationData);

        if (validationData.sessionStatus === "Active") {
          console.log('[AuthContext] validate: Session is "Active".');
          setExternalSessionError(null); // Clear any previous error
        } else if (validationData.sessionStatus === "Expired") {
          console.log('[AuthContext] validate: Session is "Expired". Setting error and logging out.');
          setExternalSessionError("Your session has expired. Please log in again.");
          await logout();
        } else if (validationData.sessionStatus === "Completed") {
          console.log('[AuthContext] validate: Session is "Completed". Setting error and logging out.');
          setExternalSessionError("This session is already completed. Please start a new one.");
          await logout();
        } else {
          console.warn('[AuthContext] validate: Unknown session status received:', validationData.sessionStatus, ". Treating as error.");
          setExternalSessionError(`Unknown session status: ${validationData.sessionStatus}. Please log in again.`);
          await logout();
        }
      } catch (error: any) {
        console.error('[AuthContext] validate: Network or parsing error during session status check:', error);
        setExternalSessionError("Error validating session. Please try logging in again.");
        await logout();
      } finally {
        console.log('[AuthContext] validate: Finished validation attempt.');
        setIsSessionValidationLoading(false);
      }
    };

    if (sessionStatus === 'authenticated' && session?.user?.sessionId && session?.user?.tableId && !isSessionValidationLoading && validateCurrentSessionTrigger > 0) {
      console.log(`[AuthContext] validateCurrentSession effect running. Trigger: ${validateCurrentSessionTrigger}, SessionID: ${session.user.sessionId}`);
      validate();
    } else if (validateCurrentSessionTrigger > 0 && sessionStatus === 'authenticated' && (!session?.user?.sessionId || !session?.user?.tableId)) {
        console.log('[AuthContext] validateCurrentSession effect: Authenticated, but session details missing. Resetting trigger.');
        // This case might happen if session object is not fully populated yet.
        // Resetting trigger will allow re-validation when details arrive.
        // Or, if it's a bad session state, subsequent checks should catch it.
        setValidateCurrentSessionTrigger(0); // Reset to allow re-triggering if session details populate
        setIsSessionValidationLoading(false);
    } else if (sessionStatus !== 'authenticated' && isSessionValidationLoading) {
        console.log('[AuthContext] validateCurrentSession effect: No longer authenticated, but validation was in progress. Resetting loading state.');
        setIsSessionValidationLoading(false); // Ensure loading stops if user logs out during validation
    }

  }, [sessionStatus, session, restaurantId, isSessionValidationLoading, validateCurrentSessionTrigger, logout]);


  const confirmPaymentExternal = useCallback(async (sessionIdToConfirm: string): Promise<boolean> => {
    if (!sessionIdToConfirm) {
      console.error("[AuthContext] confirmPaymentExternal: Session ID is required.");
      throw new Error("Session ID is required to confirm payment.");
    }
    setIsAuthContextLoadingInternal(true);
    console.log(`[AuthContext] confirmPaymentExternal called for sessionId: ${sessionIdToConfirm}`);
    try {
      const response = await fetch('/api/session/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdToConfirm }),
      });
      const data = await response.json();
      console.log('[AuthContext] confirmPaymentExternal - Response from /api/session/confirm-payment:', response.status, data);

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || `Failed to confirm payment. Status: ${response.status}`);
      }
      await nextAuthUpdate({ paymentStatus: data.paymentStatus || "Confirmed" });
      console.log("[AuthContext] Payment confirmed, NextAuth session paymentStatus updated to:", data.paymentStatus);
      return true;
    } catch (error: any) {
      console.error("[AuthContext] Error in confirmPaymentExternal:", error);
      throw error;
    } finally {
      setIsAuthContextLoadingInternal(false);
    }
  }, [nextAuthUpdate]);

  const isAuthenticated = sessionStatus === 'authenticated';
  const currentSessionUser = session?.user;

  // Memoize complex loading state
  const finalIsAuthContextLoading = useMemo(() => {
    // Loading if NextAuth is loading AND we haven't even tried our validation (trigger is 0 or session not authenticated)
    // OR if our specific session validation IS currently in progress.
    const nextAuthInitialLoading = sessionStatus === 'loading';
    console.log(`[AuthContext] Calculating finalIsAuthContextLoading: nextAuthInitialLoading=${nextAuthInitialLoading}, isSessionValidationLoading=${isSessionValidationLoading}, isAuthContextLoadingInternal=${isAuthContextLoadingInternal}`);
    return nextAuthInitialLoading || isSessionValidationLoading || isAuthContextLoadingInternal;
  }, [sessionStatus, isSessionValidationLoading, isAuthContextLoadingInternal]);


  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      sessionId: currentSessionUser?.sessionId || null,
      billId: currentSessionUser?.billId || null,
      tableId: currentSessionUser?.tableId || null,
      phoneNumber: currentSessionUser?.phoneNumber || null,
      currentPaymentStatus: currentSessionUser?.paymentStatus as PaymentStatusFromApi || null,
      isAuthContextLoading: finalIsAuthContextLoading,
      isSessionValidationLoading, // expose for potential fine-grained UI control
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
