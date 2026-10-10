import { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import {
  themeDefinitions,
  themeOrder,
  type ThemeChoice,
} from '../../themes';
import { Check, Palette } from 'lucide-react';

interface ThemePickerProps {
  theme: ThemeChoice;
  onThemeChange: (choice: ThemeChoice) => void;
  resolvedMode: 'light' | 'dark';
}

export default function ThemePicker({ theme, onThemeChange, resolvedMode }: ThemePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!open) return;

    const currentIndex = themeOrder.indexOf(theme);
    let nextIndex = currentIndex !== -1 ? currentIndex : 0;

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      nextIndex = (currentIndex + 1) % themeOrder.length;
      optionRefs.current[nextIndex]?.focus();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      nextIndex = (currentIndex - 1 + themeOrder.length) % themeOrder.length;
      optionRefs.current[nextIndex]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  const currentThemeConfig = themeDefinitions[theme] ?? themeDefinitions.light;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 p-2 sm:px-3 sm:py-2 rounded-xl text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-all border border-transparent hover:border-border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
        aria-label={`Select UI theme, current theme is ${currentThemeConfig.name}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Palette className="h-4 w-4 text-brand-primary" />
        <span className="hidden md:inline-block text-xs font-bold text-text-primary">
          {currentThemeConfig.name}
        </span>
        <span
          className="h-2.5 w-2.5 rounded-full border border-border-secondary hidden sm:inline-block"
          style={{ backgroundColor: currentThemeConfig.swatch.accent }}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-[380px] bg-widget-bg border border-widget-border rounded-2xl shadow-2xl p-3 z-50 max-h-[85vh] overflow-y-auto scrollbar-thin"
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-label="Theme options"
        >
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border-primary px-1">
            <div>
              <h3 className="font-extrabold text-xs text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-brand-primary" />
                Select Visual Theme
              </h3>
              <p className="text-[11px] text-text-tertiary">
                Active: <strong className="text-text-secondary">{currentThemeConfig.name}</strong> ({resolvedMode} mode)
              </p>
            </div>
          </div>

          <div role="radiogroup" aria-label="Color themes" className="space-y-1.5">
            {themeOrder.map((id, idx) => {
              const config = themeDefinitions[id];
              const isSelected = theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  ref={(el) => {
                    optionRefs.current[idx] = el;
                  }}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    onThemeChange(id);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-all cursor-pointer border',
                    isSelected
                      ? 'bg-brand-primary/10 border-brand-primary/40 text-text-primary shadow-2xs'
                      : 'bg-bg-tertiary/40 border-transparent hover:bg-bg-hover hover:border-border-primary text-text-secondary',
                  )}
                >
                  <div
                    className="w-12 h-10 rounded-lg p-1 border border-black/10 dark:border-white/10 flex flex-col justify-between shrink-0 shadow-2xs relative overflow-hidden"
                    style={{ backgroundColor: config.swatch.bg }}
                  >
                    <div
                      className="w-full h-4 rounded-xs border border-black/5 dark:border-white/5 flex items-center justify-end px-1"
                      style={{ backgroundColor: config.swatch.surface }}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: config.swatch.accent }}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <div
                        className="h-1.5 w-full rounded-full"
                        style={{ backgroundColor: config.swatch.accent }}
                      />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-xs text-text-primary truncate">
                        {config.name}
                      </span>
                      <span
                        className={cn(
                          'text-[9px] px-1.5 rounded-full font-bold uppercase tracking-wider',
                          config.mode === 'auto'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : config.mode === 'dark'
                              ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                              : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20',
                        )}
                      >
                        {config.mode === 'auto' ? 'Auto' : config.mode}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-tertiary truncate mt-0.5">
                      {config.description}
                    </p>
                  </div>

                  {isSelected && (
                    <div className="h-6 w-6 rounded-full bg-brand-primary text-brand-accent-contrast flex items-center justify-center shrink-0 shadow-2xs">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
