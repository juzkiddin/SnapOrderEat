
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { store } from '@/lib/apiStore';
import type { OrderType, CartItemType, OrderItemType, OrderStatus } from '@/types';
import { z } from 'zod';

// Basic validation for cart items - can be expanded
const CartItemSchema = z.object({
  menuItem: z.object({ // Basic structure, could be more detailed
    id: z.string(),
    name: z.string(),
    price: z.number(),
    imageUrl: z.string().url().optional(), // Making URL optional as it might not always be sent from client
    dataAiHint: z.string().optional(),
  }),
  quantity: z.number().int().min(1),
  selectedPortion: z.string().optional(),
  priceInCart: z.number(),
});

const CreateOrderRequestBodySchema = z.object({
  billId: z.string().min(1, "Bill ID is required"),
  cartItems: z.array(CartItemSchema).min(1, "Cart cannot be empty"),
  specialRequests: z.string().optional(), // Assuming specialRequests is optional
  total: z.number().positive("Total must be a positive number"),
});

interface CreateOrderRequestBody extends z.infer<typeof CreateOrderRequestBodySchema> {}

// POST /api/orders - Create a new order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = CreateOrderRequestBodySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }
    
    const { billId, cartItems, specialRequests = "", total } = validationResult.data;

    const orderItems: OrderItemType[] = cartItems.map((cartItem) => ({
      menuItem: cartItem.menuItem, // Assuming client sends enough menuItem data
      quantity: cartItem.quantity,
      selectedPortion: cartItem.selectedPortion,
      priceInOrder: cartItem.priceInCart,
      status: 'Pending' as OrderStatus,
    }));

    const newOrder: OrderType = {
      id: `ORDER-API-${billId}-${Date.now()}`,
      billId,
      items: orderItems,
      specialRequests,
      total,
      timestamp: new Date(),
    };

    store.orders.push(newOrder);

    return NextResponse.json(newOrder, { status: 201 });
  } catch (error: any) {
    console.error('API Error creating order:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET /api/orders?billId=[billId] - Get orders for a specific bill
export async function GET(request: NextRequest) {
  try {
    const billId = request.nextUrl.searchParams.get('billId');

    if (!billId || typeof billId !== 'string' || billId.trim() === '') {
      return NextResponse.json({ error: 'billId query parameter is required and must be a non-empty string' }, { status: 400 });
    }

    const billOrders = store.orders.filter(order => order.billId === billId)
                                  .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return NextResponse.json(billOrders, { status: 200 });
  } catch (error) {
    console.error('API Error fetching orders by billId:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
