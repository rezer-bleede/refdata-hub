import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MatchInsightsPage from './MatchInsightsPage';

let mockRefreshToken = 0;

const apiMocks = vi.hoisted(() => ({
  fetchFieldMappings: vi.fn(),
  fetchMatchStatistics: vi.fn(),
  fetchSourceConnections: vi.fn(),
}));

vi.mock('../api', () => ({
  fetchFieldMappings: apiMocks.fetchFieldMappings,
  fetchMatchStatistics: apiMocks.fetchMatchStatistics,
  fetchSourceConnections: apiMocks.fetchSourceConnections,
}));

vi.mock('../state/AppStateContext', () => ({
  useAppState: () => ({
    refreshToken: mockRefreshToken,
  }),
}));

describe('MatchInsightsPage empty-state messaging', () => {
  beforeEach(() => {
    mockRefreshToken = 0;
    vi.clearAllMocks();
  });
  it('refreshes match insights when the global sync token changes', async () => {
    apiMocks.fetchSourceConnections.mockResolvedValue([
      {
        id: 1,
        name: 'Target Demo Warehouse',
        db_type: 'postgres',
        host: 'localhost',
        port: 5432,
        database: 'targetdb',
        username: 'svc',
        options: null,
        created_at: '',
        updated_at: '',
      },
    ]);
    apiMocks.fetchMatchStatistics.mockResolvedValue([]);
    apiMocks.fetchFieldMappings.mockResolvedValue([]);

    const onToast = vi.fn();
    const { rerender } = render(<MatchInsightsPage onToast={onToast} />);

    await waitFor(() => expect(apiMocks.fetchMatchStatistics).toHaveBeenCalledTimes(1));

    mockRefreshToken = 1;
    rerender(<MatchInsightsPage onToast={onToast} />);

    await waitFor(() => expect(apiMocks.fetchMatchStatistics).toHaveBeenCalledTimes(2));
  });

  it('falls back to field mappings when match stats are empty', async () => {
    apiMocks.fetchSourceConnections.mockResolvedValue([
      {
        id: 1,
        name: 'Target Demo Warehouse',
        db_type: 'postgres',
        host: 'localhost',
        port: 5432,
        database: 'targetdb',
        username: 'svc',
        options: null,
        created_at: '',
        updated_at: '',
      },
    ]);
    apiMocks.fetchMatchStatistics.mockResolvedValue([]);
    apiMocks.fetchFieldMappings.mockResolvedValue([
      {
        id: 55,
        source_table: 'public.orders',
        source_field: 'payment_status',
        ref_dimension: 'payment_status',
        description: null,
        created_at: '',
        updated_at: '',
      },
    ]);

    const onToast = vi.fn();
    render(<MatchInsightsPage onToast={onToast} />);

    await waitFor(() => expect(apiMocks.fetchMatchStatistics).toHaveBeenCalledWith(1));
    await waitFor(() => expect(apiMocks.fetchFieldMappings).toHaveBeenCalledWith(1));

    expect(screen.getByText('public.orders.payment_status')).toBeInTheDocument();
    expect(screen.getAllByText('No samples captured yet.').length).toBeGreaterThan(0);
  });

  it('highlights when no samples have been captured', async () => {
    apiMocks.fetchSourceConnections.mockResolvedValue([
      {
        id: 1,
        name: 'Target Demo Warehouse',
        db_type: 'postgres',
        host: 'localhost',
        port: 5432,
        database: 'targetdb',
        username: 'svc',
        options: null,
        created_at: '',
        updated_at: '',
      },
    ]);
    apiMocks.fetchMatchStatistics.mockResolvedValue([
      {
        mapping_id: 10,
        source_table: 'public.customers',
        source_field: 'marital_status',
        ref_dimension: 'marital_status',
        total_values: 0,
        matched_values: 0,
        unmatched_values: 0,
        match_rate: 0,
        top_unmatched: [],
        top_matched: [],
      },
    ]);
    apiMocks.fetchFieldMappings.mockResolvedValue([]);

    const onToast = vi.fn();
    render(<MatchInsightsPage onToast={onToast} />);

    await waitFor(() => expect(apiMocks.fetchMatchStatistics).toHaveBeenCalledWith(1));

    expect(screen.getByRole('heading', { name: 'Match Insights' })).toBeInTheDocument();
    await screen.findByText('public.customers.marital_status');
    expect(screen.getAllByText('No samples captured yet.').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('No samples have been captured for this mapping yet.').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('shows matched values inside an expandable section', async () => {
    apiMocks.fetchSourceConnections.mockResolvedValue([
      {
        id: 1,
        name: 'Target Demo Warehouse',
        db_type: 'postgres',
        host: 'localhost',
        port: 5432,
        database: 'targetdb',
        username: 'svc',
        options: null,
        created_at: '',
        updated_at: '',
      },
    ]);
    apiMocks.fetchMatchStatistics.mockResolvedValue([
      {
        mapping_id: 7,
        source_table: 'public.orders',
        source_field: 'status',
        ref_dimension: 'order_status',
        total_values: 12,
        matched_values: 11,
        unmatched_values: 1,
        match_rate: 0.91,
        top_unmatched: [],
        top_matched: [
          {
            raw_value: 'shipped',
            occurrence_count: 8,
            canonical_label: 'Shipped',
            match_type: 'semantic',
            confidence: 0.97,
          },
        ],
      },
    ]);
    apiMocks.fetchFieldMappings.mockResolvedValue([]);

    const onToast = vi.fn();
    render(<MatchInsightsPage onToast={onToast} />);

    const matchedSection = await screen.findByTestId('matched-section-7');
    expect(matchedSection).not.toHaveAttribute('open');

    const summary = within(matchedSection).getByText('Matched values');
    fireEvent.click(summary);

    expect(matchedSection).toHaveAttribute('open');
    expect(screen.getByText('Shipped')).toBeInTheDocument();
    expect(screen.getByText('Confidence 97%')).toBeInTheDocument();
  });
});
