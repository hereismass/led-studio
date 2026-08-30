import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChoiceMenu } from './ChoiceMenu';

describe('ChoiceMenu', () => {
  it('selects an option with the pointer', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChoiceMenu
        ariaLabel="Add layer"
        options={[{ label: 'Keyframes', value: 'keyframe' }]}
        value={null}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add layer' }));
    await user.click(screen.getByRole('option', { name: 'Keyframes' }));
    expect(onChange).toHaveBeenCalledWith('keyframe');
    expect(screen.queryByRole('listbox', { name: 'Add layer' })).toBeNull();
  });

  it('supports arrow navigation, selection, Escape, and focus restoration', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChoiceMenu
        ariaLabel="Target"
        options={[
          { group: 'Built in', label: 'All LEDs', value: 'all' },
          { group: 'Built in', label: 'E-side LEDs', value: 'e-side' },
          { disabled: true, label: 'Unavailable', value: 'disabled' },
        ]}
        value="e-side"
        onChange={onChange}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Target' });
    await user.click(trigger);
    const selected = screen.getByRole('option', { name: 'E-side LEDs' });
    await waitFor(() => expect(selected).toHaveFocus());
    fireEvent.keyDown(selected, { key: 'ArrowUp' });
    const all = screen.getByRole('option', { name: 'All LEDs' });
    expect(all).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('all');
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'E-side LEDs' })).toHaveFocus(),
    );
    fireEvent.keyDown(screen.getByRole('option', { name: 'E-side LEDs' }), {
      key: 'Escape',
    });
    expect(screen.queryByRole('listbox', { name: 'Target' })).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
