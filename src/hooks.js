import { useSyncExternalStore } from 'react';
import { getDb, getSessionUserId, subscribe } from './api/db';

export const useDb = () => useSyncExternalStore(subscribe, getDb);

export function useCurrentUser() {
  const db = useDb();
  const id = useSyncExternalStore(subscribe, getSessionUserId);
  return db.users.find((u) => u.id === id) ?? null;
}

const THEME_KEY = 'conferation-theme';

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || localStorage.getItem('theme');
  } catch {
    return null;
  }
}

function getSystemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function getResolvedTheme() {
  const stored = getStoredTheme();
  if (stored === 'dark' || stored === 'light') return stored;
  return getSystemPrefersDark() ? 'dark' : 'light';
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

let themeTransitionTimer = null;

export function enableThemeTransition() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.add('theme-transition');
  if (themeTransitionTimer) clearTimeout(themeTransitionTimer);
  themeTransitionTimer = setTimeout(() => {
    root.classList.remove('theme-transition');
    themeTransitionTimer = null;
  }, 350);
}

const themeListeners = new Set();

export function setTheme(newTheme, withTransition = true) {
  try {
    localStorage.setItem(THEME_KEY, newTheme);
  } catch {}
  if (withTransition) {
    enableThemeTransition();
  }
  applyTheme(newTheme);
  themeListeners.forEach((listener) => listener());
}

export function toggleTheme() {
  const current = getResolvedTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next, true);
  return next;
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (onStoreChange) => {
      themeListeners.add(onStoreChange);

      const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
      const handleMediaChange = () => {
        if (!getStoredTheme()) {
          enableThemeTransition();
          applyTheme(getResolvedTheme());
          onStoreChange();
        }
      };

      const handleStorage = (e) => {
        if (e.key === THEME_KEY || e.key === 'theme') {
          enableThemeTransition();
          applyTheme(getResolvedTheme());
          onStoreChange();
        }
      };

      mediaQuery?.addEventListener?.('change', handleMediaChange);
      window.addEventListener('storage', handleStorage);

      return () => {
        themeListeners.delete(onStoreChange);
        mediaQuery?.removeEventListener?.('change', handleMediaChange);
        window.removeEventListener('storage', handleStorage);
      };
    },
    getResolvedTheme,
    () => 'light',
  );

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    setTheme,
  };
}
