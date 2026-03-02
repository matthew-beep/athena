'use client';

import { Sidebar } from './Sidebar';
import { SystemFooter } from './SystemFooter';
import { MobileHeader } from './MobileHeader';
import { BottomNav } from './BottomNav';
import { DevModeOverlay } from '@/components/chat/DevModeOverlay';

export function AppShell({ children }: { children: React.ReactNode }) {


  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden relative">
      {/* Ceiling light — ambient highlight */}
      <div
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 z-0"
        style={{
          width: '600px',
          height: '1px',
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.12) 70%, transparent)',
          boxShadow: '0 0 80px 20px rgba(255,255,255,0.04)',
        }}
      />

      <MobileHeader />

      <div className="flex flex-1 overflow-hidden relative z-10">
        <Sidebar />
        <main className="flex-1 overflow-hidden pb-16 md:pb-0">
          {children}
        </main>
      </div>
      {/* false && }
      <SystemFooter className="hidden md:flex" />
      */}
      <BottomNav />

      {/* Developer mode overlay — fixed panel, visible on all pages */}
      <DevModeOverlay />
    </div>
  );
}
