export interface AppLifecycleGateway {
  exitApp(): Promise<void>;
  onExitRequested(handler: () => void): Promise<() => void>;
}
