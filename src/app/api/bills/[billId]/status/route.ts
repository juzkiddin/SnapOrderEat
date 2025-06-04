
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { store } from '@/lib/apiStore';
// Reverted: Zod import removed
// import { z } from 'zod';

// Reverted: Enum and Zod schema removed
type PaymentStatus = 'Pending' | 'Completed'; // Basic type definition
// const PaymentStatusSchema = z.enum(['Pending', 'Completed']);
// type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

// const StatusUpdateBodySchema = z.object({
//   status: PaymentStatusSchema,
// });

// Reverted: Interface based on simple type
interface StatusUpdateBody {
  status: PaymentStatus;
}

interface Params {
  params: { billId: string };
}

// GET /api/bills/[billId]/status - Get payment status of a bill
export async function GET(request: NextRequest, { params }: Params) {
  // Reverted: Simplified, assumes params.billId exists for the core logic. No try-catch.
  const { billId } = params;
  // console.log(`GET /api/bills/${billId}/status invoked. Params:`, params);


  const bill = store.bills.find(b => b.id === billId);

  if (!bill) {
    // console.warn(`Bill not found for ID: ${billId}`);
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  }

  return NextResponse.json({ paymentStatus: bill.paymentStatus }, { status: 200 });
}

// POST /api/bills/[billId]/status - Update payment status of a bill
export async function POST(request: NextRequest, { params }: Params) {
  // Reverted: Simplified, assumes params.billId exists. No try-catch, no Zod validation.
  const { billId } = params;
  // console.log(`POST /api/bills/${billId}/status invoked. Params:`, params);

  const body = await request.json(); // This can throw if JSON is invalid
  const { status } = body as StatusUpdateBody; // Original, less safe type assertion

  const billIndex = store.bills.findIndex(b => b.id === billId);

  if (billIndex === -1) {
    // console.warn(`Bill not found for ID during POST: ${billId}`);
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  }

  store.bills[billIndex].paymentStatus = status;
  if (status === 'Completed' && !store.bills[billIndex].paymentMethod) {
    store.bills[billIndex].paymentMethod = 'Cash'; // Default to Cash if completed via this route
  }


  return NextResponse.json({ success: true, message: `Bill ${billId} status updated to ${status}`, paymentStatus: status }, { status: 200 });
}
