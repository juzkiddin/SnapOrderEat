
"use client";

import type { ReactNode } from "react";
import React, { createContext, useContext, useState, useCallback } from 'react';
import type { OrderType, OrderStatus, CartItemType, OrderItemType } from '@/types';

interface OrderContextType {
  addOrder: (billId: string, items: CartItemType[], specialRequests: string, total: number) => Promise<OrderType | null>;
  updateOrderItemStatus: (orderId: string, menuItemId: string, newStatus: OrderStatus, portion?: string) => void;
  // Function to get simulated client-side orders (primarily for status updates)
  getClientSideOrderById: (orderId: string) => OrderType | undefined; 
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const OrderProvider = ({ children }: { children: ReactNode }) => {
  const [clientSideOrders, setClientSideOrders] = useState<OrderType[]>([]);

  const simulateProcessing = useCallback((orderId: string, item: OrderItemType) => {
    const updateStatusInState = (targetStatus: OrderStatus, previousStatus: OrderStatus) => {
      setClientSideOrders(prevOrders => prevOrders.map(o => {
        if (o.id === orderId) {
          const currentItem = o.items.find(i => i.menuItem.id === item.menuItem.id && i.selectedPortion === item.selectedPortion);
          if (currentItem?.status === previousStatus) {
            return {
              ...o,
              items: o.items.map(orderItem =>
                orderItem.menuItem.id === item.menuItem.id && orderItem.selectedPortion === item.selectedPortion
                ? { ...orderItem, status: targetStatus }
                : orderItem
              ),
            };
          }
        }
        return o;
      }));
    };

    const initialOrder = clientSideOrders.find(o => o.id === orderId);
    const initialItem = initialOrder?.items.find(i => i.menuItem.id === item.menuItem.id && i.selectedPortion === item.selectedPortion);

    if (initialItem?.status === "Pending") {
      setTimeout(() => updateStatusInState("Cooking", "Pending"), 5000); 
      setTimeout(() => updateStatusInState("Finished", "Cooking"), 17000); 
    } else if (initialItem?.status === "Cooking") {
      setTimeout(() => updateStatusInState("Finished", "Cooking"), 12000); 
    }
  }, [clientSideOrders]);


  const updateOrderItemStatus = useCallback((orderId: string, menuItemId: string, newStatus: OrderStatus, portion?: string) => {
    setClientSideOrders((prevOrders) =>
      prevOrders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              items: order.items.map((item) =>
                item.menuItem.id === menuItemId && item.selectedPortion === portion
                ? { ...item, status: newStatus }
                : item
              ),
            }
          : order
      )
    );
  }, []);

  const addOrder = useCallback(async (
    billId: string, 
    cartItems: CartItemType[], 
    specialRequests: string, 
    total: number
  ): Promise<OrderType | null> => {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId, cartItems, specialRequests, total }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const newOrder = await response.json() as OrderType;
      
      setClientSideOrders((prevOrders) => [newOrder, ...prevOrders].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      
      newOrder.items.forEach(item => {
        simulateProcessing(newOrder.id, item);
      });
      return newOrder;
    } catch (err: any) {
      console.error("Failed to add order:", err);
      return null;
    }
  }, [simulateProcessing]);

  const getClientSideOrderById = useCallback((orderId: string) => {
    return clientSideOrders.find(order => order.id === orderId);
  }, [clientSideOrders]);

  return (
    <OrderContext.Provider value={{ addOrder, updateOrderItemStatus, getClientSideOrderById }}>
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};
