
import { NextResponse } from 'next/server';
import { sampleMenuData, categoryOrder as localCategoryOrder, categoryIcons as localCategoryIcons } from '@/lib/dataValues';
import type { MenuItemType } from '@/types';

// In a real app, you'd fetch this from a database.
// We are also sending categoryStructure to maintain order and icons for simplicity.
// Icons themselves cannot be serialized, so we'll map names on the client.

const EXTERNAL_CATEGORIES_API_URL = 'https://catalogue.snapordereat.in/catalouge/categories';

async function fetchCategoriesFromExternalAPI(): Promise<string[] | null> {
  const restaurantId = process.env.RESTAURANT_ID;

  if (!restaurantId) {
    console.warn('RESTAURANT_ID environment variable is not set. Cannot fetch external categories.');
    return null;
  }

  try {
    const response = await fetch(EXTERNAL_CATEGORIES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ restaurantId: restaurantId }),
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
      if (process.env.RESTAURANT_ID) {
        // RESTAURANT_ID was set, so failure was likely an API issue.
        // fetchCategoriesFromExternalAPI would have already logged a specific error.
        console.error('Error fetching categories from external API (details likely logged above by the fetch utility). Using local fallback.', activeCategoryOrder);
      } else {
        // RESTAURANT_ID was not set. fetchCategoriesFromExternalAPI already logged a warning.
        // This console.warn just confirms fallback action.
        console.warn('RESTAURANT_ID not set. Using local fallback for categories.', activeCategoryOrder);
      }
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

