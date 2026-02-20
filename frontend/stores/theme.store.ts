import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorMode = 'dark' | 'light';
export type BgTheme = 'solid' | 'aurora' | 'ember' | 'forest' | 'dusk';

interface ThemeState {
  colorMode: ColorMode;
  bgTheme: BgTheme;
  setColorMode: (mode: ColorMode) => void;
  setBgTheme: (theme: BgTheme) => void;
  toggleColorMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      colorMode: 'dark',
      bgTheme: 'solid',
      setColorMode: (colorMode) => set({ colorMode }),
      setBgTheme: (bgTheme) => set({ bgTheme }),
      toggleColorMode: () =>
        set({ colorMode: get().colorMode === 'dark' ? 'light' : 'dark' }),
    }),
    { name: 'athena-theme' }
  )
);
