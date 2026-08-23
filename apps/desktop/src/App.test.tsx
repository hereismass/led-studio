import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import type { AppLifecycleGateway } from './appLifecycle';
import { projectExamples } from './examples';
import type {
  ProjectStorageGateway,
  UnsavedChangesGateway,
} from './projectFiles';

const loadedProject = {
  schemaVersion: 1,
  name: 'Loaded Lighting Show',
  hardwareProfile: 'test-controller-v1',
  palette: { blue: '#1248FF' },
};

function openedProjectFile() {
  return {
    contents: JSON.stringify(loadedProject),
    fileName: 'loaded-project.ledstudio',
    handle: 'project-file-1',
  };
}

function createProjectStorage(
  overrides: Partial<ProjectStorageGateway> = {},
): ProjectStorageGateway {
  return {
    openProject: vi.fn().mockResolvedValue(null),
    saveProject: vi.fn().mockResolvedValue(undefined),
    saveProjectAs: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function createUnsavedChanges(
  decision: 'cancel' | 'discard' | 'save' = 'cancel',
): UnsavedChangesGateway {
  return {
    confirmUnsavedChanges: vi.fn().mockResolvedValue(decision),
  };
}

interface TestLifecycle extends AppLifecycleGateway {
  triggerExitRequest(): void;
}

function createAppLifecycle(): TestLifecycle {
  let exitRequestHandler = () => {};

  return {
    exitApp: vi.fn().mockResolvedValue(undefined),
    onExitRequested: vi.fn().mockImplementation(async (handler: () => void) => {
      exitRequestHandler = handler;
      return vi.fn();
    }),
    triggerExitRequest() {
      exitRequestHandler();
    },
  };
}

function renderApp({
  appLifecycle = createAppLifecycle(),
  projectStorage = createProjectStorage(),
  unsavedChanges = createUnsavedChanges(),
}: {
  appLifecycle?: TestLifecycle;
  projectStorage?: ProjectStorageGateway;
  unsavedChanges?: UnsavedChangesGateway;
} = {}) {
  render(
    <App
      appLifecycle={appLifecycle}
      projectStorage={projectStorage}
      unsavedChanges={unsavedChanges}
    />,
  );
  return { appLifecycle, projectStorage, unsavedChanges };
}

describe('App project launcher and lifecycle', () => {
  it('offers new, open, and example project choices at startup', () => {
    renderApp();

    expect(
      screen.getByRole('button', { name: /new project/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /open project/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /KMS 4-String Bass Example/i }),
    ).toBeInTheDocument();
  });

  it('creates an unsaved project with an empty palette', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /new project/i }));

    expect(
      screen.getByRole('heading', { name: 'Untitled Project', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Unsaved new project')).toBeInTheDocument();
    expect(screen.getByText('Unsaved')).toBeInTheDocument();
    expect(screen.getByText('No palette colours yet')).toBeInTheDocument();
  });

  it('loads an example as an unsaved template and saves it through Save As', async () => {
    const user = userEvent.setup();
    const exampleBeforeSave = structuredClone(projectExamples[0].project);
    const projectStorage = createProjectStorage({
      saveProjectAs: vi.fn().mockResolvedValue({
        fileName: 'bass-example.ledstudio',
        handle: 'project-file-2',
      }),
    });
    renderApp({ projectStorage });

    await user.click(
      screen.getByRole('button', { name: /KMS 4-String Bass Example/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(projectStorage.saveProjectAs).toHaveBeenCalledWith(
      'KMS 4-String Bass Example',
      expect.any(String),
    );
    expect(projectStorage.saveProject).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Saved bass-example.ledstudio.'),
    ).toBeVisible();
    expect(
      screen.getByText('Local file · bass-example.ledstudio'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Unsaved')).not.toBeInTheDocument();
    expect(projectExamples[0].project).toEqual(exampleBeforeSave);
  });

  it('saves an opened project through its retained opaque handle', async () => {
    const user = userEvent.setup();
    const projectStorage = createProjectStorage({
      openProject: vi.fn().mockResolvedValue(openedProjectFile()),
    });
    renderApp({ projectStorage });

    await user.click(screen.getByRole('button', { name: /open project/i }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(projectStorage.saveProject).toHaveBeenCalledWith(
      { fileName: 'loaded-project.ledstudio', handle: 'project-file-1' },
      `${JSON.stringify(loadedProject, null, 2)}\n`,
    );
    expect(
      await screen.findByText('Saved loaded-project.ledstudio.'),
    ).toBeVisible();
  });

  it('uses Save As to replace the active file handle', async () => {
    const user = userEvent.setup();
    const copiedFile = {
      fileName: 'copied-show.ledstudio',
      handle: 'project-file-2',
    };
    const projectStorage = createProjectStorage({
      openProject: vi.fn().mockResolvedValue(openedProjectFile()),
      saveProjectAs: vi.fn().mockResolvedValue(copiedFile),
    });
    renderApp({ projectStorage });

    await user.click(screen.getByRole('button', { name: /open project/i }));
    await user.click(screen.getByRole('button', { name: 'Save As' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(projectStorage.saveProject).toHaveBeenCalledWith(
      copiedFile,
      expect.any(String),
    );
  });

  it('prevents overlapping save shortcuts synchronously', async () => {
    let finishSave = () => {};
    const projectStorage = createProjectStorage({
      openProject: vi.fn().mockResolvedValue(openedProjectFile()),
      saveProject: vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishSave = resolve;
          }),
      ),
    });
    const user = userEvent.setup();
    renderApp({ projectStorage });

    await user.click(screen.getByRole('button', { name: /open project/i }));
    fireEvent.keyDown(window, { key: 's', metaKey: true });
    fireEvent.keyDown(window, { key: 's', metaKey: true });

    expect(projectStorage.saveProject).toHaveBeenCalledOnce();

    await act(async () => finishSave());
    expect(
      await screen.findByText('Saved loaded-project.ledstudio.'),
    ).toBeVisible();
  });

  it('defers quitting while a save operation is still running', async () => {
    let finishSave = () => {};
    const appLifecycle = createAppLifecycle();
    const projectStorage = createProjectStorage({
      openProject: vi.fn().mockResolvedValue(openedProjectFile()),
      saveProject: vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishSave = resolve;
          }),
      ),
    });
    const user = userEvent.setup();
    renderApp({ appLifecycle, projectStorage });

    await user.click(screen.getByRole('button', { name: /open project/i }));
    await waitFor(() =>
      expect(appLifecycle.onExitRequested).toHaveBeenCalledOnce(),
    );
    fireEvent.keyDown(window, { key: 's', metaKey: true });
    act(() => appLifecycle.triggerExitRequest());

    expect(appLifecycle.exitApp).not.toHaveBeenCalled();

    await act(async () => finishSave());
    await screen.findByText('Saved loaded-project.ledstudio.');
    act(() => appLifecycle.triggerExitRequest());

    await waitFor(() => expect(appLifecycle.exitApp).toHaveBeenCalledOnce());
  });

  it('keeps an unsaved project unchanged when Save As is cancelled', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /new project/i }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Unsaved new project')).toBeInTheDocument();
    expect(screen.getByText('Unsaved')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('reports save failures and preserves the unsaved project', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    const projectStorage = createProjectStorage({
      saveProjectAs: vi.fn().mockRejectedValue(new Error('Disk unavailable')),
    });
    renderApp({ projectStorage });

    await user.click(screen.getByRole('button', { name: /new project/i }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'LED Studio could not save this project.',
    );
    expect(screen.getByText('Unsaved')).toBeInTheDocument();
  });

  it('returns immediately from a clean opened project', async () => {
    const user = userEvent.setup();
    const unsavedChanges = createUnsavedChanges();
    const projectStorage = createProjectStorage({
      openProject: vi.fn().mockResolvedValue(openedProjectFile()),
    });
    renderApp({ projectStorage, unsavedChanges });

    await user.click(screen.getByRole('button', { name: /open project/i }));
    await user.click(
      screen.getByRole('button', { name: /choose another project/i }),
    );

    expect(unsavedChanges.confirmUnsavedChanges).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /new project/i }),
    ).toBeInTheDocument();
  });

  it('saves an unsaved project before returning to the launcher', async () => {
    const user = userEvent.setup();
    const unsavedChanges = createUnsavedChanges('save');
    const projectStorage = createProjectStorage({
      saveProjectAs: vi.fn().mockResolvedValue({
        fileName: 'untitled-project.ledstudio',
        handle: 'project-file-2',
      }),
    });
    renderApp({ projectStorage, unsavedChanges });

    await user.click(screen.getByRole('button', { name: /new project/i }));
    await user.click(
      screen.getByRole('button', { name: /choose another project/i }),
    );

    expect(projectStorage.saveProjectAs).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole('button', { name: /new project/i }),
    ).toBeInTheDocument();
  });

  it('cancels quitting when an unsaved project is kept open', async () => {
    const user = userEvent.setup();
    const appLifecycle = createAppLifecycle();
    const unsavedChanges = createUnsavedChanges('cancel');
    renderApp({ appLifecycle, unsavedChanges });

    await user.click(screen.getByRole('button', { name: /new project/i }));
    await waitFor(() =>
      expect(appLifecycle.onExitRequested).toHaveBeenCalledOnce(),
    );
    act(() => appLifecycle.triggerExitRequest());

    await waitFor(() =>
      expect(unsavedChanges.confirmUnsavedChanges).toHaveBeenCalledWith(
        'Untitled Project',
        'quit',
      ),
    );
    expect(appLifecycle.exitApp).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: 'Untitled Project' }),
    ).toBeInTheDocument();
  });

  it('discards an unsaved project before an approved quit', async () => {
    const user = userEvent.setup();
    const appLifecycle = createAppLifecycle();
    renderApp({
      appLifecycle,
      unsavedChanges: createUnsavedChanges('discard'),
    });

    await user.click(screen.getByRole('button', { name: /new project/i }));
    await waitFor(() =>
      expect(appLifecycle.onExitRequested).toHaveBeenCalledOnce(),
    );
    act(() => appLifecycle.triggerExitRequest());

    await waitFor(() => expect(appLifecycle.exitApp).toHaveBeenCalledOnce());
  });

  it('reports malformed and invalid project files without leaving the launcher', async () => {
    const user = userEvent.setup();
    const projectStorage = createProjectStorage({
      openProject: vi
        .fn()
        .mockResolvedValueOnce({
          contents: '{',
          fileName: 'broken.ledstudio',
          handle: 'project-file-1',
        })
        .mockResolvedValueOnce({
          contents: '{"schemaVersion":1}',
          fileName: 'invalid.ledstudio',
          handle: 'project-file-2',
        }),
    });
    renderApp({ projectStorage });

    await user.click(screen.getByRole('button', { name: /open project/i }));
    let alert = await screen.findByRole('alert');
    expect(
      within(alert).getByText('This file is not valid JSON.'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: /open project/i }));
    alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'This is not a valid LED Studio project. name:',
    );
  });
});
