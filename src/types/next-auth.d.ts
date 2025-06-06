
import type { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id?: string | null;
      phoneNumber?: string | null;
      tableId?: string | null;
      billId?: string | null;
      sessionId?: string | null; // Added sessionId
      paymentStatus?: string | null; // Added paymentStatus
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    phoneNumber?: string | null;
    tableId?: string | null;
    billId?: string | null;
    sessionId?: string | null; // Added sessionId
    paymentStatus?: string | null; // Added paymentStatus
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    phoneNumber?: string | null;
    tableId?: string | null;
    billId?: string | null;
    sessionId?: string | null; // Added sessionId
    paymentStatus?: string | null; // Added paymentStatus
  }
}
