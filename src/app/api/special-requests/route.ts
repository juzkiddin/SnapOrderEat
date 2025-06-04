
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { store } from '@/lib/apiStore'; // To check if billId exists

const SpecialRequestSchema = z.object({
  billId: z.string().min(1, "Bill ID is required"),
  requestText: z.string().min(1, "Request text cannot be empty").max(500, "Request text is too long"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = SpecialRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }

    const { billId, requestText } = validationResult.data;

    // Optional: Check if the billId actually exists in our store
    const billExists = store.bills.some(bill => bill.id === billId);
    if (!billExists) {
      return NextResponse.json({ error: `Bill with ID ${billId} not found.` }, { status: 404 });
    }

    // Simulate processing the request (e.g., logging, sending to a kitchen display system)
    console.log(`Special Request for Bill ID [${billId}]: ${requestText}`);

    return NextResponse.json({ success: true, message: 'Special request received.' }, { status: 200 });

  } catch (error: any) {
    console.error('API Error processing special request:', error);
    if (error instanceof SyntaxError) { // Handles JSON parsing errors
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error processing special request' }, { status: 500 });
  }
}
