import { useState, useEffect } from 'react';
import { VacationProvider } from '@/context/VacationContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { TopConfigBar, SidebarConfig } from './ConfigPane';
import { CalendarView } from './CalendarView';
import { useMediaQuery } from '@/hooks/useMediaQuery';

function AppContent() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen && !isDesktop) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [drawerOpen, isDesktop]);

  // Close drawer when switching to desktop
  useEffect(() => {
    if (isDesktop) setDrawerOpen(false);
  }, [isDesktop]);

  return (
    <>
      <div className="min-h-screen bg-background text-foreground">
        <div className="flex flex-col lg:flex-row">
          <div className="hidden lg:block">
            <SidebarConfig />
          </div>
          <div className="flex-1 flex flex-col lg:items-center">
            <TopConfigBar onOpenDrawer={!isDesktop ? () => setDrawerOpen(true) : undefined} />
            <p className="text-sm text-muted-foreground text-center max-w-6xl w-full px-4 pt-4">
              Tryk på datoerne i kalenderen for at vælge dine feriedage.
            </p>
            <CalendarView />
          </div>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && !isDesktop && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 animate-drawer-overlay-in"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-background overflow-y-auto overscroll-contain shadow-xl animate-drawer-slide-in">
            <SidebarConfig />
          </div>
        </div>
      )}

      <Toaster position="bottom-center" />
    </>
  );
}

export default function App() {
  return (
    <VacationProvider>
      <TooltipProvider delayDuration={200}>
        <AppContent />
      </TooltipProvider>
    </VacationProvider>
  );
}
