
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/contexts/OrderContext';
import type { OrderType, OrderStatus, OrderItemType } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle2, ChefHat, Clock, ArrowLeft, Utensils, PackageCheck, CookingPot, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const itemStatusDetails: { [key in OrderStatus]: { text: string; Icon: React.ElementType; color: string; } } = {
  Pending: { text: "Pending", Icon: Clock, color: "bg-yellow-500" },
  Cooking: { text: "Cooking", Icon: CookingPot, color: "bg-blue-500" },
  Finished: { text: "Ready", Icon: PackageCheck, color: "bg-green-500" },
};

const overallOrderStatusDetails: { [key in OrderStatus | 'Mixed']: { text: string; Icon: React.ElementType; color: string; progress: number } } = {
  Pending: { text: "Order Placed, Awaiting Confirmation", Icon: Clock, color: "bg-yellow-500", progress: 25 },
  Cooking: { text: "Your order is being prepared!", Icon: ChefHat, color: "bg-blue-500", progress: 65 },
  Finished: { text: "All items ready! Enjoy your meal.", Icon: CheckCircle2, color: "bg-green-500", progress: 100 },
  Mixed: { text: "Items in various stages of preparation", Icon: ChefHat, color: "bg-orange-500", progress: 50 }, 
};


export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderIdFromUrl = params.orderId as string;
  
  const { isAuthenticated, billId: authBillId, tableId } = useAuth(); // Added tableId
  const { getOrderById, loadOrdersForBill, isLoading: ordersLoading, error: ordersError } = useOrders();
  
  const [isInitiallyLoading, setIsInitiallyLoading] = useState(true);

  // Effect to load orders for the bill if not already loaded or if specific order isn't found
  useEffect(() => {
    if (orderIdFromUrl && authBillId) {
        const existingOrder = getOrderById(orderIdFromUrl);
        if (!existingOrder) {
            // console.log(`Order ${orderIdFromUrl} not in context, attempting to load for bill ${authBillId}`);
            loadOrdersForBill(authBillId).finally(() => setIsInitiallyLoading(false));
        } else {
            setIsInitiallyLoading(false);
        }
    } else if (!orderIdFromUrl) {
        setIsInitiallyLoading(false); // No orderId, nothing to load
    }
  }, [orderIdFromUrl, authBillId, getOrderById, loadOrdersForBill]);


  const order = useMemo(() => {
    if (!orderIdFromUrl) return null;
    return getOrderById(orderIdFromUrl) || null; 
  }, [orderIdFromUrl, getOrderById]);

  // Redirect if order's billId doesn't match authenticated billId
  useEffect(() => {
    if (order && authBillId && order.billId !== authBillId) {
        // User is trying to access an order not belonging to their current bill session
        const redirectTableId = tableId || (authBillId ? authBillId.split('-')[2] : null); // Prioritize tableId from context
        router.replace(redirectTableId ? `/${redirectTableId}` : '/'); 
    }
  }, [order, authBillId, router, tableId]);


  const overallStatus = useMemo((): OrderStatus | 'Mixed' => {
    if (!order || !order.items || order.items.length === 0) return "Pending"; 
    const statuses = order.items.map(item => item.status);
    if (statuses.every(s => s === "Finished")) return "Finished";
    if (statuses.every(s => s === "Pending")) return "Pending";
    // if (statuses.some(s => s === "Cooking") || (statuses.some(s => s === "Pending") && !statuses.every(s => s === "Pending"))) return "Cooking"; 
    if (statuses.some(s => s === "Cooking") || statuses.some(s => s === "Finished")) return "Cooking"; // Simplified "Cooking" if not all Pending/Finished
    return "Mixed"; 
  }, [order]);

  const currentOverallStatusDetails = overallOrderStatusDetails[overallStatus === 'Mixed' ? 'Cooking' : overallStatus];


  if (isInitiallyLoading || ordersLoading) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading order details...</p>
      </div>
    );
  }

  if (ordersError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <AlertCircle className="h-24 w-24 text-destructive mb-6" />
        <h1 className="text-3xl font-bold mb-2">Error Loading Order</h1>
        <p className="text-muted-foreground mb-6">{ordersError}</p>
        <Button asChild variant="outline">
          <Link href={tableId ? `/${tableId}` : '/'}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Menu</Link>
        </Button>
      </div>
    );
  }
  
  if (!order) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <AlertCircle className="h-24 w-24 text-destructive mb-6" />
        <h1 className="text-3xl font-bold mb-2">Order Not Found</h1>
        <p className="text-muted-foreground mb-6">
          We couldn't find an order with ID: {orderIdFromUrl || "N/A"}. It might still be processing or the ID is incorrect.
        </p>
        <Button asChild variant="outline">
          <Link href={tableId ? `/${tableId}` : '/'}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Menu</Link>
        </Button>
      </div>
    );
  }
  
  if (!isAuthenticated || (authBillId && order.billId !== authBillId)) {
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <AlertCircle className="h-24 w-24 text-destructive mb-6" />
        <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">
          You do not have permission to view this order.
        </p>
        <Button asChild variant="outline">
           <Link href={tableId ? `/${tableId}` : '/'}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Menu</Link>
        </Button>
      </div>
    );
  }

  const effectiveTableIdForNav = tableId || (authBillId ? authBillId.split('-')[2] : null);


  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <Card className="overflow-hidden shadow-lg">
        <CardHeader className="bg-muted/30 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle className="text-2xl md:text-3xl">Order #{order.id.slice(-6)} Status</CardTitle>
              <CardDescription>
                Placed on: {new Date(order.timestamp).toLocaleString()}
              </CardDescription>
            </div>
            <Badge className={`${currentOverallStatusDetails.color} text-white text-lg px-4 py-2 shadow-md`}>
              <currentOverallStatusDetails.Icon className="mr-2 h-5 w-5" />
              {overallStatus === 'Mixed' ? 'In Progress' : overallStatus === 'Cooking' ? 'In Progress' : overallStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-3">
            <currentOverallStatusDetails.Icon className={`h-16 w-16 mx-auto ${currentOverallStatusDetails.color.replace('bg-', 'text-')}`} />
            <p className="text-xl font-semibold">{currentOverallStatusDetails.text}</p>
            <Progress value={currentOverallStatusDetails.progress} className="w-full h-3 [&>div]:bg-primary rounded-full" />
          </div>
          
          <Separator />

          <div>
            <h3 className="text-xl font-semibold mb-4">Your Items</h3>
            <div className="space-y-4">
              {order.items.map(item => {
                const itemStatus = itemStatusDetails[item.status];
                return (
                  <div key={`${item.menuItem.id}-${item.selectedPortion || 'default'}`} className="flex items-center justify-between p-3 bg-card/80 rounded-lg shadow-sm gap-3 border">
                    <div className="flex items-center space-x-4 flex-grow">
                      <div className="relative h-16 w-16 rounded-md overflow-hidden flex-shrink-0 border">
                        <Image
                          src={item.menuItem.imageUrl}
                          alt={item.menuItem.name}
                          fill
                          sizes="64px"
                          className="object-cover"
                          data-ai-hint={item.menuItem.dataAiHint || "food item"}
                        />
                      </div>
                      <div className="flex-grow">
                        <p className="font-semibold text-md">
                          {item.menuItem.name}
                          {item.selectedPortion && (
                            <span className="text-xs text-muted-foreground ml-1">({item.selectedPortion})</span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} x ₹{item.priceInOrder.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-1 flex-shrink-0 text-right">
                       <Badge variant="outline" className={`${itemStatus.color} text-white text-xs px-2.5 py-1`}>
                        <itemStatus.Icon className="mr-1.5 h-3.5 w-3.5" />
                        {itemStatus.text}
                      </Badge>
                      <p className="font-medium text-sm">₹{(item.priceInOrder * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {order.specialRequests && (
            <>
              <Separator />
              <div>
                <h3 className="text-xl font-semibold mb-2">Special Requests</h3>
                <p className="text-muted-foreground p-3 bg-secondary/50 rounded-md whitespace-pre-wrap border">{order.specialRequests}</p>
              </div>
            </>
          )}
          
          <Separator />

          <div className="text-right space-y-1">
            <p className="text-lg">Subtotal (this order): <span className="font-semibold">₹{order.items.reduce((acc, curr) => acc + curr.priceInOrder * curr.quantity, 0).toFixed(2)}</span></p>
            <p className="text-2xl font-bold text-primary">Order Total: ₹{order.total.toFixed(2)}</p>
          </div>

        </CardContent>
        <CardFooter className="p-6 bg-muted/30 flex justify-center items-center gap-3 border-t">
          <Button onClick={() => router.push(effectiveTableIdForNav ? `/${effectiveTableIdForNav}` : '/')}>
            <Utensils className="mr-2 h-4 w-4" /> Place Another Order
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
