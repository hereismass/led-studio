import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Scene } from '@led-studio/project-format';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaybackControls } from './PlaybackControls';
import { useScenePreview } from './useScenePreview';

const scene: Scene = {
  id: '6c21dc04-9a75-4f10-a7bb-9f17dc2fe32a',
  layers: [],
  ledStates: {},
  loopLengthBeats: 4,
  name: 'Scene 1',
};

afterEach(() => vi.unstubAllGlobals());

function PreviewHarness() {
  const controller = useScenePreview(scene, 120);
  return <PlaybackControls controller={controller} disabled={false} />;
}

describe('useScenePreview', () => {
  it('remains usable after Strict Mode rehearses effect cleanup', async () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    render(
      <StrictMode>
        <PreviewHarness />
      </StrictMode>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled();
  });
});
