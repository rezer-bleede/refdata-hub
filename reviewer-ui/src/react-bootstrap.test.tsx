import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Form, Table } from './react-bootstrap';

describe('react-bootstrap shim', () => {
  it('links labels and controls within Form.Group via controlId', () => {
    render(
      <Form>
        <Form.Group controlId="test-email">
          <Form.Label>Email address</Form.Label>
          <Form.Control type="email" placeholder="name@example.com" />
        </Form.Group>
      </Form>,
    );

    const input = screen.getByLabelText('Email address');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('id', 'test-email');
  });

  it('applies table utility classes and responsive wrapper', () => {
    render(
      <Table bordered hover responsive size="sm" data-testid="shim-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>foo</td>
            <td>bar</td>
          </tr>
        </tbody>
      </Table>,
    );

    const table = screen.getByTestId('shim-table');
    expect(table).toHaveClass('data-table', 'table-bordered', 'table-hover', 'table-sm');
    expect(table.parentElement).toHaveClass('table-responsive');
  });

  it('renders textarea controls with rows and change handlers', () => {
    const handleChange = vi.fn();
    render(
      <Form>
        <Form.Group controlId="notes">
          <Form.Label>Notes</Form.Label>
          <Form.Control as="textarea" rows={4} placeholder="Add notes" onChange={handleChange} />
        </Form.Group>
      </Form>,
    );

    const textarea = screen.getByLabelText('Notes');
    expect(textarea).toHaveAttribute('rows', '4');
    fireEvent.change(textarea, { target: { value: 'Updated notes' } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });
});
