import { describe, expect, it, vi } from 'vitest';
import { PreviewPlaybackController } from './previewPlayback';

function createEnvironment() {
  let now = 0;
  let nextHandle = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  const cancelFrame = vi.fn((handle: number) => callbacks.delete(handle));
  const requestFrame = vi.fn((callback: FrameRequestCallback) => {
    const handle = nextHandle;
    nextHandle += 1;
    callbacks.set(handle, callback);
    return handle;
  });
  return {
    cancelFrame,
    environment: {
      cancelFrame,
      now: () => now,
      requestFrame,
    },
    requestFrame,
    setNow(value: number) {
      now = value;
    },
    step(value: number) {
      now = value;
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback(value));
    },
  };
}

function configuredController() {
  const clock = createEnvironment();
  const controller = new PreviewPlaybackController(clock.environment);
  controller.configure({
    beatsPerMinute: 120,
    loopLengthBeats: 4,
    sceneId: 'scene-1',
  });
  return { clock, controller };
}

describe('PreviewPlaybackController', () => {
  it('plays, pauses, resumes, and stops without duplicate frame loops', () => {
    const { clock, controller } = configuredController();
    controller.play();
    controller.play();
    expect(controller.getSnapshot().status).toBe('playing');
    expect(clock.requestFrame).toHaveBeenCalledOnce();

    clock.step(500);
    expect(controller.getSnapshot().positionBeats).toBe(1);
    clock.setNow(750);
    controller.pause();
    expect(controller.getSnapshot()).toEqual({
      positionBeats: 1.5,
      status: 'paused',
    });

    controller.play();
    clock.step(1_250);
    expect(controller.getSnapshot().positionBeats).toBe(2.5);
    controller.stop();
    expect(controller.getSnapshot()).toEqual({
      positionBeats: 0,
      status: 'stopped',
    });
  });

  it('wraps playback and treats a stopped seek as paused', () => {
    const { clock, controller } = configuredController();
    controller.seek(3.75);
    expect(controller.getSnapshot()).toEqual({
      positionBeats: 3.75,
      status: 'paused',
    });
    controller.play();
    clock.step(250);
    expect(controller.getSnapshot().positionBeats).toBe(0.25);

    controller.pause();
    controller.seek(99);
    expect(controller.getSnapshot().positionBeats).toBe(4);
    controller.play();
    expect(controller.getSnapshot().positionBeats).toBe(0);
  });

  it('preserves phase across tempo changes and normalizes shorter loops', () => {
    const { clock, controller } = configuredController();
    controller.play();
    clock.setNow(500);
    controller.configure({
      beatsPerMinute: 60,
      loopLengthBeats: 4,
      sceneId: 'scene-1',
    });
    expect(controller.getSnapshot().positionBeats).toBe(1);

    clock.step(1_000);
    expect(controller.getSnapshot().positionBeats).toBe(1.5);
    controller.configure({
      beatsPerMinute: 60,
      loopLengthBeats: 1,
      sceneId: 'scene-1',
    });
    expect(controller.getSnapshot().positionBeats).toBe(0.5);
  });

  it('stops on scene changes and cancels work when disposed', () => {
    const { clock, controller } = configuredController();
    controller.play();
    clock.step(500);
    controller.configure({
      beatsPerMinute: 120,
      loopLengthBeats: 8,
      sceneId: 'scene-2',
    });
    expect(controller.getSnapshot()).toEqual({
      positionBeats: 0,
      status: 'stopped',
    });

    controller.play();
    controller.dispose();
    expect(clock.cancelFrame).toHaveBeenCalled();
  });
});
