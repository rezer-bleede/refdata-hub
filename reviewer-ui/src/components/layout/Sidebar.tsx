import { cn } from '../../utils/cn';
import { navGroups, type NavItem } from './navigation';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onCloseMobile: () => void;
  isActive: (path: string) => boolean;
  onNavigate: (path: string) => void;
}

const LogoMark = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 64 64"
    role="img"
    aria-label="RefData Hub logo"
    className={className}
  >
    <defs>
      <linearGradient id="sidebar-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#22d3ee" />
        <stop offset="50%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#a855f7" />
      </linearGradient>
      <filter id="sidebar-logo-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <rect width="64" height="64" rx="16" fill="#0b0f19" />
    <rect
      width="64"
      height="64"
      rx="16"
      fill="none"
      stroke="url(#sidebar-logo-grad)"
      strokeWidth="2"
      opacity="0.6"
    />

    <path
      d="M32 10 L50 20 L50 42 L32 52 L14 42 L14 20 Z"
      fill="url(#sidebar-logo-grad)"
      fillOpacity="0.2"
      stroke="url(#sidebar-logo-grad)"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />

    <path d="M32 10 L32 31 M50 42 L32 31 M14 42 L32 31" stroke="#38bdf8" strokeWidth="1.8" opacity="0.8" />

    <circle cx="32" cy="10" r="3" fill="#22d3ee" filter="url(#sidebar-logo-glow)" />
    <circle cx="50" cy="20" r="2.5" fill="#6366f1" />
    <circle cx="50" cy="42" r="2.5" fill="#a855f7" />
    <circle cx="32" cy="52" r="3" fill="#38bdf8" filter="url(#sidebar-logo-glow)" />
    <circle cx="14" cy="42" r="2.5" fill="#6366f1" />
    <circle cx="14" cy="20" r="2.5" fill="#22d3ee" />

    <circle cx="32" cy="31" r="4" fill="#38bdf8" filter="url(#sidebar-logo-glow)" />
    <circle cx="32" cy="31" r="1.5" fill="#ffffff" />
  </svg>
);

function NavLink({
  item,
  isActive,
  collapsed,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2',
        isActive
          ? 'bg-gradient-to-r from-brand-primary/15 to-brand-primary/5 text-brand-primary font-semibold shadow-xs border border-brand-primary/20'
          : 'text-sidebar-text hover:bg-sidebar-item-hover hover:text-text-primary',
      )}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? 'page' : undefined}
    >
      <span data-testid={`nav-icon-${item.path.replace(/\//g, '-')}`} className="flex h-5 w-5 items-center justify-center">
        <Icon
          className={cn(
            'h-5 w-5 flex-shrink-0 transition-colors',
            isActive ? 'text-brand-primary' : 'text-text-tertiary',
          )}
          aria-hidden="true"
        />
      </span>
      {!collapsed && <span className="truncate flex-1 text-left">{item.label}</span>}
    </button>
  );
}

function GroupHeader({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
      {label}
    </div>
  );
}

export default function Sidebar({
  collapsed,
  mobileOpen,
  onToggle,
  onCloseMobile,
  isActive,
  onNavigate,
}: SidebarProps) {
  const handleNavClick = (path: string) => {
    onNavigate(path);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onCloseMobile();
    }
  };

  return (
    <>
      <aside
        data-testid="app-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out',
          'bg-sidebar-bg border-r border-sidebar-border shadow-xs',
          collapsed ? 'w-[72px]' : 'w-[280px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-xl overflow-hidden shadow-md shadow-brand-primary/20"
                data-testid="app-logo-mark"
              >
                <LogoMark className="h-9 w-9" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-text-primary block leading-none">
                  RefData Hub
                </span>
                <span className="text-[11px] font-medium text-brand-primary flex items-center gap-1 mt-0.5">
                  <Sparkles className="h-3 w-3" /> Metadata stewardship
                </span>
              </div>
            </div>
          ) : (
            <div
              className="h-9 w-9 mx-auto rounded-xl overflow-hidden shadow-md shadow-brand-primary/20"
              data-testid="app-logo-mark"
            >
              <LogoMark className="h-9 w-9" />
            </div>
          )}

          {!collapsed && (
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors hidden lg:block cursor-pointer"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin" aria-label="Sidebar navigation">
          {navGroups.map((group) => (
            <div key={group.id}>
              <GroupHeader label={group.label} collapsed={collapsed} />
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div key={item.path} className="relative">
                    <NavLink
                      item={item}
                      isActive={isActive(item.path)}
                      collapsed={collapsed}
                      onClick={() => handleNavClick(item.path)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border bg-bg-secondary/50">
          {!collapsed ? (
            <button
              onClick={onToggle}
              className="w-full px-3 py-2 rounded-xl bg-bg-tertiary/60 border border-border-primary text-xs text-text-tertiary flex items-center justify-between hover:bg-bg-hover hover:text-text-primary transition-all cursor-pointer"
              title="Toggle sidebar collapse state"
            >
              <span className="font-medium">Sidebar shortcut</span>
              <kbd className="px-1.5 py-0.5 bg-bg-secondary rounded border border-border-secondary text-[10px] font-mono font-semibold text-text-secondary">
                ⌘B
              </kbd>
            </button>
          ) : (
            <button
              onClick={onToggle}
              className="w-full p-2 rounded-xl bg-bg-tertiary/60 border border-border-primary text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all flex items-center justify-center cursor-pointer"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
    </>
  );
}
