
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
import { Info, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import {
  categoryIcons,
  WELCOME_MESSAGE_VISIBLE_HEIGHT,
  predefinedServiceRequests, 
  MOCKED_WAITER_OTP,
  MOCKED_PHONE_OTP
} from '@/lib/dataValues';

const IS_DEV_SKIP_LOGIN = false;

export default function TablePage() {
  const params = useParams();
  const tableIdFromUrl = params.tableId as string;

  const {
    isAuthenticated,
    tableId: authTableId,
    billId: authBillId,
    login,
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
  const [fetchedCategories, setFetchedCategories] = useState<{name: string}[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [isSpecialRequestDialogOpen, setIsSpecialRequestDialogOpen] = useState(false);
  const [fabState, setFabState] = useState<'initial' | 'icon'>('initial');
  const [isDevLoggingIn, setIsDevLoggingIn] = useState(false);

  const cartItemCount = getItemCount();
  const cartTotal = getCartTotal();

  useEffect(() => {
    if (IS_DEV_SKIP_LOGIN && tableIdFromUrl && !(isAuthenticated && authTableId === tableIdFromUrl) && !isDevLoggingIn) {
      console.log(`DEV MODE: Auto-logging in via API for table ${tableIdFromUrl}`);
      setIsDevLoggingIn(true);
      const mockPhoneNumber = "0000000000";

      const performDevLogin = async () => {
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tableId: tableIdFromUrl,
              waiterOtp: MOCKED_WAITER_OTP,
              phoneNumber: mockPhoneNumber,
              phoneOtp: MOCKED_PHONE_OTP,
            }),
          });
          // Reverted: Simpler error handling
          const data = await response.json();
          if (response.ok && data.success && data.billId) { // Ensure billId is present
            login(data.tableId, data.phoneNumber, data.billId);
          } else {
            console.error("Dev auto-login failed:", data.error || `Status: ${response.status}`);
            setShowLogin(true);
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
          setFetchedCategories(data.categories || []);
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

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!showLogin && fabState === 'initial') {
      timer = setTimeout(() => {
        setFabState('icon');
      }, 4000); 
    }
    return () => clearTimeout(timer);
  }, [showLogin, fabState]);

   useEffect(() => {
    if (showLogin) { 
      setFabState('initial');
    } else if (!selectedCategory && !searchTerm && !showLogin) { 
      setFabState('initial');
    }
  }, [showLogin, selectedCategory, searchTerm]);


  const categoryDetails = useMemo(() => {
    return fetchedCategories.map(cat => cat.name)
      .filter(catName => menuItems.some(item => item.category === catName))
      .map(categoryName => {
        const itemsInCategory = menuItems.filter(item => item.category === categoryName);
        let imageUrl = 'https://placehold.co/320x180.png';
        let dataAiHint = 'food category';
        if (categoryName === 'Starters') { dataAiHint = 'appetizers selection'; imageUrl = 'https://placehold.co/320x180.png'; }
        else if (categoryName === 'Mains') { dataAiHint = 'hearty meals'; imageUrl = 'https://placehold.co/320x180.png'; }
        else if (categoryName === 'Drinks') { dataAiHint = 'refreshing beverages'; imageUrl = 'https://placehold.co/320x180.png'; }
        return { name: categoryName, icon: categoryIcons[categoryName] || Info, itemCount: itemsInCategory.length, imageUrl, dataAiHint };
      }).filter(cat => cat.itemCount > 0);
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
    setSearchTerm("");
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
        categoryDetails={categoryDetails}
        categoryIcons={categoryIcons}
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
        fabState={fabState}
      />

      <SpecialRequestDialog
        isOpen={isSpecialRequestDialogOpen}
        onOpenChange={setIsSpecialRequestDialogOpen}
      />
    </div>
  );
}
