import type { MenuItemType } from '@/types';
import MenuItemCard from './MenuItemCard';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Import Button

interface MenuCategoryProps {
  title: string;
  items: MenuItemType[];
  Icon?: LucideIcon;
  noItemsMessage?: string;
  showClearSearchButton?: boolean; // Added prop
  onClearSearchInCategory?: () => void; // Added prop
}

export default function MenuCategory({ title, items, Icon, noItemsMessage, showClearSearchButton, onClearSearchInCategory }: MenuCategoryProps) {
  return (
    <section className="mb-10"> {/* Reduced margin bottom */}
      <div className="flex items-center justify-between mb-4"> {/* Reduced margin bottom */}
        <div className="flex items-center">
            {Icon && <Icon className="h-7 w-7 mr-2 text-primary" />} {/* Reduced icon size & margin */}
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2> {/* Reduced font size */}
        </div>
        {showClearSearchButton && onClearSearchInCategory && (
           <Button variant="ghost" size="sm" onClick={onClearSearchInCategory} className="text-xs h-8">
            Clear search in category
          </Button>
        )}
      </div>
      {items.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4"> {/* Default to 2 cols, 3 on md+ */}
          {items.map((item) => (
            <MenuItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-4">{noItemsMessage || "No items in this category at the moment."}</p>
      )}
    </section>
  );
}