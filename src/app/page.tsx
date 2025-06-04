
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QrCode } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [selectedTable, setSelectedTable] = useState<string>("T001");
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const tableIds = Array.from({ length: 10 }, (_, i) => `T${String(i + 1).padStart(3, '0')}`);

  const handleGoToTable = () => {
    if (selectedTable) {
      router.replace(`/${selectedTable}`); // Changed from router.push to router.replace
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4">
      <QrCode className="h-24 w-24 text-primary mb-6" />
      <h1 className="text-4xl font-bold mb-4">Welcome to SnapOrderEat!</h1>
      <p className="text-lg text-muted-foreground mb-8 max-w-md">
        To start your order, please scan the QR code at your table or select a test table below.
      </p>
      
      {hasMounted ? (
        <div className="flex flex-col items-center space-y-4 w-full max-w-xs">
          <Select value={selectedTable} onValueChange={setSelectedTable}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a table" />
            </SelectTrigger>
            <SelectContent>
              {tableIds.map((tableId) => (
                <SelectItem key={tableId} value={tableId}>
                  {tableId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button onClick={handleGoToTable} className="w-full" disabled={!selectedTable}>
            Go to Table
          </Button>
        </div>
      ) : (
        <div className="h-[6rem] w-full max-w-xs" aria-hidden="true">
          {/* Placeholder for select and button to avoid layout shift */}
        </div>
      )}
    </div>
  );
}
