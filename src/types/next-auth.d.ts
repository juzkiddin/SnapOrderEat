
import type { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id?: string | null;
      phoneNumber?: string | null;
      tableId?: string | null;
      billId?: string | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    phoneNumber?: string | null;
    tableId?: string | null;
    billId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    phoneNumber?: string | null;
    tableId?: string | null;
    billId?: string | null;
  }
}
