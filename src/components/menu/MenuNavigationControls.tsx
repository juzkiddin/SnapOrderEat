
"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ChevronLeft } from 'lucide-react';

interface MenuNavigationControlsProps {
  selectedCategory: string | null;
  searchTerm: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearSelectionAndSearch: () => void;
}

export default function MenuNavigationControls({
  selectedCategory,
  searchTerm,
  onSearchChange,
  onClearSelectionAndSearch
}: MenuNavigationControlsProps) {
  return (
    <div className="flex items-center w-full max-w-xl mx-auto mb-4 gap-2">
      <AnimatePresence>
        {selectedCategory && (
          <motion.div
            key="back-button-dynamic"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex-shrink-0"
          >
            <Button variant="outline" size="icon" onClick={onClearSelectionAndSearch} aria-label="Back to categories" className="p-2.5 rounded-full shadow-sm hover:shadow-md transition-shadow">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        className="relative flex-grow"
        layout
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <Input
          type="text"
          placeholder={selectedCategory ? `Search within ${selectedCategory}...` : "Search dishes (e.g., Pizza, Soup...)"}
          value={searchTerm}
          onChange={onSearchChange}
          className="pl-10 pr-4 py-2.5 text-sm w-full rounded-full shadow-sm focus:shadow-md transition-shadow"
        />
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      </motion.div>
    </div>
  );
}
