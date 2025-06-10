
import type { OrderType } from '@/types';

interface ApiStore {
  orders: OrderType[];
}

// This store is for managing orders in-memory.
// Bill management has been moved to an external API.
export const store: ApiStore = {
  orders: [],
};

