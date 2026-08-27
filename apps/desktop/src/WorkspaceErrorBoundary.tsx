import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';

interface WorkspaceErrorBoundaryProps {
  children: ReactNode;
  disabled: boolean;
  onReturn: () => void;
  onSaveAs: () => void;
}

interface WorkspaceErrorBoundaryState {
  attempt: number;
  error: Error | null;
}

export class WorkspaceErrorBoundary extends Component<
  WorkspaceErrorBoundaryProps,
  WorkspaceErrorBoundaryState
> {
  state: WorkspaceErrorBoundaryState = { attempt: 0, error: null };

  static getDerivedStateFromError(
    error: Error,
  ): Partial<WorkspaceErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('LED Studio workspace failed to render', error, info);
  }

  private retry = () => {
    this.setState(({ attempt }) => ({ attempt: attempt + 1, error: null }));
  };

  render() {
    if (this.state.error) {
      return (
        <main className="workspace-recovery" role="alert">
          <p className="workspace-eyebrow">Workspace error</p>
          <h1>This project view ran into a problem</h1>
          <p>
            Your project session is still available. Retry the editor, save a
            copy, or return to the project launcher.
          </p>
          <div className="workspace-recovery-actions">
            <button
              type="button"
              disabled={this.props.disabled}
              onClick={this.retry}
            >
              Retry
            </button>
            <button
              type="button"
              disabled={this.props.disabled}
              onClick={this.props.onSaveAs}
            >
              Save As
            </button>
            <button
              type="button"
              disabled={this.props.disabled}
              onClick={this.props.onReturn}
            >
              Return to projects
            </button>
          </div>
        </main>
      );
    }

    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}
