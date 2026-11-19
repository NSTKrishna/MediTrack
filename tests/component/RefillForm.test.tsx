import { render, screen, userEvent } from '@testing-library/react-native';
import { RefillForm } from '@/src/features/inventory/RefillForm';

describe('RefillForm', () => {
  it('submits the entered amount', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(
      <RefillForm
        medicineName="Metformin"
        onSubmit={onSubmit}
        createOperationId={() => 'refill_op1'}
      />,
    );
    await user.type(screen.getByLabelText('Refill amount for Metformin'), '45');
    await user.press(screen.getByRole('button', { name: 'Add stock' }));
    expect(onSubmit).toHaveBeenCalledWith(45, 'refill_op1');
    expect(await screen.findByText('Added 45 doses.')).toBeOnTheScreen();
  });

  it('shows a validation error and does not submit invalid amounts', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    await render(
      <RefillForm
        medicineName="Metformin"
        onSubmit={onSubmit}
        createOperationId={() => 'refill_op1'}
      />,
    );
    await user.type(screen.getByLabelText('Refill amount for Metformin'), '2.5');
    await user.press(screen.getByRole('button', { name: 'Add stock' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a whole number of doses.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('reuses the operation ID when retrying a failed refill', async () => {
    const user = userEvent.setup();
    const onSubmit = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(undefined);
    let counter = 0;
    await render(
      <RefillForm
        medicineName="Metformin"
        onSubmit={onSubmit}
        createOperationId={() => `refill_op${(counter += 1)}`}
      />,
    );
    await user.type(screen.getByLabelText('Refill amount for Metformin'), '30');
    await user.press(screen.getByRole('button', { name: 'Add stock' }));
    expect(await screen.findByText('Network unavailable')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Add stock' }));
    expect(onSubmit.mock.calls.map((call) => call[1])).toEqual(['refill_op1', 'refill_op1']);
    // After success, the next refill is a new operation.
    await user.type(screen.getByLabelText('Refill amount for Metformin'), '5');
    await user.press(screen.getByRole('button', { name: 'Add stock' }));
    expect(onSubmit.mock.calls[2]?.[1]).toBe('refill_op2');
  });
});
