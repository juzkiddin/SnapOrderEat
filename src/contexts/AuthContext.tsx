
"use client";

import type { ReactNode } from "react";
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';

type PaymentStatusFromApi = "Pending" | "Confirmed" | "Failed" | "Expired" | "NotCompleted";
type SessionStatusFromApi = "Active" | "Expired" | "Completed" | "NotFound"; // Added NotFound

interface ExternalSessionData {
  sessionId: string;
  billId: string;
  paymentStatus: PaymentStatusFromApi;
}

interface ExternalSessionErrorResponse {
  sessionStatus: "Expired" | "Completed"; // From /createsession
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

  const clientRestaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID; 
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
    console.log('[AuthContext] logout called.');
    
    setIsSessionValidationLoading(false);
    setValidateCurrentSessionTrigger(0); 
    setExternalSessionError(null); 
    setIsAuthContextLoadingInternal(true);

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
    if (!clientRestaurantId) { // Using clientRestaurantId for this call as per previous setup
      console.error("[AuthContext] createOrVerifyExternalSession: NEXT_PUBLIC_RESTAURANT_ID is not set for client.");
      setExternalSessionError("Restaurant configuration error. Please try again later.");
      return null;
    }
    setIsAuthContextLoadingInternal(true);
    setExternalSessionError(null);
    console.log(`[AuthContext] createOrVerifyExternalSession called with mobile: ${mobileNum}, tableId: ${tableId}, restaurantId: ${clientRestaurantId}`);
    try {
      const response = await fetch(`${EXTERNAL_API_BASE_URL}/session/createsession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNum, restaurantId: clientRestaurantId, tableId }),
      });
      const data = await response.json();
      console.log('[AuthContext] createOrVerifyExternalSession - External API response status:', response.status, 'Data:', data);

      if (!response.ok) {
        throw new Error(data.message || `Failed to create/verify session. Status: ${response.status}`);
      }
      if (data.sessionStatus === "Expired") {
        console.log('[AuthContext] createOrVerifyExternalSession: Received "Expired" session status from /createsession.');
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
  }, [clientRestaurantId]);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && session?.user?.sessionId && !isLoggingOutRef.current) {
      console.log("[AuthContext] NextAuth session authenticated. Triggering custom session validation. Current externalSessionError:", externalSessionError);
      // Only trigger validation if no critical error is already present that would lead to logout
      if (!externalSessionError || externalSessionError === "Restaurant configuration error. Please try again later.") { // Allow re-validation if it's just config error
         setValidateCurrentSessionTrigger(prev => prev + 1); 
         setExternalSessionError(null); 
      }
    } else if (sessionStatus === 'unauthenticated' || (sessionStatus === 'authenticated' && !session?.user?.sessionId)) {
        console.log(`[AuthContext] Session status: ${sessionStatus}, session has sessionId: ${!!session?.user?.sessionId}. Resetting validation trigger and loading state.`);
        setValidateCurrentSessionTrigger(0);
        setIsSessionValidationLoading(false);
    }
  }, [sessionStatus, session?.user?.sessionId, externalSessionError]);


  useEffect(() => {
    const validate = async () => {
      if (isLoggingOutRef.current) {
        console.log('[AuthContext] validate: Logout in progress, aborting validation.');
        setIsSessionValidationLoading(false);
        return;
      }

      const currentAuthSessionId = session?.user?.sessionId;
      const currentAuthTableId = session?.user?.tableId;

      if (!currentAuthSessionId || !currentAuthTableId) {
        console.log('[AuthContext] validate: Missing sessionId or tableId in current NextAuth session for validation. Aborting.', { currentAuthSessionId, currentAuthTableId });
        setIsSessionValidationLoading(false); 
        if (sessionStatus === 'authenticated') {
            console.log("[AuthContext] validate: Authenticated but missing details, logging out.");
            setExternalSessionError("Session details missing. Please log in again.");
            logout();
        }
        return;
      }
      
      console.log(`[AuthContext] validate: Preparing to call /api/session/check-status. Client-known values - SessionID: ${currentAuthSessionId}, TableID: ${currentAuthTableId}, Client RestaurantID (NEXT_PUBLIC_RESTAURANT_ID): ${clientRestaurantId}`);
      // Note: restaurantIdFromEnv (NEXT_PUBLIC_RESTAURANT_ID) is used by createOrVerifyExternalSession.
      // The internal /api/session/check-status uses its own server-side process.env.RESTAURANT_ID.

      setIsSessionValidationLoading(true);
      setExternalSessionError(null); 

      try {
        const validationResponse = await fetch('/api/session/check-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: currentAuthSessionId, tableId: currentAuthTableId }),
        });

        console.log('[AuthContext] validate: Raw response from /api/session/check-status. Status:', validationResponse.status);
        
        let parsedValidationData: any = {};
        try {
            const text = await validationResponse.text(); // Read as text first
            console.log('[AuthContext] validate: Text response from /api/session/check-status:', text.substring(0, 500));
            parsedValidationData = JSON.parse(text); // Then parse
            console.log('[AuthContext] validate: Parsed validation data from /api/session/check-status:', parsedValidationData);
        } catch (e) {
            console.error(`[AuthContext] validate: Could not parse JSON from /api/session/check-status. Status: ${validationResponse.status}.`);
            // If response is not OK and not JSON, this means our internal API had an issue or external API returned non-JSON on error.
            if (!validationResponse.ok) {
                 parsedValidationData = { message: `Session validation endpoint returned non-JSON. Status: ${validationResponse.status}` };
            } else { // OK response but not JSON - server error in our internal API.
                 parsedValidationData = { message: `Internal validation API returned OK but non-JSON. This is unexpected.` };
            }
        }

        if (!validationResponse.ok) {
          const errorStatus = validationResponse.status;
          console.error('[AuthContext] validate: /api/session/check-status call failed. Status:', errorStatus, 'Parsed Data:', parsedValidationData);
          
          let specificMessage = parsedValidationData.message || parsedValidationData.error || `Session validation failed (status ${errorStatus}). Please log in again.`;
          // The internal API now returns sessionStatus: "NotFound" in the body for external 404s
          if (errorStatus === 404 && parsedValidationData.sessionStatus === "NotFound") {
            specificMessage = parsedValidationData.message || "Session not found. Please log in again.";
          }
          
          setExternalSessionError(specificMessage);
          setIsSessionValidationLoading(false); // Set loading false before logout
          logout(); 
          return; 
        }

        // If validationResponse.ok:
        const currentSessionStatus = parsedValidationData.sessionStatus as SessionStatusFromApi;
        console.log(`[AuthContext] validate: Received sessionStatus from API: '${currentSessionStatus}'`);

        if (currentSessionStatus === "Active") {
          console.log('[AuthContext] validate: Session is "Active". Validation successful.');
          setExternalSessionError(null); 
        } else if (currentSessionStatus === "Expired") {
          console.log('[AuthContext] validate: Session is "Expired". Setting error and initiating logout.');
          setExternalSessionError("Your session has expired. Please log in again.");
          logout();
        } else if (currentSessionStatus === "Completed") {
          console.log('[AuthContext] validate: Session is "Completed". Setting error and initiating logout.');
          setExternalSessionError("This session is already completed. Please start a new one.");
          logout();
        } else if (currentSessionStatus === "NotFound") { 
             console.log('[AuthContext] validate: Session "NotFound". Setting error and initiating logout.');
            setExternalSessionError(parsedValidationData.message || "Session not found. Please log in again.");
            logout();
        } else {
          console.warn('[AuthContext] validate: Unknown or unhandled session status received from internal API:', currentSessionStatus, ". Treating as error.");
          setExternalSessionError(`Invalid session status: '${String(currentSessionStatus)}'. Please log in again.`);
          logout();
        }
      } catch (error: any) { // Catch for network errors during fetch to /api/session/check-status
        console.error('[AuthContext] validate: Network or other error during /api/session/check-status call:', error);
        setExternalSessionError("Error validating session. Check connection or try logging in again.");
        logout();
      } finally {
        console.log('[AuthContext] validate: Finished validation attempt. Setting isSessionValidationLoading to false.');
        setIsSessionValidationLoading(false);
      }
    };

    if (sessionStatus === 'authenticated' && validateCurrentSessionTrigger > 0 && !isSessionValidationLoading && !isLoggingOutRef.current) {
      console.log(`[AuthContext] Custom session validation effect running. Trigger: ${validateCurrentSessionTrigger}, SessionID: ${session?.user?.sessionId}`);
      validate().catch(err => { 
        console.error("[AuthContext] Unhandled error from validate() promise chain:", err);
        if (!isLoggingOutRef.current && !externalSessionError) { 
            setExternalSessionError("An unexpected error occurred during session validation. Please log in.");
        }
        setIsSessionValidationLoading(false);
        if (!isLoggingOutRef.current) logout();
      });
    }
  }, [sessionStatus, session, validateCurrentSessionTrigger, isSessionValidationLoading, logout, clientRestaurantId]);


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

  const finalIsAuthenticated = useMemo(() => {
    // Session is authenticated if NextAuth says so, AND our custom validation hasn't found an error, AND custom validation isn't currently running.
    return sessionStatus === 'authenticated' && !externalSessionError && !isSessionValidationLoading;
  }, [sessionStatus, externalSessionError, isSessionValidationLoading]);

  const finalIsAuthContextLoading = useMemo(() => {
    const nextAuthStillLoading = sessionStatus === 'loading';
    console.log(`[AuthContext] Calculating finalIsAuthContextLoading: nextAuthInitialLoading=${nextAuthStillLoading}, isSessionValidationLoading=${isSessionValidationLoading}, isAuthContextLoadingInternal=${isAuthContextLoadingInternal}`);
    return nextAuthStillLoading || isSessionValidationLoading || isAuthContextLoadingInternal;
  }, [sessionStatus, isSessionValidationLoading, isAuthContextLoadingInternal]);

  const currentSessionUser = session?.user;

  // Log important state values when they change
  useEffect(() => {
    console.log(`[AuthContext STATE UPDATE] isAuthenticated: ${finalIsAuthenticated}, isAuthContextLoading: ${finalIsAuthContextLoading}, externalSessionError: ${externalSessionError}, sessionStatus (NextAuth): ${sessionStatus}, isSessionValidationLoading: ${isSessionValidationLoading}`);
  }, [finalIsAuthenticated, finalIsAuthContextLoading, externalSessionError, sessionStatus, isSessionValidationLoading]);


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
    
    