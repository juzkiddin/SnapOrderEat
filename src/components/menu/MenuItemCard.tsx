
"use client";

import Image from 'next/image';
import type { MenuItemType } from '@/types';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, MinusCircle, Ban, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import React, { useState, useEffect, useMemo } from 'react';

interface MenuItemCardProps {
  item: MenuItemType;
}

const animationVariants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

const transitionConfig = {
  duration: 0.2,
  ease: "easeInOut",
};

const portionOptions = [
  { id: "quarter", label: "Quarter" },
  { id: "half", label: "Half" },
  { id: "full", label: "Full" },
];

export default function MenuItemCard({ item }: MenuItemCardProps) {
  const { cartItems, addItemToCart, updateItemQuantity } = useCart();
  const [isPortionDialogOpen, setIsPortionDialogOpen] = useState(false);

  const getDefaultPortion = useMemo(() => {
    if (item.portionPrices) {
      const availablePortionLabels = portionOptions.filter(p => item.portionPrices && item.portionPrices[p.label] !== undefined).map(p => p.label);
      if (availablePortionLabels.includes("Full")) return "Full";
      return availablePortionLabels[0] || portionOptions[0].label; // Fallback to first defined portion or first option
    }
    return portionOptions[2].label; // Default to Full if no portion prices
  }, [item.portionPrices]);


  const [selectedPortionInDialog, setSelectedPortionInDialog] = useState<string>(getDefaultPortion);
  const [currentDialogPrice, setCurrentDialogPrice] = useState<number | null>(null);

  useEffect(() => {
    if (isPortionDialogOpen) {
      const defaultPortionValue = getDefaultPortion;
      setSelectedPortionInDialog(defaultPortionValue);
      if (item.portionPrices && item.portionPrices[defaultPortionValue]) {
        setCurrentDialogPrice(item.portionPrices[defaultPortionValue]);
      } else {
        setCurrentDialogPrice(item.price); // Fallback to base price if default portion has no specific price
      }
    }
  }, [isPortionDialogOpen, item.portionPrices, item.price, getDefaultPortion]);

  useEffect(() => {
    if (item.portionPrices && item.portionPrices[selectedPortionInDialog]) {
      setCurrentDialogPrice(item.portionPrices[selectedPortionInDialog]);
    } else if (item.portionId === '0001') { // only for portionable items
      setCurrentDialogPrice(item.price); // Fallback for portionable items if specific price not found
    }
  }, [selectedPortionInDialog, item.portionPrices, item.price, item.portionId]);


  const isAvailable = item.availStatus === undefined || item.availStatus === true;
  const requiresPortionSelection = item.portionId === '0001';

  const cartItemForNonPortioned = useMemo(() => {
    if (requiresPortionSelection) return undefined;
    return cartItems.find(
      (ci) => ci.menuItem.id === item.id && ci.selectedPortion === undefined
    );
  }, [cartItems, item.id, requiresPortionSelection]);

  const quantityInCartForNonPortioned = cartItemForNonPortioned ? cartItemForNonPortioned.quantity : 0;


  const handleAddItem = () => {
    if (!isAvailable) return;
    if (requiresPortionSelection) {
      setIsPortionDialogOpen(true);
    } else {
      addItemToCart(item, 1, undefined, item.price);
    }
  };

  const handleAddPortionedItemToCart = () => {
    if (!isAvailable || !selectedPortionInDialog || currentDialogPrice === null) return;
    addItemToCart(item, 1, selectedPortionInDialog, currentDialogPrice);
    setIsPortionDialogOpen(false);
  };

  const handleIncreaseQuantity = () => {
    if (!isAvailable || requiresPortionSelection) return; // Should not be called for portioned items from here
    // For non-portioned items:
    if (quantityInCartForNonPortioned > 0) {
      updateItemQuantity(item.id, quantityInCartForNonPortioned + 1, undefined);
    } else {
      addItemToCart(item, 1, undefined, item.price);
    }
  };

  const handleDecreaseQuantity = () => {
    if (!isAvailable || requiresPortionSelection) return; // Should not be called for portioned items from here
    // For non-portioned items:
    if (quantityInCartForNonPortioned > 0) {
      updateItemQuantity(item.id, quantityInCartForNonPortioned - 1, undefined);
    }
  };


  const priceToDisplayOnCard = () => {
    if (requiresPortionSelection && item.portionPrices) {
      const prices = Object.values(item.portionPrices).filter(p => typeof p === 'number');
      if (prices.length > 0) {
         return Math.min(...prices);
      }
    }
    return item.price;
  }

  return (
    <>
      <Card className={`flex flex-col overflow-hidden shadow-md transition-shadow duration-200 rounded-md ${!isAvailable ? 'opacity-70 bg-muted/30' : 'hover:shadow-lg'}`}>
        <CardHeader className="p-0">
          <div className="aspect-video relative w-full">
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className={`object-cover ${!isAvailable ? 'grayscale' : ''}`}
              data-ai-hint={item.dataAiHint || "food item"}
            />
            {!isAvailable && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-white font-semibold text-xs sm:text-sm px-2 py-1 bg-black/70 rounded">Unavailable</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3 flex-grow">
          <CardTitle className="text-md font-semibold mb-0.5">{item.name}</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mb-1 h-8 overflow-hidden">
            {item.description}
          </CardDescription>
          <p className="text-base font-bold text-primary">
            {requiresPortionSelection && item.portionPrices && Object.keys(item.portionPrices).length > 0 ? "From " : ""}
            ₹{priceToDisplayOnCard().toFixed(2)}
          </p>
        </CardContent>
        <CardFooter className="p-3 pt-0 min-h-[52px] flex items-center justify-center">
          {!isAvailable ? (
            <Button
              variant="outline"
              className="w-full text-xs sm:text-sm"
              disabled
              size="sm"
            >
              <Ban className="mr-1 sm:mr-1.5 h-4 w-4" /> Unavailable
            </Button>
          ) : requiresPortionSelection ? (
             <Button
                onClick={handleAddItem} 
                className="w-full text-xs sm:text-sm"
                aria-label={`Add ${item.name} to cart`}
                size="sm"
              >
                <ShoppingBag className="mr-1 sm:mr-1.5 h-4 w-4" /> Select Portion
              </Button>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              {quantityInCartForNonPortioned === 0 ? (
                <motion.div
                  key="add-button"
                  className="w-full"
                  variants={animationVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transitionConfig}
                >
                  <Button
                    onClick={handleAddItem} 
                    className="w-full text-xs sm:text-sm"
                    aria-label={`Add ${item.name} to cart`}
                    size="sm"
                  >
                    <PlusCircle className="mr-1 sm:mr-1.5 h-4 w-4" /> Add to Cart
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="quantity-controller"
                  className="flex items-center justify-between w-full space-x-2"
                  variants={animationVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transitionConfig}
                >
                  <Button
                    asChild
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 flex-shrink-0"
                  >
                    <motion.button
                      whileTap={{ scale: 0.90 }}
                      onClick={handleDecreaseQuantity}
                      aria-label="Decrease quantity"
                    >
                      <MinusCircle className="h-5 w-5" />
                    </motion.button>
                  </Button>
                  <span className="text-md font-medium w-10 text-center tabular-nums">
                    {quantityInCartForNonPortioned}
                  </span>
                  <Button
                    asChild
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 flex-shrink-0"
                  >
                    <motion.button
                      whileTap={{ scale: 0.90 }}
                      onClick={handleIncreaseQuantity}
                      aria-label="Increase quantity"
                    >
                      <PlusCircle className="h-5 w-5" />
                    </motion.button>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </CardFooter>
      </Card>

      {requiresPortionSelection && (
        <Dialog open={isPortionDialogOpen} onOpenChange={setIsPortionDialogOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-lg">
            <DialogHeader>
              <DialogTitle>{item.name}</DialogTitle>
              <DialogDescription>
                Select your desired portion.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <RadioGroup
                value={selectedPortionInDialog}
                onValueChange={setSelectedPortionInDialog}
                className="space-y-2"
              >
                {portionOptions.map((option) => {
                  const portionPrice = item.portionPrices?.[option.label];
                  if (portionPrice === undefined && item.portionPrices && Object.keys(item.portionPrices).includes(option.label)) return null;
                  if (portionPrice === undefined && !(item.portionPrices && Object.keys(item.portionPrices).includes(option.label))) {
                     if (option.label.toLowerCase() !== getDefaultPortion.toLowerCase()) return null; 
                  }


                  return (
                    <div key={option.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.label} id={`${item.id}-${option.id}`} />
                      <Label htmlFor={`${item.id}-${option.id}`} className="flex-grow">
                        {option.label}
                      </Label>
                       <span className="text-sm font-medium">₹{(portionPrice !== undefined ? portionPrice : item.price).toFixed(2)}</span>
                    </div>
                  );
                })}
              </RadioGroup>
              {currentDialogPrice !== null && (
                <p className="text-center font-semibold text-lg text-primary mt-2">
                  Selected Price: ₹{currentDialogPrice.toFixed(2)}
                </p>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="button" onClick={handleAddPortionedItemToCart} disabled={currentDialogPrice === null}>Add to Cart</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
