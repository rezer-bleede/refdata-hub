import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { getAllNavItems } from './navigation';
import { ArrowRight, Command, Search, X } from 'lucide-react';

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  path: string;
  icon: typeof Search;
}

interface CommandSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommandSearch({ open, onOpenChange }: CommandSearchProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    } else {
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onOpenChange]);

  const searchResults = useMemo<SearchResultItem[]>(() => {
    const items: SearchResultItem[] = getAllNavItems().map((nav) => ({
      id: `nav-${nav.path}`,
      title: nav.label,
      subtitle: `Workspace page (${nav.path})`,
      path: nav.path,
      icon: nav.icon,
    }));

    if (!searchQuery.trim()) {
      return items.slice(0, 6);
    }

    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults]);

  const handleSelectResult = (result: SearchResultItem) => {
    navigate(result.path);
    onOpenChange(false);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onOpenChange(false);
      return;
    }
    if (searchResults.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % searchResults.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = searchResults[selectedIndex];
      if (selected) {
        handleSelectResult(selected);
      }
    }
  };

  return (
    <div className="relative flex-1 max-w-md hidden sm:block" ref={containerRef}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary z-10" />
      <input
        ref={searchRef}
        type="text"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        onFocus={() => onOpenChange(true)}
        onKeyDown={handleSearchKeyDown}
        placeholder="Search pages, dimensions, settings..."
        className="w-full pl-10 pr-12 py-2 bg-bg-tertiary/80 border border-border-primary/60 rounded-xl text-sm text-text-primary placeholder-text-tertiary focus:bg-bg-secondary focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none transition-all"
        aria-label="Global search"
      />
      <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-text-tertiary bg-bg-secondary rounded border border-border-secondary">
        <Command className="h-3 w-3" />K
      </kbd>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-widget-bg border border-widget-border rounded-2xl shadow-xl p-3 z-50 max-h-[380px] overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-border-primary mb-2 px-1">
            <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
              {searchQuery ? 'Search Results' : 'Quick Navigation'}
            </span>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-bg-hover"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {searchResults.length > 0 ? (
            <div className="space-y-1">
              {searchResults.map((result, idx) => {
                const IconComponent = result.icon;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => handleSelectResult(result)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between transition-all',
                      isSelected
                        ? 'bg-brand-primary/10 text-brand-primary font-semibold border border-brand-primary/20'
                        : 'hover:bg-bg-hover text-text-primary border border-transparent',
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          'p-1.5 rounded-lg',
                          isSelected ? 'bg-brand-primary/20' : 'bg-bg-tertiary',
                        )}
                      >
                        <IconComponent className="h-4 w-4 flex-shrink-0" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold truncate leading-tight">{result.title}</p>
                        <p className="text-[10px] text-text-tertiary truncate">{result.subtitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-brand-primary/10 text-brand-primary">
                        page
                      </span>
                      <ArrowRight
                        className={cn(
                          'h-3.5 w-3.5 opacity-0 transition-opacity',
                          isSelected && 'opacity-100',
                        )}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-text-tertiary">
              No matching results for "
              <span className="font-semibold text-text-secondary">{searchQuery}</span>"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
