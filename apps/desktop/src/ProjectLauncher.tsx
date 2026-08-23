import { projectExamples } from './examples';
import type { ProjectOperation } from './projectSession';

interface ProjectLauncherProps {
  launcherError: string | null;
  onCreateNew: () => void;
  onLoadExample: (index: number) => void;
  onOpen: () => void;
  operation: ProjectOperation;
}

export function ProjectLauncher({
  launcherError,
  onCreateNew,
  onLoadExample,
  onOpen,
  operation,
}: ProjectLauncherProps) {
  const isOpening = operation === 'opening';

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
          disabled={isOpening}
          onClick={onCreateNew}
        >
          <span className="launcher-card-number" aria-hidden="true">
            01
          </span>
          <span>
            <strong>New project</strong>
            <small>
              Start with the KMS 31-inlay profile and a white palette colour.
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
          onClick={onOpen}
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
              disabled={isOpening}
              onClick={() => onLoadExample(index)}
            >
              <span className="example-palette" aria-hidden="true">
                {example.project.palette.map((token) => (
                  <span
                    key={token.id}
                    style={{ backgroundColor: token.value }}
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
