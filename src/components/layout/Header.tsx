
"use client";

import Link from 'next/link';
import CartIcon from '@/components/cart/CartIcon';
import Cart from '@/components/cart/Cart';
import VacateTableDialog from './VacateTableDialog';
import { useSession, signOut } from 'next-auth/react'; // Use NextAuth
import { useCart } from '@/contexts/CartContext';
import { useOrders } from '@/contexts/OrderContext';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Header() {
  const { data: session, status } = useSession(); // Get session from NextAuth
  const isAuthenticated = status === 'authenticated';
  const tableId = session?.user?.tableId;
  const billId = session?.user?.billId;

  const { setIsCartSheetOpen } = useCart();
  const { getOrdersByBillId } = useOrders();

  const [isVacateDialogOpen, setIsVacateDialogOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const hasPlacedOrders = useMemo(() => {
    if (isAuthenticated && billId) {
      return getOrdersByBillId(billId).length > 0;
    }
    return false;
  }, [isAuthenticated, billId, getOrdersByBillId]);

  const handleVacateConfirm = async () => {
    await signOut({ redirect: false }); // Call NextAuth signOut
    // The AuthContext will react to session changes and reset its state.
    // Router push to '/' might be good here or handled by page effects based on auth state.
    // For now, let session change drive behavior.
    setIsVacateDialogOpen(false);
    // router.push('/'); // Optional: force redirect after sign out
  };

  const headerTransition = { duration: 0.4, ease: [0.42, 0, 0.58, 1] };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <motion.div
          className={`container flex h-16 items-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${
            hasMounted && isAuthenticated ? 'justify-between' : 'justify-center'
          }`}
          layout
          transition={headerTransition}
        >
          <motion.div className="flex items-center" transition={headerTransition}>
            <Link href={(hasMounted && isAuthenticated && tableId) ? `/${tableId}` : "/"} className="flex items-center">
              <span className="font-bold text-xl sm:text-2xl text-primary">SnapOrderEat</span>
            </Link>
          </motion.div>
          
          <div className="flex items-center space-x-1">
            <AnimatePresence>
              {hasMounted && isAuthenticated && !hasPlacedOrders && (
                <motion.div
                  key="vacate-button-wrapper"
                  initial={{ opacity: 0, scale: 0.8, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 0, transition: { duration: 0.2 } }}
                  transition={{ ...headerTransition, delay: (hasMounted && isAuthenticated) ? 0.2 : 0 }}
                >
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsVacateDialogOpen(true)}
                    aria-label="Vacate Table"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {hasMounted && isAuthenticated && (
                 <motion.div
                    key="cart-icon-wrapper"
                    initial={{ opacity: 0, scale: 0.8, x: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: 0, transition: { duration: 0.2 } }}
                    transition={{ ...headerTransition, delay: (hasMounted && isAuthenticated) ? (hasPlacedOrders ? 0.2 : 0.3) : 0.1 }}
                  >
                  <CartIcon onClick={() => setIsCartSheetOpen(true)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </header>
      <Cart /> 

      {hasMounted && isAuthenticated && (
        <VacateTableDialog 
          isOpen={isVacateDialogOpen}
          onOpenChange={setIsVacateDialogOpen}
          onConfirm={handleVacateConfirm}
        />
      )}
    </>
  );
}
