
"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, LogOut, RefreshCw } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type LoginStep = "enterWaiterOtp" | "enterPhone" | "verifyPhoneOtp" | "sessionStatusInfo";
type WaiterOtpSubStep = "initialInstruction" | "enterOtp";

interface LoginFlowProps {
  tableIdFromUrl: string;
  onLoginSuccess: () => void;
}

export default function LoginFlow({ tableIdFromUrl, onLoginSuccess }: LoginFlowProps) {
  const [step, setStep] = useState<LoginStep>("enterWaiterOtp");
  const [waiterOtpSubStep, setWaiterOtpSubStep] = useState<WaiterOtpSubStep>("initialInstruction");
  const [waiterOtp, setWaiterOtp] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [enteredSmsOtp, setEnteredSmsOtp] = useState("");
  
  const [flowError, setFlowError] = useState<string | null>(null); 
  const [isLoading, setIsLoading] = useState(false);

  const [waiterApiUuid, setWaiterApiUuid] = useState<string | null>(null);
  const [waiterOtpAttemptsLeft, setWaiterOtpAttemptsLeft] = useState<number | null>(null);
  const [smsOtpUuid, setSmsOtpUuid] = useState<string | null>(null);
  const [canResendSmsOtp, setCanResendSmsOtp] = useState<boolean>(true);
  const [resendSmsOtpCountdown, setResendSmsOtpCountdown] = useState<number>(0);
  const resendSmsOtpIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [reRequestWaiterOtpCountdown, setReRequestWaiterOtpCountdown] = useState<number>(0);
  const reRequestWaiterIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isOtpGenerationRequestInFlight = useRef(false);
  const isSmsOtpGenerationRequestInFlight = useRef(false);
  
  const authContext = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authContext.externalSessionError) {
        console.log("[LoginFlow Effect] AuthContext has externalSessionError:", authContext.externalSessionError);
        setFlowError(null); // Clear local flow error if global one appears
        if (step !== "sessionStatusInfo") { 
          console.log("[LoginFlow Effect] Switching to sessionStatusInfo due to externalSessionError.");
          setStep("sessionStatusInfo");
        }
    }
  }, [authContext.externalSessionError, step]);


  useEffect(() => {
    return () => {
      if (resendSmsOtpIntervalRef.current) clearInterval(resendSmsOtpIntervalRef.current);
      if (reRequestWaiterIntervalRef.current) clearInterval(reRequestWaiterIntervalRef.current);
    };
  }, []);

  const startResendSmsOtpTimer = () => {
    setCanResendSmsOtp(false);
    setResendSmsOtpCountdown(30);
    if (resendSmsOtpIntervalRef.current) clearInterval(resendSmsOtpIntervalRef.current);
    resendSmsOtpIntervalRef.current = setInterval(() => {
      setResendSmsOtpCountdown((prev) => (prev <= 1 ? (clearInterval(resendSmsOtpIntervalRef.current!), setCanResendSmsOtp(true), 0) : prev - 1));
    }, 1000);
  };

  const startReRequestWaiterOtpTimer = () => {
    setReRequestWaiterOtpCountdown(240); // 4 minutes
    if (reRequestWaiterIntervalRef.current) clearInterval(reRequestWaiterIntervalRef.current);
    reRequestWaiterIntervalRef.current = setInterval(() => {
      setReRequestWaiterOtpCountdown((prev) => (prev <= 1 ? (clearInterval(reRequestWaiterIntervalRef.current!), 0) : prev - 1));
    }, 1000);
  };
  
  const logRateLimitHeaders = (response: Response, context: string) => {
    const limit = response.headers.get('x-ratelimit-limit');
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');
    const retryAfter = response.headers.get('retry-after');
    let logMessage = `[${context} - Rate Limit] `;
    if (limit && remaining) logMessage += `Attempts: ${remaining}/${limit}. `;
    if (reset) logMessage += `Resets in (approx seconds): ${reset}. `;
    if (retryAfter) logMessage += `Retry-After (seconds): ${retryAfter}. `;
    if (logMessage.trim() !== `[${context} - Rate Limit]`) console.log(logMessage);
  };

  const handleWaiterOtpInstructionProceed = async (isRetry = false) => {
    if (isOtpGenerationRequestInFlight.current && !isRetry) return;
    isOtpGenerationRequestInFlight.current = true;
    setFlowError(null);
    authContext.clearExternalSessionError(); 
    if (!isRetry) setWaiterOtpAttemptsLeft(null); // Reset attempts only on first try
    setIsLoading(true);
    try {
      const apiResponse = await fetch('https://otpapi.snapordereat.in/otp/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tableId: tableIdFromUrl }),
      });
      logRateLimitHeaders(apiResponse, "Waiter OTP Gen");
      const data = await apiResponse.json();
      if (apiResponse.status === 429) { setFlowError(`Rate limit exceeded. Try again in ${apiResponse.headers.get('retry-after') || '30'}s.`); }
      else if (!apiResponse.ok) { setFlowError(data.message || data.error || `OTP generation failed: ${apiResponse.status}`); }
      else {
        setWaiterApiUuid(data.uuid);
        setWaiterOtpAttemptsLeft(data.attemptsLeft === undefined ? null : Number(data.attemptsLeft)); // Ensure it's a number or null
        setWaiterOtpSubStep("enterOtp");
        setFlowError(null);
        if (isRetry) setWaiterOtp(""); // Clear OTP input field on retry
        startReRequestWaiterOtpTimer(); // Start timer on successful OTP generation (initial or retry)
      }
    } catch (err: any) {
      setFlowError(err.message || "Error requesting Waiter OTP.");
    } finally {
      setIsLoading(false);
      isOtpGenerationRequestInFlight.current = false;
    }
  };

  const handleConfirmPresence = async () => {
    if (waiterOtp.length !== 6) { setFlowError("Enter 6-digit Waiter OTP."); return; }
    setFlowError(null);
    authContext.clearExternalSessionError();
    setIsLoading(true);
    try {
      const response = await fetch('https://otpapi.snapordereat.in/otp/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uuid: waiterApiUuid, otpCode: waiterOtp }),
      });
      logRateLimitHeaders(response, "Waiter OTP Verify");
      const data = await response.json();
      if (!response.ok) {
        setFlowError(data.message || data.error || `Waiter OTP verification failed: ${response.status}`);
        if (data.attemptsLeft !== undefined) setWaiterOtpAttemptsLeft(Number(data.attemptsLeft));
      } else if (data.success === true) {
        setFlowError(null); setStep("enterPhone");
      } else {
        // Verification technically "ok" (200) but success: false (e.g., wrong OTP)
        if (data.attemptsLeft !== undefined) setWaiterOtpAttemptsLeft(Number(data.attemptsLeft));
        setFlowError(data.message || "Invalid Waiter OTP.");
      }
    } catch (err: any) {
      setFlowError(err.message || "Error verifying Waiter OTP.");
    } finally { setIsLoading(false); }
  };

  const handleSendSmsOtp = async () => {
    if (isSmsOtpGenerationRequestInFlight.current) return; // Prevent multiple requests
    if (!/^\d{10}$/.test(phoneNumber)) { setFlowError("Enter a valid 10-digit phone number."); return; }
    isSmsOtpGenerationRequestInFlight.current = true;
    setFlowError(null);
    authContext.clearExternalSessionError();
    setIsLoading(true);
    const formattedPhoneNumber = `+91${phoneNumber}`;
    try {
      const response = await fetch('https://otpapi.snapordereat.in/otp/smsgen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobileNum: formattedPhoneNumber }),
      });
      logRateLimitHeaders(response, "SMS OTP Gen");
      const data = await response.json();
      if (response.status === 400) { setFlowError(data.message?.[0] || data.error || "Invalid mobile number."); }
      else if (response.status === 429) { setFlowError(`Too many requests for SMS OTP. Try again in ${response.headers.get('retry-after') || '30'}s.`); }
      else if (response.status === 500) { setFlowError(data.message || "Failed to send SMS OTP."); } // External API internal error
      else if (!response.ok) { setFlowError(data.message || data.error || `SMS OTP generation failed: ${response.status}`); }
      else {
        setSmsOtpUuid(data.uuid); setStep("verifyPhoneOtp"); startResendSmsOtpTimer(); setFlowError(null);
      }
    } catch (err: any) {
      setFlowError(err.message || "Error sending SMS OTP.");
    } finally {
      setIsLoading(false); isSmsOtpGenerationRequestInFlight.current = false;
    }
  };

  const processExternalSessionAndSignIn = async (formattedPhoneNumber: string) => {
    setIsLoading(true);
    setFlowError(null); 
    authContext.clearExternalSessionError();

    console.log("[LoginFlow] processExternalSessionAndSignIn: Calling createOrVerifyExternalSession...");
    const externalSessionResult = await authContext.createOrVerifyExternalSession(formattedPhoneNumber, tableIdFromUrl);
    console.log("[LoginFlow] processExternalSessionAndSignIn: Result from createOrVerifyExternalSession:", externalSessionResult);


    // Check if AuthContext set an error OR if the result indicates a non-active session
    if (authContext.externalSessionError || !externalSessionResult || ('sessionStatus' in externalSessionResult && externalSessionResult.sessionStatus !== "Active") ) {
        console.log("[LoginFlow] processExternalSessionAndSignIn: createOrVerifyExternalSession failed or returned non-active. AuthContext error:", authContext.externalSessionError, "Result:", externalSessionResult);
        if (!authContext.externalSessionError && externalSessionResult && 'message' in externalSessionResult) { 
            setFlowError(externalSessionResult.message || "Session creation or verification failed.");
        }
        // If authContext.externalSessionError IS set, the useEffect in LoginFlow will pick it up and switch to sessionStatusInfo.
        setIsLoading(false);
        return; // Critical: Do not proceed to signIn or onLoginSuccess
    }

    // Ensure the result is of type ExternalSessionData before trying to access its properties
    if (!('sessionId' in externalSessionResult)) {
        console.error("[LoginFlow] processExternalSessionAndSignIn: externalSessionResult is not of type ExternalSessionData", externalSessionResult);
        setFlowError("Invalid session data from server after create/verify step.");
        setIsLoading(false);
        return; // Critical: Do not proceed
    }

    const { sessionId, billId, paymentStatus } = externalSessionResult;
    console.log("[LoginFlow] processExternalSessionAndSignIn: External session active. Proceeding to NextAuth signIn with:", { sessionId, billId, paymentStatus });
    
    // Log the paymentStatus being passed to signIn
    console.log("[LoginFlow] PaymentStatus being passed to NextAuth signIn:", paymentStatus);

    const signInResult = await signIn('credentials', {
      redirect: false,
      phoneNumber: formattedPhoneNumber,
      tableId: tableIdFromUrl,
      billId,
      sessionId,
      paymentStatus, // Make sure this is correctly passed
    });

    setIsLoading(false); // Ensure isLoading is set to false after signIn attempt

    if (signInResult?.error) {
      setFlowError(`Login failed: ${signInResult.error}.`);
    } else if (!signInResult?.ok) {
      setFlowError("Login attempt was not successful.");
    } else {
      console.log("[LoginFlow] processExternalSessionAndSignIn: NextAuth signIn successful. Calling onLoginSuccess.");
      onLoginSuccess(); 
    }
  };


  const handleVerifySmsOtpAndLogin = async () => {
    if (enteredSmsOtp.length !== 6) { setFlowError("Enter 6-digit SMS OTP."); return; }
    setFlowError(null);
    authContext.clearExternalSessionError();
    setIsLoading(true);
    try {
      const verifySmsResponse = await fetch('https://otpapi.snapordereat.in/otp/smsverify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uuid: smsOtpUuid, otpCode: enteredSmsOtp }),
      });
      logRateLimitHeaders(verifySmsResponse, "SMS OTP Verify");
      const verifySmsData = await verifySmsResponse.json();

      if (verifySmsResponse.status === 400) { setFlowError(verifySmsData.message?.[0] || verifySmsData.error || "Invalid SMS OTP format."); setIsLoading(false); return; }
      if (!verifySmsResponse.ok) { setFlowError(verifySmsData.message || verifySmsData.error || `SMS OTP verification failed (status: ${verifySmsResponse.status})`); setIsLoading(false); return; }
      if (verifySmsData.success !== true) { setFlowError(verifySmsData.message || "Invalid SMS OTP."); setIsLoading(false); return; }
      
      // SMS OTP verification success, now proceed with external session and NextAuth signIn
      const formattedPhoneNumber = `+91${phoneNumber}`;
      await processExternalSessionAndSignIn(formattedPhoneNumber);

    } catch (err: any) {
      setFlowError(err.message || "Error verifying SMS OTP.");
      setIsLoading(false); // Ensure loading is false in catch block too
    }
    // Do not set isLoading(false) here if processExternalSessionAndSignIn is async and handles its own loading
  };
  
  const handleStartNewSession = () => {
    setFlowError(null);
    authContext.clearExternalSessionError();
    if (phoneNumber) {
        // User is already on sessionStatusInfo, likely due to an expired session.
        // Try to create a new session with their existing phone number.
        processExternalSessionAndSignIn(`+91${phoneNumber}`);
    } else {
        // If no phone number stored (shouldn't happen if sessionStatusInfo is shown due to *their* session expiring),
        // send them back to enter phone. More robustly, might send to Waiter OTP.
        setStep("enterPhone"); 
    }
  };

  const renderStep = () => {
    const displayError = flowError || authContext.externalSessionError;

    switch (step) {
      case "enterWaiterOtp":
        if (waiterOtpSubStep === "initialInstruction") {
          return (
            <>
              <CardHeader><CardTitle className="text-2xl text-center">Confirm Presence</CardTitle><CardDescription className="text-center">Welcome to The Tasty Spoon!</CardDescription></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground text-center">Ask your waiter for a one-time code.</p></CardContent>
              <CardFooter className="flex flex-col">
                {displayError && <p className="text-sm text-destructive mb-4 text-center">{displayError}</p>}
                <Button onClick={() => handleWaiterOtpInstructionProceed(false)} className="w-full" disabled={isLoading || authContext.isAuthContextLoading}>
                  {(isLoading || authContext.isAuthContextLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Request OTP</Button>
              </CardFooter>
            </>
          );
        }
        // waiterOtpSubStep === "enterOtp"
        return ( 
          <>
            <CardHeader><CardTitle className="text-2xl text-center">Enter Waiter OTP</CardTitle>
              <CardDescription className="text-center">Enter 6-digit OTP from waiter.
                {waiterOtpAttemptsLeft !== null && waiterOtpAttemptsLeft > 0 && <span className="block text-xs text-muted-foreground mt-1">Attempts left: {waiterOtpAttemptsLeft}</span>}
                {waiterOtpAttemptsLeft === 0 && <span className="block text-xs text-destructive mt-1">No attempts left. Request new OTP.</span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex flex-col items-center">
              <InputOTP maxLength={6} value={waiterOtp} onChange={setWaiterOtp} disabled={isLoading || waiterOtpAttemptsLeft === 0 || authContext.isAuthContextLoading}>
                <InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup>
              </InputOTP>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              {displayError && <p className="text-sm text-destructive mb-2 text-center">{displayError}</p>}
              <Button onClick={handleConfirmPresence} className="w-full" disabled={isLoading || waiterOtp.length !== 6 || waiterOtpAttemptsLeft === 0 || authContext.isAuthContextLoading}>
                {(isLoading || authContext.isAuthContextLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm Presence</Button>
              <Button variant="default" onClick={() => handleWaiterOtpInstructionProceed(true)} className="w-full" disabled={isLoading || reRequestWaiterOtpCountdown > 0 || authContext.isAuthContextLoading}>
                {(isLoading || authContext.isAuthContextLoading) && reRequestWaiterOtpCountdown > 0 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Re-Request OTP {reRequestWaiterOtpCountdown > 0 && `(${Math.floor(reRequestWaiterOtpCountdown / 60)}:${String(reRequestWaiterOtpCountdown % 60).padStart(2, '0')})`}</Button>
              <Button variant="link" size="sm" onClick={() => { authContext.logout(); setWaiterApiUuid(null); setWaiterOtp(""); setFlowError(null); authContext.clearExternalSessionError(); setWaiterOtpSubStep("initialInstruction"); if (reRequestWaiterIntervalRef.current) clearInterval(reRequestWaiterIntervalRef.current); setReRequestWaiterOtpCountdown(0); router.push('/'); }} className="mt-1" disabled={isLoading || authContext.isAuthContextLoading}><LogOut className="mr-2 h-4 w-4" />Vacate Table</Button>
            </CardFooter>
          </>
        );
      case "enterPhone":
        return (
          <>
            <CardHeader><CardTitle className="text-2xl">Enter Phone Number</CardTitle><CardDescription>Send OTP to your 10-digit phone number (+91 assumed).</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center">
                <span className="inline-flex items-center px-3 h-10 border border-r-0 rounded-l-md bg-muted text-muted-foreground text-sm">+91</span>
                <Input id="phoneNumber" type="text" inputMode="numeric" placeholder="eg: 9876543210" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))} maxLength={10} className="rounded-l-none flex-1" disabled={isLoading || authContext.isAuthContextLoading} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col">
              {displayError && <p className="text-sm text-destructive mb-4 text-center">{displayError}</p>}
              <Button onClick={handleSendSmsOtp} className="w-full" disabled={isLoading || phoneNumber.length !== 10 || authContext.isAuthContextLoading}>
                {(isLoading || authContext.isAuthContextLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send OTP</Button>
              <Button variant="link" size="sm" onClick={() => { authContext.logout(); setWaiterApiUuid(null); setWaiterOtp(""); setWaiterOtpSubStep("initialInstruction"); if (reRequestWaiterIntervalRef.current) clearInterval(reRequestWaiterIntervalRef.current); setReRequestWaiterOtpCountdown(0); setStep("enterWaiterOtp"); setFlowError(null); authContext.clearExternalSessionError(); }} className="mt-2" disabled={isLoading || authContext.isAuthContextLoading}><LogOut className="mr-2 h-4 w-4" />Vacate Table</Button>
            </CardFooter>
          </>
        );
      case "verifyPhoneOtp":
        return (
          <>
            <CardHeader><CardTitle className="text-2xl text-center">Verify Phone OTP</CardTitle><CardDescription className="text-center">Enter 6-digit OTP sent to +91{phoneNumber}.</CardDescription></CardHeader>
            <CardContent className="space-y-4 flex flex-col items-center">
              <InputOTP id="smsOtpInput" maxLength={6} value={enteredSmsOtp} onChange={setEnteredSmsOtp} disabled={isLoading || authContext.isAuthContextLoading}>
                <InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup>
              </InputOTP>
            </CardContent>
            <CardFooter className="flex flex-col">
              {displayError && <p className="text-sm text-destructive mb-4 text-center">{displayError}</p>}
              <Button onClick={handleVerifySmsOtpAndLogin} className="w-full" disabled={isLoading || enteredSmsOtp.length !== 6 || authContext.isAuthContextLoading}>
                {(isLoading || authContext.isAuthContextLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Verify & Login</Button>
              <Button variant="link" size="sm" onClick={handleSendSmsOtp} className="mt-2" disabled={isLoading || !canResendSmsOtp || isSmsOtpGenerationRequestInFlight.current || authContext.isAuthContextLoading}>
                {(isLoading || authContext.isAuthContextLoading) && isSmsOtpGenerationRequestInFlight.current ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Resend OTP {resendSmsOtpCountdown > 0 ? `(${resendSmsOtpCountdown}s)` : ''}</Button>
              <Button variant="link" size="sm" onClick={() => { setStep("enterPhone"); setFlowError(null); authContext.clearExternalSessionError(); setEnteredSmsOtp(""); setSmsOtpUuid(null); clearInterval(resendSmsOtpIntervalRef.current!); setCanResendSmsOtp(true); setResendSmsOtpCountdown(0); }} className="mt-1" disabled={isLoading || authContext.isAuthContextLoading}>Change phone number</Button>
            </CardFooter>
          </>
        );
      case "sessionStatusInfo": 
        return (
          <>
            <CardHeader><CardTitle className="text-2xl text-center">Session Status</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground text-center">{authContext.externalSessionError || "There was an issue with your session."}</p></CardContent>
            <CardFooter className="flex flex-col gap-2">
                {/* Show "Start New Session" only if it's a recoverable/expected error like "Expired" or "Completed" */}
                { (authContext.externalSessionError?.toLowerCase().includes("expired") || 
                   authContext.externalSessionError?.toLowerCase().includes("completed")) && (
                    <Button onClick={handleStartNewSession} className="w-full" disabled={isLoading || authContext.isAuthContextLoading}>
                        {(isLoading || authContext.isAuthContextLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <RefreshCw className="mr-2 h-4 w-4" /> Start New Session
                    </Button>
                )}
                {/* Always show a way to go back/reset */}
                <Button variant="outline" onClick={() => { setStep("enterWaiterOtp"); setWaiterOtpSubStep("initialInstruction"); authContext.clearExternalSessionError(); setFlowError(null); authContext.logout(); router.push('/') }} className="w-full">
                  Go to Home / Logout
                </Button>
            </CardFooter>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] py-12">
      <Card className="w-full max-w-md">
        {renderStep()}
      </Card>
    </div>
  );
}

