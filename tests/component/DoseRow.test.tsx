import { render, screen, userEvent } from '@testing-library/react-native';
import { DoseRow } from '@/src/components/cards/DoseRow';
import type { ScheduledDose } from '@/src/features/doses/today';
import type { Medicine } from '@/src/types/medicine';

const medicine: Medicine = {
  id: 'm1',
  userId: 'u1',
  name: 'Metformin',
  category: '',
  dosage: '850',
  dosageUnit: 'mg',
  frequency: 'once-daily',
  scheduledTimes: ['8:00 AM'],
  selectedWeekdays: [],
  startDate: '2026-11-01',
  endDate: null,
  schedule: '8:00 AM',
  stockQuantity: 30,
  remainingStock: 30,
  lowStockThreshold: 5,
  instructions: 'With food',
  active: true,
  color: '#fff',
};

const item = (state: ScheduledDose['state']): ScheduledDose => ({
  doseId: 'm1_x',
  medicine,
  scheduledFor: new Date(2026, 10, 18, 8, 0),
  state,
});

describe('DoseRow', () => {
  it('offers Taken and Skip for a due dose', async () => {
    const user = userEvent.setup();
    const onRecord = jest.fn();
    await render(<DoseRow item={item('overdue')} onRecord={onRecord} />);
    expect(screen.getByText('Due now')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Taken' }));
    await user.press(screen.getByRole('button', { name: 'Skip' }));
    expect(onRecord.mock.calls).toEqual([['taken'], ['skipped']]);
  });

  it('offers no actions once taken, and disables while saving', async () => {
    await render(<DoseRow item={item('taken')} onRecord={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Taken' })).not.toBeOnTheScreen();
    await render(<DoseRow item={item('due')} onRecord={jest.fn()} busy />);
    expect(screen.getByRole('button', { name: 'Skip' })).toBeDisabled();
  });

  it('lets a skipped dose be corrected to taken', async () => {
    await render(<DoseRow item={item('skipped')} onRecord={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Taken' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeOnTheScreen();
  });
});
