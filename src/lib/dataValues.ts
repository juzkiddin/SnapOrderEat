
import type { MenuItemType } from '@/types';
import type { LucideIcon } from 'lucide-react'; // Keep for PredefinedRequest
import { 
  Utensils, Soup, GlassWater, Droplet, Flame, Snowflake, Blend, UtensilsCrossed, Layers, ConciergeBell, Popcorn
} from 'lucide-react'; // Keep for PredefinedRequest icons

// For src/app/[tableId]/page.tsx
export const sampleMenuData: MenuItemType[] = [
  {
    id: 'starter1', name: 'Spring Rolls', description: 'Crispy vegetarian spring rolls served with sweet chili sauce.', price: 8.99, category: 'Starters', imageUrl: 'https://placehold.co/320x180.png', dataAiHint: 'spring rolls appetizer', availStatus: true, portionId: '0000',
  },
  {
    id: 'starter2', name: 'Garlic Bread', description: 'Toasted baguette slices with garlic butter and herbs.', price: 6.50, category: 'Starters', imageUrl: 'https://placehold.co/320x180.png', dataAiHint: 'garlic bread snack', availStatus: true, portionId: '0000',
  },
  {
    id: 'starter3', name: 'Tomato Soup', description: 'Creamy tomato soup with a swirl of fresh cream and croutons.', price: 7.25, category: 'Starters', imageUrl: 'https://placehold.co/320x180.png', dataAiHint: 'tomato soup bowl', availStatus: false, portionId: '0000',
  },
  {
    id: 'main1', name: 'Grilled Salmon', description: 'Freshly grilled salmon fillet with roasted vegetables and lemon butter sauce.', price: 18.99, category: 'Mains', imageUrl: 'https://placehold.co/320x180.png', dataAiHint: 'grilled salmon fish', portionId: '0001', availStatus: true, portionPrices: { 'Quarter': 18.99, 'Half': 20.99, 'Full': 22.99 },
  },
  {
    id: 'main2', name: 'Chicken Alfredo', description: 'Creamy Alfredo pasta with grilled chicken breast and parmesan cheese.', price: 15.75, category: 'Mains', imageUrl: 'https://placehold.co/320x180.png', dataAiHint: 'chicken alfredo pasta', availStatus: true, portionId: '0001', portionPrices: { 'Quarter': 15.75, 'Half': 17.25, 'Full': 18.75 },
  },
  {
    id: 'main3', name: 'Margherita Pizza', description: 'Classic pizza with tomato sauce, mozzarella, and fresh basil.', price: 15.00, category: 'Mains', imageUrl: 'https://placehold.co/320x180.png', dataAiHint: 'margherita pizza', availStatus: true, portionId: '0000',
  },
  {
    id: 'drink1', name: 'Fresh Lemonade', description: 'Homemade lemonade with fresh lemons and a hint of mint.', price: 4.50, category: 'Drinks', imageUrl: 'https://placehold.co/320x180.png', dataAiHint: 'lemonade drink', availStatus: true, portionId: '0000',
  },
  {
    id: 'drink2', name: 'Iced Tea', description: 'Refreshing iced tea, available sweetened or unsweetened.', price: 3.75, category: 'Drinks', imageUrl: 'https://placehold.co/320x180.png', dataAiHint: 'iced tea beverage', availStatus: false, portionId: '0000',
  },
  {
    id: 'drink3', name: 'Sparkling Water', description: 'Chilled sparkling mineral water with a slice of lime.', price: 3.00, category: 'Drinks', imageUrl: 'https://placehold.co/320x180.png', dataAiHint: 'sparkling water', portionId: '0000', availStatus: true,
  },
];

// Changed to map category name strings to icon name strings
export const categoryIcons: { [key: string]: string } = { 
  Starters: "Soup", 
  Mains: "Utensils", 
  Drinks: "GlassWater" 
};
export const categoryOrder = ['Starters', 'Mains', 'Drinks']; // Fallback category order

export const WELCOME_MESSAGE_VISIBLE_HEIGHT = "h-[90px]";

interface PredefinedRequestOption {
  label: string;
  icon?: React.ElementType; // LucideIcon type might be too strict if some options don't have icons
}
export interface PredefinedRequest {
  id: string;
  label: string;
  icon: React.ElementType; // LucideIcon type for top-level request category
  type: 'direct' | 'selectOne';
  options?: PredefinedRequestOption[];
}
export const predefinedServiceRequests: PredefinedRequest[] = [
  { id: 'water', label: 'Water', icon: Droplet, type: 'selectOne', options: [ { label: 'Cold Water', icon: Snowflake }, { label: 'Hot Water', icon: Flame } ] },
  { id: 'condiments', label: 'Condiments', icon: Blend, type: 'selectOne', options: [ { label: 'Ketchup' }, { label: 'Mayonnaise' }, { label: 'Salt' }, { label: 'Pepper' } ] },
  { id: 'cutlery', label: 'Cutlery', icon: UtensilsCrossed, type: 'selectOne', options: [ { label: 'Spoon' }, { label: 'Fork' }, { label: 'Knife' } ] },
  { id: 'tissues', label: 'Tissues', icon: Layers, type: 'direct' },
  { id: 'call_waiter', label: 'Call Waiter', icon: ConciergeBell, type: 'direct' },
];

    
