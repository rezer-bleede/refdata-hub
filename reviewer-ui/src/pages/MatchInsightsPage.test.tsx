import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import MatchInsightsPage from './MatchInsightsPage';

const apiMocks = vi.hoisted(() => ({
  fetchMatchStatistics: vi.fn(),
  fetchSourceConnections: vi.fn(),
}));

vi.mock('../api', () => ({
  fetchMatchStatistics: apiMocks.fetchMatchStatistics,
  fetchSourceConnections: apiMocks.fetchSourceConnections,
}));

describe('MatchInsightsPage empty-state messaging', () => {
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
      },
    ]);

    const onToast = vi.fn();
    render(<MatchInsightsPage onToast={onToast} />);

    await waitFor(() => expect(apiMocks.fetchMatchStatistics).toHaveBeenCalledWith(1));

    expect(screen.getByRole('heading', { name: 'Match Insights' })).toBeInTheDocument();
    await screen.findByText('public.customers.marital_status');
    expect(screen.getAllByText('No samples captured yet.').length).toBeGreaterThan(0);
    expect(
      screen.getByText('No samples have been captured for this mapping yet.'),
    ).toBeInTheDocument();
  });
});
