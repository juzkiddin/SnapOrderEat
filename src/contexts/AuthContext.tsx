
"use client";

import type { ReactNode } from "react";
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';

type PaymentStatusFromApi = "Pending" | "Confirmed" | "Failed" | "Expired" | "NotCompleted";
type SessionStatusFromApi = "Active" | "Expired" | "Completed" | "NotFound";

interface ExternalSessionData {
  sessionId: string;
  billId: string;
  paymentStatus: PaymentStatusFromApi;
}

interface ExternalSessionErrorResponse {
  sessionStatus: "Expired" | "Completed" | "NotFound";
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
  isSessionValidationLoading: boolean; 
  externalSessionError: string | null;
  createOrVerifyExternalSession: (mobileNum: string, tableId: string) => Promise<ExternalSessionData | ExternalSessionErrorResponse | null>;
  confirmPaymentExternal: (sessionId: string) => Promise<boolean>;
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

  const restaurantIdFromEnv = process.env.NEXT_PUBLIC_RESTAURANT_ID; 
  const isLoggingOutRef = useRef(false);

  const clearExternalSessionError = useCallback(() => {
    setExternalSessionError(null);
  }, []);

  const logout = useCallback(() => {
    if (isLoggingOutRef.current) {
      console.log('[AuthContext] logout: Already in progress, skipping.');
      return;
    }
    isLoggingOutRef.current = true;
    console.log('[AuthContext] logout called. Resetting states and signing out.');
    
    setIsAuthContextLoadingInternal(true); // Should be set to true during logout
    setExternalSessionError(null);
    setIsSessionValidationLoading(false);
    setValidateCurrentSessionTrigger(0); 

    nextAuthSignOut({ redirect: false })
      .then(() => {
        console.log('[AuthContext] nextAuthSignOut finished successfully.');
      })
      .catch((e) => {
        console.error("[AuthContext] Error during nextAuthSignOut:", e);
        setExternalSessionError("Failed to log out properly. Please refresh or try again.");
      })
      .finally(() => {
        console.log('[AuthContext] logout: Finalizing logout process.');
        setIsAuthContextLoadingInternal(false);
        isLoggingOutRef.current = false;
      });
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
      console.log('[AuthContext] createOrVerifyExternalSession - External API response status:', response.status, 'Data:', JSON.stringify(data).substring(0,500));
      console.log('[AuthContext] createOrVerifyExternalSession - PaymentStatus from external API:', data.paymentStatus);


      if (!response.ok) {
        if (data.sessionStatus === "Expired" || data.message?.toLowerCase().includes("expired")) {
             console.log('[AuthContext] createOrVerifyExternalSession: Received "Expired" session status from /createsession.');
             setExternalSessionError(data.message || "Your previous session has expired. Please start a new one.");
             return { sessionStatus: "Expired", message: data.message || "Your previous session has expired. Please start a new one." };
        }
         if (data.sessionStatus === "Completed" || data.message?.toLowerCase().includes("completed")) {
             console.log('[AuthContext] createOrVerifyExternalSession: Received "Completed" session status from /createsession.');
             setExternalSessionError(data.message || "This session is already completed. Please start a new one.");
             return { sessionStatus: "Completed", message: data.message || "This session is already completed. Please start a new one." };
        }
        throw new Error(data.message || `Failed to create/verify session. Status: ${response.status}`);
      }

      if (data.sessionId && data.billId && data.paymentStatus) {
        const currentAuthSession = session; 
        if (currentAuthSession?.user?.sessionId === data.sessionId && 
            currentAuthSession?.user?.billId === data.billId &&
            currentAuthSession?.user?.paymentStatus !== data.paymentStatus) {
            console.log('[AuthContext] createOrVerifyExternalSession: Same session, different paymentStatus. Updating NextAuth session to:', data.paymentStatus);
            await nextAuthUpdate({ paymentStatus: data.paymentStatus });
        }
        console.log('[AuthContext] createOrVerifyExternalSession: Active session data received:', data);
        return { sessionId: data.sessionId, billId: data.billId, paymentStatus: data.paymentStatus as PaymentStatusFromApi };
      }

      // If API returns 200 OK but sessionStatus is Expired/Completed (as per some API designs)
      if (data.sessionStatus === "Expired") {
        console.log('[AuthContext] createOrVerifyExternalSession: External API indicated session is "Expired" (in 2xx response).');
        setExternalSessionError(data.message || "Your previous session has expired.");
        return { sessionStatus: "Expired", message: data.message || "Your previous session has expired." };
      }
       if (data.sessionStatus === "Completed") {
        console.log('[AuthContext] createOrVerifyExternalSession: External API indicated session is "Completed" (in 2xx response).');
        setExternalSessionError(data.message || "This session is already completed.");
        return { sessionStatus: "Completed", message: data.message || "This session is already completed." };
      }

      // If sessionId, billId, or paymentStatus are missing in a 2xx response
      console.error('[AuthContext] createOrVerifyExternalSession: Invalid session data in 2xx response from external API. Missing sessionId, billId, or paymentStatus.', data);
      throw new Error("Invalid session data received from server during create/verify.");

    } catch (error: any) {
      console.error("[AuthContext] Error in createOrVerifyExternalSession:", error);
      setExternalSessionError(error.message || "Could not connect to session service.");
      return null;
    } finally {
      setIsAuthContextLoadingInternal(false);
    }
  }, [restaurantIdFromEnv, session, nextAuthUpdate]);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.sessionId && !isLoggingOutRef.current) {
      console.log("[AuthContext] NextAuth session authenticated. Triggering custom session validation. Current externalSessionError:", externalSessionError);
      if (!externalSessionError || externalSessionError === "Restaurant configuration error. Please try again later.") {
         setValidateCurrentSessionTrigger(prev => prev + 1); 
         // Do NOT clearExternalSessionError here, as validate might set it.
      }
    } else if (sessionStatus === 'unauthenticated' || (sessionStatus === 'authenticated' && !session?.user?.sessionId)) {
        console.log(`[AuthContext] Session status: ${sessionStatus}, session has sessionId: ${!!session?.user?.sessionId}. Resetting validation trigger and loading state.`);
        setValidateCurrentSessionTrigger(0);
        setIsSessionValidationLoading(false); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, session?.user?.sessionId]);


  useEffect(() => {
    const validate = async () => {
      if (isLoggingOutRef.current) {
        console.log('[AuthContext] validate: Logout in progress, aborting validation.');
        setIsSessionValidationLoading(false); return;
      }

      const currentAuthSessionId = session?.user?.sessionId;
      const currentAuthTableId = session?.user?.tableId;

      if (!restaurantIdFromEnv) { 
        console.error('[AuthContext] validate: NEXT_PUBLIC_RESTAURANT_ID is not set. Cannot validate session.');
        setIsSessionValidationLoading(false); 
        setExternalSessionError("Restaurant configuration error. Please try again later.");
        if (!isLoggingOutRef.current) logout(); 
        return;
      }

      if (!currentAuthSessionId || !currentAuthTableId) {
        console.log('[AuthContext] validate: Missing sessionId or tableId in current NextAuth session for validation. Aborting.', { currentAuthSessionId, currentAuthTableId });
        setIsSessionValidationLoading(false); 
        if (sessionStatus === 'authenticated' && !isLoggingOutRef.current) {
            console.log("[AuthContext] validate: Authenticated but missing details, logging out.");
            setExternalSessionError("Session details missing. Please log in again.");
            logout();
        }
        return;
      }
      
      console.log(`[AuthContext] validate: Preparing to call /api/session/check-status. Client-known values - SessionID: ${currentAuthSessionId}, TableID: ${currentAuthTableId}, Client RestaurantID (NEXT_PUBLIC_RESTAURANT_ID): ${restaurantIdFromEnv}`);
      setIsSessionValidationLoading(true);
      setExternalSessionError(null); 

      try {
        const validationResponse = await fetch('/api/session/check-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: currentAuthSessionId, tableId: currentAuthTableId }),
        });

        console.log('[AuthContext] validate: Raw response from /api/session/check-status. Status:', validationResponse.status);
        
        let parsedValidationData: any;
        try {
            const text = await validationResponse.text();
            console.log('[AuthContext] validate: Text response from /api/session/check-status:', text.substring(0, 500));
            if (text) parsedValidationData = JSON.parse(text);
            else parsedValidationData = { message: `Empty response from session validation. Status: ${validationResponse.status}`}; // Should not happen for 200
            console.log('[AuthContext] validate: Parsed validation data from /api/session/check-status:', parsedValidationData);
        } catch (e) {
            console.error(`[AuthContext] validate: Could not parse JSON from /api/session/check-status. Status: ${validationResponse.status}.`);
            // If it's a non-200 and not JSON, it's an error in API itself
            if (!validationResponse.ok) {
                parsedValidationData = { message: `Session validation endpoint returned non-JSON. Status: ${validationResponse.status}` };
            } else { // 200 OK but not JSON - highly unlikely for this API
                parsedValidationData = { message: `Internal error: Session validation returned OK but non-JSON response.`};
            }
        }

        if (!validationResponse.ok) {
          const errorStatus = validationResponse.status;
          const errorMessage = parsedValidationData.message || parsedValidationData.error || `Session validation failed (status ${errorStatus}). Please log in again.`;
          console.error('[AuthContext] validate: /api/session/check-status call failed. Status:', errorStatus, 'Parsed Data:', parsedValidationData);
          
          setIsSessionValidationLoading(false);
          setExternalSessionError(errorMessage);
          if (!isLoggingOutRef.current) logout(); 
          return; 
        }

        const currentSessionStatusApi = parsedValidationData.sessionStatus as SessionStatusFromApi;
        const nextAuthPaymentStatus = session?.user?.paymentStatus;
        console.log(`[AuthContext] validate: Received sessionStatus from API: '${currentSessionStatusApi}'. NextAuth paymentStatus: '${nextAuthPaymentStatus}'`);

        if (currentSessionStatusApi === "Active") {
          console.log('[AuthContext] validate: Session is "Active". Validation successful.');
          setExternalSessionError(null); 
        } else if (currentSessionStatusApi === "Completed") {
          console.log('[AuthContext] validate: Session is "Completed".');
          if (nextAuthPaymentStatus === "Confirmed") {
            console.log('[AuthContext] validate: Session "Completed" and NextAuth paymentStatus is "Confirmed". Allowing navigation to BillStatusPage.');
            setExternalSessionError(null);
          } else {
            setExternalSessionError(parsedValidationData.message || "This session is already completed. Please start a new one.");
            if (!isLoggingOutRef.current) logout();
          }
        } else if (currentSessionStatusApi === "Expired") {
          console.log('[AuthContext] validate: Session is "Expired". Setting error and initiating logout.');
          setExternalSessionError(parsedValidationData.message || "Your session has expired. Please log in again.");
          if (!isLoggingOutRef.current) logout();
        } else if (currentSessionStatusApi === "NotFound") { 
            console.log('[AuthContext] validate: Session "NotFound". Setting error and initiating logout.');
            setExternalSessionError(parsedValidationData.message || "Session not found. Please log in again.");
            if (!isLoggingOutRef.current) logout();
        } else {
          console.warn('[AuthContext] validate: Unknown or unhandled session status received from internal API:', currentSessionStatusApi, ". Treating as error.");
          setExternalSessionError(`Invalid session status: '${String(currentSessionStatusApi)}'. Please log in again.`);
          if (!isLoggingOutRef.current) logout();
        }
      } catch (error: any) {
        console.error('[AuthContext] validate: Network or other error during /api/session/check-status call:', error);
        setIsSessionValidationLoading(false);
        setExternalSessionError("Error validating session. Check connection or try logging in again.");
        if (!isLoggingOutRef.current) logout();
      } finally {
         setIsSessionValidationLoading(false); 
         console.log('[AuthContext] validate: Finished validation attempt. Setting isSessionValidationLoading to false.');
      }
    };

    if (sessionStatus === 'authenticated' && validateCurrentSessionTrigger > 0 && !isSessionValidationLoading && !isLoggingOutRef.current) {
      console.log(`[AuthContext] Custom session validation effect running. Trigger: ${validateCurrentSessionTrigger}, SessionID: ${session?.user?.sessionId}`);
      validate().catch(err => { 
        console.error("[AuthContext] Unhandled error from validate() promise chain:", err);
        if (!isSessionValidationLoading) setIsSessionValidationLoading(false); // Ensure it's reset
        if (!isLoggingOutRef.current && !externalSessionError) { 
            setExternalSessionError("An unexpected error occurred during session validation. Please log in.");
        }
        if (!isLoggingOutRef.current) logout();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, session, validateCurrentSessionTrigger, logout, restaurantIdFromEnv]);


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
      console.log('[AuthContext] confirmPaymentExternal - Response from /api/session/confirm-payment:', response.status, JSON.stringify(data).substring(0,500));

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || `Failed to confirm payment. Status: ${response.status}`);
      }
      await nextAuthUpdate({ paymentStatus: data.paymentStatus || "Confirmed" });
      setExternalSessionError(null); 
      console.log("[AuthContext] Payment confirmed, NextAuth session paymentStatus updated to:", data.paymentStatus);
      return true;
    } catch (error: any) {
      console.error("[AuthContext] Error in confirmPaymentExternal:", error);
      throw error; 
    } finally {
      setIsAuthContextLoadingInternal(false);
    }
  }, [nextAuthUpdate]);

  const finalIsAuthContextLoading = useMemo(() => {
    const nextAuthStillLoading = sessionStatus === 'loading';
    // console.log(`[AuthContext] Calculating finalIsAuthContextLoading: nextAuthInitialLoading=${nextAuthStillLoading}, isSessionValidationLoading=${isSessionValidationLoading}, isAuthContextLoadingInternal=${isAuthContextLoadingInternal}`);
    return nextAuthStillLoading || isSessionValidationLoading || isAuthContextLoadingInternal;
  }, [sessionStatus, isSessionValidationLoading, isAuthContextLoadingInternal]);

  const finalIsAuthenticated = useMemo(() => {
    return sessionStatus === 'authenticated' && !!session?.user?.sessionId && !externalSessionError;
  }, [sessionStatus, session?.user?.sessionId, externalSessionError]);
  

  const currentSessionUser = session?.user;

  useEffect(() => {
    // console.log(`[AuthContext STATE UPDATE] isAuthenticated: ${finalIsAuthenticated}, isAuthContextLoading: ${finalIsAuthContextLoading}, externalSessionError: ${externalSessionError}, sessionStatus (NextAuth): ${sessionStatus}, isSessionValidationLoading: ${isSessionValidationLoading}, PaymentStatus: ${currentSessionUser?.paymentStatus}`);
  }, [finalIsAuthenticated, finalIsAuthContextLoading, externalSessionError, sessionStatus, isSessionValidationLoading, currentSessionUser?.paymentStatus]);


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

