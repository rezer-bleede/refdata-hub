import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('prioritises the existing connections list above the creation form', async () => {
    const onToast = vi.fn();
    render(
      <MemoryRouter>
        <ConnectionsPage onToast={onToast} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(apiMocks.fetchSourceConnections).toHaveBeenCalled());

    const existingHeading = await screen.findByRole('heading', { name: 'Source connections' });
    const registrationHeading = screen.getByRole('heading', { name: 'Register a source connection' });

    expect(existingHeading.compareDocumentPosition(registrationHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the port and password fields with the themed input treatment', async () => {
    apiMocks.fetchSourceConnections.mockResolvedValueOnce([
      {
        id: 7,
        name: 'Analytics Warehouse',
        db_type: 'postgres',
        host: 'warehouse.internal',
        port: 5432,
        database: 'analytics',
        username: 'analyst',
        options: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    const onToast = vi.fn();
    render(
      <MemoryRouter>
        <ConnectionsPage onToast={onToast} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(apiMocks.fetchSourceConnections).toHaveBeenCalled());

    expect(screen.getByLabelText('Port')).toHaveClass('form-input');
    expect(screen.getByLabelText('Password')).toHaveClass('form-input');

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));

    const editDialog = await screen.findByRole('dialog');
    expect(within(editDialog).getByLabelText('Port')).toHaveClass('form-input');
    expect(within(editDialog).getByLabelText('Password')).toHaveClass('form-input');
  });
});
