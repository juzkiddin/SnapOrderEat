
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { store } from '@/lib/apiStore';

interface Params {
  params: { orderId: string };
}

// GET /api/orders/[orderId] - Get a specific order by ID
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { orderId } = params;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId parameter is required' }, { status: 400 });
    }

    const order = store.orders.find(o => o.id === orderId);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order, { status: 200 });
  } catch (error) {
    console.error(`API Error fetching order ${params.orderId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
