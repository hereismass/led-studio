import {
  createProject,
  parseProjectJson,
  type Project,
} from '@led-studio/project-format';
import { useState } from 'react';
import { projectExamples } from './examples';
import { selectProjectFile, type SelectedProjectFile } from './projectFiles';

const DEFAULT_HARDWARE_PROFILE = 'kms-4-string-31-inlay-v1';

type ProjectSource =
  { kind: 'example' } | { kind: 'file'; fileName: string } | { kind: 'new' };

interface ActiveProject {
  project: Project;
  source: ProjectSource;
}

interface AppProps {
  openProjectFile?: () => Promise<SelectedProjectFile | null>;
}

interface ValidationIssue {
  message: string;
  path: PropertyKey[];
}

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

function sourceDescription(source: ProjectSource): string {
  if (source.kind === 'file') {
    return `Local file · ${source.fileName}`;
  }

  return source.kind === 'example' ? 'Bundled example' : 'New project';
}

function ProjectPreview({
  activeProject,
  onChooseAnother,
}: {
  activeProject: ActiveProject;
  onChooseAnother: () => void;
}) {
  const { project, source } = activeProject;
  const colours = Object.entries(project.palette);

  return (
    <main className="app-shell">
      <button className="back-button" type="button" onClick={onChooseAnother}>
        <span aria-hidden="true">←</span> Choose another project
      </button>

      <header className="app-header project-header">
        <div>
          <p className="eyebrow">{sourceDescription(source)}</p>
          <h1>{project.name}</h1>
        </div>
        <span className="version-badge">Schema v{project.schemaVersion}</span>
      </header>

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

export function App({ openProjectFile = selectProjectFile }: AppProps) {
  const [activeProject, setActiveProject] = useState<ActiveProject | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);

  function createNewProject() {
    setError(null);
    setActiveProject({
      project: createProject({
        name: 'Untitled Project',
        hardwareProfile: DEFAULT_HARDWARE_PROFILE,
      }),
      source: { kind: 'new' },
    });
  }

  function loadExample(index: number) {
    setError(null);
    setActiveProject({
      project: projectExamples[index].project,
      source: { kind: 'example' },
    });
  }

  async function openExistingProject() {
    setError(null);
    setIsOpening(true);

    let selectedFile: SelectedProjectFile | null;

    try {
      selectedFile = await openProjectFile();
    } catch {
      setError('LED Studio could not read the selected file.');
      setIsOpening(false);
      return;
    }

    if (selectedFile === null) {
      setIsOpening(false);
      return;
    }

    try {
      setActiveProject({
        project: parseProjectJson(selectedFile.contents),
        source: { kind: 'file', fileName: selectedFile.fileName },
      });
    } catch (projectError) {
      setError(describeProjectError(projectError));
    } finally {
      setIsOpening(false);
    }
  }

  if (activeProject) {
    return (
      <ProjectPreview
        activeProject={activeProject}
        onChooseAnother={() => setActiveProject(null)}
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
            <small>Select and validate a JSON project from your Mac.</small>
          </span>
          <span className="launcher-card-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </section>

      {error ? (
        <div className="launcher-error" role="alert">
          <strong>Could not open project</strong>
          <p>{error}</p>
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
