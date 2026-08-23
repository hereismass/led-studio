import {
  isProjectDirty,
  type ActiveProjectSession,
  type ProjectOperation,
  type SaveFeedback,
} from './projectSession';

function sourceDescription(activeProject: ActiveProjectSession): string {
  if (activeProject.source.kind === 'file') {
    return `Local file · ${activeProject.source.file.fileName}`;
  }

  return activeProject.source.kind === 'example'
    ? 'Unsaved project · Based on bundled example'
    : 'Unsaved new project';
}

interface ProjectPreviewProps {
  activeProject: ActiveProjectSession;
  onChooseAnother: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  operation: ProjectOperation;
  saveFeedback: SaveFeedback | null;
}

export function ProjectPreview({
  activeProject,
  onChooseAnother,
  onSave,
  onSaveAs,
  operation,
  saveFeedback,
}: ProjectPreviewProps) {
  const { project } = activeProject;
  const colours = Object.entries(project.palette);
  const isBusy = operation !== 'idle';

  return (
    <main className="app-shell">
      <div className="project-toolbar">
        <button
          className="back-button"
          type="button"
          disabled={isBusy}
          onClick={onChooseAnother}
        >
          <span aria-hidden="true">←</span> Choose another project
        </button>

        <div className="save-actions" aria-label="Save actions">
          <button
            aria-keyshortcuts="Meta+S Control+S"
            aria-label="Save"
            type="button"
            disabled={isBusy}
            onClick={onSave}
          >
            {operation === 'saving' ? 'Saving…' : 'Save'}
            <kbd>⌘S</kbd>
          </button>
          <button
            aria-keyshortcuts="Meta+Shift+S Control+Shift+S"
            aria-label="Save As"
            type="button"
            disabled={isBusy}
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
          {isProjectDirty(activeProject) ? (
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
