
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
import { 
  Info, Loader2, Utensils, Soup, GlassWater, Droplet, Flame, Snowflake, Blend, UtensilsCrossed, Layers, ConciergeBell, PackageSearch, ShoppingBasket, HeartHandshake 
} from 'lucide-react'; // Added more icons for flexibility
import type { LucideIcon } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import {
  WELCOME_MESSAGE_VISIBLE_HEIGHT,
  // categoryIcons as localCategoryIconNameMap, // No longer needed here directly for icon resolution logic
  // predefinedServiceRequests, // Still needed for SpecialRequestDialog, imported there
  MOCKED_WAITER_OTP,
  // MOCKED_PHONE_OTP // Already removed
} from '@/lib/dataValues';

const IS_DEV_SKIP_LOGIN = false;

// Client-side map from icon name string to Lucide component
const lucideIconComponentsMap: { [key: string]: LucideIcon } = {
  Info,
  Utensils,
  Soup,
  GlassWater,
  Droplet,
  Flame,
  Snowflake,
  Blend,
  UtensilsCrossed,
  Layers,
  ConciergeBell,
  PackageSearch, // Example, add more as needed from your API or defaults
  ShoppingBasket,
  HeartHandshake,
};


export default function TablePage() {
  const params = useParams();
  const tableIdFromUrl = params.tableId as string;

  const {
    isAuthenticated,
    tableId: authTableId,
    billId: authBillId,
    login, // Assuming login is from AuthContext after NextAuth removal or for custom logic
    logout,
    currentBillPaymentStatus,
    isLoadingBillStatus
  } = useAuth();
  const { getItemCount, getCartTotal, setIsCartSheetOpen } = useCart();

  const [showLogin, setShowLogin] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);

  const [menuItems, setMenuItems] = useState<MenuItemType[]>([]);
  // fetchedCategories now expects {name: string, iconName: string}
  const [fetchedCategories, setFetchedCategories] = useState<{name: string; iconName: string}[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [isSpecialRequestDialogOpen, setIsSpecialRequestDialogOpen] = useState(false);
  // fabState related state from PageFloatingButtons is not needed here anymore.
  const [isDevLoggingIn, setIsDevLoggingIn] = useState(false);

  const cartItemCount = getItemCount();
  const cartTotal = getCartTotal();

  useEffect(() => {
    if (IS_DEV_SKIP_LOGIN && tableIdFromUrl && !(isAuthenticated && authTableId === tableIdFromUrl) && !isDevLoggingIn) {
      console.log(`DEV MODE: Auto-logging in via API for table ${tableIdFromUrl}`);
      setIsDevLoggingIn(true);
      const mockPhoneNumber = "+910000000000"; // Ensure it's formatted as expected by API if necessary

      const performDevLogin = async () => {
        try {
          // Simulate the entire LoginFlow's final steps for dev mode
          // 1. Call internal login API
          const internalLoginResponse = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tableId: tableIdFromUrl,
              waiterOtp: MOCKED_WAITER_OTP, // Assuming still needed for mock
              phoneNumber: mockPhoneNumber,
              // phoneOtp: MOCKED_PHONE_OTP, // Removed
            }),
          });
          const internalLoginData = await internalLoginResponse.json();

          if (internalLoginResponse.ok && internalLoginData.success && internalLoginData.billId) {
             // 2. Call NextAuth signIn (or AuthContext.login if NextAuth removed)
            const signInResult = await login( // Using AuthContext's login
              tableIdFromUrl,
              mockPhoneNumber, // Use the phone number used for API
              internalLoginData.billId
            );
            // Assuming login from AuthContext doesn't return a complex object like signIn
            // and directly updates context. If it returns error status, handle it.
            // For simplicity, assuming it works or throws if error.
            // onLoginSuccess behavior is implicitly handled by useEffect watching isAuthenticated
          } else {
            console.error("Dev auto-login (internal API) failed:", internalLoginData.error || `Status: ${internalLoginResponse.status}`);
            setShowLogin(true); // Fallback to showing login
          }
        } catch (error) {
          console.error("Dev auto-login API call error:", error);
          setShowLogin(true);
        } finally {
          setIsDevLoggingIn(false);
        }
      };
      performDevLogin();
    }
  }, [IS_DEV_SKIP_LOGIN, tableIdFromUrl, login, isAuthenticated, authTableId, isDevLoggingIn]);


  useEffect(() => {
    if (isAuthenticated && authTableId === tableIdFromUrl) {
      if (!isLoadingBillStatus && currentBillPaymentStatus === 'Completed') {
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

  useEffect(() => {
    if (!showLogin) {
      const fetchMenu = async () => {
        setIsMenuLoading(true);
        setMenuError(null);
        try {
          const response = await fetch('/api/menu');
          if (!response.ok) {
            throw new Error(`Failed to fetch menu: ${response.statusText}`);
          }
          const data = await response.json();
          setMenuItems(data.menuItems || []);
          setFetchedCategories(data.categories || []); // data.categories is now [{name, iconName}, ...]
        } catch (error: any) {
          setMenuError(error.message || 'Could not load menu.');
          setMenuItems([]);
          setFetchedCategories([]);
        } finally {
          setIsMenuLoading(false);
        }
      };
      fetchMenu();
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

  // FAB related useEffects are removed as PageFloatingButtons manages its own state


  const categoryDetails = useMemo(() => {
    return fetchedCategories
      .map(cat => { // cat is {name: string, iconName: string}
        const itemsInCategory = menuItems.filter(item => item.category === cat.name);
        const IconComponent = lucideIconComponentsMap[cat.iconName] || lucideIconComponentsMap.Info;
        
        // Default placeholder, specific ones can be set if needed, or fetched if API provides them
        let imageUrl = 'https://placehold.co/320x180.png';
        let dataAiHint = 'food category'; // Generic hint

        // Example of setting specific hints/images for known categories, if desired
        if (cat.name === 'Starters') { dataAiHint = 'appetizers selection'; }
        else if (cat.name === 'Mains') { dataAiHint = 'hearty meals'; }
        else if (cat.name === 'Drinks') { dataAiHint = 'refreshing beverages'; }
        
        return { 
          name: cat.name, 
          icon: IconComponent, 
          itemCount: itemsInCategory.length, 
          imageUrl, 
          dataAiHint 
        };
      })
      .filter(cat => cat.itemCount > 0);
  }, [menuItems, fetchedCategories]);


  const displayedItems = useMemo(() => {
    let itemsToDisplay = menuItems;
    if (selectedCategory && !searchTerm) {
      itemsToDisplay = itemsToDisplay.filter(item => item.category === selectedCategory);
    }
    if (searchTerm) {
      itemsToDisplay = itemsToDisplay.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      if (selectedCategory) {
        itemsToDisplay = itemsToDisplay.filter(item => item.category === selectedCategory);
      }
    }
    return itemsToDisplay;
  }, [searchTerm, selectedCategory, menuItems]);


  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const clearSelectionAndSearch = useCallback(() => {
    setSelectedCategory(null);
    setSearchTerm("");
  }, []);

  const handleCategorySelect = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setSearchTerm(""); // Clear search when a category is selected
  };

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
  
  // This check is for NextAuth, might need adjustment if AuthContext state behaves differently
  if (isDevLoggingIn || (isAuthenticated && isLoadingBillStatus && !showLogin)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Verifying session...</p>
      </div>
    );
  }

  if (showLogin) {
    return <LoginFlow tableIdFromUrl={tableIdFromUrl} onLoginSuccess={() => { /* State change handled by useEffect */ }} />;
  }

  if (isMenuLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading menu...</p>
      </div>
    );
  }

  if (menuError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <Info className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Error Loading Menu</h1>
        <p className="text-muted-foreground">{menuError}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">
            Try Again
        </button>
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
        categoryDetails={categoryDetails} // Contains resolved icon components
        categoryIcons={lucideIconComponentsMap} // Pass the full map for title icon lookup
        onCategorySelect={handleCategorySelect}
        onClearSearch={clearSelectionAndSearch}
        setSearchTerm={setSearchTerm}
      />

      <PageFloatingButtons
        showLogin={showLogin}
        selectedCategory={selectedCategory}
        searchTerm={searchTerm}
        onOpenSpecialRequestDialog={openSpecialRequestDialog}
        cartItemCount={cartItemCount}
        cartTotal={cartTotal}
        onOpenCartSheet={() => setIsCartSheetOpen(true)}
        // fabState prop is removed, handled internally by PageFloatingButtons
      />

      <SpecialRequestDialog
        isOpen={isSpecialRequestDialogOpen}
        onOpenChange={setIsSpecialRequestDialogOpen}
      />
    </div>
  );
}
