
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import Razorpay from 'razorpay';
// import { store } from '@/lib/apiStore'; // To potentially log or link the Razorpay order to our bill

const CreateOrderSchema = z.object({
  billId: z.string().min(1, "Bill ID is required"),
  amount: z.number().positive("Amount must be a positive number"), // Amount in rupees
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = CreateOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { billId, amount } = validationResult.data;
    const amountInPaise = Math.round(amount * 100); // Razorpay expects amount in paise

    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || !process.env.RAZORPAY_SECRET_KEY) {
      console.error("[API Error] Razorpay Key ID or Secret Key not set in environment variables.");
      return NextResponse.json({ error: 'Payment gateway configuration error.' }, { status: 500 });
    }

    const razorpayInstance = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_SECRET_KEY!,
    });

    // Generate a shorter receipt ID
    const shortReceiptId = `rcpt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: shortReceiptId, // Using the shorter receipt ID
      notes: {
        snap_order_eat_bill_id: billId, // Your application's bill ID
      }
    };

    console.log(`[API] Creating Razorpay order for Bill ID: ${billId}, Amount: ${amount} (Paise: ${amountInPaise}), Receipt: ${shortReceiptId}`);
    
    const razorpayOrder = await razorpayInstance.orders.create(options);
    console.log("[API] Razorpay Order Created:", razorpayOrder);
    
    // Optional: You might want to store razorpayOrder.id associated with your billId in your database here
    // For example: updateBillInStore(billId, { razorpayOrderId: razorpayOrder.id });

    return NextResponse.json({
      success: true,
      order_id: razorpayOrder.id, // This is Razorpay's order_id
      amount: razorpayOrder.amount, // Amount in paise as returned by Razorpay
      currency: razorpayOrder.currency,
    }, { status: 200 });

  } catch (error: any) {
    console.error('API Error creating Razorpay order:', error);
    if (error.statusCode && error.error && error.error.description) { // For Razorpay specific errors
        return NextResponse.json({ error: `Razorpay Error: ${error.error.description}` }, { status: error.statusCode });
    }
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error while creating Razorpay order.' }, { status: 500 });
  }
}
