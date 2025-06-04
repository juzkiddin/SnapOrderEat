
export type MenuItemType = {
  id: string;
  name: string;
  description: string;
  price: number; // Base price / price of smallest portion
  category: string;
  imageUrl: string;
  dataAiHint?: string;
  availStatus?: boolean;
  portionId?: string;
  portionPrices?: { [key: string]: number }; // e.g., { "Quarter": 10.99, "Half": 12.99, "Full": 14.99 }
};

export type CartItemType = {
  menuItem: MenuItemType;
  quantity: number;
  selectedPortion?: string;
  priceInCart: number; // Actual price for the selected portion at the time of adding to cart
};

export type OrderStatus = "Pending" | "Cooking" | "Finished";

export type OrderItemType = {
  menuItem: MenuItemType;
  quantity: number;
  status: OrderStatus;
  selectedPortion?: string;
  priceInOrder: number; // Actual price for the selected portion at the time of ordering
};

export type OrderType = {
  id: string;
  billId: string;
  items: OrderItemType[];
  specialRequests: string;
  total: number;
  timestamp: Date;
};
