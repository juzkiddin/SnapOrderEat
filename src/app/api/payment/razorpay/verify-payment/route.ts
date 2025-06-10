
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
// store import removed as we are no longer updating bill status here

const VerifyPaymentSchema = z.object({
  razorpay_payment_id: z.string(),
  razorpay_order_id: z.string(), 
  razorpay_signature: z.string(),
  original_bill_id: z.string().min(1, "Original Bill ID is required"), 
});

const generatedSignature = (razorpayOrderId: string, razorpayPaymentId: string) => {
  const keySecret = process.env.RAZORPAY_SECRET_KEY;
  if (!keySecret) {
    console.error('[API Error] Razorpay key secret is not defined in environment variables.');
    throw new Error('Razorpay key secret is not defined in environment variables.');
  }
  const sig = crypto
    .createHmac('sha256', keySecret)
    .update(razorpayOrderId + '|' + razorpayPaymentId)
    .digest('hex');
  return sig;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json(); 
    const validationResult = VerifyPaymentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request body for verification', details: validationResult.error.flatten().fieldErrors, isOk: false }, { status: 400 });
    }

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, original_bill_id } = validationResult.data;
    
    console.log(`[API /verify-payment] Received request to verify Razorpay payment for App Bill ID: ${original_bill_id}`);
    console.log(`[API /verify-payment] Razorpay Payment ID: ${razorpay_payment_id}, Razorpay Order ID: ${razorpay_order_id}`);

    const expectedSignature = generatedSignature(razorpay_order_id, razorpay_payment_id); 

    if (expectedSignature !== razorpay_signature) {
      console.error("[API /verify-payment] Payment signature verification failed.");
      return NextResponse.json({ message: 'Payment verification failed. Invalid signature.', isOk: false }, { status: 400 });
    }
    
    console.log("[API /verify-payment] Payment signature verified successfully.");
    // Bill status update logic removed. This should be handled by a flow that calls the external /session/paymentconfirm API.
    // This endpoint now primarily serves to confirm the signature.
    // For a real application, a successful verification here (e.g., from a webhook)
    // would trigger a call to the main system's payment confirmation logic.
    return NextResponse.json({ message: "Payment signature verified successfully.", isOk: true }, { status: 200 });

  } catch (error: any) {
    console.error('[API /verify-payment] Error during payment verification:', error);
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
        return NextResponse.json({ success: false, error: 'Invalid JSON in request body to /api/payment/razorpay/verify-payment' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Internal Server Error during payment verification.' }, { status: 500 });
  }
}

