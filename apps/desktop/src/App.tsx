import {
  createProject,
  parseProject,
  parseProjectJson,
  serializeProject,
  type Project,
} from '@led-studio/project-format';
import { useCallback, useEffect, useState } from 'react';
import { projectExamples } from './examples';
import {
  nativeProjectFileGateway,
  type OpenedProjectFile,
  type ProjectFileGateway,
  type ProjectFileReference,
} from './projectFiles';

const DEFAULT_HARDWARE_PROFILE = 'kms-4-string-31-inlay-v1';

type ProjectOrigin = 'example' | 'file' | 'new';

interface ActiveProject {
  file: ProjectFileReference | null;
  isDirty: boolean;
  origin: ProjectOrigin;
  project: Project;
}

interface AppProps {
  fileGateway?: ProjectFileGateway;
}

interface ValidationIssue {
  message: string;
  path: PropertyKey[];
}

type SaveFeedback =
  { kind: 'error'; message: string } | { kind: 'success'; message: string };

function isValidationError(
  error: unknown,
): error is { issues: ValidationIssue[] } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'issues' in error &&
    Array.isArray(error.issues)
  );
}

function describeProjectError(error: unknown): string {
  if (error instanceof SyntaxError) {
    return 'This file is not valid JSON.';
  }

  if (isValidationError(error) && error.issues.length > 0) {
    const issue = error.issues[0];
    const path = issue.path.length > 0 ? issue.path.join('.') : 'project';

    return `This is not a valid LED Studio project. ${path}: ${issue.message}`;
  }

  return 'This is not a valid LED Studio project.';
}

function sourceDescription(activeProject: ActiveProject): string {
  if (activeProject.file) {
    return `Local file · ${activeProject.file.fileName}`;
  }

  return activeProject.origin === 'example'
    ? 'Unsaved project · Based on bundled example'
    : 'Unsaved new project';
}

function ProjectPreview({
  activeProject,
  isSaving,
  onChooseAnother,
  onSave,
  onSaveAs,
  saveFeedback,
}: {
  activeProject: ActiveProject;
  isSaving: boolean;
  onChooseAnother: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  saveFeedback: SaveFeedback | null;
}) {
  const { project } = activeProject;
  const colours = Object.entries(project.palette);

  return (
    <main className="app-shell">
      <div className="project-toolbar">
        <button
          className="back-button"
          type="button"
          disabled={isSaving}
          onClick={onChooseAnother}
        >
          <span aria-hidden="true">←</span> Choose another project
        </button>

        <div className="save-actions" aria-label="Save actions">
          <button
            aria-keyshortcuts="Meta+S Control+S"
            aria-label="Save"
            type="button"
            disabled={isSaving}
            onClick={onSave}
          >
            {isSaving ? 'Saving…' : 'Save'}
            <kbd>⌘S</kbd>
          </button>
          <button
            aria-keyshortcuts="Meta+Shift+S Control+Shift+S"
            aria-label="Save As"
            type="button"
            disabled={isSaving}
            onClick={onSaveAs}
          >
            Save As
            <kbd>⇧⌘S</kbd>
          </button>
        </div>
      </div>

      <header className="app-header project-header">
        <div>
          <p className="eyebrow">{sourceDescription(activeProject)}</p>
          <h1>{project.name}</h1>
        </div>
        <div className="project-badges">
          {activeProject.isDirty ? (
            <span className="unsaved-badge">Unsaved</span>
          ) : null}
          <span className="version-badge">Schema v{project.schemaVersion}</span>
        </div>
      </header>

      {saveFeedback ? (
        <div
          className={`save-feedback save-feedback-${saveFeedback.kind}`}
          role={saveFeedback.kind === 'error' ? 'alert' : 'status'}
        >
          {saveFeedback.message}
        </div>
      ) : null}

      <section className="project-card" aria-labelledby="hardware-heading">
        <div className="project-heading">
          <div>
            <p className="eyebrow">Hardware profile</p>
            <h2 id="hardware-heading">{project.hardwareProfile}</h2>
          </div>
          <p className="colour-count">
            {colours.length} {colours.length === 1 ? 'colour' : 'colours'}
          </p>
        </div>

        {colours.length === 0 ? (
          <div className="empty-palette">
            <p className="empty-palette-mark" aria-hidden="true">
              +
            </p>
            <div>
              <h3>No palette colours yet</h3>
              <p>This project starts with an empty palette.</p>
            </div>
          </div>
        ) : (
          <div className="palette-grid">
            {colours.map(([name, colour]) => (
              <article className="colour-card" key={name}>
                <div
                  className="colour-swatch"
                  style={{ backgroundColor: colour }}
                  aria-hidden="true"
                />
                <div>
                  <h3>{name}</h3>
                  <p>{colour}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export function App({ fileGateway = nativeProjectFileGateway }: AppProps) {
  const [activeProject, setActiveProject] = useState<ActiveProject | null>(
    null,
  );
  const [launcherError, setLauncherError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function createNewProject() {
    setLauncherError(null);
    setSaveFeedback(null);
    setActiveProject({
      file: null,
      isDirty: true,
      origin: 'new',
      project: createProject({
        name: 'Untitled Project',
        hardwareProfile: DEFAULT_HARDWARE_PROFILE,
      }),
    });
  }

  function loadExample(index: number) {
    setLauncherError(null);
    setSaveFeedback(null);
    setActiveProject({
      file: null,
      isDirty: true,
      origin: 'example',
      project: parseProject(projectExamples[index].project),
    });
  }

  async function openExistingProject() {
    setLauncherError(null);
    setIsOpening(true);

    let selectedFile: OpenedProjectFile | null;

    try {
      selectedFile = await fileGateway.openProject();
    } catch {
      setLauncherError('LED Studio could not read the selected file.');
      setIsOpening(false);
      return;
    }

    if (selectedFile === null) {
      setIsOpening(false);
      return;
    }

    try {
      setSaveFeedback(null);
      setActiveProject({
        file: {
          fileName: selectedFile.fileName,
          path: selectedFile.path,
        },
        isDirty: false,
        origin: 'file',
        project: parseProjectJson(selectedFile.contents),
      });
    } catch (projectError) {
      setLauncherError(describeProjectError(projectError));
    } finally {
      setIsOpening(false);
    }
  }

  const saveActiveProject = useCallback(
    async (forceSaveAs = false): Promise<boolean> => {
      if (!activeProject || isSaving) {
        return false;
      }

      setSaveFeedback(null);
      setIsSaving(true);

      try {
        const contents = serializeProject(activeProject.project);

        if (forceSaveAs || activeProject.file === null) {
          const savedFile = await fileGateway.saveProjectAs(
            activeProject.project.name,
            contents,
          );

          if (savedFile === null) {
            return false;
          }

          setActiveProject((currentProject) =>
            currentProject
              ? {
                  ...currentProject,
                  file: savedFile,
                  isDirty: false,
                  origin: 'file',
                }
              : null,
          );
          setSaveFeedback({
            kind: 'success',
            message: `Saved ${savedFile.fileName}.`,
          });
          return true;
        }

        await fileGateway.saveProject(activeProject.file.path, contents);
        setActiveProject((currentProject) =>
          currentProject ? { ...currentProject, isDirty: false } : null,
        );
        setSaveFeedback({
          kind: 'success',
          message: `Saved ${activeProject.file.fileName}.`,
        });
        return true;
      } catch {
        setSaveFeedback({
          kind: 'error',
          message: 'LED Studio could not save this project.',
        });
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [activeProject, fileGateway, isSaving],
  );

  useEffect(() => {
    if (!activeProject) {
      return;
    }

    function handleSaveShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveActiveProject(event.shiftKey);
      }
    }

    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [activeProject, saveActiveProject]);

  async function chooseAnotherProject() {
    if (!activeProject) {
      return;
    }

    if (!activeProject.isDirty) {
      setActiveProject(null);
      setSaveFeedback(null);
      return;
    }

    let decision;

    try {
      decision = await fileGateway.confirmUnsavedProject(
        activeProject.project.name,
      );
    } catch {
      setSaveFeedback({
        kind: 'error',
        message: 'LED Studio could not confirm how to handle this project.',
      });
      return;
    }

    if (decision === 'cancel') {
      return;
    }

    if (decision === 'discard') {
      setActiveProject(null);
      setSaveFeedback(null);
      return;
    }

    if (await saveActiveProject()) {
      setActiveProject(null);
      setSaveFeedback(null);
    }
  }

  if (activeProject) {
    return (
      <ProjectPreview
        activeProject={activeProject}
        isSaving={isSaving}
        onChooseAnother={() => void chooseAnotherProject()}
        onSave={() => void saveActiveProject()}
        onSaveAs={() => void saveActiveProject(true)}
        saveFeedback={saveFeedback}
      />
    );
  }

  return (
    <main className="app-shell launcher-shell">
      <header className="launcher-header">
        <p className="eyebrow">Lighting project workspace</p>
        <h1>LED Studio</h1>
        <p className="launcher-intro">
          Create a lighting project, open one from disk, or start from an
          example.
        </p>
      </header>

      <section className="launcher-actions" aria-label="Project actions">
        <button
          className="launcher-card launcher-card-primary"
          type="button"
          onClick={createNewProject}
        >
          <span className="launcher-card-number" aria-hidden="true">
            01
          </span>
          <span>
            <strong>New project</strong>
            <small>
              Start with the KMS 31-inlay profile and an empty palette.
            </small>
          </span>
          <span className="launcher-card-arrow" aria-hidden="true">
            →
          </span>
        </button>

        <button
          className="launcher-card"
          type="button"
          disabled={isOpening}
          onClick={openExistingProject}
        >
          <span className="launcher-card-number" aria-hidden="true">
            02
          </span>
          <span>
            <strong>{isOpening ? 'Opening…' : 'Open project'}</strong>
            <small>Select and validate an LED Studio or JSON project.</small>
          </span>
          <span className="launcher-card-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </section>

      {launcherError ? (
        <div className="launcher-error" role="alert">
          <strong>Could not open project</strong>
          <p>{launcherError}</p>
        </div>
      ) : null}

      <section className="examples-section" aria-labelledby="examples-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Bundled projects</p>
            <h2 id="examples-heading">Examples</h2>
          </div>
          <p>{projectExamples.length} available</p>
        </div>

        <div className="examples-list">
          {projectExamples.map((example, index) => (
            <button
              className="example-row"
              type="button"
              key={example.id}
              onClick={() => loadExample(index)}
            >
              <span className="example-palette" aria-hidden="true">
                {Object.values(example.project.palette).map((colour, index) => (
                  <span
                    key={`${colour}-${index}`}
                    style={{ backgroundColor: colour }}
                  />
                ))}
              </span>
              <span className="example-copy">
                <strong>{example.project.name}</strong>
                <small>{example.description}</small>
              </span>
              <span className="example-profile">
                {example.project.hardwareProfile}
              </span>
              <span className="launcher-card-arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
