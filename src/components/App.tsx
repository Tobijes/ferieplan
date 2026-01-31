import { VacationProvider } from '@/context/VacationContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfigPane } from './ConfigPane';
import { CalendarView } from './CalendarView';

export default function App() {
  return (
    <VacationProvider>
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-col lg:flex-row min-h-screen bg-background text-foreground">
          <ConfigPane />
          <div className="flex-1">
            <CalendarView />
          </div>
        </div>
      </TooltipProvider>
    </VacationProvider>
  );
}
