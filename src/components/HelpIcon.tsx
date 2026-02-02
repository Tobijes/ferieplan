import { CircleHelp } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function HelpIcon({ text }: { text: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center shrink-0 text-muted-foreground/40 hover:text-muted-foreground"
        >
          <CircleHelp className="w-5 h-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="text-xs w-64 p-2">
        {text}
      </PopoverContent>
    </Popover>
  );
}
