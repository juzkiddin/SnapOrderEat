
"use client";

import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';
import React from 'react';

interface CategoryCardProps {
  categoryName: string;
  Icon: LucideIcon;
  itemCount: number;
  imageUrl: string;
  dataAiHint?: string;
  onClick: () => void;
}

function CategoryCardComponent({ categoryName, Icon, itemCount, imageUrl, dataAiHint, onClick }: CategoryCardProps) {
  return (
    <Card
      className="flex flex-col overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer rounded-md"
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      aria-label={`View ${categoryName} category, ${itemCount} items`}
    >
      <div className="aspect-video relative w-full">
        <Image
          src={imageUrl}
          alt={`Image for ${categoryName} category`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
          data-ai-hint={dataAiHint || "food category"}
          priority={false} // Consider true for above-the-fold categories if applicable
        />
      </div>
      <div className="p-3 flex-grow flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-0 mb-1">
          <CardTitle className="text-md font-semibold">{categoryName}</CardTitle>
          <Icon className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent className="p-0 flex-grow">
          <p className="text-xs text-muted-foreground mb-1">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </p>
        </CardContent>
        <div className="flex items-center text-xs font-medium text-primary group mt-auto pt-1">
          View Items
          <ChevronRight className="h-3 w-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Card>
  );
}
export default React.memo(CategoryCardComponent);
