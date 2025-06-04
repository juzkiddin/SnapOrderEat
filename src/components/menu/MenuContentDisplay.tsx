
"use client";

import type { MenuItemType } from '@/types';
import MenuCategory from '@/components/menu/MenuCategory';
import MenuItemCard from '@/components/menu/MenuItemCard';
import CategoryCard from '@/components/menu/CategoryCard';
import { Info, type LucideIcon } from 'lucide-react'; 
import * as LucideIconsNamespace from 'lucide-react'; // For typing the prop
import { Button } from '@/components/ui/button';

interface CategoryDetailForDisplay {
  name: string;
  icon: LucideIcon; 
  itemCount: number;
  imageUrl: string;
  dataAiHint: string;
}

interface MenuContentDisplayProps {
  searchTerm: string;
  selectedCategory: string | null;
  displayedItems: MenuItemType[];
  categoryDetails: CategoryDetailForDisplay[]; 
  categoryIcons: typeof LucideIconsNamespace; // Expects the whole LucideIcons namespace
  onCategorySelect: (categoryName: string) => void;
  onClearSearch: () => void;
  setSearchTerm: (term: string) => void;
}

export default function MenuContentDisplay({
  searchTerm,
  selectedCategory,
  displayedItems,
  categoryDetails,
  categoryIcons, 
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
            // Use categoryIcons (LucideIcons namespace) with selectedCategory (which is a string name)
            // Fallback to Info icon from the namespace, or the directly imported Info as a final safety net.
            Icon={categoryIcons[selectedCategory as keyof typeof categoryIcons] || categoryIcons.Info || Info} 
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
                Icon={cat.icon} 
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
