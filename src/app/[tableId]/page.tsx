
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import LoginFlow from '@/components/auth/LoginFlow';
import WelcomeBanner from '@/components/layout/WelcomeBanner';
import MenuNavigationControls from '@/components/menu/MenuNavigationControls';
import MenuContentDisplay from '@/components/menu/MenuContentDisplay';
import SpecialRequestDialog from '@/components/menu/SpecialRequestDialog';
import PageFloatingButtons from '@/components/layout/PageFloatingButtons';
import { Button } from '@/components/ui/button';

import type { MenuItemType } from '@/types';
import { Info, Loader2, AlertTriangle } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import {
  sampleMenuData as localSampleMenuData,
} from '@/lib/dataValues';


export default function TablePage() {
  const params = useParams();
  const tableIdFromUrl = params.tableId as string;

  const {
    isAuthenticated,
    tableId: authTableId,
    billId: authBillId,
    sessionId: authSessionId,
    currentPaymentStatus,
    logout,
    isAuthContextLoading,
    externalSessionError,
  } = useAuth();
  const { getItemCount, getCartTotal, setIsCartSheetOpen } = useCart();

  const [showLogin, setShowLogin] = useState(true);
  const [hasHadSuccessfulLogin, setHasHadSuccessfulLogin] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);

  const [menuItems, setMenuItems] = useState<MenuItemType[]>([]);
  const [initialSampleMenuItems, setInitialSampleMenuItems] = useState<MenuItemType[]>([]);

  const [fetchedCategories, setFetchedCategories] = useState<{name: string; iconName: string}[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [isSpecialRequestDialogOpen, setIsSpecialRequestDialogOpen] = useState(false);

  const cartItemCount = getItemCount();
  const cartTotal = getCartTotal();


  useEffect(() => {
    console.log(`[TablePage Effect] Running. AuthContextLoading: ${isAuthContextLoading}, IsAuthenticated: ${isAuthenticated}, ExternalError: ${externalSessionError}, AuthTableId: ${authTableId}, URLTableId: ${tableIdFromUrl}, ShowLoginState: ${showLogin}, HasHadSuccessfulLogin: ${hasHadSuccessfulLogin}`);

    if (externalSessionError) {
        console.log("[TablePage Effect] External session error found:", externalSessionError, "-> Forcing login, reset successful login flag.");
        setShowLogin(true);
        setHasHadSuccessfulLogin(false);
        return;
    }

    if (hasHadSuccessfulLogin) {
        if (isAuthContextLoading) {
            console.log("[TablePage Effect] Has successful login, AuthContext is loading -> Ensuring LoginFlow is hidden (setShowLogin(false)). Page will show its own loader.");
            setShowLogin(false); 
            return; 
        }
        if (isAuthenticated && authTableId === tableIdFromUrl && authSessionId && authBillId) {
            if (currentPaymentStatus === 'Confirmed' || currentPaymentStatus === 'Completed') {
                console.log("[TablePage Effect] Has successful login, but Bill is Confirmed/Completed. Forcing logout.");
                logout(); 
                setShowLogin(true); 
                setHasHadSuccessfulLogin(false);
            } else {
                console.log("[TablePage Effect] Has successful login, Session active & valid, bill not paid -> Showing menu.");
                setShowLogin(false);
            }
        } else {
            console.log("[TablePage Effect] Has successful login, but session now invalid (e.g., isAuthenticated is false post-validation) -> Forcing login.");
            setShowLogin(true);
            setHasHadSuccessfulLogin(false);
        }
        return;
    }

    if (isAuthContextLoading) {
        console.log("[TablePage Effect] No prior successful login, AuthContext is loading -> Ensuring login is shown.");
        setShowLogin(true); 
        return;
    }

    if (isAuthenticated && authTableId === tableIdFromUrl && authSessionId && authBillId) {
         if (currentPaymentStatus === 'Confirmed' || currentPaymentStatus === 'Completed') {
            console.log("[TablePage Effect] No prior successful login, Bill Confirmed/Completed. Forcing logout.");
            logout();
            setShowLogin(true);
         } else {
            console.log("[TablePage Effect] No prior successful login, Session active & valid -> Showing menu.");
            setShowLogin(false);
         }
    } else {
        console.log("[TablePage Effect] No prior successful login, Session invalid or incomplete -> Showing login.");
        setShowLogin(true);
    }

  }, [
    isAuthenticated, authTableId, tableIdFromUrl, authSessionId, authBillId,
    currentPaymentStatus, isAuthContextLoading, externalSessionError, logout, hasHadSuccessfulLogin
  ]);


  useEffect(() => {
    if (!showLogin && !isAuthContextLoading) { 
      const fetchInitialMenu = async () => {
        console.log("[TablePage InitialMenuFetch] Conditions met. Fetching initial menu (categories and sample items)...");
        setIsMenuLoading(true);
        setMenuError(null);
        try {
          const response = await fetch('/api/menu', { cache: 'no-store' });
          console.log("[TablePage InitialMenuFetch] /api/menu response status:", response.status);
          if (!response.ok) {
            const errorText = await response.text();
            console.error("[TablePage InitialMenuFetch] Failed to fetch initial menu:", response.status, errorText);
            throw new Error(`Failed to fetch initial menu: ${response.status} ${errorText.substring(0,100)}`);
          }
          const data = await response.json();
          console.log("[TablePage InitialMenuFetch] /api/menu data received:", data);
          const sampleItems = data.menuItems || localSampleMenuData;
          setInitialSampleMenuItems(sampleItems);
          setMenuItems(sampleItems);
          setFetchedCategories(data.categories || []);
          console.log("[TablePage InitialMenuFetch] Initial menu data set. Categories:", data.categories, "Sample items count:", sampleItems.length);
        } catch (error: any) {
          console.error("[TablePage InitialMenuFetch] Error fetching initial menu:", error.message);
          setMenuError(error.message || 'Could not load initial menu.');
          setInitialSampleMenuItems(localSampleMenuData);
          setMenuItems(localSampleMenuData);
          setFetchedCategories([]);
        } finally {
          setIsMenuLoading(false);
          console.log("[TablePage InitialMenuFetch] Finished initial menu fetch. isMenuLoading:", false);
        }
      };
      fetchInitialMenu();
    } else {
      console.log(`[TablePage InitialMenuFetch] Skipped: showLogin: ${showLogin}, isAuthContextLoading: ${isAuthContextLoading}`);
    }
  }, [showLogin, isAuthContextLoading]); 

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!showLogin) {
      setShowWelcomeMessage(true);
      timer = setTimeout(() => setShowWelcomeMessage(false), 1500);
    } else {
      setShowWelcomeMessage(false);
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
    let itemsToDisplay = menuItems;
    if (searchTerm) {
      itemsToDisplay = itemsToDisplay.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    return itemsToDisplay;
  }, [searchTerm, menuItems]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const clearSelectionAndSearch = useCallback(() => {
    console.log("[TablePage Actions] Clearing selection and search. Resetting menuItems to initial samples.");
    setSelectedCategory(null);
    setSearchTerm("");
    setMenuItems(initialSampleMenuItems);
    setMenuError(null);
  }, [initialSampleMenuItems]);

  const handleCategorySelect = useCallback(async (categoryName: string) => {
    console.log(`[TablePage CategorySelect] Category selected: ${categoryName}. Fetching items...`);
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
      console.log(`[TablePage CategorySelect] Response status from /api/menu/items for ${categoryName}: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Status: ${response.status} ${response.statusText}` }));
        console.error(`[TablePage CategorySelect] Error from /api/menu/items for ${categoryName}:`, errorData);
        throw new Error(errorData.error || `Could not load items for ${categoryName}.`);
      }
      const data: MenuItemType[] = await response.json();
      console.log(`[TablePage CategorySelect] Items received from API for ${categoryName} (count: ${data.length}):`, data.slice(0,3));
      setMenuItems(data);
      console.log(`[TablePage CategorySelect] menuItems state updated with ${data.length} items from API.`);
    } catch (error: any) {
      console.error(`[TablePage CategorySelect] Catch block error for ${categoryName}:`, error.message);
      setMenuError(error.message);
      setMenuItems([]);
    } finally {
      setIsMenuLoading(false);
      console.log(`[TablePage CategorySelect] Finished fetching for ${categoryName}. isMenuLoading: false`);
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

  if (showLogin) {
    return <LoginFlow
              tableIdFromUrl={tableIdFromUrl}
              onLoginSuccess={() => {
                console.log("[LoginFlow Success] onLoginSuccess called, setting hasHadSuccessfulLogin to true.");
                setHasHadSuccessfulLogin(true);
              }}
            />;
  }

  if (!showLogin && (isAuthContextLoading || (isMenuLoading && menuItems.length === 0 && !menuError))) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading Delicious Food...</p>
      </div>
    );
  }

  if (menuError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">{selectedCategory ? "Error Loading Items" : "Error Loading Menu"}</h1>
        <p className="text-muted-foreground mb-3">{menuError}</p>
        <Button onClick={() => selectedCategory ? handleCategorySelect(selectedCategory) : window.location.reload()} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">Try Again</Button>
        {selectedCategory && <Button onClick={clearSelectionAndSearch} className="mt-2 px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90">Back to Categories</Button>}
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
    
