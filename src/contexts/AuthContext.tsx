
"use client";

import type { ReactNode } from "react";
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
  isSessionValidationLoading: boolean; // Exposed for clarity, though primarily used internally
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

  const restaurantIdFromEnv = process.env.NEXT_PUBLIC_RESTAURANT_ID; 
  const isLoggingOutRef = useRef(false);


  const clearExternalSessionError = useCallback(() => {
    setExternalSessionError(null);
  }, []);

  const logout = useCallback(async () => {
    if (isLoggingOutRef.current) {
      console.log('[AuthContext] logout: Already in progress, skipping.');
      return;
    }
    isLoggingOutRef.current = true;
    console.log('[AuthContext] logout called.');
    setIsAuthContextLoadingInternal(true); 
    setExternalSessionError(null); // Clear any errors on logout
    try {
      console.log('[AuthContext] Calling nextAuthSignOut...');
      await nextAuthSignOut({ redirect: false });
      console.log('[AuthContext] nextAuthSignOut finished.');
      // Session status will change via useSession, triggering effects
    } catch (e) {
      console.error("[AuthContext] Error during nextAuthSignOut:", e);
      setExternalSessionError("Failed to log out. Please try again.");
    } finally {
      console.log('[AuthContext] logout: Finalizing logout process.');
      setIsSessionValidationLoading(false); 
      setValidateCurrentSessionTrigger(0); 
      setIsAuthContextLoadingInternal(false); 
      isLoggingOutRef.current = false;
    }
  }, []); 

  const createOrVerifyExternalSession = useCallback(async (mobileNum: string, tableId: string): Promise<ExternalSessionData | ExternalSessionErrorResponse | null> => {
    if (!restaurantIdFromEnv) {
      console.error("[AuthContext] createOrVerifyExternalSession: NEXT_PUBLIC_RESTAURANT_ID is not set.");
      setExternalSessionError("Restaurant configuration error. Please try again later.");
      return null;
    }
    setIsAuthContextLoadingInternal(true);
    setExternalSessionError(null);
    console.log(`[AuthContext] createOrVerifyExternalSession called with mobile: ${mobileNum}, tableId: ${tableId}, restaurantId: ${restaurantIdFromEnv}`);
    try {
      const response = await fetch(`${EXTERNAL_API_BASE_URL}/session/createsession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNum, restaurantId: restaurantIdFromEnv, tableId }),
      });
      const data = await response.json();
      console.log('[AuthContext] createOrVerifyExternalSession - External API response status:', response.status, 'Data:', data);

      if (!response.ok) {
        throw new Error(data.message || `Failed to create/verify session. Status: ${response.status}`);
      }
      if (data.sessionStatus === "Expired") {
        console.log('[AuthContext] createOrVerifyExternalSession: Received "Expired" session status.');
        setExternalSessionError("Your previous session has expired. Please start a new one.");
        return { sessionStatus: "Expired", message: "Your previous session has expired. Please start a new one." };
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
  }, [restaurantIdFromEnv]);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.sessionId) {
      console.log("[AuthContext] Session authenticated, triggering validation.");
      setValidateCurrentSessionTrigger(prev => prev + 1);
    } else if (sessionStatus === 'unauthenticated') {
        console.log("[AuthContext] Session unauthenticated, resetting validation trigger and loading state.");
        setValidateCurrentSessionTrigger(0);
        setIsSessionValidationLoading(false);
        // If we just logged out due to an external error, keep the error message.
        // If it's a fresh unauthenticated state, clearExternalSessionError might be called by login flow if needed.
    }
  }, [sessionStatus, session?.user?.sessionId]);

  useEffect(() => {
    const validate = async () => {
      if (isLoggingOutRef.current) {
        console.log('[AuthContext] validate: Logout in progress, aborting validation.');
        setIsSessionValidationLoading(false);
        return;
      }

      if (!session?.user?.sessionId || !session.user.tableId) {
        console.log('[AuthContext] validate: Missing sessionId or tableId in current NextAuth session. Aborting validation.', session?.user);
        setExternalSessionError("Session details missing. Please log in again.");
        setIsSessionValidationLoading(false);
        if (!isLoggingOutRef.current) logout();
        return;
      }
      if (!restaurantIdFromEnv) { 
        console.error("[AuthContext] validate: NEXT_PUBLIC_RESTAURANT_ID is not set. Cannot validate.");
        setExternalSessionError("Client restaurant configuration error for session validation.");
        setIsSessionValidationLoading(false);
        if (!isLoggingOutRef.current) logout();
        return;
      }

      console.log(`[AuthContext] validate: Attempting to validate session. SessionID: ${session.user.sessionId}, TableID: ${session.user.tableId}`);
      setIsSessionValidationLoading(true);
      setExternalSessionError(null); 

      try {
        const validationResponse = await fetch('/api/session/check-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.user.sessionId, tableId: session.user.tableId, restaurantId: restaurantIdFromEnv }),
        });

        console.log('[AuthContext] validate: Raw response from /api/session/check-status:', validationResponse.status);

        if (!validationResponse.ok) {
          const errorStatus = validationResponse.status;
          let parsedErrorData: any = {};
          try {
            parsedErrorData = await validationResponse.json();
          } catch (e) {
            console.warn(`[AuthContext] validate: Could not parse JSON from ${errorStatus} error response.`);
            parsedErrorData.message = `Session validation failed. Status: ${errorStatus}. Response not valid JSON.`;
          }
          const errorMessage = parsedErrorData.message || parsedErrorData.error || `Session validation failed (status ${errorStatus}). Please log in again.`;
          console.error('[AuthContext] validate: Session status check API call failed:', errorStatus, parsedErrorData);
          setExternalSessionError(errorMessage);
          setIsSessionValidationLoading(false); 
          if (!isLoggingOutRef.current) logout(); 
          return; 
        }

        const validationData = await validationResponse.json();
        console.log('[AuthContext] validate: Parsed validation data from /api/session/check-status:', validationData);

        if (validationData.sessionStatus === "Active") {
          console.log('[AuthContext] validate: Session is "Active".');
          setExternalSessionError(null);
        } else if (validationData.sessionStatus === "Expired") {
          console.log('[AuthContext] validate: Session is "Expired". Setting error and initiating logout.');
          setExternalSessionError("Your session has expired. Please log in again.");
          setIsSessionValidationLoading(false);
          if (!isLoggingOutRef.current) logout();
          return;
        } else if (validationData.sessionStatus === "Completed") {
          console.log('[AuthContext] validate: Session is "Completed". Setting error and initiating logout.');
          setExternalSessionError("This session is already completed. Please start a new one.");
          setIsSessionValidationLoading(false);
          if (!isLoggingOutRef.current) logout();
          return;
        } else {
          console.warn('[AuthContext] validate: Unknown session status received:', validationData.sessionStatus, ". Treating as error.");
          setExternalSessionError(`Unknown session status: ${validationData.sessionStatus}. Please log in again.`);
          setIsSessionValidationLoading(false);
          if (!isLoggingOutRef.current) logout();
          return;
        }
      } catch (error: any) {
        console.error('[AuthContext] validate: Network or parsing error during session status check:', error);
        setExternalSessionError("Error validating session. Please try logging in again.");
        setIsSessionValidationLoading(false);
        if (!isLoggingOutRef.current) logout();
        return;
      } finally {
        console.log('[AuthContext] validate: Finished validation attempt. Setting isSessionValidationLoading to false if not already.');
        // Ensure it's set to false if no early return happened, though early returns should cover it.
        if (isSessionValidationLoading) setIsSessionValidationLoading(false);
      }
    };

    if (sessionStatus === 'authenticated' && session?.user?.sessionId && session?.user?.tableId && !isSessionValidationLoading && validateCurrentSessionTrigger > 0 && !isLoggingOutRef.current) {
      console.log(`[AuthContext] validateCurrentSession effect running. Trigger: ${validateCurrentSessionTrigger}, SessionID: ${session.user.sessionId}`);
      validate().catch(err => { 
        console.error("[AuthContext] Unhandled error from validate() promise chain:", err);
        if (!isLoggingOutRef.current && !externalSessionError) { 
            setExternalSessionError("An unexpected error occurred during session validation. Please log in.");
        }
        setIsSessionValidationLoading(false);
        if (!isLoggingOutRef.current) {
            logout().catch(logoutErr => console.error("[AuthContext] Error during fallback logout from validate .catch:", logoutErr));
        }
      });
    } else if (validateCurrentSessionTrigger > 0 && sessionStatus === 'authenticated' && (!session?.user?.sessionId || !session?.user?.tableId) && !isLoggingOutRef.current) {
        console.log('[AuthContext] validateCurrentSession effect: Authenticated, but session details missing. Resetting trigger & logging out.');
        setExternalSessionError("Session details missing. Please log in again.");
        setIsSessionValidationLoading(false); 
        logout(); 
        setValidateCurrentSessionTrigger(0);
    } else if (sessionStatus !== 'authenticated' && isSessionValidationLoading) {
        console.log('[AuthContext] validateCurrentSession effect: No longer authenticated, but validation was in progress. Resetting loading state.');
        setIsSessionValidationLoading(false);
    }
  }, [sessionStatus, session, isSessionValidationLoading, validateCurrentSessionTrigger, logout, restaurantIdFromEnv]);


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

  const finalIsAuthenticated = sessionStatus === 'authenticated' && !externalSessionError;

  const finalIsAuthContextLoading = useMemo(() => {
    const nextAuthStillLoading = sessionStatus === 'loading';
    console.log(`[AuthContext] Calculating finalIsAuthContextLoading: nextAuthInitialLoading=${nextAuthStillLoading}, isSessionValidationLoading=${isSessionValidationLoading}, isAuthContextLoadingInternal=${isAuthContextLoadingInternal}`);
    return nextAuthStillLoading || isSessionValidationLoading || isAuthContextLoadingInternal;
  }, [sessionStatus, isSessionValidationLoading, isAuthContextLoadingInternal]);

  const currentSessionUser = session?.user;

  return (
    <AuthContext.Provider value={{
      isAuthenticated: finalIsAuthenticated,
      sessionId: currentSessionUser?.sessionId || null,
      billId: currentSessionUser?.billId || null,
      tableId: currentSessionUser?.tableId || null,
      phoneNumber: currentSessionUser?.phoneNumber || null,
      currentPaymentStatus: currentSessionUser?.paymentStatus as PaymentStatusFromApi || null,
      isAuthContextLoading: finalIsAuthContextLoading,
      isSessionValidationLoading,
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

    