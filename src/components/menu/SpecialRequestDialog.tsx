
"use client";

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ArrowLeft } from 'lucide-react';
import { predefinedServiceRequests, type PredefinedRequest } from '@/lib/dataValues';
import { useAuth } from '@/contexts/AuthContext'; // Added
import { useToast } from '@/hooks/use-toast'; // Added
import { Loader2 } from 'lucide-react'; // Added

interface SpecialRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  // onSubmitRequest prop removed
}

export default function SpecialRequestDialog({ isOpen, onOpenChange }: SpecialRequestDialogProps) {
  const [requestDialogStep, setRequestDialogStep] = useState<'mainList' | 'subList'>('mainList');
  const [activeRequestCategory, setActiveRequestCategory] = useState<PredefinedRequest | null>(null);
  const [requestSearchTerm, setRequestSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false); // Added

  const { billId } = useAuth(); // Added
  const { toast } = useToast(); // Added

  const filteredServiceRequests = useMemo(() => {
    if (!requestSearchTerm) return predefinedServiceRequests;
    return predefinedServiceRequests.filter(req =>
      req.label.toLowerCase().includes(requestSearchTerm.toLowerCase())
    );
  }, [requestSearchTerm]);

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setTimeout(() => {
        setRequestDialogStep('mainList');
        setActiveRequestCategory(null);
        setRequestSearchTerm("");
        setIsSubmitting(false);
      }, 300); 
    }
    onOpenChange(open);
  };

  const internalHandleSubmit = async (itemName: string) => {
    if (!billId) {
      toast({
        title: "Authentication Error",
        description: "Cannot submit request without a valid session.",
        variant: "destructive",
      });
      return;
    }
    if (!itemName) {
        toast({
            title: "Error",
            description: "Request cannot be empty.",
            variant: "destructive",
        });
        return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/special-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId, requestText: itemName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      toast({
        title: "Request Sent!",
        description: `${itemName} requested. Our staff will attend to it shortly.`,
      });
      handleDialogClose(false); // This will also reset internal states
    } catch (err: any) {
      console.error("Failed to submit special request:", err);
      toast({
        title: "Submission Failed",
        description: err.message || "Could not send your request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[calc(100vw-2rem)] max-w-sm rounded-lg flex flex-col max-h-[80vh]"
      >
        {requestDialogStep === 'mainList' && (
          <>
            <DialogHeader>
              <DialogTitle>What do you need?</DialogTitle>
              <DialogDescription>Select a common request or search below.</DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Input
                type="text"
                placeholder="Search requests..."
                value={requestSearchTerm}
                onChange={(e) => setRequestSearchTerm(e.target.value)}
                className="mb-3"
                disabled={isSubmitting}
              />
            </div>
            <ScrollArea className="flex-grow -mx-6 px-6">
              <div className="space-y-2 pb-4">
                {filteredServiceRequests.map((req) => {
                  const IconComponent = req.icon;
                  return (
                    <Button
                      key={req.id}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3"
                      disabled={isSubmitting}
                      onClick={() => {
                        if (req.type === 'direct') {
                          internalHandleSubmit(req.label);
                        } else {
                          setActiveRequestCategory(req);
                          setRequestDialogStep('subList');
                        }
                      }}
                    >
                      <IconComponent className="mr-3 h-5 w-5 text-primary" />
                      <span className="flex-grow">{req.label}</span>
                      {req.type === 'selectOne' && <ChevronLeft className="h-4 w-4 text-muted-foreground transform rotate-180" />}
                    </Button>
                  );
                })}
                {filteredServiceRequests.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No requests match your search.</p>
                )}
              </div>
            </ScrollArea>
            <DialogFooter className="mt-auto pt-4 border-t -mx-6 px-6 pb-6">
              <DialogClose asChild>
                <Button type="button" variant="ghost" className="w-full" disabled={isSubmitting}>Cancel</Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}

        {requestDialogStep === 'subList' && activeRequestCategory && (
          <>
            <DialogHeader>
              <div className="flex items-center mb-2">
                <Button variant="ghost" size="icon" className="-ml-2 mr-2" onClick={() => { setRequestDialogStep('mainList'); setActiveRequestCategory(null); }} disabled={isSubmitting}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <DialogTitle>{activeRequestCategory.label}</DialogTitle>
              </div>
              <DialogDescription>Please choose an option.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow -mx-6 px-6">
              <div className="space-y-2 pb-4">
                {activeRequestCategory.options?.map((opt) => {
                  const IconComponent = opt.icon;
                  return (
                    <Button
                      key={opt.label}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3"
                      disabled={isSubmitting}
                      onClick={() => internalHandleSubmit(`${activeRequestCategory.label} - ${opt.label}`)}
                    >
                      {IconComponent && <IconComponent className="mr-3 h-5 w-5 text-primary" />}
                      {!IconComponent && <span className="mr-3 h-5 w-5"></span>} {/* Placeholder for alignment if no icon */}
                      {opt.label}
                       {isSubmitting && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
            <DialogFooter className="mt-auto pt-4 border-t -mx-6 px-6 pb-6">
               <Button type="button" variant="ghost" className="w-full" onClick={() => { setRequestDialogStep('mainList'); setActiveRequestCategory(null); }} disabled={isSubmitting}>
                  Back to Main List
                </Button>
              <DialogClose asChild>
                <Button type="button" variant="outline" className="w-full" disabled={isSubmitting}>Cancel</Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
