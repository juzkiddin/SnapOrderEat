
// This page is no longer required and will be deleted.
// The functionality of listing all orders has been removed from the user flow.
// Users can see their recent orders directly in the cart sheet.
// Specific order details are available via /orders/[orderId].

"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PackageOpen } from 'lucide-react';


export default function DeprecatedOrdersPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
      <PackageOpen className="h-24 w-24 text-primary mb-6" />
      <h1 className="text-3xl font-bold mb-2">Page Not Used</h1>
      <p className="text-muted-foreground mb-6">
        This page for listing all orders is no longer part of the application flow.
        You can view recent orders in the cart, and specific order details by their ID.
      </p>
      <Button asChild>
        <Link href="/">Back to Home</Link>
      </Button>
    </div>
  );
}

