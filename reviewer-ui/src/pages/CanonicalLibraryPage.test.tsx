import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CanonicalLibraryPage from './CanonicalLibraryPage';

vi.mock('../api', () => ({
  bulkImportCanonicalValues: vi.fn(),
  previewBulkImportCanonicalValues: vi.fn(),
  createCanonicalValue: vi.fn(),
  deleteCanonicalValue: vi.fn(),
  updateCanonicalValue: vi.fn(),
}));

vi.mock('../state/AppStateContext', () => ({
  useAppState: () => ({
    canonicalValues: [],
    dimensions: [],
    updateCanonicalValues: vi.fn(),
  }),
}));

describe('CanonicalLibraryPage bulk import', () => {
  it('accepts pasted rows in the bulk import textarea', () => {
    const onToast = vi.fn();
    render(<CanonicalLibraryPage onToast={onToast} />);

    fireEvent.click(screen.getByRole('button', { name: 'Bulk import' }));

    const textarea = screen.getByLabelText('Rows to import');
    fireEvent.change(textarea, { target: { value: 'dimension,label\nregion,Abu Dhabi' } });

    expect(textarea).toHaveValue('dimension,label\nregion,Abu Dhabi');
  });
});
