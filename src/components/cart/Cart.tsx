
"use client";

import { useRouter } from 'next/navigation';
import { useMemo, useEffect, useState } from 'react'; // Added useEffect, useState
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/contexts/OrderContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import CartItemCard from './CartItemCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { OrderStatus, OrderItemType } from '@/types'; // Removed OrderType as it's inferred
import { Badge } from '@/components/ui/badge';
import { Clock, ChefHat, CheckCircle2, ListOrdered, FileText, Home, CreditCard, Loader2 } from 'lucide-react';

const getOverallOrderStatus = (items: OrderItemType[]): OrderStatus => {
  if (!items || items.length === 0) return 'Pending';
  const statuses = items.map(item => item.status);
  if (statuses.every(s => s === 'Finished')) return 'Finished';
  if (statuses.some(s => s === 'Cooking')) return 'Cooking';
  return 'Pending';
};

const statusDisplayConfig: { [key in OrderStatus]: { text: string; Icon: React.ElementType; color: string } } = {
  Pending: { text: "Pending", Icon: Clock, color: "bg-yellow-500 hover:bg-yellow-600" },
  Cooking: { text: "Cooking", Icon: ChefHat, color: "bg-blue-500 hover:bg-blue-600" },
  Finished: { text: "Finished", Icon: CheckCircle2, color: "bg-green-500 hover:bg-green-600" },
};


export default function Cart() {
  const {
    cartItems,
    specialRequests,
    setSpecialRequests,
    getCartTotal,
    clearCart,
    isCartSheetOpen,
    setIsCartSheetOpen
  } = useCart();
  const { billId, isAuthenticated, tableId } = useAuth();
  const { 
    addOrder, 
    getOrdersByBillId, 
    loadOrdersForBill, 
    isLoading: ordersLoading, 
    error: ordersError 
  } = useOrders();
  const router = useRouter();
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const currentCartTotal = getCartTotal();

  // Load orders when billId changes or cart opens and billId is available
  useEffect(() => {
    if (isAuthenticated && billId && isCartSheetOpen) {
      loadOrdersForBill(billId);
    }
  }, [isAuthenticated, billId, isCartSheetOpen, loadOrdersForBill]);

  const allOrdersForBill = useMemo(() => {
    if (isAuthenticated && billId) {
      return getOrdersByBillId(billId); // Reads from OrderContext's local state
    }
    return [];
  }, [isAuthenticated, billId, getOrdersByBillId]);


  const totalBillAmount = useMemo(() => {
    return allOrdersForBill.reduce((sum, order) => sum + order.total, 0);
  }, [allOrdersForBill]);

  const handleSubmitOrder = async () => {
    if (cartItems.length === 0 || isSubmittingOrder) {
      return;
    }
    if (!billId) {
      console.error("Authentication Error: Cannot place order without a valid bill ID.");
      // Potentially show a toast or error message to the user
      return;
    }
    setIsSubmittingOrder(true);
    const newOrder = await addOrder(billId, cartItems, specialRequests, currentCartTotal);
    setIsSubmittingOrder(false);
    if (newOrder) {
      clearCart();
      // User remains in the cart sheet, order appears in "Recent Orders"
      // Force a reload of orders for the bill to include the new one,
      // though addOrder should ideally update the context state.
      // loadOrdersForBill(billId); // This might be redundant if addOrder updates context correctly
    } else {
      // Handle order submission error (e.g., show a toast)
      console.error("Order submission failed.");
    }
  };

  const handleGoToMenu = () => {
    setIsCartSheetOpen(false);
    setTimeout(() => {
      if (tableId) {
        router.push(`/${tableId}`);
      } else {
        router.push('/');
      }
    }, 300); 
  };
  
  const handleNavigate = (path: string) => {
    setIsCartSheetOpen(false);
    setTimeout(() => {
      router.push(path);
    }, 350); 
  };

  const showContinueShoppingLink = cartItems.length === 0 && allOrdersForBill.length === 0;
  const showFooterActionButtons = !(cartItems.length === 0 && allOrdersForBill.length === 0 && !ordersLoading);


  return (
    <Sheet open={isCartSheetOpen} onOpenChange={setIsCartSheetOpen}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="text-2xl">Your Cart & Bill</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-grow">
          {cartItems.length > 0 ? (
            <>
              <div className="divide-y border-b">
                {cartItems.map((item) => (
                  <CartItemCard key={`${item.menuItem.id}-${item.selectedPortion || 'default'}`} cartItem={item} />
                ))}
              </div>
              <div className="p-6 space-y-4 border-b">
                <div>
                  <label htmlFor="specialRequests" className="block text-sm font-medium mb-1">
                    Special Requests for Current Order
                  </label>
                  <Textarea
                    id="specialRequests"
                    placeholder="Any allergies or special instructions? (e.g., no onions)"
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
                <Separator />
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Current Order Subtotal:</span>
                  <span>₹{currentCartTotal.toFixed(2)}</span>
                </div>
              </div>
            </>
          ) : showContinueShoppingLink && !ordersLoading ? (
            <div className="flex flex-col items-center justify-center p-6 text-center min-h-[200px]">
              <ListOrdered className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg">Your cart is empty.</p>
              <p className="text-muted-foreground text-sm">No recent orders found for this bill.</p>
                <Button variant="link" className="mt-4" onClick={handleGoToMenu}>Continue Shopping</Button>
            </div>
          ) : cartItems.length === 0 && !ordersLoading ? ( // Cart empty, but orders might exist or be loading
            <div className="p-4 text-center text-muted-foreground text-sm border-b">
              Your cart is currently empty. Add items to start a new order.
            </div>
          ) : null}

          {ordersLoading && (
            <div className="p-6 flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-muted-foreground">Loading orders...</p>
            </div>
          )}
          {ordersError && !ordersLoading && (
            <div className="p-6 text-center text-destructive">
              <p>Error loading orders: {ordersError}</p>
            </div>
          )}

          {isAuthenticated && allOrdersForBill.length > 0 && !ordersLoading && (
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-3">Recent Orders</h3>
              <div className="space-y-3">
                {allOrdersForBill.map(order => {
                  const overallStatus = getOverallOrderStatus(order.items);
                  const displayConfig = statusDisplayConfig[overallStatus];
                  return (
                    <div key={order.id} className="p-3 bg-muted/50 rounded-md border">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-sm">Order #{order.id.slice(-6)}</span>
                        <Badge className={`${displayConfig.color} text-white text-xs`}>
                          <displayConfig.Icon className="mr-1 h-3 w-3" />
                          {displayConfig.text}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {new Date(order.timestamp).toLocaleDateString()} - ₹{order.total.toFixed(2)}
                      </p>
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="p-0 h-auto text-xs" 
                          onClick={() => handleNavigate(`/orders/${order.id}`)}
                        >
                          View Details
                        </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </ScrollArea>

        {showFooterActionButtons && (
            <SheetFooter className="p-6 border-t bg-background gap-3 flex-col">
            {allOrdersForBill.length > 0 && (
                <div className="flex justify-between items-center text-xl font-bold text-primary mb-3 pt-2 border-t">
                <div className="flex items-center">
                    <FileText className="mr-2 h-5 w-5" />
                    <span>Total Bill Amount:</span>
                </div>
                <span>₹{totalBillAmount.toFixed(2)}</span>
                </div>
            )}

            {cartItems.length > 0 ? (
                <div className="flex flex-col sm:flex-row gap-2 w-full mb-2">
                <Button variant="outline" onClick={clearCart} className="w-full sm:flex-1" disabled={isSubmittingOrder}>
                    Clear Current Order
                </Button>
                <Button onClick={handleSubmitOrder} className="w-full sm:flex-1" disabled={isSubmittingOrder}>
                    {isSubmittingOrder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit Current Order (₹{currentCartTotal.toFixed(2)})
                </Button>
                </div>
            ) : allOrdersForBill.length > 0 || ordersLoading ? ( // Show menu button if orders exist or are loading, and cart is empty
                <Button variant="default" className="w-full" onClick={handleGoToMenu}>
                    <Home className="mr-2 h-4 w-4" /> Menu
                </Button>
            ) : null }
            
            {allOrdersForBill.length > 0 && (
                <Button
                onClick={() => {
                    if (billId) {
                        handleNavigate(`/checkout/${billId}`);
                    }
                }}
                className="w-full"
                disabled={!billId || isSubmittingOrder}
                variant="default" 
                >
                <CreditCard className="mr-2 h-4 w-4" /> Proceed to Checkout
                </Button>
            )}
            </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
