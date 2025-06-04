
import { NextResponse } from 'next/server';
import { sampleMenuData, categoryOrder as localCategoryOrder, categoryIcons as localCategoryIconsMap } from '@/lib/dataValues';
import type { MenuItemType } from '@/types';

const EXTERNAL_CATEGORIES_API_URL = 'https://catalogue.snapordereat.in/catalouge/categories';
const EXTERNAL_CATEGORY_ICONS_API_URL = 'https://catalogue.snapordereat.in/catalouge/categoryicons';

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
      cache: 'no-store', // Ensure fresh data
    });

    if (!response.ok) {
      console.error(`External Categories API Error: Status ${response.status} - ${await response.text()}`);
      return null;
    }
    const data = await response.json();
    if (data && Array.isArray(data.categories)) {
      return data.categories;
    }
    console.error('External Categories API Error: Invalid response format', data);
    return null;
  } catch (error) {
    console.error('External Categories API Error: Failed to fetch categories', error);
    return null;
  }
}

async function fetchCategoryIconsFromExternalAPI(): Promise<{ [key: string]: string } | null> {
  const restaurantId = process.env.RESTAURANT_ID;

  if (!restaurantId) {
    console.warn('RESTAURANT_ID environment variable is not set. Cannot fetch external category icons.');
    return null;
  }

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
      console.error(`External Category Icons API Error: Status ${response.status} - ${await response.text()}`);
      return null;
    }
    const data = await response.json();
    // The API returns { "Drinks": "GlassWater", ... } which matches { [key: string]: string }
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        // Validate that values are strings
        for (const key in data) {
            if (typeof data[key] !== 'string') {
                console.error('External Category Icons API Error: Invalid icon name format for key', key, data[key]);
                return null; // Or handle partially
            }
        }
        return data;
    }
    console.error('External Category Icons API Error: Invalid response format for icons', data);
    return null;
  } catch (error) {
    console.error('External Category Icons API Error: Failed to fetch category icons', error);
    return null;
  }
}


export async function GET() {
  try {
    let activeCategoryOrder: string[];
    const fetchedCategoryNames = await fetchCategoriesFromExternalAPI();

    if (fetchedCategoryNames) {
      activeCategoryOrder = fetchedCategoryNames;
      console.log('Using category names from external API:', activeCategoryOrder);
    } else {
      activeCategoryOrder = localCategoryOrder; // Fallback to local category order
      if (process.env.RESTAURANT_ID) {
        console.error('Error fetching category names from external API. Using local fallback for category order.', localCategoryOrder);
      } else {
        console.warn('RESTAURANT_ID not set. Using local fallback for category order.', localCategoryOrder);
      }
    }
    
    let activeIconNameMap: { [key: string]: string };
    const fetchedIconNameMap = await fetchCategoryIconsFromExternalAPI();

    if (fetchedIconNameMap) {
      activeIconNameMap = fetchedIconNameMap;
      console.log('Using category icon names from external API:', activeIconNameMap);
    } else {
      activeIconNameMap = localCategoryIconsMap; // Fallback to local icon name map
      if (process.env.RESTAURANT_ID) {
        console.error('Error fetching category icon names from external API. Using local fallback for icon names.', localCategoryIconsMap);
      } else {
        console.warn('RESTAURANT_ID not set. Using local fallback for icon names.', localCategoryIconsMap);
      }
    }

    const categoriesForClient = activeCategoryOrder.map(catName => ({
      name: catName,
      iconName: activeIconNameMap[catName] || 'Info', // Default to 'Info' icon string if not found
    }));

    return NextResponse.json({
      menuItems: sampleMenuData as MenuItemType[],
      categories: categoriesForClient,
    }, { status: 200 });

  } catch (error) {
    console.error('API Error fetching menu:', error);
    return NextResponse.json({ error: 'Internal Server Error fetching menu' }, { status: 500 });
  }
}
