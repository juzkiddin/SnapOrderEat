
// This file is no longer needed as the in-memory store for bills and orders
// is being replaced by an external API for session management and database for orders.
// Orders will persist via OrderContext and its API calls.
// It will be deleted.

// Retaining order-related types here if they are still used by OrderContext,
// but BillType and the store itself are deprecated by the new session API.

import type { OrderType } from '@/types'; // Keep if OrderContext still uses OrderType from here.

// BillType is deprecated by the new external session API
// export interface BillType {
//   id: string;
//   tableId: string;
//   phoneNumber: string;
//   paymentStatus: 'Pending' | 'Completed'; // This PaymentStatus is also specific to old model
//   createdAt: Date;
//   razorpayPaymentId?: string;
//   paymentMethod?: 'Cash' | 'Online';
// }

// interface ApiStore {
//   orders: OrderType[]; // Order persistence will be handled by OrderContext's backend calls
//   bills: BillType[];   // Bill data now comes from external session API
// }

// export const store: ApiStore = { // Deprecated
//   orders: [],
//   bills: [],
// };
