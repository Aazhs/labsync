'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Copy, ExternalLink, FlaskConical, Maximize2, Moon, Pause, Play, Plus, Square, Sun, X } from 'lucide-react';
import {
  effectiveStudentStatus,
  getLobbyStudents,
  isDemoMode,
  LabLobby,
  LabStudent,
  listTeacherLobbies,
  StudentStatus,
  subscribeToLobbyUpdates,
  updateLobbyStatus,
} from '@/lib/lobbyService';
import { isDemoTeacher, logoutTeacher, restoreTeacherSession, TeacherUser } from '@/lib/teacherAuth';
import { createDemoClass, DEMO_LAB_TITLE, DemoSeat, getDemoSeats } from '@/lib/demoClass';

const DEMO_LAB_TTL_MS = 2 * 60 * 60 * 1000;
import { LANGUAGES } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import CreateLobbyModal from '@/components/CreateLobbyModal';

type Seat = LabStudent & { status: StudentStatus };
type Filter = 'all' | 'needs_help' | 'stuck' | 'coding' | 'completed' | 'idle';

// Students who need attention come first.
const STATUS_PRIORITY: Record<StudentStatus, number> = {
  needs_help: 0,
  stuck: 1,
  coding: 2,
  active: 2,
  idle: 3,
  completed: 4,
};

const STATUS_LABEL: Record<StudentStatus, string> = {
  needs_help: 'Asked for help',
  stuck: 'Stuck',
  coding: 'Coding',
  active: 'Coding',
  idle: 'Away',
  completed: 'Done',
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'needs_help', label: 'Asked for help' },
  { id: 'stuck', label: 'Stuck' },
  { id: 'coding', label: 'Coding' },
  { id: 'completed', label: 'Done' },
  { id: 'idle', label: 'Away' },
];

const TIER_LABEL: Record<string, string> = { syntax: 'Syntax', logic: 'Logic', conceptual: 'Conceptual' };

function statusClass(status: StudentStatus): string {
  return status === 'active' ? 'coding' : status;
}

function matchesFilter(status: StudentStatus, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'coding') return status === 'coding' || status === 'active';
  return status === filter;
}

function upsertStudent(list: LabStudent[], student: LabStudent, deleted?: boolean): LabStudent[] {
  if (deleted) return list.filter((s) => s.id !== student.id);
  return list.some((s) => s.id === student.id)
    ? list.map((s) => (s.id === student.id ? { ...s, ...student } : s))
    : [...list, student];
}

function timeAgo(iso: string, now: number): string {
  const secs = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatCode(code: string) {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function languageLabel(name: string) {
  return LANGUAGES.find((l) => l.name === name)?.label ?? name;
}

export default function DashboardPage() {
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();

  const [teacher, setTeacher] = useState<TeacherUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [lobbies, setLobbies] = useState<LabLobby[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [students, setStudents] = useState<LabStudent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showProjector, setShowProjector] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [creatingDemo, setCreatingDemo] = useState(false);

  const activeLobby = lobbies.find((l) => l.id === activeId) ?? null;
  const roomCode = activeLobby?.room_code;

  const reportError = (err: unknown, fallback: string) => setError(err instanceof Error ? err.message : fallback);

  // Sample seats this browser can open, for the demo class. They are saved before the lab is selected.
  // A small localStorage read; the dashboard renders only after sign-in, on the client.
  const demoSeats: Record<string, DemoSeat> = roomCode ? getDemoSeats(roomCode) : {};

  /** Open the demo class: reuse one this browser set up, otherwise create it with sample students. */
  const openDemoClass = useCallback(
    async (t: TeacherUser, list: LabLobby[]) => {
      const existing = list.find((l) => l.title === DEMO_LAB_TITLE && Object.keys(getDemoSeats(l.room_code)).length);
      if (existing) {
        setActiveId(existing.id);
        return;
      }
      setCreatingDemo(true);
      setError(null);
      try {
        // Many visitors share the demo account. End its demo labs nobody has used for a while.
        const stale = list.filter(
          (l) => l.title === DEMO_LAB_TITLE && Date.now() - new Date(l.created_at).getTime() > DEMO_LAB_TTL_MS
        );
        await Promise.allSettled(stale.map((l) => updateLobbyStatus(l.room_code, 'completed')));
        if (stale.length) setLobbies((prev) => prev.filter((l) => !stale.includes(l)));
        const lobby = await createDemoClass(t);
        setLobbies((prev) => [lobby, ...prev.filter((l) => l.id !== lobby.id)]);
        setActiveId(lobby.id);
        setStudents([]);
        setSelectedId(null);
        setFilter('all');
      } catch (err) {
        reportError(err, 'Could not set up the demo class.');
      } finally {
        setCreatingDemo(false);
      }
    },
    []
  );

  // Idle detection depends on the clock.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const loadLobbies = useCallback(async (t: TeacherUser, preferId?: string) => {
    const list = await listTeacherLobbies(t);
    setLobbies(list);
    setActiveId((prev) => {
      const want = preferId ?? prev;
      return want && list.some((l) => l.id === want) ? want : list[0]?.id ?? null;
    });
  }, []);

  // Confirm the session, then load labs. Signed-out visitors go to the sign-in page.
  useEffect(() => {
    let cancelled = false;
    restoreTeacherSession()
      .then(async (t) => {
        if (cancelled) return;
        if (!t) {
          router.replace('/login?next=/dashboard');
          return;
        }
        setTeacher(t);
        setAuthChecked(true);
        await loadLobbies(t);
        // The shared demo account lands in a ready-made C++ class.
        if (isDemoTeacher(t) && !cancelled) {
          const list = await listTeacherLobbies(t);
          if (!list.some((l) => l.title === DEMO_LAB_TITLE && Object.keys(getDemoSeats(l.room_code)).length))
            await openDemoClass(t, list);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setAuthChecked(true);
        reportError(err, 'Could not load your labs.');
      });
    return () => {
      cancelled = true;
    };
  }, [router, loadLobbies, openDemoClass]);

  // Roster for the selected lab: initial load, then realtime updates.
  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;
    const fetchStudents = async () => {
      try {
        const list = await getLobbyStudents(roomCode);
        if (!cancelled) setStudents(list);
      } catch (err) {
        if (!cancelled) reportError(err, 'Could not load students.');
      }
    };
    fetchStudents();
    const unsubscribe = subscribeToLobbyUpdates(roomCode, (change) => {
      if (change.table === 'lab_students') {
        setStudents((prev) => upsertStudent(prev, change.student, change.deleted));
      } else if (change.table === 'lab_lobbies') {
        setLobbies((prev) => prev.map((l) => (l.id === change.lobby.id ? change.lobby : l)));
      } else {
        fetchStudents();
        // Keep lab settings (sharing, paused) fresh too.
        if (teacher) listTeacherLobbies(teacher).then(setLobbies).catch(() => {});
      }
    }, { roster: true });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [roomCode, teacher]);

  const seats: Seat[] = useMemo(
    () =>
      students
        .map((s) => ({ ...s, status: effectiveStudentStatus(s, now) }))
        .sort(
          (a, b) =>
            STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] ||
            a.student_name.localeCompare(b.student_name)
        ),
    [students, now]
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: seats.length, needs_help: 0, stuck: 0, coding: 0, completed: 0, idle: 0 };
    for (const s of seats) for (const f of FILTERS) if (f.id !== 'all' && matchesFilter(s.status, f.id)) c[f.id]++;
    return c;
  }, [seats]);

  const visibleSeats = seats.filter((s) => matchesFilter(s.status, filter));
  const selected = seats.find((s) => s.id === selectedId) ?? null;

  // Esc closes whatever is on top.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showProjector) setShowProjector(false);
      else setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showProjector]);

  const selectLab = (id: string) => {
    setActiveId(id);
    setStudents([]);
    setSelectedId(null);
    setFilter('all');
  };

  const changeStatus = async (status: 'active' | 'paused' | 'completed') => {
    if (!activeLobby || busy || !teacher) return;
    setBusy(true);
    try {
      const updated = await updateLobbyStatus(activeLobby.room_code, status);
      if (status === 'completed') {
        selectLab('');
        await loadLobbies(teacher);
      } else {
        setLobbies((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      }
    } catch (err) {
      reportError(err, 'Could not change the lab status.');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = () => {
    if (!roomCode) return;
    navigator.clipboard?.writeText(roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (!authChecked || !teacher) {
    return (
      <div className="db-loading">
        <div className="loading-spinner" />
        Loading your labs…
      </div>
    );
  }

  const joinUrl = typeof window !== 'undefined' ? `${window.location.host}/join` : '/join';
  const sharing = Boolean(activeLobby?.follow_mode && activeLobby?.broadcast_enabled !== false);

  return (
    <div className="db">
      <header className="db-top">
        <div className="db-top-left">
          <Link href="/" className="db-brand" aria-label="LabSync home">
            <Image src="/logo.png" alt="" width={26} height={26} />
          </Link>
          {lobbies.length > 0 && (
            <select
              className="db-lab-select"
              aria-label="Choose a lab"
              value={activeId ?? ''}
              onChange={(e) => selectLab(e.target.value)}
            >
              {lobbies.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}{l.status === 'paused' ? ' (paused)' : ''}
                </option>
              ))}
            </select>
          )}
          <button className="btn btn-secondary db-btn" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            New lab
          </button>
          <button
            className="btn btn-ghost db-btn"
            disabled={creatingDemo}
            onClick={() => openDemoClass(teacher, lobbies)}
            title="A C++ lab with sample students whose screens you can open"
          >
            <FlaskConical size={14} />
            {creatingDemo ? 'Setting up demo…' : 'C++ demo class'}
          </button>
        </div>
        <div className="db-top-right">
          <span className="db-teacher">{teacher.name}</span>
          <button className="btn-icon" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            className="btn btn-ghost db-btn"
            onClick={async () => {
              await logoutTeacher();
              router.push('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {isDemoMode && (
        <div className="db-notice">
          Demo mode: labs are saved in this browser only. Open student tabs in this same browser to try it.
        </div>
      )}
      {Object.keys(demoSeats).length > 0 && (
        <div className="db-notice db-demo-strip">
          <span>Demo class. Open any sample student&apos;s screen to see what they see:</span>
          <div className="db-demo-students">
            {students
              .filter((s) => demoSeats[s.id])
              .map((s) => (
                <a
                  key={s.id}
                  className="btn btn-secondary db-btn"
                  href={`/ide?room=${s.room_code}&student=${s.id}`}
                  target="_blank"
                  rel="noopener"
                >
                  {s.student_name.split(' ')[0]}
                  <ExternalLink size={12} />
                </a>
              ))}
          </div>
        </div>
      )}
      {error && (
        <div className="db-notice db-notice-error" role="alert">
          <span>{error}</span>
          <button className="btn btn-ghost db-btn" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {!activeLobby ? (
        <div className="db-empty">
          <h1>{creatingDemo ? 'Setting up the C++ demo class…' : 'Create your first lab'}</h1>
          <p>You will get a six-digit code to share with your class. Students join with it, their name and their PRN.</p>
          <div className="db-empty-actions">
            <button className="btn btn-primary db-btn-lg" onClick={() => setShowCreate(true)}>
              <Plus size={16} />
              New lab
            </button>
            <button
              className="btn btn-secondary db-btn-lg"
              disabled={creatingDemo}
              onClick={() => openDemoClass(teacher, lobbies)}
            >
              <FlaskConical size={16} />
              Try a C++ demo class
            </button>
          </div>
        </div>
      ) : (
        <>
          <section className="db-lab">
            <div className="db-lab-info">
              <h1 className="db-lab-title">{activeLobby.title}</h1>
              <div className="db-lab-meta">
                <span className={`db-state db-state-${activeLobby.status}`}>
                  {activeLobby.status === 'paused' ? 'Paused, students cannot run code' : 'Running'}
                </span>
                <span>{activeLobby.course}</span>
                <span>{languageLabel(activeLobby.language)}</span>
              </div>
            </div>

            <div className="db-code-block">
              <span className="db-code-label">Room code</span>
              <button className="db-code" onClick={copyCode} title="Copy room code">
                {formatCode(activeLobby.room_code)}
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <button className="btn btn-secondary db-btn" onClick={() => setShowProjector(true)}>
                <Maximize2 size={14} />
                Show to class
              </button>
            </div>

            <div className="db-lab-actions">
              <Link href={`/ide?room=${activeLobby.room_code}&role=teacher`} className="btn btn-primary db-btn">
                Open my editor
              </Link>
              {activeLobby.status === 'paused' ? (
                <button className="btn btn-secondary db-btn" disabled={busy} onClick={() => changeStatus('active')}>
                  <Play size={13} />
                  Resume
                </button>
              ) : (
                <button className="btn btn-secondary db-btn" disabled={busy} onClick={() => changeStatus('paused')}>
                  <Pause size={13} />
                  Pause
                </button>
              )}
              <button
                className="btn btn-danger db-btn"
                disabled={busy}
                onClick={() => {
                  if (confirm(`End “${activeLobby.title}”? Students will no longer be able to join or send updates.`)) {
                    changeStatus('completed');
                  }
                }}
              >
                <Square size={12} />
                End lab
              </button>
            </div>
          </section>

          <div className="db-body">
            <section className="db-room" aria-label="Seat map">
              <div className="db-filters" role="tablist" aria-label="Filter students">
                {seats.length > 0 && FILTERS.map((f) => (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={filter === f.id}
                    className={`db-filter db-filter-${f.id}${filter === f.id ? ' is-on' : ''}`}
                    onClick={() => setFilter(f.id)}
                    disabled={f.id !== 'all' && counts[f.id] === 0 && filter !== f.id}
                  >
                    {f.id !== 'all' && <span className="db-filter-dot" />}
                    {f.label}
                    <span className="db-filter-count">{counts[f.id]}</span>
                  </button>
                ))}
                <span className={`db-sharing${sharing ? ' is-on' : ''}`}>
                  {sharing ? 'Your code is on students’ screens' : 'Not sharing your code'}
                </span>
              </div>

              {seats.length === 0 ? (
                <div className="db-waiting">
                  <p className="db-waiting-lead">Waiting for students</p>
                  <p>
                    Ask them to open <strong>{joinUrl}</strong> and enter
                  </p>
                  <div className="db-waiting-code">{formatCode(activeLobby.room_code)}</div>
                  <button className="btn btn-secondary db-btn" onClick={() => setShowProjector(true)}>
                    <Maximize2 size={14} />
                    Show to class
                  </button>
                </div>
              ) : visibleSeats.length === 0 ? (
                <div className="db-waiting">
                  <p>No one here right now.</p>
                  <button className="link-btn" onClick={() => setFilter('all')}>Show everyone</button>
                </div>
              ) : (
                <div className="db-seats">
                  {visibleSeats.map((s) => {
                    const tier = s.error_tier && s.error_tier !== 'none' ? TIER_LABEL[s.error_tier] : null;
                    return (
                      <button
                        key={s.id}
                        className={`db-seat db-seat-${statusClass(s.status)}${selectedId === s.id ? ' is-selected' : ''}`}
                        onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
                        aria-pressed={selectedId === s.id}
                      >
                        <span className="db-seat-name">{s.student_name}</span>
                        <span className="db-seat-prn">{s.prn}</span>
                        <span className="db-seat-status">
                          {s.status === 'needs_help' || s.status === 'completed' || s.status === 'idle' || !tier
                            ? STATUS_LABEL[s.status]
                            : `${tier}: ${s.error_category}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {selected && (
              <aside className="db-detail" aria-label={`${selected.student_name}'s code`}>
                <div className="db-detail-head">
                  <div>
                    <h2>{selected.student_name}</h2>
                    <div className="db-detail-sub">
                      <span className="db-mono">{selected.prn}</span>
                      <span>Seen {timeAgo(selected.last_seen_at, now)}</span>
                    </div>
                  </div>
                  <button className="btn-icon" onClick={() => setSelectedId(null)} aria-label="Close">
                    <X size={16} />
                  </button>
                </div>

                <div className={`db-detail-status db-seat-${statusClass(selected.status)}`}>
                  <strong>{STATUS_LABEL[selected.status]}</strong>
                  {selected.error_tier && selected.error_tier !== 'none' && selected.error_category && (
                    <span>
                      Last run: {TIER_LABEL[selected.error_tier]} error, {selected.error_category.toLowerCase()}
                    </span>
                  )}
                </div>

                {demoSeats[selected.id] && (
                  <a
                    className="btn btn-primary db-btn db-detail-open"
                    href={`/ide?room=${selected.room_code}&student=${selected.id}`}
                    target="_blank"
                    rel="noopener"
                  >
                    <ExternalLink size={13} />
                    Open student view
                  </a>
                )}

                <div className="db-detail-file">{selected.current_file || 'Code'}</div>
                <pre className="db-detail-code">
                  {selected.code_snapshot || 'Nothing received yet. Code appears a few seconds after the student starts typing.'}
                </pre>
              </aside>
            )}
          </div>
        </>
      )}

      {showProjector && activeLobby && (
        <div className="db-projector" role="dialog" aria-label="Room code for students" onClick={() => setShowProjector(false)}>
          <p className="db-projector-lead">Go to <strong>{joinUrl}</strong> and enter</p>
          <div className="db-projector-code">{formatCode(activeLobby.room_code)}</div>
          <p className="db-projector-title">{activeLobby.title}</p>
          <p className="db-projector-hint">
            {counts.all === 1 ? '1 student has joined' : `${counts.all} students have joined`}. Click anywhere or press Esc to close.
          </p>
        </div>
      )}

      <CreateLobbyModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onLobbyCreated={(lobby) => {
          setLobbies((prev) => [lobby, ...prev.filter((l) => l.id !== lobby.id)]);
          selectLab(lobby.id);
        }}
      />
    </div>
  );
}
