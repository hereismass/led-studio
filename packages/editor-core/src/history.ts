import type { Project } from '@led-studio/project-format';

export const MAX_EDITOR_HISTORY_REVISIONS = 200;

export interface EditorRevision {
  historyGroupId: string | null;
  project: Project;
  revision: number;
}

export interface EditorHistory {
  future: EditorRevision[];
  nextRevision: number;
  past: EditorRevision[];
  present: EditorRevision;
}

export interface EditorHistoryTransition {
  changed: boolean;
  history: EditorHistory;
}

export function createEditorHistory(project: Project): EditorHistory {
  return {
    future: [],
    nextRevision: 1,
    past: [],
    present: { historyGroupId: null, project, revision: 0 },
  };
}

export function commitEditorProject(
  history: EditorHistory,
  project: Project,
  historyGroupId?: string,
): EditorHistoryTransition {
  if (project === history.present.project) return { changed: false, history };

  const groupId = historyGroupId ?? null;
  const replacePresent =
    groupId !== null && history.present.historyGroupId === groupId;
  const past = replacePresent
    ? history.past
    : [...history.past, history.present].slice(-MAX_EDITOR_HISTORY_REVISIONS);

  return {
    changed: true,
    history: {
      future: [],
      nextRevision: history.nextRevision + 1,
      past,
      present: {
        historyGroupId: groupId,
        project,
        revision: history.nextRevision,
      },
    },
  };
}

export function undoEditorHistory(history: EditorHistory): EditorHistory {
  const present = history.past.at(-1);
  if (!present) return history;
  return {
    ...history,
    future: [history.present, ...history.future],
    past: history.past.slice(0, -1),
    present,
  };
}

export function redoEditorHistory(history: EditorHistory): EditorHistory {
  const [present, ...future] = history.future;
  if (!present) return history;
  return {
    ...history,
    future,
    past: [...history.past, history.present].slice(
      -MAX_EDITOR_HISTORY_REVISIONS,
    ),
    present,
  };
}
