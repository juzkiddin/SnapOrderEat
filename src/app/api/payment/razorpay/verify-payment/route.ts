
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { store } from '@/lib/apiStore'; // To update our bill status

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
  // Reverted: Removed outer try-catch block. Errors from generatedSignature or JSON parsing might lead to HTML error pages.
  const body = await request.json(); // This can throw SyntaxError for invalid JSON
  const validationResult = VerifyPaymentSchema.safeParse(body);

  if (!validationResult.success) {
    return NextResponse.json({ error: 'Invalid request body for verification', details: validationResult.error.flatten().fieldErrors, isOk: false }, { status: 400 });
  }

  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, original_bill_id } = validationResult.data;
  
  console.log(`[API] Received request to verify Razorpay payment for App Bill ID: ${original_bill_id}`);
  console.log(`[API] Razorpay Payment ID: ${razorpay_payment_id}, Razorpay Order ID: ${razorpay_order_id}`);

  const expectedSignature = generatedSignature(razorpay_order_id, razorpay_payment_id); // This can throw if RAZORPAY_SECRET_KEY is missing

  if (expectedSignature !== razorpay_signature) {
    console.error("[API] Payment signature verification failed.");
    return NextResponse.json({ message: 'Payment verification failed. Invalid signature.', isOk: false }, { status: 400 });
  }
  
  console.log("[API] Payment signature verified successfully.");

  const billIndex = store.bills.findIndex(b => b.id === original_bill_id);
  if (billIndex !== -1) {
    store.bills[billIndex].paymentStatus = 'Completed';
    store.bills[billIndex].razorpayPaymentId = razorpay_payment_id; // Store Razorpay Payment ID
    store.bills[billIndex].paymentMethod = 'Online'; // Set payment method
    console.log(`[API] Bill ID ${original_bill_id} status updated to 'Completed' in apiStore.`);
    return NextResponse.json({ message: "Payment verified successfully and bill updated.", isOk: true }, { status: 200 });
  } else {
    console.error(`[API] Bill ID ${original_bill_id} not found in apiStore during verification, but payment was valid.`);
    return NextResponse.json({ message: "Payment verified, but original bill not found in our records.", isOk: true }, { status: 200 });
  }
  // Note: The catch block for SyntaxError or other errors was not present in this simpler, earlier version.
  // An unhandled error here (e.g., from await request.json() or generatedSignature) would result in a 500 HTML page.
}
