import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import type { AppLifecycleGateway } from './appLifecycle';
import { projectExamples } from './examples';
import type {
  ProjectStorageGateway,
  UnsavedChangesGateway,
} from './projectFiles';

const loadedProject = {
  schemaVersion: 2,
  name: 'Loaded Lighting Show',
  hardwareProfile: 'kms-4-string-10-led-v1',
  palette: [
    {
      id: 'd2c6fe14-65a2-4d79-bf65-aa47e76733de',
      name: 'Blue',
      value: '#1248FF',
    },
  ],
  scenes: [],
  sequence: [],
  groups: [],
};

afterEach(() => vi.unstubAllGlobals());

function stubAnimationFrames() {
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
}

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
  const view = render(
    <App
      appLifecycle={appLifecycle}
      projectStorage={projectStorage}
      unsavedChanges={unsavedChanges}
    />,
  );
  return { appLifecycle, projectStorage, unsavedChanges, ...view };
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

  it('creates an unsaved project with a default white palette token', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /new project/i }));

    expect(
      screen.getByRole('heading', { name: 'Untitled Project', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Unsaved new project')).toBeInTheDocument();
    expect(screen.getByText('Unsaved')).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /White.*#FFFFFF/i }),
    ).toBeInTheDocument();
  });

  it('edits the project name as one undoable command', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /new project/i }));
    await user.click(screen.getByRole('button', { name: 'Edit project name' }));
    const input = screen.getByRole('textbox', { name: 'Project name' });
    await user.clear(input);
    await user.type(input, 'Stage Show{Enter}');

    expect(
      screen.getByRole('heading', { name: 'Stage Show', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(
      screen.getByRole('heading', { name: 'Untitled Project', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled();
  });

  it('adds, edits, duplicates, deletes, and restores palette tokens', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /new project/i }));
    await user.click(screen.getByRole('button', { name: 'Add colour' }));

    expect(
      await screen.findByRole('option', { name: /New Colour.*#FFFFFF/i }),
    ).toHaveAttribute('aria-selected', 'true');
    const nameInput = screen.getByRole('textbox', { name: 'Display name' });
    await waitFor(() => expect(nameInput).toHaveFocus());
    await user.clear(nameInput);
    await user.type(nameInput, 'Ocean Blue{Enter}');

    const hexInput = screen.getByRole('textbox', { name: 'Hex colour' });
    await user.clear(hexInput);
    await user.type(hexInput, '#12abef{Enter}');
    expect(
      screen.getByRole('option', { name: /Ocean Blue.*#12ABEF/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Stable ID')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(
      await screen.findByRole('option', { name: /Ocean Blue Copy.*#12ABEF/i }),
    ).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(
      screen.queryByRole('option', { name: /Ocean Blue Copy/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(
      screen.getByRole('option', { name: /Ocean Blue Copy/i }),
    ).toBeInTheDocument();
  });

  it('keeps invalid palette drafts out of the project history', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(
      screen.getByRole('button', { name: /KMS 4-String Bass Example/i }),
    );
    await user.click(screen.getByRole('option', { name: /Black.*#000000/i }));
    const nameInput = screen.getByRole('textbox', { name: 'Display name' });
    await user.clear(nameInput);
    await user.type(nameInput, 'hot pink{Enter}');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Colour names must be unique',
    );
    expect(
      screen.getByRole('option', { name: /Black.*#000000/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('supports keyboard navigation through palette tokens', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(
      screen.getByRole('button', { name: /KMS 4-String Bass Example/i }),
    );
    const hotPink = screen.getByRole('option', { name: /Hot Pink/i });
    await user.click(hotPink);
    await user.keyboard('{ArrowDown}');

    const electricGreen = screen.getByRole('option', {
      name: /Electric Green/i,
    });
    expect(electricGreen).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(electricGreen).toHaveFocus());
  });

  it('starts with a lit default scene and manages additional scenes', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /new project/i }));
    expect(
      await screen.findByRole('option', { name: /Scene 1.*4 beats/i }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('option', { name: /Scene 1.*10 lit/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /Fret 21 G-side LED, address 0, #FFFFFF at 100%/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tabpanel', { name: 'Scene timeline' }),
    ).toHaveTextContent('Loop · 4 beats · 1 bar · 120 BPM · 4/4');
    expect(
      screen
        .getByRole('slider', { name: 'Scene preview position' })
        .closest('.scene-ruler'),
    ).toHaveStyle({ minWidth: '480px', width: '100%' });

    await user.click(screen.getByRole('button', { name: 'Add scene' }));
    expect(
      await screen.findByRole('option', { name: /Scene 2.*0 lit/i }),
    ).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(
      await screen.findByRole('option', { name: /Scene 2 Copy.*4 beats/i }),
    ).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(
      screen.queryByRole('option', { name: /Scene 2 Copy/i }),
    ).not.toBeInTheDocument();
  });

  it('selects profile groups and paints LEDs from the inspector', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(
      screen.getByRole('button', { name: /KMS 4-String Bass Example/i }),
    );
    await user.click(screen.getByRole('button', { name: /All LEDs.*10/i }));
    expect(
      screen.getByRole('heading', { name: '10 LEDs selected' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Apply Hot Pink' }));
    expect(
      screen.getByRole('button', {
        name: /Fret 21 G-side LED, address 0, #FF2B9A at 100%/i,
      }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Turn selected LEDs off' }),
    );
    expect(
      screen.getByRole('button', {
        name: /Fret 21 G-side LED, address 0, off/i,
      }),
    ).toBeInTheDocument();
  });

  it('edits project-wide preview timing', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /new project/i }));

    const bpm = screen.getByRole('spinbutton', { name: 'Preview BPM' });
    const numerator = screen.getByRole('spinbutton', {
      name: 'Time signature numerator',
    });

    await user.clear(bpm);
    expect(bpm).toHaveValue(null);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    await user.type(bpm, '96{Enter}');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    await user.clear(numerator);
    await user.type(numerator, '6');
    fireEvent.blur(numerator);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Time signature denominator' }),
      '8',
    );

    expect(screen.getByRole('spinbutton', { name: 'Preview BPM' })).toHaveValue(
      96,
    );
    expect(
      screen.getByRole('tabpanel', { name: 'Scene timeline' }),
    ).toHaveTextContent('96 BPM · 6/8');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(
      screen.getByRole('combobox', { name: 'Time signature denominator' }),
    ).toHaveValue('4');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(numerator).toHaveValue(4);
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(numerator).toHaveValue(6);
  });

  it('plays, pauses, seeks, and stops the active scene preview', async () => {
    stubAnimationFrames();
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /new project/i }));

    const stop = screen.getByRole('button', { name: 'Stop' });
    expect(stop).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(stop).toBeEnabled();

    const scrubber = screen.getByRole('slider', {
      name: 'Scene preview position',
    });
    fireEvent.change(scrubber, { target: { value: '2.5' } });
    expect(scrubber).toHaveValue('2.5');
    expect(
      screen.getByRole('tabpanel', { name: 'Scene timeline' }),
    ).toHaveTextContent('Position 2.5 / 4 beats · playing');

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    const pausedPosition = Number(scrubber.getAttribute('value'));
    fireEvent.keyDown(scrubber, { key: 'ArrowRight' });
    expect(Number(scrubber.getAttribute('value'))).toBeCloseTo(
      pausedPosition + 0.25,
    );
    fireEvent.keyDown(scrubber, { key: 'Home' });
    expect(scrubber).toHaveValue('0');
    await user.click(stop);
    expect(stop).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('supports Space playback, live edits, and scene-switch reset', async () => {
    stubAnimationFrames();
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /new project/i }));

    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /E-side LEDs.*5/i }));
    await user.click(
      screen.getByRole('button', { name: 'Turn selected LEDs off' }),
    );
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();

    const bpm = screen.getByRole('spinbutton', { name: 'Preview BPM' });
    fireEvent.keyDown(bpm, { code: 'Space', key: ' ' });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add scene' }));
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled();
    expect(
      screen.getByRole('slider', { name: 'Scene preview position' }),
    ).toHaveValue('0');
  });

  it('disables playback when an opened project has no scenes', async () => {
    const user = userEvent.setup();
    const projectStorage = createProjectStorage({
      openProject: vi.fn().mockResolvedValue(openedProjectFile()),
    });
    renderApp({ projectStorage });

    await user.click(screen.getByRole('button', { name: /open project/i }));

    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled();
    expect(
      screen.getByRole('tabpanel', { name: 'Scene timeline' }),
    ).toHaveTextContent('Create or select a scene to use preview playback.');
    expect(
      screen.queryByRole('slider', { name: 'Scene preview position' }),
    ).not.toBeInTheDocument();
  });

  it('opens a switchable editor workspace with collapsible panels', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: /new project/i }));

    expect(
      screen.getByRole('complementary', { name: 'Project assets' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('complementary', { name: 'Inspector' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: 'Show sequence' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Scene timeline')).toBeInTheDocument();

    const assetsResizer = screen.getByRole('separator', {
      name: 'Resize assets panel',
    });
    fireEvent.keyDown(assetsResizer, { key: 'ArrowRight' });
    expect(assetsResizer).toHaveAttribute('aria-valuenow', '244');

    expect(
      screen.getByRole('tabpanel', { name: 'Scene timeline' }),
    ).toHaveTextContent('Scene 1');

    await user.click(
      screen.getByRole('button', { name: 'Collapse assets panel' }),
    );
    expect(
      screen.getByRole('button', { name: 'Expand assets panel' }),
    ).toBeInTheDocument();
  });

  it('restores workspace panel preferences independently from a project', async () => {
    const user = userEvent.setup();
    const firstRender = renderApp();

    await user.click(screen.getByRole('button', { name: /new project/i }));
    await user.click(
      screen.getByRole('button', { name: 'Collapse inspector panel' }),
    );
    firstRender.unmount();

    renderApp();
    await user.click(screen.getByRole('button', { name: /new project/i }));

    expect(
      screen.getByRole('button', { name: 'Expand inspector panel' }),
    ).toBeInTheDocument();
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
      `${JSON.stringify(
        {
          ...loadedProject,
          timing: {
            previewBpm: 120,
            timeSignature: { denominator: 4, numerator: 4 },
          },
        },
        null,
        2,
      )}\n`,
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
          contents: '{"schemaVersion":2}',
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
