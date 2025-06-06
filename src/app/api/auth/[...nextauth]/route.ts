
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions, User } from "next-auth";

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
const isDevelopmentOrSecurePreview = process.env.NODE_ENV === 'development' || useSecureCookies;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        phoneNumber: { label: "Phone Number", type: "text" },
        tableId: { label: "Table ID", type: "text" },
        billId: { label: "Bill ID", type: "text" },
        sessionId: { label: "Session ID", type: "text" }, // Added sessionId
        paymentStatus: { label: "Payment Status", type: "text" }, // Added paymentStatus
      },
      async authorize(credentials, req) {
        // All credentials including sessionId and billId are now expected to be pre-validated
        // by LoginFlow.tsx after a successful call to the external /session/createsession API.
        if (
          credentials?.phoneNumber &&
          credentials?.tableId &&
          credentials?.billId &&
          credentials?.sessionId && // Ensure sessionId is present
          credentials?.paymentStatus // Ensure paymentStatus is present
        ) {
          const user: User = {
            id: credentials.phoneNumber, // Using phoneNumber as the unique ID for NextAuth User
            phoneNumber: credentials.phoneNumber,
            tableId: credentials.tableId,
            billId: credentials.billId,
            sessionId: credentials.sessionId, // Store sessionId
            paymentStatus: credentials.paymentStatus, // Store paymentStatus
          };
          return user;
        }
        console.error("[NextAuth Authorize] Missing credentials for session creation:", {
            hasPhoneNumber: !!credentials?.phoneNumber,
            hasTableId: !!credentials?.tableId,
            hasBillId: !!credentials?.billId,
            hasSessionId: !!credentials?.sessionId,
            hasPaymentStatus: !!credentials?.paymentStatus
        });
        return null; // If any credential is missing, authorization fails
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger, session: newSessionData }) {
      if (user) { // On sign-in
        token.phoneNumber = user.phoneNumber ?? null;
        token.tableId = user.tableId ?? null;
        token.billId = user.billId ?? null;
        token.sessionId = user.sessionId ?? null; // Persist sessionId
        token.paymentStatus = user.paymentStatus ?? null; // Persist paymentStatus
      }
      // Handle session updates for payment status
      if (trigger === "update" && newSessionData?.paymentStatus) {
        token.paymentStatus = newSessionData.paymentStatus;
      }
      return token;
    },
    async session({ session, token }) {
      // Assign properties from token to session.user
      session.user = {
        ...session.user, // Keep existing session.user fields if any (like email, name, image from other providers)
        phoneNumber: token.phoneNumber as string | null,
        tableId: token.tableId as string | null,
        billId: token.billId as string | null,
        sessionId: token.sessionId as string | null, // Expose sessionId
        paymentStatus: token.paymentStatus as string | null, // Expose paymentStatus
      };
      return session;
    },
  },
  pages: {
    signIn: '/', // Redirect to landing if sign-in is required but not handled by a custom flow
  },
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    csrfToken: {
      name: `${useSecureCookies ? '__Host-' : ''}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: isDevelopmentOrSecurePreview && useSecureCookies ? 'none' : 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
    sessionToken: {
      name: `${useSecureCookies ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: isDevelopmentOrSecurePreview && useSecureCookies ? 'none' : 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: `${useSecureCookies ? '__Secure-' : ''}next-auth.callback-url`,
      options: {
        sameSite: isDevelopmentOrSecurePreview && useSecureCookies ? 'none' : 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
