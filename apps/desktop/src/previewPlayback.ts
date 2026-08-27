import {
  advanceLoopPosition,
  normalizeLoopPosition,
} from '@led-studio/playback';

export type PreviewPlaybackStatus = 'paused' | 'playing' | 'stopped';

export interface PreviewPlaybackSnapshot {
  positionBeats: number;
  status: PreviewPlaybackStatus;
}

export interface PreviewPlaybackConfiguration {
  beatsPerMinute: number;
  loopLengthBeats: number;
  sceneId: string | null;
}

interface PreviewPlaybackEnvironment {
  cancelFrame: (handle: number) => void;
  now: () => number;
  requestFrame: (callback: FrameRequestCallback) => number;
}

const initialSnapshot: PreviewPlaybackSnapshot = {
  positionBeats: 0,
  status: 'stopped',
};

export class PreviewPlaybackController {
  private beatsPerMinute = 120;
  private disposed = false;
  private frameHandle: number | null = null;
  private lastTimestamp: number | null = null;
  private listeners = new Set<() => void>();
  private loopLengthBeats = 4;
  private sceneId: string | null = null;
  private snapshot = initialSnapshot;

  constructor(
    private readonly environment: PreviewPlaybackEnvironment = {
      cancelFrame: (handle) => cancelAnimationFrame(handle),
      now: () => performance.now(),
      requestFrame: (callback) => requestAnimationFrame(callback),
    },
  ) {}

  readonly getSnapshot = (): PreviewPlaybackSnapshot => this.snapshot;

  readonly getPositionSnapshot = (): number => this.snapshot.positionBeats;

  readonly getStatusSnapshot = (): PreviewPlaybackStatus =>
    this.snapshot.status;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  configure({
    beatsPerMinute,
    loopLengthBeats,
    sceneId,
  }: PreviewPlaybackConfiguration): void {
    if (this.disposed) return;
    const sceneChanged = sceneId !== this.sceneId;
    if (sceneChanged || sceneId === null) {
      this.sceneId = sceneId;
      this.beatsPerMinute = beatsPerMinute;
      this.loopLengthBeats = loopLengthBeats;
      this.stop();
      return;
    }

    const now = this.environment.now();
    const position =
      this.snapshot.status === 'playing'
        ? this.positionAt(now)
        : this.snapshot.positionBeats;
    const loopChanged = loopLengthBeats !== this.loopLengthBeats;
    this.beatsPerMinute = beatsPerMinute;
    this.loopLengthBeats = loopLengthBeats;
    this.lastTimestamp = this.snapshot.status === 'playing' ? now : null;
    if (loopChanged) {
      this.update({
        ...this.snapshot,
        positionBeats: normalizeLoopPosition(position, loopLengthBeats),
      });
    } else if (position !== this.snapshot.positionBeats) {
      this.update({ ...this.snapshot, positionBeats: position });
    }
  }

  play(): void {
    if (
      this.disposed ||
      this.sceneId === null ||
      this.snapshot.status === 'playing'
    )
      return;
    const positionBeats =
      this.snapshot.positionBeats >= this.loopLengthBeats
        ? 0
        : this.snapshot.positionBeats;
    this.lastTimestamp = this.environment.now();
    this.update({ positionBeats, status: 'playing' });
    this.scheduleFrame();
  }

  pause(): void {
    if (this.disposed || this.snapshot.status !== 'playing') return;
    const positionBeats = this.positionAt(this.environment.now());
    this.cancelScheduledFrame();
    this.lastTimestamp = null;
    this.update({ positionBeats, status: 'paused' });
  }

  toggle(): void {
    if (this.snapshot.status === 'playing') this.pause();
    else this.play();
  }

  stop(): void {
    if (this.disposed) return;
    this.cancelScheduledFrame();
    this.lastTimestamp = null;
    this.update(initialSnapshot);
  }

  seek(positionBeats: number): void {
    if (this.disposed || this.sceneId === null) return;
    const nextPosition = Math.min(
      this.loopLengthBeats,
      Math.max(0, positionBeats),
    );
    const status =
      this.snapshot.status === 'stopped' ? 'paused' : this.snapshot.status;
    if (status === 'playing') this.lastTimestamp = this.environment.now();
    this.update({ positionBeats: nextPosition, status });
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancelScheduledFrame();
    this.listeners.clear();
    this.disposed = true;
  }

  private positionAt(timestamp: number): number {
    if (this.lastTimestamp === null) return this.snapshot.positionBeats;
    return advanceLoopPosition(
      this.snapshot.positionBeats,
      Math.max(0, timestamp - this.lastTimestamp),
      this.beatsPerMinute,
      this.loopLengthBeats,
    );
  }

  private scheduleFrame(): void {
    if (this.frameHandle !== null || this.snapshot.status !== 'playing') return;
    this.frameHandle = this.environment.requestFrame((timestamp) => {
      this.frameHandle = null;
      if (this.snapshot.status !== 'playing' || this.disposed) return;
      const positionBeats = this.positionAt(timestamp);
      this.lastTimestamp = timestamp;
      this.update({ positionBeats, status: 'playing' });
      this.scheduleFrame();
    });
  }

  private cancelScheduledFrame(): void {
    if (this.frameHandle === null) return;
    this.environment.cancelFrame(this.frameHandle);
    this.frameHandle = null;
  }

  private update(snapshot: PreviewPlaybackSnapshot): void {
    if (
      snapshot.positionBeats === this.snapshot.positionBeats &&
      snapshot.status === this.snapshot.status
    )
      return;
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
}
