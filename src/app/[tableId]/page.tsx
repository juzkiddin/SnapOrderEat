
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
import { Info, Loader2, Popcorn, AlertTriangle } from 'lucide-react'; 
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import {
  WELCOME_MESSAGE_VISIBLE_HEIGHT,
  MOCKED_WAITER_OTP, // This is for DEV_SKIP_LOGIN, may not be needed with new external OTP
  sampleMenuData as localSampleMenuData,
} from '@/lib/dataValues';

const IS_DEV_SKIP_LOGIN = false; // Set to false as external OTP/Session API is primary

export default function TablePage() {
  const params = useParams();
  const tableIdFromUrl = params.tableId as string;

  const {
    isAuthenticated, // From NextAuth session via AuthContext
    tableId: authTableId, // From NextAuth session
    billId: authBillId, // From NextAuth session
    sessionId: authSessionId, // From NextAuth session
    currentPaymentStatus, // From NextAuth session, updated by AuthContext
    logout,
    isAuthContextLoading, // Loading state from AuthContext (e.g. for /session/createsession)
    externalSessionError, // Error from AuthContext (e.g. "Expired session")
  } = useAuth();
  const { getItemCount, getCartTotal, setIsCartSheetOpen } = useCart();

  const [showLogin, setShowLogin] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);

  const [menuItems, setMenuItems] = useState<MenuItemType[]>([]); // Holds current items for display
  const [initialSampleMenuItems, setInitialSampleMenuItems] = useState<MenuItemType[]>([]); // Fallback/initial

  const [fetchedCategories, setFetchedCategories] = useState<{name: string; iconName: string}[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(true); 
  const [menuError, setMenuError] = useState<string | null>(null);

  const [isSpecialRequestDialogOpen, setIsSpecialRequestDialogOpen] = useState(false);
  // isDevLoggingIn state might be removable if DEV_SKIP_LOGIN is always false
  const [isDevLoggingIn, setIsDevLoggingIn] = useState(false);


  const cartItemCount = getItemCount();
  const cartTotal = getCartTotal();

  // Dev Skip Login - To be reviewed if still needed with external session API
  useEffect(() => {
    if (IS_DEV_SKIP_LOGIN && tableIdFromUrl && !isAuthenticated && !isDevLoggingIn) {
      // This dev login flow would need significant rework to use the new /session/createsession
      // and then NextAuth sign-in. For now, it's best to disable IS_DEV_SKIP_LOGIN.
      console.warn("[DEV MODE] Auto-login is active but needs update for new session API. Please test manual login.");
      // To make this work:
      // 1. Call a dev version of authContext.createOrVerifyExternalSession (or a direct API call here)
      // 2. With the sessionId and billId, call NextAuth signIn.
    }
  }, [IS_DEV_SKIP_LOGIN, tableIdFromUrl, isAuthenticated, isDevLoggingIn]);


  // Main effect to determine if login screen or menu should be shown
  useEffect(() => {
    if (isAuthContextLoading) {
      // Wait for AuthContext to finish any loading (e.g. initial session check, /session/createsession call)
      return;
    }

    if (isAuthenticated && authTableId === tableIdFromUrl && authSessionId && authBillId) {
      // User is authenticated for this table, has session and bill
      if (externalSessionError) {
        // If AuthContext reported an error (e.g., "Expired session" from createOrVerifyExternalSession)
        // LoginFlow will handle displaying this. Ensure we show login.
        setShowLogin(true);
      } else if (currentPaymentStatus === 'Confirmed' || currentPaymentStatus === 'Completed') { 
        // Assuming 'Completed' is an old status and 'Confirmed' is the new one from API.
        // If bill is paid, user should be logged out or redirected.
        // For now, let's redirect to bill status page.
        // This logic might also live in BillStatusPage or CheckoutPage based on flow.
        // If on table page and bill is paid, likely means they came back.
        // Consider if logout is more appropriate here.
        // For now, if they land here and it's paid, show login to re-initiate.
        console.log("[Auth] Bill is Confirmed/Completed. Showing login to re-initiate if needed.");
        logout(); // Force logout and re-evaluation
        setShowLogin(true);
      } else {
        // Session is active, not expired, and bill not paid
        setShowLogin(false);
      }
    } else {
      // Not authenticated, or tableId mismatch, or session/billId missing
      setShowLogin(true);
    }
  }, [
    isAuthenticated,
    authTableId,
    tableIdFromUrl,
    authSessionId,
    authBillId,
    currentPaymentStatus,
    isAuthContextLoading,
    externalSessionError,
    logout
  ]);


  // Effect for initial menu (categories + sample items) load OR if showLogin becomes false
  useEffect(() => {
    if (!showLogin && !isAuthContextLoading) { // Only fetch if login is hidden and auth context is not loading
      const fetchInitialMenu = async () => {
        console.log("[PageLoad] Fetching initial menu (categories and sample items)...");
        setIsMenuLoading(true);
        setMenuError(null);
        try {
          // This fetches category definitions and *sample* items for global search/fallback
          const response = await fetch('/api/menu', { cache: 'no-store' }); 
          if (!response.ok) {
            throw new Error(`Failed to fetch initial menu: ${response.statusText}`);
          }
          const data = await response.json();
          const sampleItems = data.menuItems || localSampleMenuData; 
          setInitialSampleMenuItems(sampleItems);
          setMenuItems(sampleItems); // Initially, menuItems are the sample items
          setFetchedCategories(data.categories || []); 
        } catch (error: any) {
          console.error("[PageLoad] Error fetching initial menu:", error.message);
          setMenuError(error.message || 'Could not load initial menu.');
          setInitialSampleMenuItems(localSampleMenuData); 
          setMenuItems(localSampleMenuData);
          setFetchedCategories([]); // Use local fallback or define structure for empty categories
        } finally {
          setIsMenuLoading(false);
        }
      };
      fetchInitialMenu();
    }
  }, [showLogin, isAuthContextLoading]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!showLogin) {
      setShowWelcomeMessage(true);
      timer = setTimeout(() => setShowWelcomeMessage(false), 1500);
    } else {
      setShowWelcomeMessage(true); 
    }
    return () => clearTimeout(timer);
  }, [showLogin]);

  const categoryDetails = useMemo(() => {
    return fetchedCategories
      .map(cat => { 
        const itemsInCategory = initialSampleMenuItems.filter(item => item.category === cat.name);
        const IconComponent = LucideIcons[cat.iconName as keyof typeof LucideIcons] || Info;
        let dataAiHint = 'food category';
        if (cat.name === 'Starters') { dataAiHint = 'appetizers selection'; }
        else if (cat.name === 'Mains') { dataAiHint = 'hearty meals'; }
        else if (cat.name === 'Drinks') { dataAiHint = 'refreshing beverages'; }
        else if (cat.iconName === 'Popcorn') { dataAiHint = 'snacks popcorn';}
        return { 
          name: cat.name, icon: IconComponent, itemCount: itemsInCategory.length, 
          imageUrl: `https://placehold.co/320x180.png`, dataAiHint 
        };
      })
      .filter(cat => cat.itemCount > 0 || fetchedCategories.some(fc => fc.name === cat.name)); 
  }, [initialSampleMenuItems, fetchedCategories]);

  const displayedItems = useMemo(() => {
    let itemsToDisplay = menuItems; // menuItems now correctly holds category-specific or sample items
    if (searchTerm) {
      itemsToDisplay = itemsToDisplay.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      // If a category is selected, itemsToDisplay is already filtered for that category by handleCategorySelect.
      // If no category is selected, itemsToDisplay is initialSampleMenuItems, so this search is global.
    }
    return itemsToDisplay;
  }, [searchTerm, menuItems]); // Removed selectedCategory dependency as menuItems handles it

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const clearSelectionAndSearch = useCallback(() => {
    setSelectedCategory(null);
    setSearchTerm("");
    setMenuItems(initialSampleMenuItems); // Reset to show all sample items (for category browsing)
    setMenuError(null); 
  }, [initialSampleMenuItems]);

  const handleCategorySelect = useCallback(async (categoryName: string) => {
    setSelectedCategory(categoryName);
    setSearchTerm(""); 
    setIsMenuLoading(true);
    setMenuError(null);
    try {
      const response = await fetch('/api/menu/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryName }),
        cache: 'no-store', 
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Status: ${response.status}` }));
        throw new Error(errorData.error || `Could not load items for ${categoryName}.`);
      }
      const data: MenuItemType[] = await response.json();
      setMenuItems(data); // Update menuItems with category-specific items
    } catch (error: any) {
      setMenuError(error.message);
      setMenuItems([]); 
    } finally {
      setIsMenuLoading(false);
    }
  }, []);

  const openSpecialRequestDialog = () => setIsSpecialRequestDialogOpen(true);

  if (!tableIdFromUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <Info className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Invalid Table Link</h1>
        <p className="text-muted-foreground">Scan a valid QR code.</p>
      </div>
    );
  }
  
  if (isAuthContextLoading || isDevLoggingIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">
          {isDevLoggingIn ? "Developer auto-login..." : "Initializing session..."}
        </p>
      </div>
    );
  }

  if (showLogin) {
    // LoginFlow will now internally handle displaying authContext.externalSessionError
    return <LoginFlow tableIdFromUrl={tableIdFromUrl} onLoginSuccess={() => { /* setShowLogin(false) handled by useEffect */ }} />;
  }

  // Menu loading state (after login and successful session validation)
  if (isMenuLoading) {
    const loadingMessage = selectedCategory ? `Loading ${selectedCategory}...` : "Loading menu...";
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">{loadingMessage}</p>
      </div>
    );
  }

  if (menuError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <Info className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">{selectedCategory ? "Error Loading Items" : "Error Loading Menu"}</h1>
        <p className="text-muted-foreground">{menuError}</p>
        <button onClick={() => selectedCategory ? handleCategorySelect(selectedCategory) : window.location.reload()} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">Try Again</button>
        {selectedCategory && <button onClick={clearSelectionAndSearch} className="mt-2 px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90">Back to Categories</button>}
      </div>
    );
  }

  return (
    <div className="pb-24">
      <WelcomeBanner showWelcomeMessage={showWelcomeMessage} />
      <MenuNavigationControls selectedCategory={selectedCategory} searchTerm={searchTerm} onSearchChange={handleSearchChange} onClearSelectionAndSearch={clearSelectionAndSearch} />
      <MenuContentDisplay searchTerm={searchTerm} selectedCategory={selectedCategory} displayedItems={displayedItems} categoryDetails={categoryDetails} categoryIcons={LucideIcons} onCategorySelect={handleCategorySelect} onClearSearch={clearSelectionAndSearch} setSearchTerm={setSearchTerm} />
      <PageFloatingButtons showLogin={showLogin} selectedCategory={selectedCategory} searchTerm={searchTerm} onOpenSpecialRequestDialog={openSpecialRequestDialog} cartItemCount={cartItemCount} cartTotal={cartTotal} onOpenCartSheet={() => setIsCartSheetOpen(true)} />
      <SpecialRequestDialog isOpen={isSpecialRequestDialogOpen} onOpenChange={setIsSpecialRequestDialogOpen} />
    </div>
  );
}
