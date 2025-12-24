import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import DimensionDetailPage from './DimensionDetailPage';

const apiMocks = vi.hoisted(() => ({
  fetchAllValueMappings: vi.fn(),
}));

vi.mock('../api', () => ({
  fetchAllValueMappings: apiMocks.fetchAllValueMappings,
}));

const mockToast = vi.fn();

vi.mock('../state/AppStateContext', () => ({
  useAppState: () => ({
    canonicalValues: [
      {
        id: 1,
        dimension: 'region',
        canonical_label: 'Europe',
        description: 'European Union member states',
        attributes: { iso_code: 'EU', priority: 1 },
      },
      {
        id: 2,
        dimension: 'region',
        canonical_label: 'Asia',
        description: '',
        attributes: { iso_code: 'AS', priority: null },
      },
    ],
    dimensions: [
      {
        id: 1,
        code: 'region',
        label: 'Region',
        description: 'Geographic region',
        extra_fields: [
          { key: 'iso_code', label: 'ISO code', description: 'Two letter code', data_type: 'string', required: true },
          { key: 'priority', label: 'Priority', description: '', data_type: 'number', required: false },
        ],
        created_at: '2024-05-01T12:00:00Z',
        updated_at: '2024-06-01T12:00:00Z',
      },
    ],
    isLoading: false,
  }),
}));

describe('DimensionDetailPage', () => {
  it('renders metrics and mappings for the selected dimension', async () => {
    apiMocks.fetchAllValueMappings.mockResolvedValue([
      {
        id: 10,
        source_connection_id: 5,
        source_table: 'customers',
        source_field: 'region',
        raw_value: 'EMEA',
        canonical_id: 1,
        status: 'approved',
        confidence: 0.92,
        suggested_label: null,
        notes: null,
        created_at: '2024-06-01T12:00:00Z',
        updated_at: '2024-06-01T12:00:00Z',
        canonical_label: 'Europe',
        ref_dimension: 'region',
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/dimensions/region"]}>
        <Routes>
          <Route path="/dimensions/:code" element={<DimensionDetailPage onToast={mockToast} />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(apiMocks.fetchAllValueMappings).toHaveBeenCalled());

    expect(screen.getByRole('heading', { name: 'Region' })).toBeInTheDocument();
    expect(screen.getByText('Canonical values')).toBeInTheDocument();
    expect(screen.getByText('Documented entries')).toBeInTheDocument();
    expect(screen.getByText('Mapping health')).toBeInTheDocument();

    expect(screen.getByText('Europe')).toBeInTheDocument();
    expect(screen.getAllByText('ISO code:').length).toBeGreaterThan(0);
    expect(screen.getByText('Value mappings')).toBeInTheDocument();
    expect(screen.getByText('approved')).toBeInTheDocument();
  });
});
