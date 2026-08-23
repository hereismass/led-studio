import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { projectExamples } from './examples';
import type { ProjectFileGateway } from './projectFiles';

const loadedProject = {
  schemaVersion: 1,
  name: 'Loaded Lighting Show',
  hardwareProfile: 'test-controller-v1',
  palette: {
    blue: '#1248FF',
  },
};

function createFileGateway(
  overrides: Partial<ProjectFileGateway> = {},
): ProjectFileGateway {
  return {
    confirmUnsavedProject: vi.fn().mockResolvedValue('cancel'),
    openProject: vi.fn().mockResolvedValue(null),
    saveProject: vi.fn().mockResolvedValue(undefined),
    saveProjectAs: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function openedProjectFile() {
  return {
    contents: JSON.stringify(loadedProject),
    fileName: 'loaded-project.ledstudio',
    path: '/projects/loaded-project.ledstudio',
  };
}

describe('App project launcher', () => {
  it('offers new, open, and example project choices at startup', () => {
    render(<App fileGateway={createFileGateway()} />);

    expect(
      screen.getByRole('button', { name: /new project/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /open project/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Examples' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /KMS 4-String Bass Example/i }),
    ).toBeInTheDocument();
  });

  it('creates an unsaved project with an empty palette', async () => {
    const user = userEvent.setup();
    render(<App fileGateway={createFileGateway()} />);

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
    const savedFile = {
      fileName: 'bass-example.ledstudio',
      path: '/projects/bass-example.ledstudio',
    };
    const fileGateway = createFileGateway({
      saveProjectAs: vi.fn().mockResolvedValue(savedFile),
    });
    render(<App fileGateway={fileGateway} />);

    await user.click(
      screen.getByRole('button', { name: /KMS 4-String Bass Example/i }),
    );

    expect(
      screen.getByText('Unsaved project · Based on bundled example'),
    ).toBeInTheDocument();
    expect(screen.getByText('hot-pink')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(fileGateway.saveProjectAs).toHaveBeenCalledWith(
      'KMS 4-String Bass Example',
      expect.any(String),
    );
    expect(fileGateway.saveProject).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Saved bass-example.ledstudio.'),
    ).toBeVisible();
    expect(
      screen.getByText('Local file · bass-example.ledstudio'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Unsaved')).not.toBeInTheDocument();
    expect(projectExamples[0].project).toEqual(exampleBeforeSave);

    const serialized = vi.mocked(fileGateway.saveProjectAs).mock.calls[0][1];
    expect(JSON.parse(serialized)).toEqual(exampleBeforeSave);
  });

  it('saves an opened project directly to its retained path', async () => {
    const user = userEvent.setup();
    const fileGateway = createFileGateway({
      openProject: vi.fn().mockResolvedValue(openedProjectFile()),
    });
    render(<App fileGateway={fileGateway} />);

    await user.click(screen.getByRole('button', { name: /open project/i }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(fileGateway.saveProject).toHaveBeenCalledWith(
      '/projects/loaded-project.ledstudio',
      `${JSON.stringify(loadedProject, null, 2)}\n`,
    );
    expect(fileGateway.saveProjectAs).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Saved loaded-project.ledstudio.'),
    ).toBeVisible();
  });

  it('uses Save As to replace the active file path', async () => {
    const user = userEvent.setup();
    const fileGateway = createFileGateway({
      openProject: vi.fn().mockResolvedValue(openedProjectFile()),
      saveProjectAs: vi.fn().mockResolvedValue({
        fileName: 'copied-show.ledstudio',
        path: '/copies/copied-show.ledstudio',
      }),
    });
    render(<App fileGateway={fileGateway} />);

    await user.click(screen.getByRole('button', { name: /open project/i }));
    await user.click(screen.getByRole('button', { name: 'Save As' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(fileGateway.saveProjectAs).toHaveBeenCalledOnce();
    expect(fileGateway.saveProject).toHaveBeenCalledWith(
      '/copies/copied-show.ledstudio',
      expect.any(String),
    );
    expect(
      screen.getByText('Local file · copied-show.ledstudio'),
    ).toBeInTheDocument();
  });

  it('supports Save and Save As keyboard shortcuts', async () => {
    const fileGateway = createFileGateway({
      openProject: vi.fn().mockResolvedValue(openedProjectFile()),
      saveProjectAs: vi.fn().mockResolvedValue({
        fileName: 'shortcut-copy.ledstudio',
        path: '/projects/shortcut-copy.ledstudio',
      }),
    });
    const user = userEvent.setup();
    render(<App fileGateway={fileGateway} />);

    await user.click(screen.getByRole('button', { name: /open project/i }));
    fireEvent.keyDown(window, { key: 's', metaKey: true });

    await waitFor(() => expect(fileGateway.saveProject).toHaveBeenCalledOnce());
    await screen.findByText('Saved loaded-project.ledstudio.');

    fireEvent.keyDown(window, { key: 's', metaKey: true, shiftKey: true });

    await waitFor(() =>
      expect(fileGateway.saveProjectAs).toHaveBeenCalledOnce(),
    );
  });

  it('keeps an unsaved project unchanged when Save As is cancelled', async () => {
    const user = userEvent.setup();
    const fileGateway = createFileGateway({
      saveProjectAs: vi.fn().mockResolvedValue(null),
    });
    render(<App fileGateway={fileGateway} />);

    await user.click(screen.getByRole('button', { name: /new project/i }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Unsaved new project')).toBeInTheDocument();
    expect(screen.getByText('Unsaved')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('reports save failures and preserves the unsaved project', async () => {
    const user = userEvent.setup();
    const fileGateway = createFileGateway({
      saveProjectAs: vi.fn().mockRejectedValue(new Error('Disk unavailable')),
    });
    render(<App fileGateway={fileGateway} />);

    await user.click(screen.getByRole('button', { name: /new project/i }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'LED Studio could not save this project.',
    );
    expect(screen.getByText('Unsaved')).toBeInTheDocument();
  });

  it('returns immediately from a clean opened project', async () => {
    const user = userEvent.setup();
    const fileGateway = createFileGateway({
      openProject: vi.fn().mockResolvedValue(openedProjectFile()),
    });
    render(<App fileGateway={fileGateway} />);

    await user.click(screen.getByRole('button', { name: /open project/i }));
    await user.click(
      screen.getByRole('button', { name: /choose another project/i }),
    );

    expect(fileGateway.confirmUnsavedProject).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /new project/i }),
    ).toBeInTheDocument();
  });

  it('keeps an unsaved project open when navigation is cancelled', async () => {
    const user = userEvent.setup();
    const fileGateway = createFileGateway({
      confirmUnsavedProject: vi.fn().mockResolvedValue('cancel'),
    });
    render(<App fileGateway={fileGateway} />);

    await user.click(screen.getByRole('button', { name: /new project/i }));
    await user.click(
      screen.getByRole('button', { name: /choose another project/i }),
    );

    expect(
      screen.getByRole('heading', { name: 'Untitled Project' }),
    ).toBeInTheDocument();
  });

  it('discards an unsaved project after confirmation', async () => {
    const user = userEvent.setup();
    const fileGateway = createFileGateway({
      confirmUnsavedProject: vi.fn().mockResolvedValue('discard'),
    });
    render(<App fileGateway={fileGateway} />);

    await user.click(screen.getByRole('button', { name: /new project/i }));
    await user.click(
      screen.getByRole('button', { name: /choose another project/i }),
    );

    expect(
      await screen.findByRole('button', { name: /new project/i }),
    ).toBeInTheDocument();
  });

  it('saves an unsaved project before returning to the launcher', async () => {
    const user = userEvent.setup();
    const fileGateway = createFileGateway({
      confirmUnsavedProject: vi.fn().mockResolvedValue('save'),
      saveProjectAs: vi.fn().mockResolvedValue({
        fileName: 'untitled-project.ledstudio',
        path: '/projects/untitled-project.ledstudio',
      }),
    });
    render(<App fileGateway={fileGateway} />);

    await user.click(screen.getByRole('button', { name: /new project/i }));
    await user.click(
      screen.getByRole('button', { name: /choose another project/i }),
    );

    expect(fileGateway.saveProjectAs).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole('button', { name: /new project/i }),
    ).toBeInTheDocument();
  });

  it('reports malformed JSON without leaving the launcher', async () => {
    const user = userEvent.setup();
    const fileGateway = createFileGateway({
      openProject: vi.fn().mockResolvedValue({
        contents: '{',
        fileName: 'broken.ledstudio',
        path: '/projects/broken.ledstudio',
      }),
    });
    render(<App fileGateway={fileGateway} />);

    await user.click(screen.getByRole('button', { name: /open project/i }));

    const alert = await screen.findByRole('alert');
    expect(
      within(alert).getByText('This file is not valid JSON.'),
    ).toBeVisible();
  });
});
