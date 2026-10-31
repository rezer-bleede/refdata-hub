import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import MappingHistoryPage from './MappingHistoryPage';

const apiMocks = vi.hoisted(() => ({
  fetchSourceConnections: vi.fn(),
  fetchAllValueMappings: vi.fn(),
  fetchConnectionValueMappings: vi.fn(),
  reviewValueMappingCluster: vi.fn(),
}));

vi.mock('../api', () => ({
  fetchSourceConnections: apiMocks.fetchSourceConnections,
  fetchAllValueMappings: apiMocks.fetchAllValueMappings,
  fetchConnectionValueMappings: apiMocks.fetchConnectionValueMappings,
  reviewValueMappingCluster: apiMocks.reviewValueMappingCluster,
  deleteValueMapping: vi.fn(),
  exportValueMappings: vi.fn(),
  importValueMappings: vi.fn(),
  updateValueMapping: vi.fn(),
}));

vi.mock('../state/AppStateContext', () => ({ useAppState: () => ({ canonicalValues: [] }) }));

describe('MappingHistoryPage evidence clusters', () => {
  it('requires an explicit cluster-level approval and sends the evidence key', async () => {
    const clusterId = 'company:7:abc123';
    const notes = JSON.stringify({
      cluster_id: clusterId,
      evidence_tier: 'A',
      method: 'linkedin',
      matched_identifiers: [{ field: 'linkedin', value: 'acme', tier: 'A' }],
    });
    const mappings = ['Acme LLC', 'Acme Saudi'].map((raw_value, index) => ({
      id: index + 1,
      source_connection_id: 3,
      source_table: 'employers',
      source_field: 'company_name',
      raw_value,
      canonical_id: 7,
      status: 'pending',
      confidence: 1,
      notes,
      created_at: '2026-10-30T00:00:00Z',
      updated_at: '2026-10-30T00:00:00Z',
      canonical_label: 'Acme Group',
      ref_dimension: 'company',
    }));
    apiMocks.fetchSourceConnections.mockResolvedValue([]);
    apiMocks.fetchAllValueMappings.mockResolvedValue(mappings);
    apiMocks.reviewValueMappingCluster.mockResolvedValue({ cluster_id: clusterId, status: 'approved', updated: 2 });

    render(<MappingHistoryPage onToast={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Pending company identity clusters' })).toBeInTheDocument();
    expect(screen.getByText('Acme LLC · Acme Saudi')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve cluster' }));

    await waitFor(() => expect(apiMocks.reviewValueMappingCluster).toHaveBeenCalledWith(3, clusterId, 'approved'));
  });
});
