import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import SourceConnectionDetailPage from './SourceConnectionDetailPage';

const apiMocks = vi.hoisted(() => ({
  fetchSourceConnection: vi.fn(),
  fetchSourceTables: vi.fn(),
  fetchMatchStatistics: vi.fn(),
  fetchSourceFields: vi.fn(),
  fetchSourceSamples: vi.fn(),
}));

vi.mock('../api', () => ({
  fetchSourceConnection: apiMocks.fetchSourceConnection,
  fetchSourceTables: apiMocks.fetchSourceTables,
  fetchMatchStatistics: apiMocks.fetchMatchStatistics,
  fetchSourceFields: apiMocks.fetchSourceFields,
  fetchSourceSamples: apiMocks.fetchSourceSamples,
}));

describe('SourceConnectionDetailPage', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());

    apiMocks.fetchSourceConnection.mockResolvedValue({
      id: 1,
      name: 'warehouse',
      db_type: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'analytics',
      username: 'svc',
      options: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T12:30:00Z',
    });
    apiMocks.fetchSourceTables.mockResolvedValue([
      { name: 'customers', schema: 'public', type: 'table' },
    ]);
    apiMocks.fetchMatchStatistics.mockResolvedValue([
      {
        mapping_id: 1,
        source_table: 'customers',
        source_field: 'email',
        ref_dimension: 'contact',
        total_values: 100,
        matched_values: 90,
        unmatched_values: 10,
        match_rate: 0.9,
        top_unmatched: [],
        top_matched: [],
      },
    ]);
    apiMocks.fetchSourceFields.mockResolvedValue([
      { name: 'email', data_type: 'text', nullable: false, default: null },
    ]);
    apiMocks.fetchSourceSamples.mockResolvedValue([
      {
        id: 1,
        source_connection_id: 1,
        source_table: 'customers',
        source_field: 'email',
        dimension: null,
        raw_value: 'alice@example.com',
        occurrence_count: 4,
        last_seen_at: '2024-01-02T12:00:00Z',
      },
      {
        id: 2,
        source_connection_id: 1,
        source_table: 'customers',
        source_field: 'email',
        dimension: 'contact',
        raw_value: 'alice@example.com',
        occurrence_count: 3,
        last_seen_at: '2024-02-15T08:00:00Z',
      },
      {
        id: 3,
        source_connection_id: 1,
        source_table: 'customers',
        source_field: 'email',
        dimension: null,
        raw_value: 'bob@example.com',
        occurrence_count: 2,
        last_seen_at: '2024-01-20T10:30:00Z',
      },
    ]);
  });

  it('loads metadata and allows inspecting field samples', async () => {
    const onToast = vi.fn();
    render(
      <MemoryRouter initialEntries={["/connections/1"]}>
        <Routes>
          <Route path="/connections/:connectionId" element={<SourceConnectionDetailPage onToast={onToast} />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(apiMocks.fetchSourceConnection).toHaveBeenCalledWith(1));
    await waitFor(() => expect(apiMocks.fetchSourceFields).toHaveBeenCalledWith(1, 'customers', 'public'));

    expect(screen.getByRole('heading', { name: 'warehouse' })).toBeInTheDocument();
    expect(screen.getAllByText('customers')[0]).toBeInTheDocument();

    const fieldRow = await screen.findByText('email');
    const rowElement = fieldRow.closest('tr');
    expect(rowElement).not.toBeNull();
    if (!rowElement) return;
    fireEvent.click(rowElement);

    await waitFor(() => expect(apiMocks.fetchSourceSamples).toHaveBeenCalledWith(1, {
      source_table: 'customers',
      source_field: 'email',
    }));

    const tables = screen.getAllByRole('table');
    const sampleTable = tables[tables.length - 1];
    expect(within(sampleTable).getAllByRole('row')).toHaveLength(3);
    expect(screen.getAllByText('alice@example.com')).toHaveLength(1);
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });
});
