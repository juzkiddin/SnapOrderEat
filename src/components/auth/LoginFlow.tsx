
"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react'; // Import signIn from next-auth/react
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, LogOut } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
// import { useLoading } from '../../contexts/LoadingContext'; // Reverted to relative path

type LoginStep = "enterWaiterOtp" | "enterPhone" | "verifyPhoneOtp";
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
  const [error, setError] = useState<string | null>(null);
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

  const [stepInProgress, setStepInProgress] = useState<string>('idle');


  useEffect(() => {
    return () => {
      if (resendSmsOtpIntervalRef.current) {
        clearInterval(resendSmsOtpIntervalRef.current);
      }
      if (reRequestWaiterIntervalRef.current) {
        clearInterval(reRequestWaiterIntervalRef.current);
      }
    };
  }, []);

  const startResendSmsOtpTimer = () => {
    setCanResendSmsOtp(false);
    setResendSmsOtpCountdown(30);
    if (resendSmsOtpIntervalRef.current) {
      clearInterval(resendSmsOtpIntervalRef.current);
    }
    resendSmsOtpIntervalRef.current = setInterval(() => {
      setResendSmsOtpCountdown((prevCountdown) => {
        if (prevCountdown <= 1) {
          clearInterval(resendSmsOtpIntervalRef.current!);
          setCanResendSmsOtp(true);
          return 0;
        }
        return prevCountdown - 1;
      });
    }, 1000);
  };

  const startReRequestWaiterOtpTimer = () => {
    setReRequestWaiterOtpCountdown(240); 
    if (reRequestWaiterIntervalRef.current) {
      clearInterval(reRequestWaiterIntervalRef.current);
    }
    reRequestWaiterIntervalRef.current = setInterval(() => {
      setReRequestWaiterOtpCountdown((prevCountdown) => {
        if (prevCountdown <= 1) {
          clearInterval(reRequestWaiterIntervalRef.current!);
          return 0;
        }
        return prevCountdown - 1;
      });
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
    if (isOtpGenerationRequestInFlight.current && !isRetry) {
      return;
    }
    isOtpGenerationRequestInFlight.current = true;
    setError(null);
    if (!isRetry) setWaiterOtpAttemptsLeft(null);
    setIsLoading(true);
    let apiResponse: Response | undefined;

    try {
      apiResponse = await fetch('https://otpapi.snapordereat.in/otp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: tableIdFromUrl }),
      });

      logRateLimitHeaders(apiResponse, "Waiter OTP Gen");
      let data;
      try {
        const contentType = apiResponse.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            data = await apiResponse.json();
        } else {
            const textResponse = await apiResponse.text();
            throw new Error(`Expected JSON, got: ${textResponse.substring(0,100)}... (status: ${apiResponse?.status})`);
        }
      } catch (jsonError: any) {
        setError(`OTP generation response error. Status: ${apiResponse?.status}. ${jsonError.message}`);
        setIsLoading(false);
        isOtpGenerationRequestInFlight.current = false;
        return;
      }

      if (apiResponse.status === 429) {
        const retryAfter = apiResponse.headers.get('retry-after') || apiResponse.headers.get('x-ratelimit-reset') || '30';
        setError(`Rate limit exceeded. Please try again in ${retryAfter} seconds.`);
      } else if (!apiResponse.ok) {
        setError(data.message || data.error || `OTP generation failed: ${apiResponse.status}`);
      } else {
        setWaiterApiUuid(data.uuid);
        setWaiterOtpAttemptsLeft(data.attemptsLeft === undefined ? null : Number(data.attemptsLeft));
        setWaiterOtpSubStep("enterOtp");
        setError(null);
        if (isRetry) {
          setWaiterOtp(""); 
        }
        startReRequestWaiterOtpTimer();
      }
    } catch (err: any) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError("Network error or API unreachable (Waiter OTP). Check connection/CORS. See console.");
      } else {
        setError(err.message || "An unexpected error occurred while requesting Waiter OTP. Check console.");
      }
      console.error("LoginFlow: Error during handleWaiterOtpInstructionProceed", err);
    } finally {
      setIsLoading(false);
      isOtpGenerationRequestInFlight.current = false;
    }
  };

  const handleConfirmPresence = async () => {
    if (waiterOtp.length !== 6) {
      setError("Please enter a 6-digit Waiter OTP.");
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('https://otpapi.snapordereat.in/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: waiterApiUuid, otpCode: waiterOtp }),
      });
      
      logRateLimitHeaders(response, "Waiter OTP Verify");
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || data.error || `Waiter OTP verification failed: ${response.status}`);
        if (data.attemptsLeft !== undefined) setWaiterOtpAttemptsLeft(Number(data.attemptsLeft));
      } else {
        if (data.success === true) {
          setError(null);
          setStep("enterPhone");
        } else {
           if (data.attemptsLeft !== undefined) setWaiterOtpAttemptsLeft(Number(data.attemptsLeft));
           setError(data.message || "Invalid Waiter OTP. Please try again.");
        }
      }
    } catch (err: any) {
      if (err instanceof TypeError && err.message.toLowerCase().includes("failed to fetch")) {
        setError("Network error during Waiter OTP verification. Check connection/CORS. See browser console.");
        console.error("LoginFlow: 'Failed to fetch' calling /otp/verify", err);
      } else {
        setError(err.message || "An error occurred during Waiter OTP verification. Check console.");
        console.error("LoginFlow: Error during handleConfirmPresence", err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendSmsOtp = async () => {
    if (isSmsOtpGenerationRequestInFlight.current) return;

    if (!/^\d{10}$/.test(phoneNumber)) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    
    isSmsOtpGenerationRequestInFlight.current = true;
    setError(null);
    setIsLoading(true);
    const formattedPhoneNumber = `+91${phoneNumber}`;

    try {
      const response = await fetch('https://otpapi.snapordereat.in/otp/smsgen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNum: formattedPhoneNumber }),
      });
      
      logRateLimitHeaders(response, "SMS OTP Gen");
      const data = await response.json();

      if (response.status === 400) {
        setError(data.message?.[0] || data.error || "Invalid mobile number format.");
      } else if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after') || '30';
        setError(`Too many requests for SMS OTP. Please try again in ${retryAfter} seconds.`);
      } else if (response.status === 500) {
         setError(data.message || "Failed to send SMS OTP. Please try again later.");
      } else if (!response.ok) {
         setError(data.message || data.error || `SMS OTP generation failed: ${response.status}`);
      } else {
        setSmsOtpUuid(data.uuid);
        setStep("verifyPhoneOtp");
        startResendSmsOtpTimer();
        setError(null);
      }
    } catch (err: any) {
      if (err instanceof TypeError && err.message.toLowerCase().includes("failed to fetch")) {
        setError("Network error sending SMS OTP. Check connection/CORS. See browser console for more details (e.g., with /otp/smsgen).");
         console.error("LoginFlow: 'Failed to fetch' calling /otp/smsgen", err);
      } else {
        setError(err.message || "An unexpected error occurred while sending SMS OTP. Check console.");
        console.error("LoginFlow: Error during handleSendSmsOtp", err);
      }
    } finally {
      setIsLoading(false);
      isSmsOtpGenerationRequestInFlight.current = false;
    }
  };

  const handleVerifySmsOtpAndLogin = async () => {
    if (enteredSmsOtp.length !== 6) {
      setError("Please enter a 6-digit SMS OTP.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setStepInProgress('smsVerification');
    console.log("[LoginFlow] Step: External SMS OTP verification. UUID:", smsOtpUuid, "OTP:", enteredSmsOtp);

    try {
      const verifySmsResponse = await fetch('https://otpapi.snapordereat.in/otp/smsverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: smsOtpUuid, otpCode: enteredSmsOtp }),
      });

      logRateLimitHeaders(verifySmsResponse, "SMS OTP Verify");
      console.log("[LoginFlow] External SMS OTP verification response status:", verifySmsResponse.status);
      const verifySmsData = await verifySmsResponse.json();
      console.log("[LoginFlow] External SMS OTP verification response data:", verifySmsData);

      if (verifySmsResponse.status === 400) {
        setError(verifySmsData.message?.[0] || verifySmsData.error || "Invalid SMS OTP format.");
        setIsLoading(false);
        return;
      } else if (!verifySmsResponse.ok) {
        setError(verifySmsData.message || verifySmsData.error || `SMS OTP verification failed (status: ${verifySmsResponse.status})`);
        setIsLoading(false);
        return;
      }

      if (verifySmsData.success !== true) {
        setError(verifySmsData.message || "Invalid SMS OTP entered. Please try again.");
        setIsLoading(false);
        return;
      }
      
      console.log("[LoginFlow] External SMS OTP verified. Proceeding to internal login API call.");
      setStepInProgress('internalLoginApi');
      const formattedPhoneNumber = `+91${phoneNumber}`;
      console.log("[LoginFlow] Step: Internal API call to /api/auth/login with:", { tableId: tableIdFromUrl, waiterOtp, phoneNumber: formattedPhoneNumber });
      const internalLoginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: tableIdFromUrl,
          waiterOtp, 
          phoneNumber: formattedPhoneNumber,
        }),
      });
      console.log("[LoginFlow] Internal login API response status:", internalLoginResponse.status);
      
      const internalLoginResponseText = await internalLoginResponse.text(); // Get raw text first
      let internalLoginData;
      try {
        internalLoginData = JSON.parse(internalLoginResponseText); // Try to parse as JSON
        console.log("[LoginFlow] Internal login API response data:", internalLoginData);
      } catch (e) {
        console.error("[LoginFlow] Failed to parse JSON from internal login API. Status:", internalLoginResponse.status, "Response text:", internalLoginResponseText);
        setError(`Error communicating with our server (non-JSON response from /api/auth/login). Please try again. Status: ${internalLoginResponse.status}`);
        setIsLoading(false);
        return;
      }

      if (!internalLoginResponse.ok) {
        console.error("[LoginFlow] Internal login API call failed. Status:", internalLoginResponse.status, "Data:", internalLoginData);
        setError(`Our server had trouble preparing your session (status: ${internalLoginResponse.status}). Details: ${internalLoginData.error || 'Unknown error'}. Please try again.`);
        setIsLoading(false);
        return;
      }

      if (!internalLoginData.success || !internalLoginData.billId) {
        console.error("[LoginFlow] Internal login API data indicates failure or missing billId:", internalLoginData);
        setError(internalLoginData.message || "Failed to prepare session data from our server (bill ID missing).");
        setIsLoading(false);
        return;
      }
      console.log("[LoginFlow] Internal login successful. Proceeding to NextAuth signIn.");

      setStepInProgress('nextAuthSignIn');
      console.log("[LoginFlow] Step: Calling NextAuth signIn with credentials:", {
        phoneNumber: formattedPhoneNumber,
        tableId: tableIdFromUrl,
        billId: internalLoginData.billId,
      });

      const signInResult = await signIn('credentials', {
        redirect: false, // We handle UI changes based on session status
        phoneNumber: formattedPhoneNumber,
        tableId: tableIdFromUrl,
        billId: internalLoginData.billId,
      });

      console.log("[LoginFlow] NextAuth signIn result:", signInResult);

      if (signInResult?.error) {
        console.error("[LoginFlow] NextAuth signIn failed. Error:", signInResult.error);
        let uiError = `Login failed: ${signInResult.error}.`;
        if (signInResult.error.toLowerCase().includes("CredentialsSignin") || signInResult.error.toLowerCase().includes("authorize")) {
            uiError = "Login failed. Please check your details or try again. (Auth error)";
        } else if (signInResult.error.toLowerCase().includes("fetch")) { // This might catch "Failed to fetch" for NEXTAUTH_URL issues
            uiError = "Login process interrupted (Network issue during sign-in). Please ensure your NEXTAUTH_URL is correctly set in environment variables and try again.";
        }
        setError(uiError);
        setIsLoading(false);
        return;
      }
      
      if (!signInResult?.ok) {
         console.error("[LoginFlow] NextAuth signIn was not 'ok'. Full result:", signInResult);
         setError("Login attempt was not successful. Please try again. (NextAuth status not ok)");
         setIsLoading(false);
         return;
      }
      
      console.log("[LoginFlow] NextAuth signIn successful. Calling onLoginSuccess.");
      setStepInProgress('loginSuccess');
      onLoginSuccess(); 

    } catch (err: any) {
      console.error(`[LoginFlow] Critical error during ${stepInProgress} step:`, err);
      let displayError = `An unexpected error occurred during the '${stepInProgress}' step. Please try again.`;
      if (err.name === 'TypeError' && err.message.toLowerCase().includes("failed to fetch")) {
         displayError = `Network request failed during '${stepInProgress}'. Please check your internet connection.`;
         if (stepInProgress === 'internalLoginApi') {
            displayError += " This might indicate a problem with our server endpoint /api/auth/login or your network connection to it.";
         } else if (stepInProgress === 'nextAuthSignIn') {
            displayError += " This might indicate an issue with NextAuth.js configuration (e.g., NEXTAUTH_URL) or network. Check console.";
            console.error("A 'Failed to fetch' error occurred during NextAuth signIn. THIS IS OFTEN DUE TO A MISSING OR INCORRECT `NEXTAUTH_URL` environment variable. Ensure it's set to your application's publicly accessible URL (e.g., http://localhost:9002 for local dev).");
         }
      } else {
        displayError = err.message || `An unexpected error during '${stepInProgress}'.`;
      }
      setError(displayError);
    } finally {
      console.log("[LoginFlow] handleVerifySmsOtpAndLogin finally block. Setting isLoading to false.");
      setIsLoading(false);
      setStepInProgress('idle'); 
    }
  };


  const renderStep = () => {
    switch (step) {
      case "enterWaiterOtp":
        if (waiterOtpSubStep === "initialInstruction") {
          return (
            <>
              <CardHeader key="header-waiter-instr">
                <CardTitle className="text-2xl text-center">Confirm Presence</CardTitle>
                <CardDescription className="text-center">
                  Welcome to The Tasty Spoon!
                </CardDescription>
              </CardHeader>
              <CardContent key="content-waiter-instr">
                <p className="text-sm text-muted-foreground text-center">
                  To ensure you are at the table, please ask your waiter for a one-time code.
                </p>
              </CardContent>
              <CardFooter className="flex flex-col" key="footer-waiter-instr">
                {error && <p className="text-sm text-destructive mb-4 text-center">{error}</p>}
                <Button onClick={() => handleWaiterOtpInstructionProceed(false)} className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Request OTP
                </Button>
              </CardFooter>
            </>
          );
        }
        return (
          <>
            <CardHeader key="header-waiter-otp">
              <CardTitle className="text-2xl text-center">Enter Waiter OTP</CardTitle>
              <CardDescription className="text-center">
                Enter the 6-digit OTP provided by your waiter.
                {waiterOtpAttemptsLeft !== null && waiterOtpAttemptsLeft > 0 && <span className="block text-xs text-muted-foreground mt-1">Attempts left: {waiterOtpAttemptsLeft}</span>}
                {waiterOtpAttemptsLeft === 0 && <span className="block text-xs text-destructive mt-1">No attempts left for this OTP. Please request a new one.</span>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex flex-col items-center" key="content-waiter-otp">
              <div className="space-y-2">
                <InputOTP
                  maxLength={6}
                  value={waiterOtp}
                  onChange={(value) => setWaiterOtp(value)}
                  disabled={isLoading || waiterOtpAttemptsLeft === 0}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2" key="footer-waiter-otp">
              {error && <p className="text-sm text-destructive mb-2 text-center">{error}</p>}
              <Button
                onClick={handleConfirmPresence}
                className="w-full"
                disabled={isLoading || waiterOtp.length !== 6 || waiterOtpAttemptsLeft === 0}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Presence
              </Button>
              <Button
                variant="default" 
                onClick={() => handleWaiterOtpInstructionProceed(true)}
                className="w-full"
                disabled={isLoading || reRequestWaiterOtpCountdown > 0}
              >
                {isLoading && reRequestWaiterOtpCountdown > 0 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                 Re-Request OTP
                {reRequestWaiterOtpCountdown > 0 && ` (${Math.floor(reRequestWaiterOtpCountdown / 60)}:${String(reRequestWaiterOtpCountdown % 60).padStart(2, '0')})`}
              </Button>
               <Button
                variant="link"
                size="sm"
                onClick={() => {
                  authContext.logout(); 
                  setWaiterApiUuid(null);
                  setWaiterOtp("");
                  setError(null);
                  setWaiterOtpSubStep("initialInstruction");
                  if (reRequestWaiterIntervalRef.current) clearInterval(reRequestWaiterIntervalRef.current);
                  setReRequestWaiterOtpCountdown(0);
                  router.push('/'); 
                }}
                className="mt-1"
                disabled={isLoading}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Vacate Table
              </Button>
            </CardFooter>
          </>
        );
      case "enterPhone":
        return (
          <>
            <CardHeader key="header-phone">
              <CardTitle className="text-2xl">Enter Your Phone Number</CardTitle>
              <CardDescription>
                We'll send an OTP to verify your 10-digit phone number. (India +91 assumed).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4" key="content-phone">
              <div className="space-y-2">
                <div className="flex items-center">
                  <span className="inline-flex items-center px-3 h-10 border border-r-0 rounded-l-md bg-muted text-muted-foreground text-sm">
                    +91
                  </span>
                  <Input
                    id="phoneNumber"
                    type="text"
                    inputMode="numeric"
                    placeholder="eg: 9876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    maxLength={10}
                    className="rounded-l-none flex-1 placeholder:italic placeholder:text-muted-foreground/70"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col" key="footer-phone">
              {error && <p className="text-sm text-destructive mb-4 text-center">{error}</p>}
              <Button onClick={handleSendSmsOtp} className="w-full" disabled={isLoading || phoneNumber.length !== 10}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Login
              </Button>
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  authContext.logout(); 
                  setWaiterApiUuid(null);
                  setWaiterOtp("");
                  setWaiterOtpSubStep("initialInstruction");
                  if (reRequestWaiterIntervalRef.current) clearInterval(reRequestWaiterIntervalRef.current);
                  setReRequestWaiterOtpCountdown(0);
                  setStep("enterWaiterOtp"); 
                  setError(null);
                }}
                className="mt-2"
                disabled={isLoading}
              >
                <LogOut className="mr-2 h-4 w-4" />
                 Vacate Table
              </Button>
            </CardFooter>
          </>
        );
      case "verifyPhoneOtp":
        return (
          <>
            <CardHeader key="header-phone-otp">
              <CardTitle className="text-2xl text-center">Verify Phone OTP</CardTitle>
              <CardDescription className="text-center">
                Enter the 6-digit OTP sent to +91{phoneNumber}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex flex-col items-center" key="content-phone-otp">
              <div className="space-y-2">
                <InputOTP
                  id="smsOtpInput"
                  maxLength={6}
                  value={enteredSmsOtp}
                  onChange={(value) => setEnteredSmsOtp(value)}
                  disabled={isLoading}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col" key="footer-phone-otp">
              {error && <p className="text-sm text-destructive mb-4 text-center">{error}</p>}
              <Button onClick={handleVerifySmsOtpAndLogin} className="w-full" disabled={isLoading || enteredSmsOtp.length !== 6}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify & Login
              </Button>
              <Button
                variant="link"
                size="sm"
                onClick={handleSendSmsOtp}
                className="mt-2"
                disabled={isLoading || !canResendSmsOtp || isSmsOtpGenerationRequestInFlight.current}
              >
                {isLoading && isSmsOtpGenerationRequestInFlight.current ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Resend OTP {resendSmsOtpCountdown > 0 ? `(${resendSmsOtpCountdown}s)` : ''}
              </Button>
              <Button variant="link" size="sm" onClick={() => { setStep("enterPhone"); setError(null); setEnteredSmsOtp(""); setSmsOtpUuid(null); clearInterval(resendSmsOtpIntervalRef.current!); setCanResendSmsOtp(true); setResendSmsOtpCountdown(0); }} className="mt-1" disabled={isLoading}>
                Change phone number
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

    