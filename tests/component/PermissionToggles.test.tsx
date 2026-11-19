import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PermissionToggles } from '@/src/features/caregivers/PermissionToggles';
import { noPermissions } from '@/src/features/caregivers/permissions';
import type { CarePermissions } from '@/src/types/caregiver';

function Harness({ onChange }: { onChange: (value: CarePermissions) => void }) {
  const [value, setValue] = useState(noPermissions);
  return (
    <PermissionToggles
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('PermissionToggles', () => {
  it('turns on prerequisites and turns off dependents', async () => {
    const onChange = jest.fn();
    // Switches change through onValueChange, not press events.
    const toggle = (name: string) =>
      fireEvent(
        screen.getByRole('switch', { name }),
        'valueChange',
        !screen.getByRole('switch', { name }).props.value,
      );
    await render(<Harness onChange={onChange} />);
    await toggle('Low-stock alerts');
    expect(screen.getByRole('switch', { name: 'Stock and refills' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Medicines and schedule' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Dose history' })).not.toBeChecked();

    await toggle('Medicines and schedule');
    expect(screen.getByRole('switch', { name: 'Low-stock alerts' })).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(noPermissions);
  });
});
