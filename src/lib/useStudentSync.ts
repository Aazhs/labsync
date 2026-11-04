'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ProjectFile, useIDEStore } from './store';
import {
  ErrorTier,
  StudentSession,
  StudentStatePatch,
  updateStudentState,
} from './lobbyService';

const SNAPSHOT_DEBOUNCE_MS = 2500;
const HEARTBEAT_MS = 60_000;
/** Consecutive failed runs before a student is flagged as stuck. */
const STUCK_AFTER_FAILURES = 3;

type HelpState = { handRaised: boolean; done: boolean };

function helpStateKey(roomCode: string) {
  return `labsync_student_help_${roomCode}`;
}

function readHelpState(roomCode: string | undefined): HelpState {
  if (!roomCode || typeof window === 'undefined') return { handRaised: false, done: false };
  try {
    return { handRaised: false, done: false, ...JSON.parse(localStorage.getItem(helpStateKey(roomCode)) || '{}') };
  } catch {
    return { handRaised: false, done: false };
  }
}

function snapshotOf(files: ProjectFile[]): string {
  if (files.length === 1) return files[0].content;
  return files.map((f) => `// ===== ${f.name} =====\n${f.content}`).join('\n\n');
}

/**
 * Keeps the instructor dashboard up to date with a student's code, run results and
 * help requests. Does nothing when `session` is null or `enabled` is false.
 */
export function useStudentSync(session: StudentSession | null, enabled: boolean) {
  const [help, setHelp] = useState<HelpState>(() => readHelpState(session?.roomCode));
  const [syncError, setSyncError] = useState<string | null>(null);
  const failuresRef = useRef(0);
  const helpRef = useRef(help);

  const active = Boolean(session && enabled);

  const push = useCallback(
    async (patch: StudentStatePatch) => {
      if (!session || !enabled) return;
      try {
        await updateStudentState(session, patch);
        setSyncError(null);
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : 'Could not reach the lab server.');
      }
    },
    [session, enabled]
  );

  // Code snapshots: one right away, then debounced after edits.
  useEffect(() => {
    if (!active) return;
    const snapshot = () => {
      const state = useIDEStore.getState();
      const activeFile = state.files.find((f) => f.id === state.activeFileId);
      push({ codeSnapshot: snapshotOf(state.files), currentFile: activeFile?.name });
    };
    snapshot();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useIDEStore.subscribe((state, prev) => {
      if (state.files === prev.files && state.activeFileId === prev.activeFileId) return;
      clearTimeout(timer);
      timer = setTimeout(snapshot, SNAPSHOT_DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [active, push]);

  // Heartbeat so the dashboard can tell an idle student from an absent one.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') push({});
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [active, push]);

  const updateHelp = useCallback(
    (next: HelpState) => {
      helpRef.current = next;
      setHelp(next);
      if (session) {
        try {
          localStorage.setItem(helpStateKey(session.roomCode), JSON.stringify(next));
        } catch {}
      }
    },
    [session]
  );

  /** Report the outcome of a run. */
  const reportRun = useCallback(
    (succeeded: boolean, classification?: { tier: ErrorTier; category: string }) => {
      failuresRef.current = succeeded ? 0 : failuresRef.current + 1;
      const { handRaised, done } = helpRef.current;
      const status =
        handRaised ? 'needs_help'
        : done ? 'completed'
        : failuresRef.current >= STUCK_AFTER_FAILURES ? 'stuck'
        : 'coding';
      const tier = succeeded || !classification ? 'none' : classification.tier;
      push({ status, errorTier: tier, errorCategory: tier === 'none' ? null : classification?.category });
    },
    [push]
  );

  const toggleHandRaised = useCallback(() => {
    const handRaised = !helpRef.current.handRaised;
    updateHelp({ handRaised, done: false });
    push({ status: handRaised ? 'needs_help' : 'coding' });
  }, [push, updateHelp]);

  const toggleDone = useCallback(() => {
    const done = !helpRef.current.done;
    updateHelp({ handRaised: false, done });
    push({ status: done ? 'completed' : 'coding' });
  }, [push, updateHelp]);

  return {
    handRaised: help.handRaised,
    done: help.done,
    syncError,
    reportRun,
    toggleHandRaised,
    toggleDone,
  };
}
