
import { NextResponse } from 'next/server';
import { sampleMenuData, categoryOrder as localCategoryOrder, categoryIcons as localCategoryIconsMap } from '@/lib/dataValues';
import type { MenuItemType } from '@/types';

const EXTERNAL_CATEGORIES_API_URL = 'https://catalogue.snapordereat.in/catalogue/categories';
const EXTERNAL_CATEGORY_ICONS_API_URL = 'https://catalogue.snapordereat.in/catalogue/categoryicons';

async function fetchCategoriesFromExternalAPI(): Promise<string[] | null> {
  const restaurantId = process.env.RESTAURANT_ID;

  if (!restaurantId) {
    console.warn('[API /menu] RESTAURANT_ID environment variable is not set. Cannot fetch external categories.');
    return null;
  }
  console.log('[API /menu] Fetching categories from external API...');
  try {
    const response = await fetch(EXTERNAL_CATEGORIES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ restaurantId: restaurantId }),
      cache: 'no-store', // Ensure fresh data
    });

    if (!response.ok) {
      console.error(`[API /menu] External Categories API Error: Status ${response.status} - ${await response.text()}`);
      return null;
    }
    const data = await response.json();
    if (data && Array.isArray(data.categories)) {
      console.log('[API /menu] Successfully fetched categories:', data.categories);
      return data.categories;
    }
    console.error('[API /menu] External Categories API Error: Invalid response format', data);
    return null;
  } catch (error) {
    console.error('[API /menu] External Categories API Error: Failed to fetch categories', error);
    return null;
  }
}

async function fetchCategoryIconsFromExternalAPI(): Promise<{ [key: string]: string } | null> {
  const restaurantId = process.env.RESTAURANT_ID;

  if (!restaurantId) {
    console.warn('[API /menu] RESTAURANT_ID environment variable is not set. Cannot fetch external category icons.');
    return null;
  }
  console.log('[API /menu] Fetching category icons from external API...');
  try {
    const response = await fetch(EXTERNAL_CATEGORY_ICONS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ restaurantId: restaurantId }),
      cache: 'no-store', // Ensure fresh data
    });
    
    if (!response.ok) {
      console.error(`[API /menu] External Category Icons API Error: Status ${response.status} - ${await response.text()}`);
      return null;
    }
    const data = await response.json();
    // The API returns { "Drinks": "GlassWater", ... } which matches { [key: string]: string }
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        // Validate that values are strings
        for (const key in data) {
            if (typeof data[key] !== 'string') {
                console.error('[API /menu] External Category Icons API Error: Invalid icon name format for key', key, data[key]);
                return null; 
            }
        }
        console.log('[API /menu] Successfully fetched category icons:', data);
        return data;
    }
    console.error('[API /menu] External Category Icons API Error: Invalid response format for icons', data);
    return null;
  } catch (error) {
    console.error('[API /menu] External Category Icons API Error: Failed to fetch category icons', error);
    return null;
  }
}


export async function GET() {
  console.log('[API /menu] GET request received.');
  try {
    const restaurantId = process.env.RESTAURANT_ID;
    let activeCategoryOrder: string[];
    let activeIconNameMap: { [key: string]: string };

    if (restaurantId) {
      console.log('[API /menu] RESTAURANT_ID is set. Attempting to fetch external data concurrently.');
      // Fetch categories and icons concurrently
      const [fetchedCategoryNames, fetchedIconNameMap] = await Promise.all([
        fetchCategoriesFromExternalAPI(),
        fetchCategoryIconsFromExternalAPI()
      ]);

      if (fetchedCategoryNames) {
        activeCategoryOrder = fetchedCategoryNames;
        console.log('[API /menu] Using category names from external API:', activeCategoryOrder);
      } else {
        activeCategoryOrder = localCategoryOrder; // Fallback
        console.error('[API /menu] Failed to fetch external category names. Using local fallback for category order:', localCategoryOrder);
      }

      if (fetchedIconNameMap) {
        activeIconNameMap = fetchedIconNameMap;
        console.log('[API /menu] Using category icon names from external API:', activeIconNameMap);
      } else {
        activeIconNameMap = localCategoryIconsMap; // Fallback
        console.error('[API /menu] Failed to fetch external category icon names. Using local fallback for icon names:', localCategoryIconsMap);
      }
    } else {
      console.warn('[API /menu] RESTAURANT_ID not set. Using local fallbacks for categories and icons.');
      activeCategoryOrder = localCategoryOrder;
      activeIconNameMap = localCategoryIconsMap;
    }
    
    const categoriesForClient = activeCategoryOrder.map(catName => ({
      name: catName,
      iconName: activeIconNameMap[catName] || 'Info', // Default to 'Info' icon string if not found
    }));

    console.log('[API /menu] Responding with menu data. Number of categories:', categoriesForClient.length);
    return NextResponse.json({
      menuItems: sampleMenuData as MenuItemType[], // Sample items are still local
      categories: categoriesForClient,
    }, { status: 200 });

  } catch (error) {
    console.error('[API /menu] Overall API Error fetching menu:', error);
    return NextResponse.json({ error: 'Internal Server Error fetching menu' }, { status: 500 });
  }
}
