import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button, Table } from './ui';

describe('ui components', () => {
  it('renders primary buttons with the brand palette styling', () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveClass('rounded-xl');
    expect(button).toHaveClass('bg-brand-primary');
    expect(button).toHaveClass('text-brand-accent-contrast');
  });

  it('adds table modifiers and wraps tables in a widget card', () => {
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
    expect(table).toHaveClass('pi-table', 'pi-table--striped', 'pi-table--hover', 'pi-table--compact');

    const wrapper = table?.parentElement;
    expect(wrapper).toHaveClass('bg-widget-bg');
    expect(wrapper).toHaveClass('border-widget-border');
    expect(wrapper).toHaveClass('rounded-xl');
    expect(wrapper).toHaveClass('overflow-x-auto');
    expect(wrapper).toHaveClass('pi-table--bordered');
  });
});
