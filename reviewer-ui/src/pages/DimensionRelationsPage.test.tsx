import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import DimensionRelationsPage from './DimensionRelationsPage';
import { useAppState } from '../state/AppStateContext';
import * as api from '../api';

vi.mock('../state/AppStateContext', () => ({
  useAppState: vi.fn(),
}));

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    fetchDimensionRelations: vi.fn(),
    fetchDimensionRelationLinks: vi.fn(),
  };
});

// Mock @xyflow/react because Vitest / JSDOM doesn't support full SVG DOM canvas dimensions
vi.mock('@xyflow/react', () => {
  const React = require('react');
  return {
    ReactFlow: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="react-flow-mock">{children}</div>
    ),
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Controls: () => <div data-testid="react-flow-controls" />,
    Background: () => <div data-testid="react-flow-bg" />,
    MiniMap: () => <div data-testid="react-flow-minimap" />,
    Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    useNodesState: (initial: any) => [initial, vi.fn(), vi.fn()],
    useEdgesState: (initial: any) => [initial, vi.fn(), vi.fn()],
    useReactFlow: () => ({
      fitView: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
    }),
    Handle: () => null,
    Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
    MarkerType: { ArrowClosed: 'arrowclosed' },
  };
});

describe('DimensionRelationsPage', () => {
  const mockToast = vi.fn();

  const sampleRelations = [
    {
      id: 1,
      label: 'Region to District',
      parent_dimension_code: 'region',
      child_dimension_code: 'district',
      description: 'Hierarchical mapping of regions',
      link_count: 2,
      parent_dimension: { code: 'region', label: 'Region', description: 'Region' },
      child_dimension: { code: 'district', label: 'District', description: 'District' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useAppState as any).mockReturnValue({
      dimensions: [
        { code: 'region', label: 'Region' },
        { code: 'district', label: 'District' },
      ],
      canonicalValues: [
        { id: 101, dimension: 'region', canonical_label: 'North America' },
        { id: 201, dimension: 'district', canonical_label: 'Northeast' },
      ],
    });

    (api.fetchDimensionRelations as any).mockResolvedValue(sampleRelations);
    (api.fetchDimensionRelationLinks as any).mockResolvedValue([
      { id: 10, parent_canonical_id: 101, child_canonical_id: 201, parent_label: 'North America', child_label: 'Northeast' },
    ]);
  });

  it('renders graph view by default with custom controls and relations data', async () => {
    render(<DimensionRelationsPage onToast={mockToast} />);

    expect(await screen.findByText('Dimension relationships')).toBeInTheDocument();
    expect(await screen.findByTestId('react-flow-mock')).toBeInTheDocument();
    expect(screen.getByText('Graph View')).toBeInTheDocument();
  });

  it('allows toggling between Graph View and Card Grid view', async () => {
    render(<DimensionRelationsPage onToast={mockToast} />);

    expect(await screen.findByTestId('react-flow-mock')).toBeInTheDocument();

    const gridButton = screen.getByRole('button', { name: /Card Grid/i });
    fireEvent.click(gridButton);

    await waitFor(() => {
      expect(screen.queryByTestId('react-flow-mock')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('Region to District').length).toBeGreaterThan(0);

    const graphButton = screen.getByRole('button', { name: /Graph View/i });
    fireEvent.click(graphButton);

    await waitFor(() => {
      expect(screen.getByTestId('react-flow-mock')).toBeInTheDocument();
    });
  });
});
