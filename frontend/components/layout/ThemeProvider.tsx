'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/stores/theme.store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorMode, bgTheme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    if (colorMode === 'light') {
      root.setAttribute('data-theme', 'light');
    } else {
      root.removeAttribute('data-theme');
    }
    root.setAttribute('data-bg', bgTheme);
  }, [colorMode, bgTheme]);

  return <>{children}</>;
}
