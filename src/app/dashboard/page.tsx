'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap,
  ArrowLeft,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Code2,
  Eye,
  EyeOff,
  Flame,
  Plus,
  Copy,
  Check,
  Share2,
  ExternalLink,
  Radio,
  Send,
  Sparkles,
  Play,
  Pause,
  Square,
  LogOut,
  ShieldCheck,
  GraduationCap,
} from 'lucide-react';
import {
  listTeacherLobbies,
  getLobbyStudents,
  subscribeToLobbyUpdates,
  updateLobbyBroadcast,
  updateLobbyStatus,
  effectiveStudentStatus,
  isDemoMode,
  LabLobby,
  LabStudent,
  StudentStatus,
} from '@/lib/lobbyService';
import {
  restoreTeacherSession,
  logoutTeacher,
  TeacherUser,
} from '@/lib/teacherAuth';
import CreateLobbyModal from '@/components/CreateLobbyModal';
import TeacherAuthModal from '@/components/TeacherAuthModal';

const emptySubscribe = () => () => {};

// Sort order for the roster: students who need attention first.
const STATUS_PRIORITY: Record<StudentStatus, number> = {
  needs_help: 0,
  stuck: 1,
  coding: 2,
  active: 2,
  idle: 3,
  completed: 4,
};

function upsertStudent(list: LabStudent[], student: LabStudent, deleted?: boolean): LabStudent[] {
  const without = list.filter((s) => s.id !== student.id);
  if (deleted) return without;
  const existing = list.find((s) => s.id === student.id);
  return existing ? list.map((s) => (s.id === student.id ? { ...s, ...student } : s)) : [...without, student];
}

export default function DashboardPage() {
  const router = useRouter();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [time, setTime] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);

  // Teacher Auth State
  const [teacher, setTeacher] = useState<TeacherUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Lab Lobbies State
  const [lobbies, setLobbies] = useState<LabLobby[]>([]);
  const [activeLobby, setActiveLobby] = useState<LabLobby | null>(null);
  const [realStudents, setRealStudents] = useState<LabStudent[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Professor Live Broadcast Controls
  const [broadcastCode, setBroadcastCode] = useState('');
  const [broadcastEnabled, setBroadcastEnabled] = useState(true);
  const [followMode, setFollowMode] = useState(false);
  const [isSavingBroadcast, setIsSavingBroadcast] = useState(false);
  const [broadcastSuccessNotice, setBroadcastSuccessNotice] = useState(false);

  const reportError = (err: unknown, fallback: string) => {
    setError(err instanceof Error ? err.message : fallback);
  };

  // Clock (also drives idle detection)
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Verify the teacher session, then load their labs
  useEffect(() => {
    let cancelled = false;
    restoreTeacherSession()
      .then(async (t) => {
        if (cancelled) return;
        setTeacher(t);
        setAuthChecked(true);
        if (!t) return;
        const list = await listTeacherLobbies(t);
        if (cancelled) return;
        setLobbies(list);
        setActiveLobby((prev) => prev ?? list[0] ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setAuthChecked(true);
        reportError(err, 'Could not load your labs.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync professor broadcast controls whenever the selected lab changes
  const activeRoomCode = activeLobby?.room_code;
  useEffect(() => {
    if (!activeLobby) return;
    let isMounted = true;
    Promise.resolve().then(() => {
      if (!isMounted) return;
      setBroadcastCode(activeLobby.broadcast_code ?? activeLobby.starter_code ?? '');
      setBroadcastEnabled(activeLobby.broadcast_enabled !== false);
      setFollowMode(!!activeLobby.follow_mode);
    });
    return () => {
      isMounted = false;
    };
    // Only reset the editor when switching labs, not on every realtime update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLobby?.id]);

  const refreshLobbies = async () => {
    if (!teacher) return;
    try {
      const list = await listTeacherLobbies(teacher);
      setLobbies(list);
      setActiveLobby((prev) => {
        if (!prev) return list[0] ?? null;
        return list.find((l) => l.room_code === prev.room_code) ?? prev;
      });
    } catch (err) {
      reportError(err, 'Could not load your labs.');
    }
  };

  const applyLobbyUpdate = (updated: LabLobby) => {
    setActiveLobby((prev) => (prev && prev.id === updated.id ? updated : prev));
    setLobbies((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  };

  const handleStatusChange = async (newStatus: 'active' | 'paused' | 'completed') => {
    if (!activeLobby || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      applyLobbyUpdate(await updateLobbyStatus(activeLobby.room_code, newStatus));
    } catch (err) {
      reportError(err, 'Could not change the lab status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Student roster: initial load, then merge realtime changes
  useEffect(() => {
    if (!activeRoomCode) return;
    let cancelled = false;
    const fetchStudents = async () => {
      try {
        const studs = await getLobbyStudents(activeRoomCode);
        if (!cancelled) setRealStudents(studs);
      } catch (err) {
        if (!cancelled) reportError(err, 'Could not load students.');
      }
    };
    fetchStudents();
    const unsub = subscribeToLobbyUpdates(activeRoomCode, (change) => {
      if (change.table === 'lab_students') {
        setRealStudents((prev) => upsertStudent(prev, change.student, change.deleted));
      } else if (change.table === 'lab_lobbies') {
        applyLobbyUpdate(change.lobby);
      } else {
        fetchStudents();
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [activeRoomCode]);

  const copyRoomCode = () => {
    if (!activeLobby) return;
    navigator.clipboard.writeText(activeLobby.room_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyRoomLink = () => {
    if (!activeLobby) return;
    const url = `${window.location.origin}/join?code=${activeLobby.room_code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const saveBroadcast = async (updates: Parameters<typeof updateLobbyBroadcast>[1]) => {
    if (!activeLobby) return false;
    try {
      applyLobbyUpdate(await updateLobbyBroadcast(activeLobby.room_code, updates));
      return true;
    } catch (err) {
      reportError(err, 'Could not update the broadcast.');
      return false;
    }
  };

  const handleToggleFollowMode = async () => {
    const nextFollow = !followMode;
    setFollowMode(nextFollow);
    if (!(await saveBroadcast({ follow_mode: nextFollow }))) setFollowMode(!nextFollow);
  };

  const handleToggleViewingPermission = async () => {
    const nextEnabled = !broadcastEnabled;
    setBroadcastEnabled(nextEnabled);
    if (!(await saveBroadcast({ broadcast_enabled: nextEnabled }))) setBroadcastEnabled(!nextEnabled);
  };

  const handleBroadcastCodeSubmit = async () => {
    setIsSavingBroadcast(true);
    const ok = await saveBroadcast({
      broadcast_code: broadcastCode,
      broadcast_enabled: broadcastEnabled,
      follow_mode: followMode,
    });
    setIsSavingBroadcast(false);
    if (ok) {
      setBroadcastSuccessNotice(true);
      setTimeout(() => setBroadcastSuccessNotice(false), 2500);
    }
  };

  // Statistics derived from real students, with idle detection
  const now = time.getTime();
  const studentsWithStatus = realStudents
    .map((s) => ({ ...s, status: effectiveStudentStatus(s, now) }))
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || a.student_name.localeCompare(b.student_name));
  const needsHelp = studentsWithStatus.filter((s) => s.status === 'needs_help');
  const stuck = studentsWithStatus.filter((s) => s.status === 'stuck');
  const coding = studentsWithStatus.filter((s) => s.status === 'coding' || s.status === 'active');
  const completed = studentsWithStatus.filter((s) => s.status === 'completed');
  const selectedStudent = studentsWithStatus.find((s) => s.id === selectedStudentId) ?? null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'needs_help': return 'var(--accent-danger)';
      case 'stuck': return 'var(--accent-warning)';
      case 'coding': return 'var(--accent-success)';
      case 'completed': return 'var(--accent-info)';
      default: return 'var(--text-tertiary)';
    }
  };

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-tertiary)', fontSize: 13 }}>
        <div className="loading-spinner" style={{ marginRight: 8 }} />
        Loading dashboard…
      </div>
    );
  }

  if (!teacher) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: 16 }}>
        <div style={{ maxWidth: 400, width: '100%', padding: 24, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Instructor sign-in required</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
            The dashboard shows your labs and students. Sign in with your institutional account to continue.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-ghost" onClick={() => router.push('/')} style={{ height: 32, fontSize: 12, padding: '0 14px' }}>
              Home
            </button>
            <button className="btn btn-primary" onClick={() => setShowAuthModal(true)} style={{ height: 32, fontSize: 12, padding: '0 14px', gap: 6 }}>
              <ShieldCheck size={13} />
              Sign in
            </button>
          </div>
        </div>
        <TeacherAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={(t) => {
            setShowAuthModal(false);
            setTeacher(t);
            listTeacherLobbies(t)
              .then((list) => {
                setLobbies(list);
                setActiveLobby(list[0] ?? null);
              })
              .catch((err) => reportError(err, 'Could not load your labs.'));
          }}
        />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      overflow: 'auto',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: '1px solid var(--border-default)',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="btn btn-ghost" onClick={() => router.push('/')} style={{ padding: '6px' }}>
            <ArrowLeft size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              background: 'linear-gradient(135deg, var(--brand), var(--brand-light))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Zap size={14} color="#080808" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Instructor Dashboard</span>
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--border-default)' }} />

          {/* Active Lab Rooms Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', maxWidth: 460 }}>
            {lobbies.map((lobby) => {
              const isSelected = activeLobby?.id === lobby.id;
              const isLobbyPaused = lobby.status === 'paused';
              const isLobbyEnded = lobby.status === 'completed';
              return (
                <button
                  key={lobby.id}
                  onClick={() => setActiveLobby(lobby)}
                  className={`btn ${isSelected ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    height: 28,
                    fontSize: 11,
                    padding: '0 10px',
                    borderRadius: 4,
                    whiteSpace: 'nowrap',
                    gap: 6,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={`Status: ${lobby.status || 'active'}`}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isLobbyPaused
                        ? 'var(--accent-warning)'
                        : isLobbyEnded
                        ? 'var(--text-muted)'
                        : 'var(--accent-success)',
                    }}
                  />
                  <span>{lobby.course}: #{lobby.room_code}</span>
                </button>
              );
            })}
            <button
              className="btn btn-secondary"
              onClick={() => setShowCreateModal(true)}
              style={{
                height: 28,
                fontSize: 11,
                padding: '0 9px',
                gap: 4,
                borderRadius: 4,
                whiteSpace: 'nowrap',
              }}
              title="Create a new lab room"
            >
              <Plus size={12} />
              New Lab
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {teacher ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 4,
                background: 'rgba(212, 148, 58, 0.1)',
                border: '1px solid rgba(212, 148, 58, 0.28)',
                fontSize: 12,
              }}>
                <GraduationCap size={14} style={{ color: 'var(--brand-light)' }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{teacher.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({teacher.email})</span>
              </div>
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  await logoutTeacher();
                  router.push('/login');
                }}
                style={{ height: 28, fontSize: 11, padding: '0 8px', gap: 4, borderRadius: 4 }}
                title="Sign out of instructor account"
              >
                <LogOut size={12} />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => setShowAuthModal(true)}
              style={{ height: 28, fontSize: 11, padding: '0 10px', gap: 5, borderRadius: 4 }}
            >
              <ShieldCheck size={12} />
              Faculty Sign In (@mitaoe.ac.in)
            </button>
          )}

          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {time.toLocaleTimeString()}
          </span>
        </div>
      </header>

      {/* Active Lab Room Bar */}
      {activeLobby && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 24px',
            background: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-default)',
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                Active Session:
              </span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeLobby.title}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>({activeLobby.course} • {activeLobby.language})</span>
            </div>

            <div style={{ width: 1, height: 16, background: 'var(--border-default)' }} />

            {/* 6-Digit Room Code Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(212, 148, 58, 0.12)',
                border: '1px solid rgba(212, 148, 58, 0.35)',
                padding: '3px 10px',
                borderRadius: 4,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-light)' }}>
                ROOM CODE:
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  color: 'var(--text-primary)',
                }}
              >
                {activeLobby.room_code}
              </span>
              <button
                type="button"
                onClick={copyRoomCode}
                title="Copy 6-digit room code"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--brand-light)',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {copiedCode ? <Check size={13} style={{ color: 'var(--accent-success)' }} /> : <Copy size={13} />}
              </button>
            </div>

            <button
              type="button"
              onClick={copyRoomLink}
              className="btn btn-ghost"
              style={{ height: 26, fontSize: 11, padding: '0 8px', gap: 4, borderRadius: 3 }}
            >
              <Share2 size={12} />
              {copiedLink ? 'Link Copied!' : 'Copy Student Link'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Lab Status Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.06em',
                fontFamily: 'var(--font-mono, monospace)',
                background:
                  activeLobby.status === 'paused'
                    ? 'rgba(217, 119, 6, 0.15)'
                    : activeLobby.status === 'completed'
                    ? 'rgba(113, 113, 122, 0.15)'
                    : 'rgba(34, 197, 94, 0.15)',
                color:
                  activeLobby.status === 'paused'
                    ? 'var(--accent-warning)'
                    : activeLobby.status === 'completed'
                    ? 'var(--text-muted)'
                    : 'var(--accent-success)',
                border: `1px solid ${
                  activeLobby.status === 'paused'
                    ? 'rgba(217, 119, 6, 0.35)'
                    : activeLobby.status === 'completed'
                    ? 'rgba(113, 113, 122, 0.35)'
                    : 'rgba(34, 197, 94, 0.35)'
                }`,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'currentColor',
                }}
              />
              {activeLobby.status === 'paused'
                ? 'PAUSED'
                : activeLobby.status === 'completed'
                ? 'STOPPED'
                : 'ACTIVE'}
            </div>

            {/* Start / Pause / Stop Controls */}
            {activeLobby.status === 'paused' ? (
              <button
                type="button"
                onClick={() => handleStatusChange('active')}
                disabled={isUpdatingStatus}
                className="btn btn-primary"
                style={{ height: 26, fontSize: 11, padding: '0 9px', gap: 4, borderRadius: 3 }}
                title="Resume this lab: allows students to run code again"
              >
                <Play size={11} fill="currentColor" />
                Resume Lab
              </button>
            ) : activeLobby.status === 'completed' ? (
              <button
                type="button"
                onClick={() => handleStatusChange('active')}
                disabled={isUpdatingStatus}
                className="btn btn-primary"
                style={{ height: 26, fontSize: 11, padding: '0 9px', gap: 4, borderRadius: 3 }}
                title="Restart lab session for students"
              >
                <Play size={11} fill="currentColor" />
                Start Lab
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleStatusChange('paused')}
                disabled={isUpdatingStatus}
                className="btn btn-secondary"
                style={{ height: 26, fontSize: 11, padding: '0 9px', gap: 4, borderRadius: 3 }}
                title="Pause lab: prevents student code execution while you lecture"
              >
                <Pause size={11} fill="currentColor" />
                Pause Lab
              </button>
            )}

            {activeLobby.status !== 'completed' && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Stop Lab #${activeLobby.room_code}? This will end the active session.`)) {
                    handleStatusChange('completed');
                  }
                }}
                disabled={isUpdatingStatus}
                className="btn btn-ghost"
                style={{
                  height: 26,
                  fontSize: 11,
                  padding: '0 8px',
                  gap: 4,
                  borderRadius: 3,
                  color: 'var(--accent-danger)',
                }}
                title="Stop / Complete lab session"
              >
                <Square size={11} fill="currentColor" />
                Stop Lab
              </button>
            )}

            <div style={{ width: 1, height: 16, background: 'var(--border-default)', margin: '0 2px' }} />

            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: realStudents.length > 0 ? 'var(--accent-success)' : 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>
              <Users size={13} />
              {realStudents.length} {realStudents.length === 1 ? 'Student' : 'Students'} Joined
            </span>
            <button
              className="btn btn-primary"
              onClick={() => router.push(`/ide?room=${activeLobby.room_code}&role=teacher`)}
              style={{ height: 28, fontSize: 11, padding: '0 10px', gap: 5, borderRadius: 4 }}
              title="Join this lab room as instructor in the full IDE"
            >
              <Code2 size={13} />
              Join Lab in IDE
              <ExternalLink size={11} />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 24px', fontSize: 12, background: 'rgba(224, 74, 59, 0.12)', borderBottom: '1px solid rgba(224, 74, 59, 0.3)', color: 'var(--accent-danger)' }}>
          <span>{error}</span>
          <button className="btn btn-ghost" onClick={() => setError(null)} style={{ height: 22, fontSize: 11, padding: '0 8px' }}>
            Dismiss
          </button>
        </div>
      )}

      {isDemoMode && (
        <div style={{ padding: '6px 24px', fontSize: 12, background: 'rgba(91, 141, 184, 0.12)', borderBottom: '1px solid rgba(91, 141, 184, 0.3)', color: 'var(--accent-info)' }}>
          Demo mode — labs and students are stored in this browser only, so students must use this same browser. Configure Supabase (see README) to run real labs.
        </div>
      )}

      {!activeLobby && (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>No labs yet</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Create a lab to get a 6-digit room code your students can join.
          </p>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ height: 34, fontSize: 13, padding: '0 16px', gap: 6 }}>
            <Plus size={14} />
            Create your first lab
          </button>
        </div>
      )}

      {activeLobby && (<>
      {/* Mode Banner */}
      <div className={`mode-banner ${followMode ? 'mode-follow' : 'mode-practice'}`}>
        {followMode ? (
          <>
            <span className="live-dot" />
            <span>📡 Follow Mode Active — Your code is broadcasting live into every student&apos;s split screen</span>
          </>
        ) : (
          <span>✏️ Practice Mode — Students are coding independently on their local machines</span>
        )}
      </div>

      {/* Dashboard Content */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: 16,
        padding: 16,
        height: 'calc(100vh - 128px)',
        overflow: 'hidden',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.3s ease-out',
      }}>
        {/* Left: Main Content (Stats + Professor Code Broadcast + Help Queue) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Raised Hand', value: needsHelp.length, icon: <AlertTriangle size={16} />, color: 'var(--accent-danger)' },
              { label: 'Stuck (repeated errors)', value: stuck.length, icon: <Clock size={16} />, color: 'var(--accent-warning)' },
              { label: 'Coding', value: coding.length, icon: <Code2 size={16} />, color: 'var(--accent-success)' },
              { label: 'Finished', value: completed.length, icon: <CheckCircle size={16} />, color: 'var(--accent-info)' },
            ].map((stat, i) => (
              <div key={i} className="glass-panel" style={{ padding: '12px 14px', borderRadius: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {stat.label}
                  </span>
                  <span style={{ color: stat.color }}>{stat.icon}</span>
                </div>
                <span style={{ fontSize: 26, fontWeight: 800, color: stat.color }}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>

          {selectedStudent ? (
            <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Eye size={15} style={{ color: 'var(--brand-light)' }} />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{selectedStudent.student_name}&apos;s code</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {selectedStudent.current_file || ''} • live
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setSelectedStudentId(null)}
                  style={{ height: 26, fontSize: 11, padding: '0 10px', borderRadius: 4, gap: 4 }}
                >
                  <ArrowLeft size={12} />
                  Back to broadcast
                </button>
              </div>
              {selectedStudent.error_category && (
                <div style={{ padding: '6px 14px', fontSize: 12, background: 'rgba(224, 74, 59, 0.08)', color: 'var(--accent-danger-light)', borderBottom: '1px solid var(--border)' }}>
                  <strong>{selectedStudent.error_tier?.toUpperCase()}:</strong> {selectedStudent.error_category}
                </div>
              )}
              <pre style={{
                flex: 1,
                margin: 0,
                padding: 14,
                overflow: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: 12.5,
                lineHeight: 1.6,
                color: 'var(--text-primary)',
                background: 'var(--bg-secondary)',
                whiteSpace: 'pre',
              }}>
                {selectedStudent.code_snapshot || '// No code received from this student yet.'}
              </pre>
            </div>
          ) : (
          <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Radio size={15} style={{ color: followMode ? 'var(--accent-danger)' : 'var(--brand-light)' }} />
                <span style={{ fontWeight: 700, fontSize: 13 }}>Professor Live Code Broadcast</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  (Room #{activeLobby?.room_code})
                </span>
              </div>

              {/* Broadcast Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Follow Mode Toggle */}
                <button
                  type="button"
                  onClick={handleToggleFollowMode}
                  className={`btn ${followMode ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    height: 26,
                    fontSize: 11,
                    padding: '0 10px',
                    borderRadius: 4,
                    gap: 5,
                    border: followMode ? 'none' : '1px solid var(--border)',
                  }}
                  title="Toggle Follow Mode: forces all student IDEs to open your code in split screen"
                >
                  <Radio size={12} />
                  {followMode ? 'Follow Mode: ON' : 'Follow Mode: OFF'}
                </button>

                {/* Viewing Permission Toggle */}
                <button
                  type="button"
                  onClick={handleToggleViewingPermission}
                  className="btn btn-secondary"
                  style={{
                    height: 26,
                    fontSize: 11,
                    padding: '0 10px',
                    borderRadius: 4,
                    gap: 5,
                    color: broadcastEnabled ? 'var(--accent-success)' : 'var(--accent-danger)',
                    borderColor: broadcastEnabled ? 'rgba(61, 140, 111, 0.4)' : 'rgba(224, 74, 59, 0.4)',
                  }}
                  title={broadcastEnabled ? 'Click to hide and disable code viewing for students' : 'Click to enable code viewing for students'}
                >
                  {broadcastEnabled ? <Eye size={12} /> : <EyeOff size={12} />}
                  {broadcastEnabled ? 'Viewing: Enabled' : 'Viewing: Disabled'}
                </button>

                {/* Broadcast / Save Button */}
                <button
                  type="button"
                  onClick={handleBroadcastCodeSubmit}
                  disabled={isSavingBroadcast}
                  className="btn btn-primary"
                  style={{
                    height: 26,
                    fontSize: 11,
                    padding: '0 12px',
                    borderRadius: 4,
                    gap: 5,
                  }}
                >
                  {isSavingBroadcast ? <Clock size={12} /> : <Send size={12} />}
                  {isSavingBroadcast ? 'Broadcasting...' : 'Broadcast to Class'}
                </button>
              </div>
            </div>

            {/* Editor Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12, overflow: 'hidden' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
                fontSize: 11,
                color: 'var(--text-secondary)',
              }}>
                <span>Type or paste demonstration code below to broadcast to all connected students:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {broadcastSuccessNotice && (
                    <span style={{ color: 'var(--accent-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Check size={12} /> Broadcast updated to students!
                    </span>
                  )}
                  {!broadcastEnabled && (
                    <span style={{ color: 'var(--accent-danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <EyeOff size={12} /> Code viewing is disabled for students
                    </span>
                  )}
                </div>
              </div>

              <textarea
                value={broadcastCode}
                onChange={(e) => setBroadcastCode(e.target.value)}
                placeholder="// Enter instructor demonstration code to broadcast to students..."
                style={{
                  flex: 1,
                  width: '100%',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '12px 14px',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: 'var(--text-primary)',
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 8,
                fontSize: 11,
                color: 'var(--text-muted)',
              }}>
                <span>
                  Language: <strong style={{ color: 'var(--text-primary)' }}>{activeLobby?.language.toUpperCase()}</strong> • Students receive changes automatically via Realtime & Broadcast channels
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    if (activeLobby?.starter_code) {
                      setBroadcastCode(activeLobby.starter_code);
                    }
                  }}
                  style={{ height: 22, fontSize: 10, padding: '0 6px' }}
                >
                  <Sparkles size={10} style={{ marginRight: 4 }} />
                  Reset to Starter Code
                </button>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Right: Real Student Queue & Attendance List */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={14} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>Connected Students</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {realStudents.length} in room #{activeLobby?.room_code}
            </span>
          </div>

          <div className="panel-body" style={{ flex: 1, padding: 12, overflow: 'auto' }}>
            {realStudents.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '24px 16px',
                textAlign: 'center',
                gap: 12,
              }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 6,
                  background: 'rgba(212, 148, 58, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--brand-light)',
                }}>
                  <Users size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                    No Students in Room Yet
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 280 }}>
                    Students can join this lab session by entering the 6-digit access code:
                  </div>
                </div>

                <div
                  onClick={copyRoomCode}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    borderRadius: 4,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                  title="Click to copy code"
                >
                  <span style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 20,
                    fontWeight: 800,
                    letterSpacing: '0.14em',
                    color: 'var(--brand-light)',
                  }}>
                    {activeLobby?.room_code}
                  </span>
                  <Copy size={14} style={{ color: 'var(--text-muted)' }} />
                </div>

                <button
                  type="button"
                  onClick={copyRoomLink}
                  className="btn btn-secondary"
                  style={{ fontSize: 11, padding: '0 12px', height: 28, borderRadius: 4, gap: 5 }}
                >
                  <Share2 size={12} />
                  {copiedLink ? 'Link Copied!' : 'Copy Direct Student Join Link'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {studentsWithStatus.map((student) => {
                  const isSelected = selectedStudentId === student.id;
                  return (
                    <div
                      key={student.id}
                      onClick={() => setSelectedStudentId(isSelected ? null : student.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 4,
                        background: isSelected ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                        border: isSelected
                          ? '1px solid var(--brand-light)'
                          : '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: getStatusColor(student.status),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#fff',
                          }}>
                            {student.student_name.slice(0, 1).toUpperCase()}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                              {student.student_name}
                            </span>
                            <span style={{
                              fontSize: 10,
                              fontFamily: 'var(--font-mono, monospace)',
                              color: 'var(--brand-light)',
                              fontWeight: 600,
                              letterSpacing: '0.04em',
                            }}>
                              PRN: {student.prn || 'N/A'}
                            </span>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            padding: '2px 6px',
                            borderRadius: 3,
                            background: `${getStatusColor(student.status)}22`,
                            color: getStatusColor(student.status),
                          }}
                        >
                          {student.status.replace('_', ' ')}
                        </span>
                      </div>

                      {student.error_category && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11,
                          color: 'var(--accent-danger-light)',
                          marginTop: 6,
                          padding: '4px 6px',
                          borderRadius: 3,
                          background: 'rgba(224, 74, 59, 0.08)',
                        }}>
                          <Flame size={11} />
                          <span style={{ fontWeight: 600 }}>{student.error_tier?.toUpperCase()}:</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {student.error_category}
                          </span>
                        </div>
                      )}

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 6,
                        fontSize: 10,
                        color: 'var(--text-muted)',
                      }}>
                        <span>File: {student.current_file || 'main'}</span>
                        <span>Joined: {new Date(student.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Student Quick Action Footer */}
          {selectedStudent && (
            <div style={{
              padding: '12px',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-tertiary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedStudent.student_name}
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono, monospace)',
                  color: 'var(--brand-light)',
                  background: 'rgba(212, 148, 58, 0.12)',
                  border: '1px solid rgba(212, 148, 58, 0.3)',
                  padding: '2px 6px',
                  borderRadius: 3,
                }}>
                  PRN: {selectedStudent.prn || 'N/A'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Status: {selectedStudent.status} • {selectedStudent.error_category || 'No active syntax errors reported'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Last active {new Date(selectedStudent.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • their code is shown on the left
              </div>
            </div>
          )}
        </div>
      </div>

      </>)}

      {/* Create Lobby Modal */}
      <CreateLobbyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onLobbyCreated={(newLobby) => {
          setActiveLobby(newLobby);
          refreshLobbies();
        }}
      />

      {/* Teacher Authentication Modal */}
      <TeacherAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={(t) => {
          setTeacher(t);
          setShowAuthModal(false);
        }}
      />
    </div>
  );
}
