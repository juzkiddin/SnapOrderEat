
import type { OrderType } from '@/types';

// IMPORTANT: This is an in-memory store. Data will be lost on server restart.
// Suitable only for prototyping.

type PaymentStatus = 'Pending' | 'Completed';

export interface BillType {
  id: string;
  tableId: string;
  phoneNumber: string;
  paymentStatus: PaymentStatus;
  createdAt: Date;
  razorpayPaymentId?: string; // Added for Razorpay
  paymentMethod?: 'Cash' | 'Online'; // Added
}

interface ApiStore {
  orders: OrderType[];
  bills: BillType[];
  // activePhoneOtps (Twilio related) removed
}

export const store: ApiStore = {
  orders: [],
  bills: [],
  // activePhoneOtps: {}, // Twilio related removed
};
