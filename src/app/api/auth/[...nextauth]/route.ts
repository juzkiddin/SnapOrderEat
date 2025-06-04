
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions, User } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        phoneNumber: { label: "Phone Number", type: "text" },
        tableId: { label: "Table ID", type: "text" },
        billId: { label: "Bill ID", type: "text" },
        // We don't need waiterOtp or phoneOtp here as they are verified by the custom flow before signIn is called.
      },
      async authorize(credentials, req) {
        // This function is called when signIn (with "credentials" provider) is invoked.
        // The custom OTP flow in LoginFlow.tsx has already verified the user.
        // Here, we just take the verified details and create a NextAuth session.

        if (credentials?.phoneNumber && credentials?.tableId && credentials?.billId) {
          // You could add additional checks here if needed, e.g., verify the billId structure.
          // For now, we trust the data coming from our LoginFlow after successful OTP.
          const user: User = {
            id: credentials.phoneNumber, // Use phoneNumber as a unique ID for the user in NextAuth
            phoneNumber: credentials.phoneNumber,
            tableId: credentials.tableId,
            billId: credentials.billId,
          };
          return user;
        }
        // Return null if credentials are not valid or missing
        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      // Persist the custom user data to the JWT
      if (user) {
        token.phoneNumber = user.phoneNumber;
        token.tableId = user.tableId;
        token.billId = user.billId;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client, like an access_token and user id from a provider.
      if (token && session.user) {
        session.user.phoneNumber = token.phoneNumber as string;
        session.user.tableId = token.tableId as string;
        session.user.billId = token.billId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/', // Redirect users to home page if signIn page is accessed directly
    // You might want to point to your [tableId] page if direct access to signIn is attempted,
    // but NextAuth usually handles this well by just not showing a page if not configured.
    // For a Credentials provider, direct access to a sign-in page is less common.
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
