import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MDMPage from './MDMPage';

const mocks = vi.hoisted(() => ({
  fetchMasterEntities: vi.fn(),
  fetchSourceConnections: vi.fn(),
  fetchMasterRecords: vi.fn(),
  fetchMDMSourceRecords: vi.fn(),
  fetchMasterRecordLinks: vi.fn(),
  fetchEntityQuality: vi.fn(),
}));

vi.mock('../api', () => mocks);

describe('MDMPage', () => {
  beforeEach(() => {
    mocks.fetchMasterEntities.mockResolvedValue([{
      id: 1, code: 'organization', label: 'Organization', attribute_schema: [], match_fields: [],
      match_threshold: 0.95, survivorship_rules: {}, quality_rules: [], created_at: '', updated_at: '',
    }]);
    mocks.fetchSourceConnections.mockResolvedValue([]);
    mocks.fetchMasterRecords.mockResolvedValue([{
      id: 9, entity_code: 'organization', attributes: { name: 'Example Org' }, status: 'active',
      merged_into_id: null, version: 1, created_at: '', updated_at: '',
    }]);
    mocks.fetchMDMSourceRecords.mockResolvedValue([]);
    mocks.fetchMasterRecordLinks.mockResolvedValue([]);
    mocks.fetchEntityQuality.mockResolvedValue({
      entity_code: 'organization', total_records: 1, compliant_records: 1, average_score: 1,
      records: [{ record: {
        id: 9, entity_code: 'organization', attributes: { name: 'Example Org' }, status: 'active',
        merged_into_id: null, version: 1, created_at: '', updated_at: '',
      }, score: 1, violations: [] }],
    });
  });

  it('loads entity golden records and quality view', async () => {
    render(<MDMPage onToast={vi.fn()} />);
    expect(await screen.findByRole('option', { name: /Example Org/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Quality & hierarchy' }));
    expect(await screen.findByText('Data quality')).toBeInTheDocument();
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0);
  });
});
