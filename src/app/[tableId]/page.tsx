
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
import { sampleMenuData as localSampleMenuData } from '@/lib/dataValues';
import { useQuery } from '@tanstack/react-query';

interface InitialMenuData {
  menuItems: MenuItemType[];
  categories: { name: string; iconName: string }[];
}

const fetchInitialMenuData = async (): Promise<InitialMenuData> => {
  console.log("[TablePage InitialMenuFetch] Attempting to fetch /api/menu...");
  const response = await fetch('/api/menu', { cache: 'no-store' });
  console.log("[TablePage InitialMenuFetch] /api/menu response status:", response.status);
  if (!response.ok) {
    const errorText = await response.text();
    console.error("[TablePage Tanstack] Failed to fetch initial menu:", response.status, errorText);
    throw new Error(`Failed to fetch initial menu: ${response.status} ${errorText.substring(0, 100)}`);
  }
  const data = await response.json();
  console.log("[TablePage InitialMenuFetch] /api/menu data received:", data);
  return {
    menuItems: data.menuItems || localSampleMenuData,
    categories: data.categories || [],
  };
};

const fetchCategoryItems = async (categoryName: string): Promise<MenuItemType[]> => {
  const response = await fetch('/api/menu/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryName }),
    cache: 'no-store',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: `Status: ${response.status} ${response.statusText}` }));
    console.error(`[TablePage Tanstack] Error from /api/menu/items for ${categoryName}:`, errorData);
    throw new Error(errorData.error || `Could not load items for ${categoryName}.`);
  }
  const data: MenuItemType[] = await response.json();
  return data;
};


export default function TablePage() {
  const params = useParams();
  
  let tableIdFromUrl: string | undefined = undefined;
  const tableIdParam = params?.tableId;

  if (typeof tableIdParam === 'string') {
    tableIdFromUrl = tableIdParam;
  } else if (Array.isArray(tableIdParam) && tableIdParam.length > 0 && typeof tableIdParam[0] === 'string') {
    tableIdFromUrl = tableIdParam[0];
  }


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
  const [isSpecialRequestDialogOpen, setIsSpecialRequestDialogOpen] = useState(false);

  const cartItemCount = getItemCount();
  const cartTotal = getCartTotal();

  useEffect(() => {
    const logPrefix = "[TablePage Effect]";
    // console.log(`${logPrefix} Running. AuthContextLoading: ${isAuthContextLoading}, IsAuthenticated: ${isAuthenticated}, ExternalError: ${externalSessionError}, AuthTableId: ${authTableId}, URLTableId: ${tableIdFromUrl}, ShowLoginState: ${showLogin}, HasHadSuccessfulLogin: ${hasHadSuccessfulLogin}`);

    if (externalSessionError) {
        console.log(`${logPrefix} External session error detected: "${externalSessionError}". Showing login, resetting success flag.`);
        setShowLogin(true);
        setHasHadSuccessfulLogin(false); 
        return;
    }

    if (hasHadSuccessfulLogin) {
        // User has completed the LoginFlow.tsx steps.
        setShowLogin(false); // Primary intent: menu should be shown or TablePage loader.

        if (isAuthContextLoading) {
            // AuthContext is still processing (e.g., validating session post-signIn).
            // LoginFlow is hidden; TablePage will show its loader.
            // console.log(`${logPrefix} HasHadSuccessfulLogin is true, AuthContext is loading. LoginFlow hidden, page loader may show.`);
            return;
        }

        // AuthContext is NOT loading.
        // If, after all processing, the session is NOT authenticated,
        // it implies the post-signIn validation failed or session was invalidated.
        if (!isAuthenticated) {
            console.log(`${logPrefix} HasHadSuccessfulLogin is true, AuthContext not loading, BUT !isAuthenticated. Forcing login.`);
            setShowLogin(true);
            setHasHadSuccessfulLogin(false); // The "successful" login flow didn't result in a lasting valid session.
        } else if (currentPaymentStatus === 'Confirmed' || currentPaymentStatus === 'Completed') {
            // Valid session, but payment is done. Logout.
            console.log(`${logPrefix} HasHadSuccessfulLogin is true, Session is valid, but payment is ${currentPaymentStatus}. Logging out.`);
            logout(); // This will likely set externalSessionError or change isAuthenticated, triggering re-evaluation.
        }
        // If isAuthenticated and payment status is not terminal, menu stays visible (showLogin remains false).
        return;
    }

    // Initial load or hasHadSuccessfulLogin is false (user hasn't gone through LoginFlow yet OR it was reset).
    if (isAuthContextLoading) {
        // console.log(`${logPrefix} Initial load / No prior success, AuthContext is loading. Showing LoginFlow.`);
        setShowLogin(true); 
        return;
    }

    // AuthContext not loading, user hasn't completed LoginFlow.
    if (isAuthenticated && authTableId === tableIdFromUrl && authSessionId && authBillId) {
        // Session is already valid (e.g., user refreshes page with active session).
        if (currentPaymentStatus === 'Confirmed' || currentPaymentStatus === 'Completed') {
            // console.log(`${logPrefix} Initial load / No prior success, existing valid session, but payment is ${currentPaymentStatus}. Logging out.`);
            logout();
        } else {
            // console.log(`${logPrefix} Initial load / No prior success, existing valid session, payment not terminal. Showing menu.`);
            setShowLogin(false); // Show menu directly.
        }
    } else {
        // No valid existing session, and user hasn't completed LoginFlow.
        // console.log(`${logPrefix} Initial load / No prior success, no valid existing session. Showing LoginFlow.`);
        setShowLogin(true);
    }
  }, [
    isAuthenticated, authTableId, tableIdFromUrl, authSessionId, authBillId,
    currentPaymentStatus, isAuthContextLoading, externalSessionError, logout, hasHadSuccessfulLogin
  ]);


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


  const {
    data: initialMenuData,
    isLoading: isInitialMenuLoading,
    error: initialMenuError,
    refetch: refetchInitialMenu,
  } = useQuery<InitialMenuData, Error>({
    queryKey: ['initialMenu', tableIdFromUrl],
    queryFn: fetchInitialMenuData,
    enabled: !showLogin && !isAuthContextLoading && isAuthenticated, // Only fetch if logged in, not loading auth, and menu should be shown
    staleTime: 1000 * 60 * 15, // 15 minutes for initial general menu info
    onSuccess: (data) => {
      console.log("[TablePage InitialMenuFetch] Initial menu data set. Categories:", data.categories, "Sample items count:", data.menuItems.length);
    },
    onError: (error) => {
        console.error("[TablePage InitialMenuFetch] Error fetching initial menu:", error);
    }
  });

  // console.log(`[TablePage Tanstack Query InitialMenu] enabled: ${!showLogin && !isAuthContextLoading && isAuthenticated}, isLoading: ${isInitialMenuLoading}, error: ${initialMenuError}, showLogin: ${showLogin}, isAuthContextLoading: ${isAuthContextLoading}, isAuthenticated: ${isAuthenticated}`);


  const initialSampleMenuItems = useMemo(() => initialMenuData?.menuItems || [], [initialMenuData]);
  const fetchedCategories = useMemo(() => initialMenuData?.categories || [], [initialMenuData]);

  const {
    data: categorySpecificItems,
    isLoading: isCategoryItemsLoading,
    error: categoryItemsError,
    refetch: refetchCategoryItems,
  } = useQuery<MenuItemType[], Error>({
    queryKey: ['categoryItems', selectedCategory],
    queryFn: () => {
      if (!selectedCategory) throw new Error("Category not selected for query");
      return fetchCategoryItems(selectedCategory);
    },
    enabled: !!selectedCategory && !showLogin && !isAuthContextLoading && isAuthenticated,
    staleTime: 1000 * 60 * 2, // 2 minutes for category specific items
  });

  const isOverallMenuLoading = isInitialMenuLoading || (selectedCategory ? isCategoryItemsLoading : false);
  const overallMenuError = initialMenuError || (selectedCategory ? categoryItemsError : null);

  const menuItemsToDisplay = useMemo(() => {
    if (selectedCategory) {
      return categorySpecificItems || [];
    }
    return initialSampleMenuItems;
  }, [selectedCategory, categorySpecificItems, initialSampleMenuItems]);


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

  const displayedItemsFromSearch = useMemo(() => {
    let itemsToDisplay = menuItemsToDisplay;
    if (searchTerm) {
      itemsToDisplay = itemsToDisplay.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    return itemsToDisplay;
  }, [searchTerm, menuItemsToDisplay]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const clearSelectionAndSearch = useCallback(() => {
    setSelectedCategory(null);
    setSearchTerm("");
  }, []);

  const handleCategorySelect = useCallback((categoryName: string) => {
    setSelectedCategory(categoryName);
    setSearchTerm("");
  }, []);

  const openSpecialRequestDialog = () => setIsSpecialRequestDialogOpen(true);

  if (!tableIdFromUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <Info className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Invalid Table Link</h1>
        <p className="text-muted-foreground">Scan a valid QR code or ensure the URL is correct.</p>
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

  const shouldShowPageLoader = !showLogin && (
    isAuthContextLoading || 
    (isOverallMenuLoading && (!selectedCategory ? initialSampleMenuItems.length === 0 : categorySpecificItems === undefined) && !overallMenuError)
  );

  if (shouldShowPageLoader) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">Loading Delicious Food...</p>
      </div>
    );
  }

  if (overallMenuError && !showLogin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-semibold mb-2">{selectedCategory ? "Error Loading Items" : "Error Loading Menu"}</h1>
        <p className="text-muted-foreground mb-3">{overallMenuError.message}</p>
        <Button 
          onClick={() => selectedCategory ? refetchCategoryItems() : refetchInitialMenu()} 
          className="mt-4">
            Try Again
        </Button>
        {selectedCategory && (
          <Button 
            onClick={clearSelectionAndSearch} 
            variant="outline"
            className="mt-2">
              Back to Categories
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="pb-24">
      <WelcomeBanner showWelcomeMessage={showWelcomeMessage} />
      <MenuNavigationControls selectedCategory={selectedCategory} searchTerm={searchTerm} onSearchChange={handleSearchChange} onClearSelectionAndSearch={clearSelectionAndSearch} />
      <MenuContentDisplay 
        searchTerm={searchTerm} 
        selectedCategory={selectedCategory} 
        displayedItems={displayedItemsFromSearch} 
        categoryDetails={categoryDetails} 
        categoryIcons={LucideIcons} 
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
      />
      <SpecialRequestDialog isOpen={isSpecialRequestDialogOpen} onOpenChange={setIsSpecialRequestDialogOpen} />
    </div>
  );
}

