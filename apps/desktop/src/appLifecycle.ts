import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

const EXIT_REQUESTED_EVENT = 'led-studio://exit-requested';

export interface AppLifecycleGateway {
  exitApp(): Promise<void>;
  onExitRequested(handler: () => void): Promise<UnlistenFn>;
}

export async function exitApp(): Promise<void> {
  await invoke('exit_app');
}

export async function onExitRequested(
  handler: () => void,
): Promise<UnlistenFn> {
  const unlisten = await listen(EXIT_REQUESTED_EVENT, handler);

  try {
    await invoke('register_exit_listener');
  } catch (error) {
    unlisten();
    throw error;
  }

  return () => {
    void invoke('unregister_exit_listener');
    unlisten();
  };
}

export const nativeAppLifecycleGateway: AppLifecycleGateway = {
  exitApp,
  onExitRequested,
};
