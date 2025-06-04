
"use client";

import type { ReactNode } from "react";
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { MenuItemType, CartItemType } from '@/types';

interface CartContextType {
  cartItems: CartItemType[];
  specialRequests: string;
  addItemToCart: (item: MenuItemType, quantity?: number, portion?: string, priceForSelection?: number) => void;
  removeItemFromCart: (itemId: string, portion?: string) => void;
  updateItemQuantity: (itemId: string, quantity: number, portion?: string) => void;
  clearCart: () => void;
  setSpecialRequests: (requests: string) => void;
  getCartTotal: () => number;
  getItemCount: () => number;
  isCartSheetOpen: boolean;
  setIsCartSheetOpen: (isOpen: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItemType[]>([]);
  const [specialRequests, setSpecialRequests] = useState<string>("");
  const [isCartSheetOpen, setIsCartSheetOpen] = useState<boolean>(false);

  const addItemToCart = useCallback((
    item: MenuItemType, 
    quantity: number = 1, 
    portion?: string,
    priceForSelection?: number
  ) => {
    setCartItems((prevItems) => {
      const existingItemIndex = prevItems.findIndex(
        (cartItem) => cartItem.menuItem.id === item.id && cartItem.selectedPortion === portion
      );

      const priceToAdd = priceForSelection !== undefined ? priceForSelection : item.price;

      if (existingItemIndex > -1) {
        const updatedItems = [...prevItems];
        const existingItem = updatedItems[existingItemIndex];
        updatedItems[existingItemIndex] = {
          ...existingItem,
          quantity: existingItem.quantity + quantity,
          priceInCart: priceToAdd, // Ensure price is updated if re-adding with different logic (though unlikely for portions)
        };
        return updatedItems;
      }
      return [...prevItems, { 
        menuItem: item, 
        quantity: quantity, 
        selectedPortion: portion,
        priceInCart: priceToAdd,
      }];
    });
  }, []);

  const removeItemFromCart = useCallback((itemId: string, portion?: string) => {
    setCartItems((prevItems) =>
      prevItems.filter(
        (item) => !(item.menuItem.id === itemId && item.selectedPortion === portion)
      )
    );
  }, []);

  const updateItemQuantity = useCallback((itemId: string, quantity: number, portion?: string) => {
    if (quantity <= 0) {
      removeItemFromCart(itemId, portion);
      return;
    }
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.menuItem.id === itemId && item.selectedPortion === portion
          ? { ...item, quantity }
          // priceInCart is set when item is added, quantity change doesn't alter item's unit price.
          : item 
      )
    );
  }, [removeItemFromCart]);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setSpecialRequests("");
  }, []);

  const getCartTotal = useCallback(() => {
    return cartItems.reduce((total, item) => total + item.priceInCart * item.quantity, 0);
  }, [cartItems]);

  const getItemCount = useCallback(() => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  }, [cartItems]);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        specialRequests,
        addItemToCart,
        removeItemFromCart,
        updateItemQuantity,
        clearCart,
        setSpecialRequests,
        getCartTotal,
        getItemCount,
        isCartSheetOpen,
        setIsCartSheetOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
