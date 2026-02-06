import { VacationProvider } from '@/context/VacationContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ConfigPane } from './ConfigPane';
import { CalendarView } from './CalendarView';

export default function App() {
  return (
    <VacationProvider>
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-col lg:flex-row min-h-screen bg-background text-foreground">
          <ConfigPane />
          <div className="flex-1 flex flex-col lg:items-center">
            <p className="text-sm text-muted-foreground text-center max-w-6xl px-4 pt-4 lg:pt-6">
              Tryk på datoerne i kalenderen for at vælge dine feriedage.
            </p>
            <CalendarView />
          </div>
        </div>
        <Toaster position="bottom-center" />
      </TooltipProvider>
    </VacationProvider>
  );
}
