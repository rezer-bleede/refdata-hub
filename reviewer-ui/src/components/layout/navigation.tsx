import {
  Boxes,
  GitFork,
  History,
  LayoutDashboard,
  Library,
  Lightbulb,
  Plug,
  Settings,
  Sparkles,
  TableProperties,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const dashboard: NavItem = {
  path: '/dashboard',
  label: 'Dashboard',
  icon: LayoutDashboard,
};

const dimensions: NavItem = {
  path: '/dimensions',
  label: 'Dimensions',
  icon: Boxes,
};

const canonicalLibrary: NavItem = {
  path: '/canonical-library',
  label: 'Canonical Library',
  icon: Library,
};

const dimensionRelations: NavItem = {
  path: '/dimension-relations',
  label: 'Dimension Relations',
  icon: GitFork,
};

const connections: NavItem = {
  path: '/connections',
  label: 'Source Connections',
  icon: Plug,
};

const fieldMappings: NavItem = {
  path: '/field-mappings',
  label: 'Field Mappings',
  icon: TableProperties,
};

const matchInsights: NavItem = {
  path: '/match-insights',
  label: 'Match Insights',
  icon: Sparkles,
};

const suggestions: NavItem = {
  path: '/suggestions',
  label: 'Suggestions',
  icon: Lightbulb,
};

const mappingHistory: NavItem = {
  path: '/mapping-history',
  label: 'Mapping History',
  icon: History,
};

const settings: NavItem = {
  path: '/settings',
  label: 'Settings',
  icon: Settings,
};

export const navGroups: NavGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [dashboard, dimensions, canonicalLibrary, dimensionRelations],
  },
  {
    id: 'integration',
    label: 'Integration',
    items: [connections, fieldMappings],
  },
  {
    id: 'quality',
    label: 'Quality Control',
    items: [matchInsights, suggestions, mappingHistory],
  },
  {
    id: 'system',
    label: 'System',
    items: [settings],
  },
];

export const navItems: NavItem[] = navGroups.flatMap((group) => group.items);

export function getAllNavItems(): NavItem[] {
  return navItems;
}
