
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// MOCKED_PHONE_OTP removed as phone OTP verification is now external
import { store } from '@/lib/apiStore';
import type { BillType } from '@/lib/apiStore';
import { z } from 'zod';

// phoneOtp is removed from the schema as it's verified externally now
const LoginRequestBodySchema = z.object({
  tableId: z.string().min(1, "Table ID is required"),
  waiterOtp: z.string().length(6, "Waiter OTP must be 6 characters (pre-verified by client)"),
  phoneNumber: z.string().min(10, "Phone number is required (pre-verified by client)"), 
  // phoneOtp: z.string().length(6, "Phone OTP must be 6 characters"), // Removed
});

interface LoginRequestBody extends z.infer<typeof LoginRequestBodySchema> {}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const validationResult = LoginRequestBodySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    // waiterOtp is still received but not validated here by this API. Its presence was confirmed by external API.
    // phoneOtp is no longer received or validated here.
    const { tableId, waiterOtp, phoneNumber } = validationResult.data;
    
    // Waiter OTP verification against MOCKED_WAITER_OTP has been removed.
    // It's assumed the client-side flow with the external OTP service has handled waiter presence.
    
    // Phone OTP verification against MOCKED_PHONE_OTP has been removed.
    // It's assumed the client-side flow with the external SMS OTP service has handled phone verification.
    // console.log(`Login attempt for ${phoneNumber}. Waiter OTP (client-verified): ${waiterOtp}. Phone (client-verified).`);


    // 2. Check for existing active bill for this table
    let activeBill = store.bills.find(
      (bill) => bill.tableId === tableId && bill.paymentStatus === 'Pending'
    );

    if (activeBill) {
      // If an active bill exists, associate the new phone number if it's different
      // or if the bill was somehow created without one (though less likely now).
      if (activeBill.phoneNumber !== phoneNumber) {
        console.log(`Resuming bill ${activeBill.id} for table ${tableId}, updating phone from ${activeBill.phoneNumber || 'N/A'} to ${phoneNumber}`);
        activeBill.phoneNumber = phoneNumber;
      } else {
        console.log(`Resuming bill ${activeBill.id} for table ${tableId} with phone ${phoneNumber}`);
      }

      return NextResponse.json({
        success: true,
        message: 'Login successful, existing bill resumed.',
        tableId: activeBill.tableId,
        phoneNumber: activeBill.phoneNumber,
        billId: activeBill.id,
      }, { status: 200 });
    }

    // 3. Create new bill if no active one
    const newBillId = `BILL-API-${tableId}-${Date.now()}`;
    const newBill: BillType = {
      id: newBillId,
      tableId,
      phoneNumber, // The phone number is now trusted as pre-verified
      paymentStatus: 'Pending',
      createdAt: new Date(),
    };
    store.bills.push(newBill);
    console.log(`New bill ${newBill.id} created for table ${tableId} with phone ${phoneNumber}`);

    return NextResponse.json({
      success: true,
      message: 'Login successful, new bill created.',
      tableId: newBill.tableId,
      phoneNumber: newBill.phoneNumber,
      billId: newBill.id,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Login API error:', error);
    if (error instanceof SyntaxError) { 
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
    