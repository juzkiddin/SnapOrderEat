
"use client";

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';

interface VacateTableDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export default function VacateTableDialog({ isOpen, onOpenChange, onConfirm }: VacateTableDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-lg">
        <DialogHeader>
          <DialogTitle>Vacate Table?</DialogTitle>
          <DialogDescription>
            We're sad to see you go. Are you sure you want to vacate your table? This will log you out.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="outline">No</Button>
          </DialogClose>
          <Button type="button" onClick={onConfirm} variant="destructive">Yes, Vacate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
