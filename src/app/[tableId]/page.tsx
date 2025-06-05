
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import LoginFlow from '@/components/auth/LoginFlow';
import WelcomeBanner from '@/components/layout/WelcomeBanner';
import MenuNavigationControls from '@/components/menu/MenuNavigationControls';
import MenuContentDisplay from '@/components/menu/MenuContentDisplay';
import SpecialRequestDialog from '@/components/menu/SpecialRequestDialog';
import PageFloatingButtons from '@/components/layout/PageFloatingButtons';

import type { MenuItemType } from '@/types';
import { Info, Loader2, Popcorn } from 'lucide-react'; 
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';


import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import {
  WELCOME_MESSAGE_VISIBLE_HEIGHT,
  MOCKED_WAITER_OTP,
  sampleMenuData as localSampleMenuData, // Use a distinct name for local fallback
} from '@/lib/dataValues';

const IS_DEV_SKIP_LOGIN = false;


export default function TablePage() {
  const params = useParams();
  const tableIdFromUrl = params.tableId as string;

  const {
    isAuthenticated,
    tableId: authTableId,
    billId: authBillId,
    logout,
    currentBillPaymentStatus,
    isLoadingBillStatus
  } = useAuth();
  const { getItemCount, getCartTotal, setIsCartSheetOpen } = useCart();

  const [showLogin, setShowLogin] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);

  // Holds the initial sample menu or items for a selected category
  const [menuItems, setMenuItems] = useState<MenuItemType[]>([]);
  // Holds only the initial sample menu loaded from /api/menu, used for global search or reset
  const [initialSampleMenuItems, setInitialSampleMenuItems] = useState<MenuItemType[]>([]);

  const [fetchedCategories, setFetchedCategories] = useState<{name: string; iconName: string}[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(true); // Combined loading state for initial menu and category items
  const [menuError, setMenuError] = useState<string | null>(null);

  const [isSpecialRequestDialogOpen, setIsSpecialRequestDialogOpen] = useState(false);
  const [isDevLoggingIn, setIsDevLoggingIn] = useState(false);

  const cartItemCount = getItemCount();
  const cartTotal = getCartTotal();

  useEffect(() => {
    if (IS_DEV_SKIP_LOGIN && tableIdFromUrl && !(isAuthenticated && authTableId === tableIdFromUrl) && !isDevLoggingIn) {
      console.log(`[DEV MODE] Auto-logging in via API for table ${tableIdFromUrl}`);
      setIsDevLoggingIn(true);
      const mockPhoneNumber = "+910000000000"; 

      const performDevLogin = async () => {
        try {
          const internalLoginResponse = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tableId: tableIdFromUrl,
              waiterOtp: MOCKED_WAITER_OTP, 
              phoneNumber: mockPhoneNumber,
            }),
          });
          const internalLoginData = await internalLoginResponse.json();

          if (internalLoginResponse.ok && internalLoginData.success && internalLoginData.billId) {
            const { signIn } = await import('next-auth/react'); 
            const signInResult = await signIn('credentials', {
              redirect: false,
              phoneNumber: mockPhoneNumber,
              tableId: tableIdFromUrl,
              billId: internalLoginData.billId,
            });
            if (signInResult?.error) {
              console.error("[DEV MODE] Auto-login (NextAuth signIn) failed:", signInResult.error);
              setShowLogin(true);
            } else {
              console.log("[DEV MODE] Auto-login via NextAuth signIn successful.");
            }
          } else {
            console.error("[DEV MODE] Auto-login (internal API) failed:", internalLoginData.error || `Status: ${internalLoginResponse.status}`);
            setShowLogin(true); 
          }
        } catch (error) {
          console.error("[DEV MODE] Auto-login API call error:", error);
          setShowLogin(true);
        } finally {
          setIsDevLoggingIn(false);
        }
      };
      performDevLogin();
    }
  }, [IS_DEV_SKIP_LOGIN, tableIdFromUrl, isAuthenticated, authTableId, isDevLoggingIn]);


  useEffect(() => {
    if (isAuthenticated && authTableId === tableIdFromUrl) {
      if (!isLoadingBillStatus && currentBillPaymentStatus === 'Completed') {
        console.log("[Auth] Bill completed, logging out.");
        logout();
        setShowLogin(true);
      } else if (!isLoadingBillStatus) {
        setShowLogin(false);
      }
    } else {
      setShowLogin(true);
    }
  }, [
    isAuthenticated,
    authTableId,
    tableIdFromUrl,
    logout,
    currentBillPaymentStatus,
    isLoadingBillStatus
  ]);

  // Effect for initial menu (categories + sample items) load
  useEffect(() => {
    if (!showLogin) {
      const fetchInitialMenu = async () => {
        console.log("[PageLoad] Fetching initial menu (categories and sample items)...");
        setIsMenuLoading(true);
        setMenuError(null);
        try {
          const response = await fetch('/api/menu', { cache: 'no-store' }); // Ensure categories are fresh too
          if (!response.ok) {
            throw new Error(`Failed to fetch initial menu: ${response.statusText}`);
          }
          const data = await response.json();
          console.log("[PageLoad] Initial menu data received:", data);
          const sampleItems = data.menuItems || localSampleMenuData; // Fallback to local if API doesn't send items
          setInitialSampleMenuItems(sampleItems);
          setMenuItems(sampleItems); // Initially, menuItems are the sample items
          setFetchedCategories(data.categories || []); 
        } catch (error: any) {
          console.error("[PageLoad] Error fetching initial menu:", error.message);
          setMenuError(error.message || 'Could not load initial menu.');
          setInitialSampleMenuItems(localSampleMenuData); // Fallback on error
          setMenuItems(localSampleMenuData);
          setFetchedCategories([]);
        } finally {
          setIsMenuLoading(false);
        }
      };
      fetchInitialMenu();
    }
  }, [showLogin]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!showLogin) {
      setShowWelcomeMessage(true);
      timer = setTimeout(() => {
        setShowWelcomeMessage(false);
      }, 1500);
    } else {
      setShowWelcomeMessage(true);
    }
    return () => clearTimeout(timer);
  }, [showLogin]);


  const categoryDetails = useMemo(() => {
    return fetchedCategories
      .map(cat => { 
        // Item count is based on initial sample menu for category cards, not dynamic items
        const itemsInCategory = initialSampleMenuItems.filter(item => item.category === cat.name);
        const IconComponent = LucideIcons[cat.iconName as keyof typeof LucideIcons] || Info;
        
        let imageUrl = 'https://placehold.co/320x180.png';
        let dataAiHint = 'food category'; 

        if (cat.name === 'Starters') { dataAiHint = 'appetizers selection'; }
        else if (cat.name === 'Mains') { dataAiHint = 'hearty meals'; }
        else if (cat.name === 'Drinks') { dataAiHint = 'refreshing beverages'; }
        else if (cat.iconName === 'Popcorn') { dataAiHint = 'snacks popcorn';} 
        
        return { 
          name: cat.name, 
          icon: IconComponent, 
          itemCount: itemsInCategory.length, 
          imageUrl, 
          dataAiHint 
        };
      })
      .filter(cat => cat.itemCount > 0 || fetchedCategories.some(fc => fc.name === cat.name)); // Show category even if 0 sample items, if API listed it
  }, [initialSampleMenuItems, fetchedCategories]);


  const displayedItems = useMemo(() => {
    // menuItems state now correctly holds either global sample data or category-specific API data
    let itemsToDisplay = menuItems; 
    if (searchTerm) {
      itemsToDisplay = itemsToDisplay.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      // If a category is selected, search should already be within its items.
      // This additional filter ensures it, though menuItems should already be scoped.
      if (selectedCategory) { 
        itemsToDisplay = itemsToDisplay.filter(item => item.category === selectedCategory);
      }
    }
    // console.log(`[DisplayedItems] For search '${searchTerm}' in category '${selectedCategory || 'All'}', showing ${itemsToDisplay.length} items.`);
    return itemsToDisplay;
  }, [searchTerm, selectedCategory, menuItems]);


  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const clearSelectionAndSearch = useCallback(() => {
    console.log("[Selection] Clearing category selection and search. Resetting to initial sample menu items.");
    setSelectedCategory(null);
    setSearchTerm("");
    setMenuItems(initialSampleMenuItems); // Reset to show all sample items
    setMenuError(null); // Clear any previous category-specific errors
  }, [initialSampleMenuItems]);

  const handleCategorySelect = useCallback(async (categoryName: string) => {
    console.log(`[CategorySelect] Category selected: ${categoryName}. Fetching items...`);
    setSelectedCategory(categoryName);
    setSearchTerm(""); 
    setIsMenuLoading(true);
    setMenuError(null);
    try {
      const response = await fetch('/api/menu/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryName }),
        cache: 'no-store', // Ensure fresh data from our API endpoint
      });
      console.log(`[CategorySelect] Response status from /api/menu/items for ${categoryName}: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Failed to fetch items for ${categoryName}. Status: ${response.status}` }));
        console.error(`[CategorySelect] Error fetching items for ${categoryName}:`, errorData.error || response.statusText);
        throw new Error(errorData.error || `Could not load items for ${categoryName}.`);
      }
      const data: MenuItemType[] = await response.json();
      console.log(`[CategorySelect] Items received from API for ${categoryName} (count: ${data.length}):`, data.slice(0,3)); // Log first 3 items
      setMenuItems(data);
      console.log(`[CategorySelect] menuItems state updated with ${data.length} items from API for ${categoryName}.`);
    } catch (error: any) {
      console.error(`[CategorySelect] Catch block error for ${categoryName}:`, error.message);
      setMenuError(error.message);
      setMenuItems([]); // Clear items on error
    } finally {
      setIsMenuLoading(false);
    }
  }, []);

  const openSpecialRequestDialog = () => {
    setIsSpecialRequestDialogOpen(true);
  };

  if (!tableIdFromUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <Info className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Invalid Table Link</h1>
        <p className="text-muted-foreground">Please scan a valid QR code at your table.</p>
      </div>
    );
  }
  
  if (isDevLoggingIn || (isAuthenticated && isLoadingBillStatus && !showLogin)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Verifying session...</p>
      </div>
    );
  }

  if (showLogin) {
    return <LoginFlow tableIdFromUrl={tableIdFromUrl} onLoginSuccess={() => { /* State change handled by useEffect watching session */ }} />;
  }

  // This loading state now covers initial menu load AND category-specific item load
  if (isMenuLoading) {
    const loadingMessage = selectedCategory 
      ? `Loading items for ${selectedCategory}...` 
      : "Loading menu...";
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">{loadingMessage}</p>
      </div>
    );
  }

  // This error state can be for initial menu load OR category-specific item load
  if (menuError) {
    const errorMessage = selectedCategory
      ? `Error loading items for ${selectedCategory}: ${menuError}`
      : `Error Loading Menu: ${menuError}`;
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <Info className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">{selectedCategory ? "Error Loading Items" : "Error Loading Menu"}</h1>
        <p className="text-muted-foreground">{menuError}</p>
        <button 
          onClick={() => selectedCategory ? handleCategorySelect(selectedCategory) : window.location.reload()} 
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
            Try Again
        </button>
        {selectedCategory && (
          <button 
            onClick={clearSelectionAndSearch}
            className="mt-2 px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
          >
            Back to Categories
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="pb-24">
      <WelcomeBanner showWelcomeMessage={showWelcomeMessage} />

      <MenuNavigationControls
        selectedCategory={selectedCategory}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onClearSelectionAndSearch={clearSelectionAndSearch}
      />

      <MenuContentDisplay
        searchTerm={searchTerm}
        selectedCategory={selectedCategory}
        displayedItems={displayedItems}
        categoryDetails={categoryDetails} 
        categoryIcons={LucideIcons} 
        onCategorySelect={handleCategorySelect}
        onClearSearch={clearSelectionAndSearch} // Used when "Clear Search" in global search results
        setSearchTerm={setSearchTerm} // Used when "Clear search in category"
      />

      <PageFloatingButtons
        showLogin={showLogin}
        selectedCategory={selectedCategory}
        searchTerm={searchTerm}
        onOpenSpecialRequestDialog={openSpecialRequestDialog}
        cartItemCount={cartItemCount}
        cartTotal={cartTotal}
        onOpenCartSheet={() => setIsCartSheetOpen(true)}
      />

      <SpecialRequestDialog
        isOpen={isSpecialRequestDialogOpen}
        onOpenChange={setIsSpecialRequestDialogOpen}
      />
    </div>
  );
}

