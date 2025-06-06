
// src/app/api/session/confirm-payment/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const EXTERNAL_API_BASE_URL = "https://catalogue.snapordereat.in";

const ConfirmPaymentBodySchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  // We don't need razorpay details here if the external API only needs sessionId and its own secret key
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = ConfirmPaymentBodySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request body', 
        details: validationResult.error.flatten().fieldErrors 
      }, { status: 400 });
    }

    const { sessionId } = validationResult.data;
    const paymentConfKey = process.env.PAYMENT_CONF_KEY;

    if (!paymentConfKey) {
      console.error("[API /confirm-payment] PAYMENT_CONF_KEY is not set in environment variables.");
      return NextResponse.json({ success: false, error: 'Payment confirmation configuration error on server.' }, { status: 500 });
    }

    console.log(`[API /confirm-payment] Attempting to confirm payment for session: ${sessionId}`);

    const externalResponse = await fetch(`${EXTERNAL_API_BASE_URL}/session/paymentconfirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sessionId: sessionId,
        signedPaymentKey: paymentConfKey 
      }),
    });

    const responseData = await externalResponse.json();

    if (!externalResponse.ok) {
      console.error(`[API /confirm-payment] External API error for session ${sessionId}. Status: ${externalResponse.status}`, responseData);
      // Relay the error message from the external API if available
      return NextResponse.json({ 
        success: false, 
        error: responseData.message || responseData.error || `External API failed with status ${externalResponse.status}`,
        details: responseData // include full external error if any
      }, { status: externalResponse.status });
    }

    // Assuming success means the external API returned 200 OK and valid session data
    console.log(`[API /confirm-payment] Payment confirmed successfully by external API for session: ${sessionId}`, responseData);
    return NextResponse.json({ 
      success: true, 
      message: "Payment confirmed successfully.",
      sessionId: responseData.sessionId,
      billId: responseData.billId,
      paymentStatus: responseData.paymentStatus 
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API /confirm-payment] Internal server error:', error);
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
        return NextResponse.json({ success: false, error: 'Invalid JSON in request body to /api/session/confirm-payment' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Internal Server Error while confirming payment.' }, { status: 500 });
  }
}
