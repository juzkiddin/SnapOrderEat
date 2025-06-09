
// src/app/api/session/check-status/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const EXTERNAL_API_BASE_URL = "https://catalogue.snapordereat.in";

const CheckStatusBodySchema = z.object({
  sessionId: z.string().uuid("Session ID must be a UUID"),
  tableId: z.string().min(1, "Table ID is required"),
});

export async function POST(request: NextRequest) {
  console.log('[API /check-status] Received POST request.');
  let requestData;

  try {
    const body = await request.json();
    const validationResult = CheckStatusBodySchema.safeParse(body);

    if (!validationResult.success) {
      console.error('[API /check-status] Invalid request body:', validationResult.error.flatten().fieldErrors);
      return NextResponse.json({
        success: false,
        error: 'Invalid request body to /check-status',
        details: validationResult.error.flatten().fieldErrors
      }, { status: 400 });
    }

    requestData = validationResult.data;
    const { sessionId, tableId } = requestData;
    console.log(`[API /check-status] Validated request data: sessionId: ${sessionId}, tableId: ${tableId}`);

    const restaurantId = process.env.RESTAURANT_ID;
    if (!restaurantId) {
      console.error('[API /check-status] RESTAURANT_ID environment variable is not set on the server.');
      return NextResponse.json({ success: false, error: 'Server configuration error (restaurant ID missing).' }, { status: 500 });
    }
    console.log(`[API /check-status] Using RESTAURANT_ID: ${restaurantId} from server env.`);

    const requestBodyForExternalAPI = {
      restaurantId,
      sessionId,
      tableId,
    };
    console.log('[API /check-status] Request body for external API (/session/sessionstatus):', JSON.stringify(requestBodyForExternalAPI));

    const externalResponse = await fetch(`${EXTERNAL_API_BASE_URL}/session/sessionstatus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBodyForExternalAPI),
      cache: 'no-store',
    });

    console.log(`[API /check-status] External API /session/sessionstatus response status: ${externalResponse.status}`);

    let externalResponseData;
    let responseTextForError = "";
    try {
        const text = await externalResponse.text();
        responseTextForError = text;
        externalResponseData = JSON.parse(text);
        console.log('[API /check-status] External API response JSON:', JSON.stringify(externalResponseData));
    } catch (e) {
        console.error('[API /check-status] Failed to parse JSON from external API response. Status:', externalResponse.status, 'Response Text Snippet:', responseTextForError.substring(0, 200));
        if (!externalResponse.ok) {
            if (externalResponse.status === 404) {
                 return NextResponse.json({ success: false, sessionStatus: "NotFound", paymentStatus: null, message: `External API returned 404 Not Found (non-JSON response). Session ID: ${sessionId}` }, { status: 404 });
            }
            return NextResponse.json({ success: false, error: `External API request failed with status ${externalResponse.status}. Response was not valid JSON.`, paymentStatus: null }, { status: externalResponse.status });
        }
        externalResponseData = { error: "External API response was OK but not valid JSON.", sessionStatus: "Active", paymentStatus: null }; // Default to Active/null if OK but non-JSON
    }

    if (!externalResponse.ok) {
      if (externalResponse.status === 404) {
        return NextResponse.json({
          success: false,
          sessionStatus: "NotFound",
          paymentStatus: externalResponseData?.paymentStatus || null, // Include paymentStatus if available in error
          message: externalResponseData?.message || `Session ID ${sessionId} not found by external API.`,
          details: externalResponseData
        }, { status: 404 });
      }
      return NextResponse.json({
        success: false,
        error: externalResponseData?.message || externalResponseData?.error || `External API failed with status ${externalResponse.status}`,
        paymentStatus: externalResponseData?.paymentStatus || null, // Include paymentStatus
        details: externalResponseData
      }, { status: externalResponse.status });
    }

    // If externalResponse.ok is true, we expect sessionStatus and potentially paymentStatus
    if (externalResponseData && externalResponseData.sessionStatus) {
      console.log(`[API /check-status] External API success. Returning sessionStatus: ${externalResponseData.sessionStatus}, paymentStatus: ${externalResponseData.paymentStatus}`);
      return NextResponse.json({
        success: true,
        sessionStatus: externalResponseData.sessionStatus,
        paymentStatus: externalResponseData.paymentStatus // Relay paymentStatus
      }, { status: 200 });
    } else {
      console.error('[API /check-status] External API response was OK, but sessionStatus was missing or invalid.', externalResponseData);
      return NextResponse.json({ success: false, error: 'Invalid response format from external session status API.', paymentStatus: null }, { status: 500 });
    }

  } catch (error: any) {
    console.error(`[API /check-status] Internal server error:`, error.message, error.stack);
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
        return NextResponse.json({ success: false, error: 'Invalid JSON in request body to /api/session/check-status', paymentStatus: null }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Internal Server Error while checking session status.', paymentStatus: null }, { status: 500 });
  }
}
