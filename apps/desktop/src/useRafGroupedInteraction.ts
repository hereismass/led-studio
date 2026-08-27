import type { ExecuteEditorCommandOptions } from '@led-studio/editor-core';
import { useEffect, useRef } from 'react';

type CommitValue<T> = (value: T, options: ExecuteEditorCommandOptions) => void;

export function useRafGroupedInteraction<T>(onCommit: CommitValue<T>) {
  const callbackRef = useRef(onCommit);
  const frameRef = useRef<number | null>(null);
  const groupIdRef = useRef<string | null>(null);
  const pendingRef = useRef<T | null>(null);
  callbackRef.current = onCommit;

  function begin() {
    groupIdRef.current ??= globalThis.crypto.randomUUID();
  }

  function flush() {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (pendingRef.current === null) return;
    begin();
    const value = pendingRef.current;
    pendingRef.current = null;
    callbackRef.current(value, { historyGroupId: groupIdRef.current! });
  }

  function update(value: T) {
    begin();
    pendingRef.current = value;
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      flush();
    });
  }

  function end() {
    flush();
    groupIdRef.current = null;
  }

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return { begin, end, update };
}
