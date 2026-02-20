'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/stores/theme.store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorMode, bgTheme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', colorMode === 'light');
    root.setAttribute('data-bg', bgTheme);
  }, [colorMode, bgTheme]);

  return <>{children}</>;
}
