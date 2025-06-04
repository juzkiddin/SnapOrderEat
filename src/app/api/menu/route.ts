
import { NextResponse } from 'next/server';
import { sampleMenuData, categoryOrder as localCategoryOrder, categoryIcons as localCategoryIcons } from '@/lib/dataValues';
import type { MenuItemType } from '@/types';

// In a real app, you'd fetch this from a database.
// We are also sending categoryStructure to maintain order and icons for simplicity.
// Icons themselves cannot be serialized, so we'll map names on the client.

const EXTERNAL_CATEGORIES_API_URL = 'https://catalogue.snapordereat.in/catalouge/categories';

async function fetchCategoriesFromExternalAPI(): Promise<string[] | null> {
  try {
    const response = await fetch(EXTERNAL_CATEGORIES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ restaurantId: "tastyspoon" }),
    });

    if (!response.ok) {
      console.error(`External API Error: Status ${response.status} - ${await response.text()}`);
      return null;
    }
    const data = await response.json();
    if (data && Array.isArray(data.categories)) {
      return data.categories;
    }
    console.error('External API Error: Invalid response format', data);
    return null;
  } catch (error) {
    console.error('External API Error: Failed to fetch categories', error);
    return null;
  }
}

export async function GET() {
  try {
    // Simulate a network delay
    // await new Promise(resolve => setTimeout(resolve, 500));

    let activeCategoryOrder: string[];
    const fetchedCategories = await fetchCategoriesFromExternalAPI();

    if (fetchedCategories) {
      activeCategoryOrder = fetchedCategories;
      console.log('Using categories from external API:', activeCategoryOrder);
    } else {
      activeCategoryOrder = localCategoryOrder;
      console.warn('Failed to fetch categories from external API, using local fallback:', activeCategoryOrder);
    }

    // Prepare category data to send to client.
    // We send names and the client will map icons.
    const categories = activeCategoryOrder.map(catName => ({
      name: catName,
      // Note: We don't send the icon component itself over API
    }));

    return NextResponse.json({
      menuItems: sampleMenuData as MenuItemType[],
      categories: categories, // Sending ordered category names
    }, { status: 200 });

  } catch (error) {
    console.error('API Error fetching menu:', error);
    return NextResponse.json({ error: 'Internal Server Error fetching menu' }, { status: 500 });
  }
}
