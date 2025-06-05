
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { store } from '@/lib/apiStore';

interface Params {
  params: { billId: string };
}

// GET /api/bills/[billId]/validate - Check if a billId is valid in the server store
export async function GET(request: NextRequest, { params }: Params) {
  const { billId } = params;

  if (!billId) {
    return NextResponse.json({ error: 'Bill ID is required' }, { status: 400 });
  }

  // Check if the bill exists in the store.
  // For an active session, we might also want to check if it's 'Pending',
  // but for this validation, existence is the primary concern.
  const bill = store.bills.find(b => b.id === billId);

  if (bill) {
    // console.log(`[API Validate] Bill ${billId} found in store. Status: ${bill.paymentStatus}`);
    return NextResponse.json({ isValid: true }, { status: 200 });
  } else {
    // console.warn(`[API Validate] Bill ${billId} NOT found in store.`);
    return NextResponse.json({ isValid: false }, { status: 200 }); // Return 200 with isValid:false, not 404
  }
}
