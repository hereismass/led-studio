import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

const loadedProject = {
  schemaVersion: 1,
  name: 'Loaded Lighting Show',
  hardwareProfile: 'test-controller-v1',
  palette: {
    blue: '#1248FF',
  },
};

describe('App project launcher', () => {
  it('offers new, open, and example project choices at startup', () => {
    render(<App />);

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

  it('creates an untitled project with an empty palette', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /new project/i }));

    expect(
      screen.getByRole('heading', { name: 'Untitled Project', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('kms-4-string-31-inlay-v1')).toBeInTheDocument();
    expect(screen.getByText('No palette colours yet')).toBeInTheDocument();
  });

  it('loads the bundled example and can return to the launcher', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole('button', { name: /KMS 4-String Bass Example/i }),
    );

    expect(
      screen.getByRole('heading', {
        name: 'KMS 4-String Bass Example',
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('hot-pink')).toBeInTheDocument();
    expect(screen.getByText('3 colours')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /choose another project/i }),
    );

    expect(
      screen.getByRole('button', { name: /new project/i }),
    ).toBeInTheDocument();
  });

  it('opens and validates a selected JSON project', async () => {
    const user = userEvent.setup();
    const openProjectFile = vi.fn().mockResolvedValue({
      contents: JSON.stringify(loadedProject),
      fileName: 'loaded-project.json',
    });
    render(<App openProjectFile={openProjectFile} />);

    await user.click(screen.getByRole('button', { name: /open project/i }));

    expect(openProjectFile).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole('heading', {
        name: 'Loaded Lighting Show',
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/loaded-project\.json/)).toBeInTheDocument();
    expect(screen.getByText('1 colour')).toBeInTheDocument();
  });

  it('silently stays on the launcher when file selection is cancelled', async () => {
    const user = userEvent.setup();
    const openProjectFile = vi.fn().mockResolvedValue(null);
    render(<App openProjectFile={openProjectFile} />);

    await user.click(screen.getByRole('button', { name: /open project/i }));

    expect(
      screen.getByRole('button', { name: /new project/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports malformed JSON without leaving the launcher', async () => {
    const user = userEvent.setup();
    const openProjectFile = vi.fn().mockResolvedValue({
      contents: '{',
      fileName: 'broken.json',
    });
    render(<App openProjectFile={openProjectFile} />);

    await user.click(screen.getByRole('button', { name: /open project/i }));

    const alert = await screen.findByRole('alert');
    expect(
      within(alert).getByText('This file is not valid JSON.'),
    ).toBeVisible();
  });

  it('reports the first schema validation issue', async () => {
    const user = userEvent.setup();
    const openProjectFile = vi.fn().mockResolvedValue({
      contents: JSON.stringify({ ...loadedProject, name: '   ' }),
      fileName: 'invalid-project.json',
    });
    render(<App openProjectFile={openProjectFile} />);

    await user.click(screen.getByRole('button', { name: /open project/i }));

    const alert = await screen.findByRole('alert');
    expect(
      within(alert).getByText(/name: Project name cannot be empty/),
    ).toBeVisible();
  });

  it('reports native file reading failures', async () => {
    const user = userEvent.setup();
    const openProjectFile = vi
      .fn()
      .mockRejectedValue(new Error('File is unavailable'));
    render(<App openProjectFile={openProjectFile} />);

    await user.click(screen.getByRole('button', { name: /open project/i }));

    const alert = await screen.findByRole('alert');
    expect(
      within(alert).getByText('LED Studio could not read the selected file.'),
    ).toBeVisible();
  });
});
