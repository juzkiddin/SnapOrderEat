
"use client";

import Image from 'next/image';
import type { CartItemType } from '@/types';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { MinusCircle, PlusCircle, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import React from 'react'; // Import React

interface CartItemCardProps {
  cartItem: CartItemType;
}

const buttonAnimationVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.15 } },
};

const iconTransition = { duration: 0.2, ease: "easeInOut" };

function CartItemCardComponent({ cartItem }: CartItemCardProps) {
  const { updateItemQuantity, removeItemFromCart } = useCart();

  const handleQuantityChange = (newQuantity: number) => {
    // updateItemQuantity already handles removing if quantity <= 0
    updateItemQuantity(cartItem.menuItem.id, newQuantity, cartItem.selectedPortion);
  };

  const handleRemoveItem = () => {
    removeItemFromCart(cartItem.menuItem.id, cartItem.selectedPortion);
  };

  return (
    <div className="flex items-start sm:items-center justify-between p-4 gap-3">
      <div className="flex items-start sm:items-center space-x-3 flex-grow">
        <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-md overflow-hidden flex-shrink-0">
           <Image
            src={cartItem.menuItem.imageUrl}
            alt={cartItem.menuItem.name}
            fill
            sizes="(max-width: 640px) 64px, 80px"
            className="object-cover"
            data-ai-hint={cartItem.menuItem.dataAiHint || "food item"}
          />
        </div>
        <div className="flex-grow">
          <h4 className="font-semibold text-sm sm:text-base">
            {cartItem.menuItem.name}
            {cartItem.selectedPortion && (
              <span className="text-xs text-muted-foreground ml-1">({cartItem.selectedPortion})</span>
            )}
          </h4>
          <p className="text-xs sm:text-sm text-muted-foreground">₹{cartItem.priceInCart.toFixed(2)} per item</p>
          <p className="text-sm sm:text-base font-medium mt-1">Total: ₹{(cartItem.priceInCart * cartItem.quantity).toFixed(2)}</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 mt-1 sm:mt-0">
        <div className="flex items-center space-x-1">
          <AnimatePresence mode="wait" initial={false}>
            {cartItem.quantity === 1 ? (
              <motion.div
                key="delete-in-place"
                variants={buttonAnimationVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={iconTransition}
              >
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                  aria-label="Remove item"
                >
                  <motion.button
                    whileTap={{ scale: 0.90 }}
                    onClick={handleRemoveItem}
                  >
                    <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  </motion.button>
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="decrease-quantity"
                variants={buttonAnimationVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={iconTransition}
              >
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9"
                  disabled={cartItem.quantity <= 0} // Should not reach 0 if remove logic is correct
                  aria-label="Decrease quantity"
                >
                  <motion.button
                    whileTap={{ scale: 0.90 }}
                    onClick={() => handleQuantityChange(cartItem.quantity - 1)}
                  >
                    <MinusCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                  </motion.button>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          <span className="w-10 text-center text-sm sm:text-base font-medium tabular-nums">
            {cartItem.quantity}
          </span>

          <Button
            asChild
            variant="outline"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9"
            aria-label="Increase quantity"
          >
            <motion.button
              whileTap={{ scale: 0.90 }}
              onClick={() => handleQuantityChange(cartItem.quantity + 1)}
            >
              <PlusCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            </motion.button>
          </Button>
        </div>
        
        <AnimatePresence initial={false}>
          {cartItem.quantity > 1 && (
            <motion.div
              key="separate-delete-button"
              variants={buttonAnimationVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={iconTransition}
              className="flex-shrink-0" // Prevents squashing
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemoveItem}
                className="text-destructive hover:text-destructive h-8 w-8 sm:h-9 sm:w-9"
                aria-label="Remove item"
              >
                <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default React.memo(CartItemCardComponent);
