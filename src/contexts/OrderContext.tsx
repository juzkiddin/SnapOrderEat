
"use client";

import type { ReactNode } from "react";
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { OrderType, OrderStatus, CartItemType, OrderItemType } from '@/types';
import { useAuth } from "./AuthContext"; // To get billId for loading orders

interface OrderContextType {
  orders: OrderType[]; // Orders loaded for the current billId
  isLoading: boolean;
  error: string | null;
  addOrder: (billId: string, items: CartItemType[], specialRequests: string, total: number) => Promise<OrderType | null>;
  updateOrderItemStatus: (orderId: string, menuItemId: string, newStatus: OrderStatus, portion?: string) => void;
  getOrdersByBillId: (billId: string) => OrderType[]; // Reads from local state
  getOrderById: (orderId: string) => OrderType | undefined; // Reads from local state
  loadOrdersForBill: (billId: string) => Promise<void>;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const OrderProvider = ({ children }: { children: ReactNode }) => {
  const [orders, setOrders] = useState<OrderType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { billId: currentBillId } = useAuth(); // Get current authenticated billId

  const simulateProcessing = useCallback((orderId: string, item: OrderItemType) => {
    const updateStatusInState = (targetStatus: OrderStatus, previousStatus: OrderStatus) => {
      setOrders(prevOrders => prevOrders.map(o => {
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

    const initialOrder = orders.find(o => o.id === orderId);
    const initialItem = initialOrder?.items.find(i => i.menuItem.id === item.menuItem.id && i.selectedPortion === item.selectedPortion);

    if (initialItem?.status === "Pending") {
      setTimeout(() => updateStatusInState("Cooking", "Pending"), 5000); 
      setTimeout(() => updateStatusInState("Finished", "Cooking"), 17000); 
    } else if (initialItem?.status === "Cooking") {
      setTimeout(() => updateStatusInState("Finished", "Cooking"), 12000); 
    }
  }, [orders]);


  const updateOrderItemStatus = useCallback((orderId: string, menuItemId: string, newStatus: OrderStatus, portion?: string) => {
    setOrders((prevOrders) =>
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
    setIsLoading(true);
    setError(null);
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
      // Reverted: newOrder.timestamp is now a string from API
      
      setOrders((prevOrders) => [newOrder, ...prevOrders].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      
      newOrder.items.forEach(item => {
        simulateProcessing(newOrder.id, item);
      });
      setIsLoading(false);
      return newOrder;
    } catch (err: any) {
      console.error("Failed to add order:", err);
      setError(err.message || "Could not submit order.");
      setIsLoading(false);
      return null;
    }
  }, [simulateProcessing]);

  const loadOrdersForBill = useCallback(async (billIdToLoad: string) => {
    if (!billIdToLoad) {
      setOrders([]); 
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders?billId=${billIdToLoad}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }
      const fetchedOrders = await response.json() as OrderType[];
      // Reverted: fetchedOrders timestamps are now strings from API
      setOrders(fetchedOrders.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (err: any) {
      console.error("Failed to load orders:", err);
      setError(err.message || "Could not load orders.");
      setOrders([]); 
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    if (currentBillId) {
      loadOrdersForBill(currentBillId);
    } else {
      setOrders([]); 
    }
  }, [currentBillId, loadOrdersForBill]);


  const getOrdersByBillId = useCallback((billIdToFilter: string) => {
    return orders.filter(order => order.billId === billIdToFilter).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [orders]);

  const getOrderById = useCallback((orderId: string) => {
    return orders.find(order => order.id === orderId);
  }, [orders]);

  return (
    <OrderContext.Provider value={{ orders, isLoading, error, addOrder, updateOrderItemStatus, getOrdersByBillId, getOrderById, loadOrdersForBill }}>
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
