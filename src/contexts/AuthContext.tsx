
"use client";

import type { ReactNode } from "react";
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';

type PaymentStatusFromApi = "Pending" | "Confirmed" | "Failed" | "Expired" | "NotCompleted" | null;
type SessionStatusFromApi = "Active" | "Expired" | "Completed" | "NotFound" | null;

interface ExternalSessionData {
  sessionId: string;
  billId: string;
  paymentStatus: PaymentStatusFromApi;
}

interface ExternalSessionErrorResponse {
  sessionStatus: Exclude<SessionStatusFromApi, "Active" | null>;
  message?: string;
  paymentStatus?: PaymentStatusFromApi;
}

interface CheckSessionStatusResult {
    success: boolean;
    sessionStatus: SessionStatusFromApi;
    paymentStatus: PaymentStatusFromApi;
    message?: string;
    error?: string;
    details?: any;
}


interface AuthContextType {
  isAuthenticated: boolean;
  sessionId: string | null;
  billId: string | null;
  tableId: string | null;
  phoneNumber: string | null;
  currentPaymentStatus: PaymentStatusFromApi | null;
  isAuthContextLoading: boolean;
  isSessionValidationLoading: boolean; 
  externalSessionError: string | null;
  hasExplicitlyRequestedBill: boolean;
  setHasExplicitlyRequestedBill: (value: boolean) => void;
  createOrVerifyExternalSession: (mobileNum: string, tableId: string) => Promise<ExternalSessionData | ExternalSessionErrorResponse | null>;
  confirmPaymentExternal: (sessionId: string) => Promise<boolean>;
  checkAndUpdateSessionStatus: (sessionIdToCheck: string, tableIdToCheck: string) => Promise<CheckSessionStatusResult | null>;
  logout: () => void;
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
  const [hasExplicitlyRequestedBill, setHasExplicitlyRequestedBill] = useState<boolean>(false);

  const clientRestaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID;
  const isLoggingOutRef = useRef(false);
  const prevSessionIdRef = useRef<string | null | undefined>(null); 

  const clearExternalSessionError = useCallback(() => {
    setExternalSessionError(null);
  }, []);

  const logout = useCallback(async () => {
    if (isLoggingOutRef.current) {
      // console.log('[AuthContext] logout: Already in progress, skipping.');
      return;
    }
    isLoggingOutRef.current = true;
    // console.log('[AuthContext] logout called. Resetting states and signing out.');

    setExternalSessionError(null); 
    setHasExplicitlyRequestedBill(false); 
    
    try {
      await nextAuthSignOut({ redirect: false });
      // console.log('[AuthContext] nextAuthSignOut finished successfully.');
    } catch (e) {
      console.error("[AuthContext] Error during nextAuthSignOut:", e);
      setExternalSessionError("Failed to log out properly. Please refresh or try again.");
    } finally {
      // console.log('[AuthContext] logout: Finalizing logout process.');
      isLoggingOutRef.current = false;
      setIsAuthContextLoadingInternal(false); 
      setIsSessionValidationLoading(false);
      setValidateCurrentSessionTrigger(0); 
      prevSessionIdRef.current = null; 
    }
  }, []);


  const createOrVerifyExternalSession = useCallback(async (mobileNum: string, tableId: string): Promise<ExternalSessionData | ExternalSessionErrorResponse | null> => {
    if (!clientRestaurantId) {
      console.error("[AuthContext] createOrVerifyExternalSession: NEXT_PUBLIC_RESTAURANT_ID is not set.");
      setExternalSessionError("Restaurant configuration error. Please try again later.");
      return null;
    }
    setIsAuthContextLoadingInternal(true);
    setExternalSessionError(null);
    // console.log(`[AuthContext] createOrVerifyExternalSession called with mobile: ${mobileNum}, tableId: ${tableId}, restaurantId: ${clientRestaurantId}`);
    try {
      const response = await fetch(`${EXTERNAL_API_BASE_URL}/session/createsession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNum, restaurantId: clientRestaurantId, tableId }),
      });
      const data = await response.json();
      // console.log('[AuthContext] createOrVerifyExternalSession - External API response status:', response.status);
      // console.log('[AuthContext] createOrVerifyExternalSession - PaymentStatus from external API:', data.paymentStatus);


      if (!response.ok) {
         const errorPayload: ExternalSessionErrorResponse = {
            sessionStatus: data.sessionStatus || "NotFound", 
            message: data.message || `Failed to create/verify session. Status: ${response.status}`,
            paymentStatus: data.paymentStatus || null,
        };
        // console.log(`[AuthContext] createOrVerifyExternalSession: Error from /createsession. Status: ${errorPayload.sessionStatus}, Message: ${errorPayload.message}`);
        setExternalSessionError(errorPayload.message);
        return errorPayload;
      }

      if (data.sessionId && data.billId && data.paymentStatus !== undefined) {
        const currentAuthSession = session;
        if (currentAuthSession?.user?.sessionId === data.sessionId &&
            currentAuthSession?.user?.billId === data.billId &&
            currentAuthSession?.user?.paymentStatus !== data.paymentStatus) {
            // console.log('[AuthContext] createOrVerifyExternalSession: Same session, different paymentStatus. Updating NextAuth session to:', data.paymentStatus);
            // setIsAuthContextLoadingInternal(true); // Already true
            await nextAuthUpdate({ paymentStatus: data.paymentStatus });
            // setIsAuthContextLoadingInternal(false); // Do not set to false here, finally block handles it.
        }
        // console.log('[AuthContext] createOrVerifyExternalSession: Active session data received:', data);
        setHasExplicitlyRequestedBill(false); 
        return { sessionId: data.sessionId, billId: data.billId, paymentStatus: data.paymentStatus as PaymentStatusFromApi };
      }
      
      const sessionState = data.sessionStatus as Exclude<SessionStatusFromApi, "Active" | null> | undefined;
      if (sessionState && (sessionState === "Expired" || sessionState === "Completed" || sessionState === "NotFound")) {
         // console.log(`[AuthContext] createOrVerifyExternalSession: External API indicated session is "${sessionState}" (in 2xx response).`);
         const errorPayload: ExternalSessionErrorResponse = {
            sessionStatus: sessionState,
            message: data.message || `Session is ${sessionState}.`,
            paymentStatus: data.paymentStatus || null,
         };
         setExternalSessionError(errorPayload.message);
         return errorPayload;
      }

      console.error('[AuthContext] createOrVerifyExternalSession: Invalid session data in 2xx response from external API. Missing sessionId, billId, or paymentStatus.', data);
      throw new Error("Invalid session data received from server during create/verify.");

    } catch (error: any) {
      console.error("[AuthContext] Error in createOrVerifyExternalSession:", error);
      setExternalSessionError(error.message || "Could not connect to session service.");
      return null;
    } finally {
      setIsAuthContextLoadingInternal(false);
    }
  }, [clientRestaurantId, session, nextAuthUpdate]);


  const validate = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    if (externalSessionError) return; // Don't validate if there's already a known external error

    const currentAuthSessionId = session?.user?.sessionId;
    const currentAuthTableId = session?.user?.tableId;

    if (!clientRestaurantId) {
      console.error('[AuthContext] validate: NEXT_PUBLIC_RESTAURANT_ID is not set on client. Cannot validate session.');
      setExternalSessionError("Restaurant configuration error. Please log in again.");
      if (!isLoggingOutRef.current) logout();
      return;
    }
    if (!currentAuthSessionId || !currentAuthTableId) {
      if (sessionStatus === 'authenticated' && !isLoggingOutRef.current) {
          setExternalSessionError("Session details missing. Please log in again.");
          logout();
      }
      return;
    }
    
    // console.log(`[AuthContext] validate: Preparing to call /api/session/check-status. Client-known values - SessionID: ${currentAuthSessionId}, TableID: ${currentAuthTableId}, Client RestaurantID (NEXT_PUBLIC_RESTAURANT_ID): ${clientRestaurantId}`);
    let parsedValidationData: CheckSessionStatusResult = { success: false, sessionStatus: null, paymentStatus: null, message: "Initial empty parsed data" };
    try {
      const validationResponse = await fetch('/api/session/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentAuthSessionId, tableId: currentAuthTableId }),
      });
      // console.log('[AuthContext] validate: Raw response from /api/session/check-status. Status:', validationResponse.status);
      
      const responseText = await validationResponse.text();
      // console.log('[AuthContext] validate: Text response from /api/session/check-status:', responseText.substring(0, 200));
      try {
        parsedValidationData = JSON.parse(responseText);
      } catch (e) {
        console.error('[AuthContext] validate: Failed to parse JSON from /api/session/check-status. Response text:', responseText.substring(0, 200));
         parsedValidationData.message = `Non-JSON response from session check. Status: ${validationResponse.status}`;
         parsedValidationData.error = parsedValidationData.message; 
         parsedValidationData.success = false;
      }
      // console.log('[AuthContext] validate: Parsed validation data from /api/session/check-status:', parsedValidationData);

      if (!validationResponse.ok || !parsedValidationData.success) {
        const errorStatus = validationResponse.status;
        const errorMessage = parsedValidationData.message || parsedValidationData.error || `Session validation failed (status ${errorStatus}). Please log in again.`;
        // console.error('[AuthContext] validate: /api/session/check-status call failed or success=false. Status:', errorStatus, 'Parsed Data:', parsedValidationData);
        setExternalSessionError(errorMessage);
        if (!isLoggingOutRef.current) logout(); 
        return; 
      }

      const currentSessionStatusApi = parsedValidationData.sessionStatus;
      const currentPaymentStatusApi = parsedValidationData.paymentStatus;
      const nextAuthPaymentStatus = session?.user?.paymentStatus;
      // console.log(`[AuthContext] validate: Received sessionStatus from API: '${currentSessionStatusApi}', API paymentStatus: '${currentPaymentStatusApi}'. Current NextAuth paymentStatus: '${nextAuthPaymentStatus}'`);

      if (currentSessionStatusApi === "Active") {
        // console.log('[AuthContext] validate: Session is "Active". Validation successful.');
        setExternalSessionError(null); 
        if (currentPaymentStatusApi !== nextAuthPaymentStatus) {
            // console.log(`[AuthContext] validate: Active session, paymentStatus mismatch. API: ${currentPaymentStatusApi}, NextAuth: ${nextAuthPaymentStatus}. Updating NextAuth session.`);
            setIsAuthContextLoadingInternal(true);
            await nextAuthUpdate({ paymentStatus: currentPaymentStatusApi });
            setIsAuthContextLoadingInternal(false);
        }
      } else if (currentSessionStatusApi === "Completed") {
        // console.log('[AuthContext] validate: Session is "Completed".');
        if (nextAuthPaymentStatus === "Confirmed" || currentPaymentStatusApi === "Confirmed") {
          // console.log('[AuthContext] validate: Session "Completed" and payment "Confirmed". Allowing user to see bill status.');
          setExternalSessionError(null); 
           if (currentPaymentStatusApi === "Confirmed" && nextAuthPaymentStatus !== "Confirmed") {
            setIsAuthContextLoadingInternal(true);
            await nextAuthUpdate({ paymentStatus: "Confirmed" });
            setIsAuthContextLoadingInternal(false);
          }
        } else {
          setExternalSessionError(parsedValidationData.message || "This session is already completed. Please start a new one.");
          if (!isLoggingOutRef.current) logout();
          return;
        }
      } else if (currentSessionStatusApi === "Expired" || currentSessionStatusApi === "NotFound") {
        // console.log(`[AuthContext] validate: Session is "${currentSessionStatusApi}". Setting error and initiating logout.`);
        setExternalSessionError(parsedValidationData.message || `Your session is ${currentSessionStatusApi}. Please log in again.`);
        if (!isLoggingOutRef.current) logout();
        return;
      } else {
        console.warn('[AuthContext] validate: Unknown or unhandled session status received:', currentSessionStatusApi);
        setExternalSessionError(`Invalid session status: '${String(currentSessionStatusApi)}'. Please log in again.`);
        if (!isLoggingOutRef.current) logout();
        return;
      }
    } catch (error: any) {
      console.error('[AuthContext] validate: Network or other error during /api/session/check-status call:', error);
      setExternalSessionError("Error validating session. Check connection or try logging in again.");
      if (!isLoggingOutRef.current) logout(); 
    }
  }, [session, sessionStatus, logout, nextAuthUpdate, clientRestaurantId, externalSessionError]);


  useEffect(() => {
    const currentSessId = session?.user?.sessionId;
    if (sessionStatus === 'authenticated' && currentSessId && !isLoggingOutRef.current) {
      if (prevSessionIdRef.current !== currentSessId) {
        // console.log("[AuthContext] NextAuth session authenticated and sessionId changed/loaded. Triggering custom session validation.");
        setValidateCurrentSessionTrigger(prev => prev + 1); 
      }
    } else if (sessionStatus === 'unauthenticated' || (sessionStatus === 'authenticated' && !currentSessId)) {
        // console.log(`[AuthContext] Session status: ${sessionStatus}, session has sessionId: ${!!currentSessId}. Resetting validation trigger.`);
        if (validateCurrentSessionTrigger !== 0) {
            setValidateCurrentSessionTrigger(0);
        }
    }
    prevSessionIdRef.current = currentSessId;
  }, [sessionStatus, session?.user?.sessionId]);


  useEffect(() => {
    if (validateCurrentSessionTrigger > 0 && sessionStatus === 'authenticated' && session?.user?.sessionId && !isLoggingOutRef.current && !isSessionValidationLoading && !externalSessionError) {
      // console.log(`[AuthContext] Validation orchestrator: Triggered (value: ${validateCurrentSessionTrigger}). Starting validation for session ID: ${session.user.sessionId}`);
      setIsSessionValidationLoading(true);
      validate()
        .catch(err => {
          console.error("[AuthContext] Unhandled error from validate() promise chain in validation orchestrator:", err);
          if (!isLoggingOutRef.current && !externalSessionError) { // Check externalSessionError again as validate might have set it
            setExternalSessionError("An unexpected error occurred during session validation process.");
            logout();
          }
        })
        .finally(() => {
          // console.log(`[AuthContext] Validation orchestrator: validate() promise settled for trigger ${validateCurrentSessionTrigger}. Resetting loading state and trigger.`);
          setIsSessionValidationLoading(false);
          // Only reset the trigger if this effect was the one that consumed it.
          // This check might be redundant if the trigger is always incremented.
          setValidateCurrentSessionTrigger(0); 
        });
    }
  }, [validateCurrentSessionTrigger, sessionStatus, session?.user?.sessionId, validate, logout, isSessionValidationLoading, externalSessionError]);


  const checkAndUpdateSessionStatus = useCallback(async (sessionIdToCheck: string, tableIdToCheck: string): Promise<CheckSessionStatusResult | null> => {
    if (!sessionIdToCheck || !tableIdToCheck) {
      console.error("[AuthContext] checkAndUpdateSessionStatus: SessionId and TableId are required.");
      setExternalSessionError("Missing details for status check.");
      return null;
    }
    if (!clientRestaurantId) {
      console.error("[AuthContext] checkAndUpdateSessionStatus: NEXT_PUBLIC_RESTAURANT_ID is not set.");
      setExternalSessionError("Restaurant configuration error.");
      return null;
    }

    setIsAuthContextLoadingInternal(true);
    setExternalSessionError(null); 
    // console.log(`[AuthContext] checkAndUpdateSessionStatus: Calling /api/session/check-status for SID: ${sessionIdToCheck}, TID: ${tableIdToCheck}`);

    let responseData: CheckSessionStatusResult = { success: false, sessionStatus: null, paymentStatus: null, message: "Initial empty response data" };
    try {
      const response = await fetch('/api/session/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdToCheck, tableId: tableIdToCheck }),
      });
      const responseText = await response.text();
      // console.log('[AuthContext] checkAndUpdateSessionStatus - Text response from /api/session/check-status:', responseText.substring(0, 200));
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.error('[AuthContext] checkAndUpdateSessionStatus: Failed to parse JSON. Text:', responseText.substring(0,200));
        responseData.message = `Non-JSON response from session check. Status: ${response.status}`;
        responseData.error = responseData.message;
        responseData.success = false;
      }
      // console.log('[AuthContext] checkAndUpdateSessionStatus - Parsed response data:', responseData);


      if (!response.ok || !responseData.success) {
        const errorMessage = responseData.message || responseData.error || `Failed to check session status (HTTP ${response.status})`;
        setExternalSessionError(errorMessage); 
        if (responseData.sessionStatus === "Expired" || responseData.sessionStatus === "NotFound" || responseData.sessionStatus === "Completed") {
            if (!isLoggingOutRef.current) logout();
        }
        return responseData;
      }

      const currentAuthPaymentStatus = session?.user?.paymentStatus;
      if (responseData.sessionStatus === "Active" && responseData.paymentStatus !== currentAuthPaymentStatus) {
        // console.log(`[AuthContext] checkAndUpdateSessionStatus: Payment status differs. API: ${responseData.paymentStatus}, NextAuth: ${currentAuthPaymentStatus}. Updating NextAuth session.`);
        // setIsAuthContextLoadingInternal(true); // Already true
        await nextAuthUpdate({ paymentStatus: responseData.paymentStatus });
        // setIsAuthContextLoadingInternal(false); // Let finally block handle
      } else if (responseData.sessionStatus === "Completed" && responseData.paymentStatus === "Confirmed") {
        if (currentAuthPaymentStatus !== "Confirmed") {
            // setIsAuthContextLoadingInternal(true); // Already true
            await nextAuthUpdate({ paymentStatus: "Confirmed" });
            // setIsAuthContextLoadingInternal(false); // Let finally block handle
        }
        setExternalSessionError(null);
      } else if (responseData.sessionStatus === "Expired" || responseData.sessionStatus === "NotFound") {
        setExternalSessionError(responseData.message || `Session is ${responseData.sessionStatus}.`);
        if (!isLoggingOutRef.current) logout();
      } else if (responseData.sessionStatus === "Completed" && responseData.paymentStatus !== "Confirmed") {
        setExternalSessionError(responseData.message || "Session is completed but payment not confirmed.");
        if (!isLoggingOutRef.current) logout();
      } else {
        setExternalSessionError(null);
      }
      return responseData; 
    } catch (error: any) {
      console.error("[AuthContext] Error in checkAndUpdateSessionStatus:", error);
      setExternalSessionError(error.message || "Could not connect to session status service.");
      return null;
    } finally {
      setIsAuthContextLoadingInternal(false);
    }
  }, [clientRestaurantId, session, nextAuthUpdate, logout]);


  const confirmPaymentExternal = useCallback(async (sessionIdToConfirm: string): Promise<boolean> => {
    if (!sessionIdToConfirm) {
      console.error("[AuthContext] confirmPaymentExternal: Session ID is required.");
      throw new Error("Session ID is required to confirm payment.");
    }
    setIsAuthContextLoadingInternal(true);
    // console.log(`[AuthContext] confirmPaymentExternal called for sessionId: ${sessionIdToConfirm}`);
    try {
      const response = await fetch('/api/session/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionIdToConfirm }),
      });
      const data = await response.json();
      // console.log('[AuthContext] confirmPaymentExternal - Response from /api/session/confirm-payment:', response.status, JSON.stringify(data).substring(0,500));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || `Failed to confirm payment. Status: ${response.status}`);
      }
      // setIsAuthContextLoadingInternal(true); // Already true
      await nextAuthUpdate({ paymentStatus: data.paymentStatus || "Confirmed" });
      // setIsAuthContextLoadingInternal(false); // Let finally block handle

      setExternalSessionError(null); 
      setHasExplicitlyRequestedBill(false); 
      // console.log("[AuthContext] Payment confirmed, NextAuth session paymentStatus updated to:", data.paymentStatus);
      return true;
    } catch (error: any) {
      console.error("[AuthContext] Error in confirmPaymentExternal:", error);
      throw error; 
    } finally {
      setIsAuthContextLoadingInternal(false);
    }
  }, [nextAuthUpdate]);

  const finalIsAuthContextLoading = useMemo(() => {
    const nextAuthInitialLoading = sessionStatus === 'loading';
    // console.log(`[AuthContext] Calculating finalIsAuthContextLoading: nextAuthInitialLoading=${nextAuthInitialLoading}, isSessionValidationLoading=${isSessionValidationLoading}, isAuthContextLoadingInternal=${isAuthContextLoadingInternal}`);
    return nextAuthInitialLoading || isSessionValidationLoading || isAuthContextLoadingInternal;
  }, [sessionStatus, isSessionValidationLoading, isAuthContextLoadingInternal]);

  const finalIsAuthenticated = useMemo(() => {
    return sessionStatus === 'authenticated' && !!session?.user?.sessionId && !externalSessionError;
  }, [sessionStatus, session?.user?.sessionId, externalSessionError]);


  const currentSessionUser = session?.user;

  // useEffect(() => {
    // console.log(`[AuthContext STATE UPDATE] isAuthenticated: ${finalIsAuthenticated}, isAuthContextLoading: ${finalIsAuthContextLoading}, externalSessionError: ${externalSessionError}, sessionStatus (NextAuth): ${sessionStatus}, isSessionValidationLoading: ${isSessionValidationLoading}, PaymentStatus: ${currentSessionUser?.paymentStatus}, hasExplicitlyRequestedBill: ${hasExplicitlyRequestedBill}`);
  // }, [finalIsAuthenticated, finalIsAuthContextLoading, externalSessionError, sessionStatus, isSessionValidationLoading, currentSessionUser?.paymentStatus, hasExplicitlyRequestedBill]);

  const contextValue = useMemo(() => ({
    isAuthenticated: finalIsAuthenticated,
    sessionId: currentSessionUser?.sessionId || null,
    billId: currentSessionUser?.billId || null,
    tableId: currentSessionUser?.tableId || null,
    phoneNumber: currentSessionUser?.phoneNumber || null,
    currentPaymentStatus: currentSessionUser?.paymentStatus as PaymentStatusFromApi || null,
    isAuthContextLoading: finalIsAuthContextLoading,
    isSessionValidationLoading, 
    externalSessionError,
    hasExplicitlyRequestedBill,
    setHasExplicitlyRequestedBill,
    createOrVerifyExternalSession,
    confirmPaymentExternal,
    checkAndUpdateSessionStatus,
    logout,
    clearExternalSessionError,
  }), [
    finalIsAuthenticated,
    currentSessionUser?.sessionId,
    currentSessionUser?.billId,
    currentSessionUser?.tableId,
    currentSessionUser?.phoneNumber,
    currentSessionUser?.paymentStatus,
    finalIsAuthContextLoading,
    isSessionValidationLoading,
    externalSessionError,
    hasExplicitlyRequestedBill,
    // setHasExplicitlyRequestedBill is stable
    createOrVerifyExternalSession, 
    confirmPaymentExternal, 
    checkAndUpdateSessionStatus, 
    logout, 
    clearExternalSessionError 
  ]);


  return (
    <AuthContext.Provider value={contextValue}>
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

