import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock, listenMock, unlistenMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  listenMock: vi.fn(),
  unlistenMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));
vi.mock('@tauri-apps/api/event', () => ({ listen: listenMock }));

import { exitApp, onExitRequested } from './appLifecycle';

describe('application lifecycle adapter', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
    unlistenMock.mockReset();
  });

  it('registers the native listener after subscribing to exit requests', async () => {
    const handler = vi.fn();
    listenMock.mockResolvedValue(unlistenMock);
    invokeMock.mockResolvedValue(undefined);

    const cleanup = await onExitRequested(handler);

    expect(listenMock).toHaveBeenCalledWith(
      'led-studio://exit-requested',
      handler,
    );
    expect(invokeMock).toHaveBeenCalledWith('register_exit_listener');

    cleanup();
    expect(unlistenMock).toHaveBeenCalledOnce();
    expect(invokeMock).toHaveBeenCalledWith('unregister_exit_listener');
  });

  it('removes the event listener when native registration fails', async () => {
    listenMock.mockResolvedValue(unlistenMock);
    invokeMock.mockRejectedValue(new Error('Registration failed'));

    await expect(onExitRequested(vi.fn())).rejects.toThrow(
      'Registration failed',
    );
    expect(unlistenMock).toHaveBeenCalledOnce();
  });

  it('requests an approved native exit', async () => {
    invokeMock.mockResolvedValue(undefined);

    await exitApp();

    expect(invokeMock).toHaveBeenCalledWith('exit_app');
  });
});
