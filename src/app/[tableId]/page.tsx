
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

  const [menuItems, setMenuItems] = useState<MenuItemType[]>([]);
  const [initialSampleMenuItems, setInitialSampleMenuItems] = useState<MenuItemType[]>([]);

  const [fetchedCategories, setFetchedCategories] = useState<{name: string; iconName: string}[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(true); 
  const [menuError, setMenuError] = useState<string | null>(null);

  const [isSpecialRequestDialogOpen, setIsSpecialRequestDialogOpen] = useState(false);
  const [isDevLoggingIn, setIsDevLoggingIn] = useState(false);

  // New states for server-side session bill validation
  const [isServerSessionValidating, setIsServerSessionValidating] = useState(false);
  const [serverSessionValidationError, setServerSessionValidationError] = useState<string | null>(null);


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


  // Main effect to determine if login screen or menu (after validation) should be shown
  useEffect(() => {
    if (isAuthenticated && authTableId === tableIdFromUrl && authBillId) {
      // User is authenticated for this table and has a billId
      setServerSessionValidationError(null); // Clear previous validation errors

      if (!isLoadingBillStatus && currentBillPaymentStatus === 'Completed') {
        console.log("[Auth] Bill completed, logging out.");
        logout();
        setShowLogin(true);
      } else if (!isLoadingBillStatus) { // Bill status is loaded and not 'Completed'
        // Ready to validate the session bill ID with the server
        const validateAndProceed = async () => {
          setIsServerSessionValidating(true);
          console.log(`[SessionValidate] Validating session bill ${authBillId} against server store.`);
          try {
            const response = await fetch(`/api/bills/${authBillId}/validate`);
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Validation API call failed: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            if (data.isValid) {
              console.log(`[SessionValidate] Bill ${authBillId} is valid. Proceeding to menu.`);
              setShowLogin(false); // Bill is valid, allow menu display
            } else {
              console.warn(`[SessionValidate] Bill ${authBillId} NOT found or invalid in server store. Logging out.`);
              setServerSessionValidationError("Your session is no longer active or valid. Please log in again.");
              logout(); 
              setShowLogin(true);
            }
          } catch (error: any) {
            console.error("[SessionValidate] Error validating session bill:", error);
            setServerSessionValidationError("Could not verify your session with the server. Please log in again.");
            logout();
            setShowLogin(true);
          } finally {
            setIsServerSessionValidating(false);
          }
        };
        validateAndProceed();
      }
      // If isLoadingBillStatus is true, we wait for it to resolve, this effect will re-run.
    } else { // Not authenticated, or tableId mismatch, or authBillId missing
      setShowLogin(true);
      setServerSessionValidationError(null); // Clear validation error if navigating away/logging out
    }
  }, [
    isAuthenticated,
    authTableId,
    tableIdFromUrl,
    authBillId,
    logout,
    currentBillPaymentStatus,
    isLoadingBillStatus,
  ]);


  // Effect for initial menu (categories + sample items) load OR if showLogin becomes false after validation
  useEffect(() => {
    if (!showLogin && !isServerSessionValidating) { // Only fetch if login is hidden and not currently validating
      const fetchInitialMenu = async () => {
        console.log("[PageLoad] Fetching initial menu (categories and sample items)...");
        setIsMenuLoading(true);
        setMenuError(null);
        try {
          const response = await fetch('/api/menu', { cache: 'no-store' }); 
          if (!response.ok) {
            throw new Error(`Failed to fetch initial menu: ${response.statusText}`);
          }
          const data = await response.json();
          console.log("[PageLoad] Initial menu data received:", data);
          const sampleItems = data.menuItems || localSampleMenuData; 
          setInitialSampleMenuItems(sampleItems);
          setMenuItems(sampleItems); 
          setFetchedCategories(data.categories || []); 
        } catch (error: any) {
          console.error("[PageLoad] Error fetching initial menu:", error.message);
          setMenuError(error.message || 'Could not load initial menu.');
          setInitialSampleMenuItems(localSampleMenuData); 
          setMenuItems(localSampleMenuData);
          setFetchedCategories([]);
        } finally {
          setIsMenuLoading(false);
        }
      };
      fetchInitialMenu();
    }
  }, [showLogin, isServerSessionValidating]); // Depends on showLogin and isServerSessionValidating

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!showLogin) {
      setShowWelcomeMessage(true);
      timer = setTimeout(() => {
        setShowWelcomeMessage(false);
      }, 1500);
    } else {
      setShowWelcomeMessage(true); // Keep welcome message area "open" if login is shown
    }
    return () => clearTimeout(timer);
  }, [showLogin]);


  const categoryDetails = useMemo(() => {
    return fetchedCategories
      .map(cat => { 
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
      .filter(cat => cat.itemCount > 0 || fetchedCategories.some(fc => fc.name === cat.name)); 
  }, [initialSampleMenuItems, fetchedCategories]);


  const displayedItems = useMemo(() => {
    let itemsToDisplay = menuItems; 
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
    console.log("[Selection] Clearing category selection and search. Resetting to initial sample menu items.");
    setSelectedCategory(null);
    setSearchTerm("");
    setMenuItems(initialSampleMenuItems); 
    setMenuError(null); 
  }, [initialSampleMenuItems]);

  const handleCategorySelect = useCallback(async (categoryName: string) => {
    console.log(`[CategorySelect] Category selected: ${categoryName}. Fetching items...`);
    setSelectedCategory(categoryName);
    setSearchTerm(""); 
    setIsMenuLoading(true); // Use general menu loading state
    setMenuError(null);
    try {
      const response = await fetch('/api/menu/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryName }),
        cache: 'no-store', 
      });
      console.log(`[CategorySelect] Response status from /api/menu/items for ${categoryName}: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Failed to fetch items for ${categoryName}. Status: ${response.status}` }));
        console.error(`[CategorySelect] Error fetching items for ${categoryName}:`, errorData.error || response.statusText);
        throw new Error(errorData.error || `Could not load items for ${categoryName}.`);
      }
      const data: MenuItemType[] = await response.json();
      console.log(`[CategorySelect] Items received from API for ${categoryName} (count: ${data.length}):`, data.slice(0,3)); 
      setMenuItems(data);
      console.log(`[CategorySelect] menuItems state updated with ${data.length} items from API for ${categoryName}.`);
    } catch (error: any) {
      console.error(`[CategorySelect] Catch block error for ${categoryName}:`, error.message);
      setMenuError(error.message);
      setMenuItems([]); 
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
  
  // Combined loading states
  if ( isDevLoggingIn || 
      (isAuthenticated && authBillId && (isLoadingBillStatus || isServerSessionValidating))
     ) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-xl text-muted-foreground">
          {isDevLoggingIn ? "Developer auto-login in progress..." :
           isServerSessionValidating ? "Verifying session with server..." : 
           "Verifying session..."}
        </p>
      </div>
    );
  }

  if (showLogin) {
    return (
      <>
        {serverSessionValidationError && (
          <div className="p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-md flex items-center gap-2 max-w-md mx-auto">
            <AlertTriangle className="h-5 w-5" />
            <span>{serverSessionValidationError}</span>
          </div>
        )}
        <LoginFlow tableIdFromUrl={tableIdFromUrl} onLoginSuccess={() => { /* State change handled by useEffect watching session */ }} />
      </>
    );
  }

  // Menu loading state (after login and validation)
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

  // Menu error state (after login and validation)
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

      <SpecialRequestDialog
        isOpen={isSpecialRequestDialogOpen}
        onOpenChange={setIsSpecialRequestDialogOpen}
      />
    </div>
  );
}
