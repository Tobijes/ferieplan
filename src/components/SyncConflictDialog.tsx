import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Upload, Download } from 'lucide-react';

interface SyncConflictDialogProps {
  open: boolean;
  onChoice: (choice: 'upload' | 'download') => void;
}

export function SyncConflictDialog({ open, onChoice }: SyncConflictDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Skyen er blevet opdateret</AlertDialogTitle>
          <AlertDialogDescription>
            En anden enhed har opdateret dine data i skyen. Vil du overskrive med dine lokale ændringer eller hente de nyeste data?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full cursor-pointer" onClick={() => onChoice('upload')}>
            <Upload className="size-4 mr-2" />
            Overskriv sky-data
          </Button>
          <Button className="w-full cursor-pointer" variant="outline" onClick={() => onChoice('download')}>
            <Download className="size-4 mr-2" />
            Hent nyeste data
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
