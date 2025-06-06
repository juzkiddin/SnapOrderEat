
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
// store import removed as it's no longer used for bill validation here

const SpecialRequestSchema = z.object({
  // Changed from billId to sessionId as per typical session-based flows,
  // but the new external session API returns both. BillId might be more persistent for KDS.
  // Let's assume for now billId is still the relevant identifier for kitchen/special requests.
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

    // With the external session API, direct validation of billId against an in-memory store is removed.
    // We trust that the client has a valid billId from an active session.
    // If stricter validation is needed, this API would need to call the external /session/createsession
    // or a new /session/validate endpoint, but that might be overkill for special requests.

    console.log(`Special Request for Bill ID [${billId}]: ${requestText}`);
    // Here, you would integrate with your Kitchen Display System (KDS) or logging service.

    return NextResponse.json({ success: true, message: 'Special request received and logged.' }, { status: 200 });

  } catch (error: any) {
    console.error('API Error processing special request:', error);
    if (error instanceof SyntaxError) { // Handles JSON parsing errors
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error processing special request' }, { status: 500 });
  }
}
