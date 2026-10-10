import { useCallback, useEffect, useState } from 'react';
import { cn } from '../../utils/cn';
import CommandSearch from './CommandSearch';
import ThemePicker from './ThemePicker';
import type { SystemConfig } from '../../types';
import type { ThemeChoice } from '../../themes';
import { Menu, RefreshCw, Sparkles } from 'lucide-react';

interface TopBarProps {
  onMenuToggle: () => void;
  config: SystemConfig | null;
  isLoading: boolean;
  onSync: () => void;
  theme: ThemeChoice;
  onThemeChange: (choice: ThemeChoice) => void;
  resolvedMode: 'light' | 'dark';
}

export default function TopBar({
  onMenuToggle,
  config,
  isLoading,
  onSync,
  theme,
  onThemeChange,
  resolvedMode,
}: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchOpenChange = useCallback((open: boolean) => {
    setSearchOpen(open);
  }, []);

  return (
    <header
      className={cn(
        'flex items-center gap-4 h-16 px-5 shrink-0 sticky top-0 z-30 glass-panel',
        'bg-topbar-bg border-b border-topbar-border shadow-xs',
      )}
      role="banner"
    >
      <button
        type="button"
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-xl hover:bg-bg-hover text-text-secondary transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 flex items-center gap-4 min-w-0">
        <CommandSearch open={searchOpen} onOpenChange={handleSearchOpenChange} />
      </div>

      <div className="flex items-center gap-2">
        {config && (
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/20">
            <Sparkles className="h-3 w-3" />
            Matcher: {config.matcher_backend}
          </span>
        )}

        <button
          type="button"
          onClick={onSync}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-brand-primary text-brand-accent-contrast hover:bg-brand-primary-hover shadow-xs transition-all border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Sync data"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span className="hidden sm:inline">Syncing…</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sync data</span>
            </>
          )}
        </button>

        <ThemePicker
          theme={theme}
          onThemeChange={onThemeChange}
          resolvedMode={resolvedMode}
        />
      </div>
    </header>
  );
}
