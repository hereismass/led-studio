import { kmsFourString10LedProfile } from '@led-studio/hardware-profiles';
import { evaluateSceneFrame } from '@led-studio/playback';
import type { Scene } from '@led-studio/project-format';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FretboardEditor } from './FretboardEditor';

const scene: Scene = {
  id: '6c21dc04-9a75-4f10-a7bb-9f17dc2fe32a',
  layers: [],
  ledStates: {},
  loopLengthBeats: 4,
  name: 'Test Scene',
};

function ControlledFretboard({
  onChange = () => undefined,
}: {
  onChange?: (ids: string[]) => void;
}) {
  const [selectedLedIds, setSelectedLedIds] = useState<string[]>([]);
  return (
    <FretboardEditor
      frame={evaluateSceneFrame(scene, [], kmsFourString10LedProfile, 0)}
      profile={kmsFourString10LedProfile}
      scene={scene}
      selectedLedIds={selectedLedIds}
      onSelectionChange={(ids) => {
        setSelectedLedIds(ids);
        onChange(ids);
      }}
    />
  );
}

describe('FretboardEditor selection', () => {
  it('supports click, Shift-click, and keyboard selection', () => {
    render(<ControlledFretboard />);
    const first = screen.getByRole('button', {
      name: /Fret 3 E-side LED.*off/i,
    });
    const second = screen.getByRole('button', {
      name: /Fret 5 E-side LED.*off/i,
    });

    fireEvent.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(second, { shiftKey: true });
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(second).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(first, { key: 'Enter' });
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(second).toHaveAttribute('aria-pressed', 'false');
  });

  it('selects LEDs intersected by a background marquee', () => {
    const onChange = vi.fn();
    const { container } = render(<ControlledFretboard onChange={onChange} />);
    const svg = screen.getByRole('group', { name: /fretboard/i });
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      bottom: 280,
      height: 280,
      left: 0,
      right: 1000,
      toJSON: () => ({}),
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
    });
    const surface = container.querySelector<SVGRectElement>(
      '.fretboard-selection-surface',
    )!;
    surface.setPointerCapture = vi.fn();

    fireEvent.pointerDown(surface, { clientX: 35, clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(surface, {
      clientX: 965,
      clientY: 225,
      pointerId: 1,
    });
    fireEvent.pointerUp(surface, { clientX: 965, clientY: 225, pointerId: 1 });

    expect(onChange).toHaveBeenLastCalledWith(
      kmsFourString10LedProfile.leds.map((led) => led.id),
    );
  });
});
