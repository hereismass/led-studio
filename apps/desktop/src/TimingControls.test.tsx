import type { ProjectTiming } from '@led-studio/project-format';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TimingControls } from './TimingControls';

const timing: ProjectTiming = {
  previewBpm: 120,
  timeSignature: { denominator: 4, numerator: 4 },
};

describe('TimingControls', () => {
  it('allows empty drafts and commits valid values on Enter or blur', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<TimingControls timing={timing} onCommit={onCommit} />);
    const bpm = screen.getByRole('spinbutton', { name: 'Preview BPM' });
    const numerator = screen.getByRole('spinbutton', {
      name: 'Time signature numerator',
    });

    await user.clear(bpm);
    expect(bpm).toHaveValue(null);
    expect(onCommit).not.toHaveBeenCalled();
    await user.type(bpm, '96{Enter}');
    expect(onCommit).toHaveBeenCalledWith({ previewBpm: 96 });

    await user.clear(numerator);
    await user.type(numerator, '6');
    fireEvent.blur(numerator);
    expect(onCommit).toHaveBeenCalledWith({
      timeSignature: { denominator: 4, numerator: 6 },
    });
  });

  it.each(['', '19', '301', '120.5'])(
    'reverts invalid BPM draft %j without committing',
    (value) => {
      const onCommit = vi.fn();
      render(<TimingControls timing={timing} onCommit={onCommit} />);
      const bpm = screen.getByRole('spinbutton', { name: 'Preview BPM' });

      fireEvent.change(bpm, { target: { value } });
      fireEvent.blur(bpm);

      expect(bpm).toHaveValue(120);
      expect(onCommit).not.toHaveBeenCalled();
    },
  );

  it('reverts invalid numerator drafts without committing', () => {
    const onCommit = vi.fn();
    render(<TimingControls timing={timing} onCommit={onCommit} />);
    const numerator = screen.getByRole('spinbutton', {
      name: 'Time signature numerator',
    });

    fireEvent.change(numerator, { target: { value: '33' } });
    fireEvent.blur(numerator);

    expect(numerator).toHaveValue(4);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('reverts with Escape and synchronizes external timing changes', () => {
    const onCommit = vi.fn();
    const view = render(<TimingControls timing={timing} onCommit={onCommit} />);
    const bpm = screen.getByRole('spinbutton', { name: 'Preview BPM' });

    fireEvent.change(bpm, { target: { value: '96' } });
    fireEvent.keyDown(bpm, { key: 'Escape' });
    expect(bpm).toHaveValue(120);
    expect(onCommit).not.toHaveBeenCalled();

    view.rerender(
      <TimingControls
        timing={{ ...timing, previewBpm: 88 }}
        onCommit={onCommit}
      />,
    );
    expect(bpm).toHaveValue(88);
  });

  it('commits denominator selections immediately', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<TimingControls timing={timing} onCommit={onCommit} />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Time signature denominator' }),
      '8',
    );

    expect(onCommit).toHaveBeenCalledWith({
      timeSignature: { denominator: 8, numerator: 4 },
    });
  });
});
