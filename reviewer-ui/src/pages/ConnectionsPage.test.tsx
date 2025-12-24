import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ConnectionsPage from './ConnectionsPage';

const apiMocks = vi.hoisted(() => ({
  createSourceConnection: vi.fn(),
  deleteSourceConnection: vi.fn(),
  fetchSourceConnections: vi.fn(),
  testExistingSourceConnection: vi.fn(),
  testSourceConnection: vi.fn(),
  updateSourceConnection: vi.fn(),
}));

vi.mock('../api', () => ({
  createSourceConnection: apiMocks.createSourceConnection,
  deleteSourceConnection: apiMocks.deleteSourceConnection,
  fetchSourceConnections: apiMocks.fetchSourceConnections,
  testExistingSourceConnection: apiMocks.testExistingSourceConnection,
  testSourceConnection: apiMocks.testSourceConnection,
  updateSourceConnection: apiMocks.updateSourceConnection,
}));

describe('ConnectionsPage', () => {
  beforeEach(() => {
    apiMocks.fetchSourceConnections.mockResolvedValue([]);
    apiMocks.createSourceConnection.mockResolvedValue({
      id: 11,
      name: 'Warehouse',
      db_type: 'postgres',
      host: 'warehouse.internal',
      port: 5432,
      database: 'analytics',
      username: 'analyst',
      options: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  it('submits new connection details', async () => {
    const onToast = vi.fn();
    render(
      <MemoryRouter>
        <ConnectionsPage onToast={onToast} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Connection name'), { target: { value: 'Warehouse' } });
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'warehouse.internal' } });
    fireEvent.change(screen.getByLabelText('Database'), { target: { value: 'analytics' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'analyst' } });

    fireEvent.click(screen.getByRole('button', { name: 'Add connection' }));

    await waitFor(() => expect(apiMocks.createSourceConnection).toHaveBeenCalled());
    expect(apiMocks.createSourceConnection).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Warehouse',
      db_type: 'postgres',
      host: 'warehouse.internal',
      port: 5432,
      database: 'analytics',
      username: 'analyst',
    }));
    expect(onToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', content: 'Connection added.' }),
    );
  });
});
