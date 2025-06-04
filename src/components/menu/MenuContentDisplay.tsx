
"use client";

import type { MenuItemType } from '@/types';
import MenuCategory from '@/components/menu/MenuCategory';
import MenuItemCard from '@/components/menu/MenuItemCard';
import CategoryCard from '@/components/menu/CategoryCard';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LucideIcon } from 'lucide-react';

interface CategoryDetail {
  name: string;
  icon: LucideIcon; // This will be mapped on client from categoryIcons
  itemCount: number;
  imageUrl: string;
  dataAiHint: string;
}

interface MenuContentDisplayProps {
  searchTerm: string;
  selectedCategory: string | null;
  displayedItems: MenuItemType[];
  categoryDetails: CategoryDetail[];
  categoryIcons: { [key: string]: LucideIcon }; // Passed from parent for mapping
  onCategorySelect: (categoryName: string) => void;
  onClearSearch: () => void;
  setSearchTerm: (term: string) => void;
}

export default function MenuContentDisplay({
  searchTerm,
  selectedCategory,
  displayedItems,
  categoryDetails,
  categoryIcons, // Now used to get the actual Icon component
  onCategorySelect,
  onClearSearch,
  setSearchTerm
}: MenuContentDisplayProps) {
  return (
    <div className="mt-4">
      {searchTerm && !selectedCategory ? (
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold tracking-tight">
              {displayedItems.length > 0 ? `Results for "${searchTerm}"` : `No results for "${searchTerm}"`}
            </h2>
            <Button variant="outline" size="sm" onClick={onClearSearch} className="text-xs h-8">Clear Search</Button>
          </div>
          {displayedItems.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {displayedItems.map(item => <MenuItemCard key={item.id} item={item} />)}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-6">Try a different search term or browse categories.</p>
          )}
        </section>
      ) : selectedCategory ? (
        <section>
          <MenuCategory
            title={selectedCategory + (searchTerm ? ` (matching "${searchTerm}")` : "")}
            items={displayedItems}
            Icon={categoryIcons[selectedCategory] || Info} // Use categoryIcons prop
            noItemsMessage={searchTerm ? "No items match your search in this category." : undefined}
            showClearSearchButton={!!searchTerm}
            onClearSearchInCategory={() => setSearchTerm("")}
          />
        </section>
      ) : (
        <section>
          <h2 className="text-xl font-semibold tracking-tight mb-4 text-center">Browse by Category</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            {categoryDetails.map(cat => (
              <CategoryCard 
                key={cat.name} 
                categoryName={cat.name} 
                Icon={categoryIcons[cat.name] || Info} // Use categoryIcons prop
                itemCount={cat.itemCount} 
                imageUrl={cat.imageUrl} 
                dataAiHint={cat.dataAiHint} 
                onClick={() => onCategorySelect(cat.name)} 
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
