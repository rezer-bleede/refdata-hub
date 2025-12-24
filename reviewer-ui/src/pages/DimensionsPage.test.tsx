import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DimensionsPage from './DimensionsPage';

const apiMocks = vi.hoisted(() => ({
  fetchDimensions: vi.fn(),
  createDimension: vi.fn(),
  updateDimension: vi.fn(),
  deleteDimension: vi.fn(),
}));

vi.mock('../api', () => ({
  fetchDimensions: apiMocks.fetchDimensions,
  createDimension: apiMocks.createDimension,
  updateDimension: apiMocks.updateDimension,
  deleteDimension: apiMocks.deleteDimension,
}));

vi.mock('../state/AppStateContext', () => ({
  useAppState: () => ({
    dimensions: [
      {
        id: 1,
        code: 'region',
        label: 'Region',
        description: 'Geographic region',
        extra_fields: [],
        created_at: '2024-05-10T00:00:00Z',
        updated_at: '2024-05-10T00:00:00Z',
      },
    ],
    updateDimensions: vi.fn(),
  }),
}));

const DetailEcho = () => {
  const { code } = useParams();
  return <div>Detail route for {code}</div>;
};

describe('DimensionsPage', () => {
  beforeEach(() => {
    apiMocks.fetchDimensions.mockResolvedValue([]);
  });

  it('navigates to the dimension detail view when a row is clicked', async () => {
    const onToast = vi.fn();
    render(
      <MemoryRouter initialEntries={["/dimensions"]}>
        <Routes>
          <Route path="/dimensions" element={<DimensionsPage onToast={onToast} />} />
          <Route path="/dimensions/:code" element={<DetailEcho />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Region').closest('tr')!);

    await waitFor(() => screen.getByText('Detail route for region'));
    expect(screen.getByText('Detail route for region')).toBeInTheDocument();
  });

  it('prevents navigation when action buttons are clicked', async () => {
    const onToast = vi.fn();
    render(
      <MemoryRouter initialEntries={["/dimensions"]}>
        <Routes>
          <Route path="/dimensions" element={<DimensionsPage onToast={onToast} />} />
          <Route path="/dimensions/:code" element={<DetailEcho />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    await waitFor(() => expect(screen.queryByText('Detail route for region')).not.toBeInTheDocument());
  });
});
