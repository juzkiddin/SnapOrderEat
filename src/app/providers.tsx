
'use client';

import type { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/contexts/AuthContext';
import { OrderProvider } from '@/contexts/OrderContext';
import { CartProvider } from '@/contexts/CartContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools'; // Optional: for dev

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes, example
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OrderProvider>
            <CartProvider>
              <Header />
              <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-2 max-w-7xl">
                {children}
              </main>
              <Footer />
              <Toaster />
            </CartProvider>
          </OrderProvider>
        </AuthProvider>
        {/* <ReactQueryDevtools initialIsOpen={false} /> */} {/* Optional: for dev */}
      </QueryClientProvider>
    </SessionProvider>
  );
}
