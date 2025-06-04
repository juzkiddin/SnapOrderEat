
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions, User } from "next-auth";

// Determine if NEXTAUTH_URL implies a secure context (HTTPS)
const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
// It's good practice to also consider NODE_ENV, but for this specific iframe issue,
// the secure nature of the URL is the primary driver for SameSite=None.
const isDevelopmentOrSecurePreview = process.env.NODE_ENV === 'development' || useSecureCookies;


export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        phoneNumber: { label: "Phone Number", type: "text" },
        tableId: { label: "Table ID", type: "text" },
        billId: { label: "Bill ID", type: "text" },
      },
      async authorize(credentials, req) {
        if (credentials?.phoneNumber && credentials?.tableId && credentials?.billId) {
          const user: User = {
            id: credentials.phoneNumber,
            phoneNumber: credentials.phoneNumber,
            tableId: credentials.tableId,
            billId: credentials.billId,
          };
          return user;
        }
        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.phoneNumber = user.phoneNumber ?? null;
        token.tableId = user.tableId ?? null;
        token.billId = user.billId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user, // Keep existing session.user fields if any
          phoneNumber: token.phoneNumber as string | null,
          tableId: token.tableId as string | null,
          billId: token.billId as string | null,
        };
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    // CSRF token: Critical for POST requests like credentials sign-in
    csrfToken: {
      name: `${useSecureCookies ? '__Host-' : ''}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: isDevelopmentOrSecurePreview && useSecureCookies ? 'none' : 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
    // Session token
    sessionToken: {
      name: `${useSecureCookies ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: isDevelopmentOrSecurePreview && useSecureCookies ? 'none' : 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
    // Callback URL cookie
    callbackUrl: {
      name: `${useSecureCookies ? '__Secure-' : ''}next-auth.callback-url`,
      options: {
        // httpOnly: false, // Typically callbackUrl is read by client JS, so not httpOnly
        sameSite: isDevelopmentOrSecurePreview && useSecureCookies ? 'none' : 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
    // Add other cookies if PKCE or other flows are used and cause issues
    // For example, PKCE code verifier:
    // pkceCodeVerifier: {
    //   name: `${useSecureCookies ? '__Secure-' : ''}next-auth.pkce.code_verifier`,
    //   options: {
    //     httpOnly: true,
    //     sameSite: isDevelopmentOrSecurePreview && useSecureCookies ? 'none' : 'lax',
    //     path: '/',
    //     secure: useSecureCookies,
    //     maxAge: 60 * 15, // 15 minutes
    //   },
    // },
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
