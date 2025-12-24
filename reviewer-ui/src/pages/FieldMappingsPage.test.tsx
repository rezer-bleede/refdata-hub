import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import FieldMappingsPage from './FieldMappingsPage';

const apiMocks = vi.hoisted(() => ({
  fetchSourceConnections: vi.fn(),
  fetchFieldMappings: vi.fn(),
  fetchSourceTables: vi.fn(),
  fetchSourceFields: vi.fn(),
}));

vi.mock('../api', () => ({
  captureMappingSamples: vi.fn(),
  createFieldMapping: vi.fn(),
  deleteFieldMapping: vi.fn(),
  fetchFieldMappings: apiMocks.fetchFieldMappings,
  fetchSourceConnections: apiMocks.fetchSourceConnections,
  fetchSourceTables: apiMocks.fetchSourceTables,
  fetchSourceFields: apiMocks.fetchSourceFields,
  ingestSamples: vi.fn(),
  updateFieldMapping: vi.fn(),
}));

apiMocks.fetchSourceConnections.mockResolvedValue([
  {
    id: 1,
    name: 'warehouse',
    db_type: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'analytics',
    username: 'svc',
    options: null,
    created_at: '',
    updated_at: '',
  },
]);

apiMocks.fetchFieldMappings.mockResolvedValue([]);
apiMocks.fetchSourceTables.mockResolvedValue([
  { name: 'customers', schema: 'public', type: 'table' },
  { name: 'customer_view', schema: 'public', type: 'view' },
]);
apiMocks.fetchSourceFields.mockResolvedValue([
  { name: 'id', data_type: 'integer' },
  { name: 'email', data_type: 'text' },
]);

vi.mock('../state/AppStateContext', () => ({
  useAppState: () => ({
    canonicalValues: [
      { dimension: 'region' },
      { dimension: 'city' },
    ],
  }),
}));

describe('FieldMappingsPage metadata selectors', () => {
  it('loads table and field metadata when a table is selected', async () => {
    const onToast = vi.fn();
    render(<FieldMappingsPage onToast={onToast} />);

    await waitFor(() => expect(apiMocks.fetchSourceConnections).toHaveBeenCalled());

    const [mappingTableSelect] = await screen.findAllByLabelText('Source table');
    await waitFor(() => expect(apiMocks.fetchSourceTables).toHaveBeenCalledWith(1));

    fireEvent.change(mappingTableSelect, { target: { value: 'public.customers' } });

    await waitFor(() =>
      expect(apiMocks.fetchSourceFields).toHaveBeenCalledWith(1, 'customers', 'public'),
    );

    const [fieldSelect] = screen.getAllByLabelText('Source field');
    const optionLabels = Array.from(fieldSelect.querySelectorAll('option')).map(
      (option) => option.textContent,
    );
    expect(optionLabels).toContain('id');
  });

  it('surfaces existing mappings before the creation form', async () => {
    const onToast = vi.fn();
    render(<FieldMappingsPage onToast={onToast} />);

    const existingHeading = await screen.findByRole('heading', { name: 'Existing mappings' });
    const addHeading = screen.getByRole('heading', { name: 'Add a new mapping' });

    expect(existingHeading.compareDocumentPosition(addHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
