
"use client";

import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { Badge } from '@/components/ui/badge';

interface CartIconProps {
  onClick: () => void;
}

export default function CartIcon({ onClick }: CartIconProps) {
  const { getItemCount } = useCart();
  const itemCount = getItemCount();

  return (
    <Button variant="ghost" size="icon" className="relative" onClick={onClick} aria-label="Open cart">
      <ShoppingCart className="h-6 w-6" />
      {itemCount > 0 && (
        <Badge 
          variant="destructive" 
          className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full"
        >
          {itemCount}
        </Badge>
      )}
    </Button>
  );
}
