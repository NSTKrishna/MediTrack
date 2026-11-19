import { render, screen, userEvent } from '@testing-library/react-native';
import { StateView } from '@/src/components/feedback/StateView';

describe('StateView', () => {
  it('announces errors and offers a retry', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    await render(<StateView kind="error" message="Network unavailable" onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Network unavailable/);
    await user.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders empty and loading states', async () => {
    await render(<StateView kind="empty" title="No medicines yet" message="Add one." />);
    expect(screen.getByText('No medicines yet')).toBeOnTheScreen();
    await render(<StateView kind="loading" message="Loading…" />);
    expect(screen.getByText('Loading…')).toBeOnTheScreen();
  });
});
