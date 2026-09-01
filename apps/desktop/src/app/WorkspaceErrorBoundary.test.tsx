import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceErrorBoundary } from './WorkspaceErrorBoundary';

afterEach(() => vi.restoreAllMocks());

function BrokenWorkspace(): never {
  throw new Error('render failed');
}

describe('WorkspaceErrorBoundary', () => {
  it('retries the workspace without discarding the surrounding session', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let shouldThrow = true;
    function FlakyWorkspace() {
      if (shouldThrow) throw new Error('render failed once');
      return <p>Editor restored</p>;
    }

    render(
      <WorkspaceErrorBoundary
        disabled={false}
        onReturn={vi.fn()}
        onSaveAs={vi.fn()}
      >
        <FlakyWorkspace />
      </WorkspaceErrorBoundary>,
    );
    expect(
      screen.getByRole('heading', { name: /project view ran into a problem/i }),
    ).toBeInTheDocument();

    shouldThrow = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByText('Editor restored')).toBeInTheDocument();
  });

  it('offers Save As and return recovery actions', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onSaveAs = vi.fn();
    const onReturn = vi.fn();
    render(
      <WorkspaceErrorBoundary
        disabled={false}
        onReturn={onReturn}
        onSaveAs={onSaveAs}
      >
        <BrokenWorkspace />
      </WorkspaceErrorBoundary>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save As' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Return to projects' }),
    );
    expect(onSaveAs).toHaveBeenCalledOnce();
    expect(onReturn).toHaveBeenCalledOnce();
  });
});
