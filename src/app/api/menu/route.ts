
import { NextResponse } from 'next/server';
import { sampleMenuData, categoryOrder, categoryIcons as localCategoryIcons } from '@/lib/dataValues';
import type { MenuItemType } from '@/types';

// In a real app, you'd fetch this from a database.
// We are also sending categoryStructure to maintain order and icons for simplicity.
// Icons themselves cannot be serialized, so we'll map names on the client.

export async function GET() {
  try {
    // Simulate a network delay
    // await new Promise(resolve => setTimeout(resolve, 500));

    // Prepare category data to send to client.
    // We send names and the client will map icons.
    const categories = categoryOrder.map(catName => ({
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
