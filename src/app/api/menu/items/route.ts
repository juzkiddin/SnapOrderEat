
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import type { MenuItemType } from '@/types';

const EXTERNAL_CATEGORY_ITEMS_API_URL = 'https://catalogue.snapordereat.in/catalogue/categoryitems';

const GetCategoryItemsBodySchema = z.object({
  categoryName: z.string().min(1, "Category name is required"),
});

interface ExternalItem {
  id: number;
  name: string | null;
  description: string | null;
  price: number | null;
  category: string | null;
  imageUrl: string | null;
  availStatus?: boolean; // Optional in external API, will default to true
  portionAvail?: boolean;
  portionPrices?: { [key: string]: number };
  dataAiHint?: string; // Keep if external API might send it
}

export async function POST(request: NextRequest) {
  console.log('[API /api/menu/items] Received POST request.');
  let categoryName;

  try {
    const body = await request.json();
    const validationResult = GetCategoryItemsBodySchema.safeParse(body);

    if (!validationResult.success) {
      console.error('[API /api/menu/items] Invalid request body:', validationResult.error.flatten().fieldErrors);
      return NextResponse.json({ error: 'Invalid request body', details: validationResult.error.flatten().fieldErrors }, { status: 400 });
    }
    
    categoryName = validationResult.data.categoryName;
    console.log(`[API /api/menu/items] Validated categoryName: ${categoryName}`);

    const restaurantId = process.env.RESTAURANT_ID;

    if (!restaurantId) {
      console.error('[API /api/menu/items] RESTAURANT_ID environment variable is not set.');
      return NextResponse.json({ error: 'Restaurant configuration error on server.' }, { status: 500 });
    }
    console.log(`[API /api/menu/items] Using RESTAURANT_ID: ${restaurantId}`);

    console.log(`[API /api/menu/items] Fetching items for category '${categoryName}' from external API: ${EXTERNAL_CATEGORY_ITEMS_API_URL}`);
    const externalResponse = await fetch(EXTERNAL_CATEGORY_ITEMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ restaurantId, categoryName }),
      cache: 'no-store', // Ensure fresh data from the external API
    });

    console.log(`[API /api/menu/items] External API response status: ${externalResponse.status}`);

    if (!externalResponse.ok) {
      let errorBody = 'Failed to fetch items from external source.';
      try {
        errorBody = await externalResponse.text(); // Try to get text first
        const jsonData = JSON.parse(errorBody); // Then try to parse as JSON
        console.error(`[API /api/menu/items] External API error (${externalResponse.status}):`, jsonData.message || errorBody);
        return NextResponse.json({ error: `External API Error: ${jsonData.message || errorBody}` }, { status: externalResponse.status });
      } catch (e) {
         console.error(`[API /api/menu/items] External API error (${externalResponse.status}). Response not JSON or unparseable: ${errorBody.substring(0, 200)}...`);
      }
      return NextResponse.json({ error: `External API Error: ${errorBody}` }, { status: externalResponse.status });
    }

    const externalItems: ExternalItem[] = await externalResponse.json();
    console.log('[API /api/menu/items] Raw items received from external API:', JSON.stringify(externalItems, null, 2).substring(0, 1000) + (JSON.stringify(externalItems, null, 2).length > 1000 ? '...' : ''));


    const transformedItems: MenuItemType[] = externalItems.map((item: ExternalItem) => ({
      id: String(item.id), // Convert number to string
      name: item.name || 'Unnamed Item',
      description: item.description || '', // Handle null description
      price: typeof item.price === 'number' ? item.price : 0, // Handle null price, default to 0
      category: item.category || categoryName, // Use categoryName from request if item.category is null/missing
      imageUrl: item.imageUrl || `https://placehold.co/320x180.png`, // Default placeholder
      dataAiHint: item.dataAiHint || `${item.name ? item.name.toLowerCase().split(' ').slice(0,2).join(' ') : 'food item'}`,
      availStatus: item.availStatus !== undefined ? item.availStatus : true, // Default to true if not provided
      portionId: item.portionAvail ? '0001' : '0000', // Map portionAvail to portionId
      portionPrices: item.portionAvail && item.portionPrices ? item.portionPrices : undefined,
    }));
    
    console.log(`[API /api/menu/items] Transformed ${transformedItems.length} items for category '${categoryName}'. First item (if any):`, JSON.stringify(transformedItems[0], null, 2));
    return NextResponse.json(transformedItems, { status: 200 });

  } catch (error: any) {
    console.error(`[API /api/menu/items] Internal server error for category '${categoryName || 'unknown'}':`, error.message, error.stack);
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
        return NextResponse.json({ error: 'Invalid JSON in request body to /api/menu/items' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error while fetching category items.' }, { status: 500 });
  }
}
