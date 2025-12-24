import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button, Table } from './ui';

describe('ui components', () => {
  it('renders primary buttons with base styling', () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('neon-button');
  });

  it('adds table modifiers and wraps responsive tables', () => {
    const { container } = render(
      <Table bordered striped hover responsive size="sm">
        <thead>
          <tr>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Row</td>
          </tr>
        </tbody>
      </Table>,
    );

    const table = container.querySelector('table');
    expect(table).toHaveClass('data-table', 'data-table--bordered', 'data-table--striped', 'data-table--hover', 'data-table--compact');
    expect(table?.parentElement).toHaveClass('overflow-x-auto');
  });
});
