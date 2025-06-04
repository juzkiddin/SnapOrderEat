
"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ShoppingCartIcon, MessageSquarePlus } from 'lucide-react';

interface PageFloatingButtonsProps {
  showLogin: boolean;
  selectedCategory: string | null;
  searchTerm: string;
  onOpenSpecialRequestDialog: () => void;
  cartItemCount: number;
  cartTotal: number;
  onOpenCartSheet: () => void;
}

export default function PageFloatingButtons({
  showLogin,
  selectedCategory,
  searchTerm,
  onOpenSpecialRequestDialog,
  cartItemCount,
  cartTotal,
  onOpenCartSheet
}: PageFloatingButtonsProps) {
  const [fabState, setFabState] = useState<'initial' | 'icon'>('initial');

  // Effect for FAB animation: initial pill to icon
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!showLogin && fabState === 'initial') {
      timer = setTimeout(() => {
        setFabState('icon');
      }, 4000); // 4 seconds
    }
    return () => clearTimeout(timer);
  }, [showLogin, fabState]);

  // Effect to reset FAB animation to 'initial' on logout OR when returning to main menu view
  useEffect(() => {
    if (showLogin) { 
      setFabState('initial');
    } else if (!selectedCategory && !searchTerm) { 
      setFabState('initial');
    }
  }, [showLogin, selectedCategory, searchTerm]);

  return (
    <>
      <AnimatePresence>
        {!showLogin && (
          <motion.button
            key="special-request-fab"
            onClick={onOpenSpecialRequestDialog}
            className="fixed bottom-6 right-6 z-50 flex items-center justify-center h-14 bg-primary text-primary-foreground rounded-full shadow-xl hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 overflow-hidden whitespace-nowrap"
            aria-label={fabState === 'initial' ? "Make a special request" : "Open special request dialog"}
            initial={{ opacity: 0, y: 20, width: fabState === 'initial' ? 'auto' : '3.5rem' }}
            animate={{
              opacity: 1,
              y: 0,
              width: fabState === 'initial' ? 'auto' : '3.5rem',
            }}
            exit={{ opacity: 0, y: 20, scale: 0.8, transition: { duration: 0.2 } }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            layout
          >
            <AnimatePresence initial={false}>
              {fabState === 'initial' && (
                <motion.span
                  key="fab-text"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: 0.1 } }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  className="text-sm font-medium px-4"
                >
                  Make Special Request
                </motion.span>
              )}
              {fabState === 'icon' && (
                <motion.div
                  key="fab-icon-wrapper"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1, transition: { duration: 0.2, delay: fabState === 'initial' ? 0 : 0.1 } }}
                  exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.15 } }}
                >
                  <MessageSquarePlus className="h-6 w-6" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartItemCount > 0 && !showLogin && (
          <motion.button
            key="go-to-cart-button"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            onClick={onOpenCartSheet}
            className="fixed bottom-6 inset-x-6 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-auto sm:min-w-[280px] z-40 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full shadow-xl hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-base font-medium"
            aria-label={`View cart with ${cartItemCount} items, total ₹${cartTotal.toFixed(2)}`}
          >
            <ShoppingCartIcon className="h-5 w-5" />
            View Cart ({cartItemCount}) - ₹{cartTotal.toFixed(2)}
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
