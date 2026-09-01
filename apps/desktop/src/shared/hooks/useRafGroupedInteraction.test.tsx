import { fireEvent, render, screen } from '@testing-library/react';
import type { ExecuteEditorCommandOptions } from '@led-studio/editor-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRafGroupedInteraction } from './useRafGroupedInteraction';

afterEach(() => vi.unstubAllGlobals());

function Harness({
  onCommit,
}: {
  onCommit: (value: number, options: ExecuteEditorCommandOptions) => void;
}) {
  const interaction = useRafGroupedInteraction<number>(onCommit);
  return (
    <input
      aria-label="Value"
      type="range"
      onChange={(event) => interaction.update(Number(event.target.value))}
      onPointerDown={interaction.begin}
      onPointerUp={interaction.end}
    />
  );
}

describe('useRafGroupedInteraction', () => {
  it('commits at most once per frame and shares one history group', () => {
    let nextHandle = 1;
    const callbacks = new Map<number, FrameRequestCallback>();
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        const handle = nextHandle++;
        callbacks.set(handle, callback);
        return handle;
      }),
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((handle: number) => callbacks.delete(handle)),
    );
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'interaction-1') });
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByRole('slider', { name: 'Value' });

    fireEvent.pointerDown(input);
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.change(input, { target: { value: '50' } });
    expect(onCommit).not.toHaveBeenCalled();
    const frame = [...callbacks.values()][0];
    callbacks.clear();
    frame(16);
    expect(onCommit).toHaveBeenCalledWith(50, {
      historyGroupId: 'interaction-1',
    });

    fireEvent.change(input, { target: { value: '75' } });
    fireEvent.pointerUp(input);
    expect(onCommit).toHaveBeenLastCalledWith(75, {
      historyGroupId: 'interaction-1',
    });
    expect(onCommit).toHaveBeenCalledTimes(2);
  });
});
