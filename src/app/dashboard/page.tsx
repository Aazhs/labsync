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
} from 'lucide-react';
import {
  listActiveLobbies,
  getLobbyStudents,
  subscribeToLobbyUpdates,
  updateLobbyBroadcast,
  LabLobby,
  LabStudent,
} from '@/lib/lobbyService';
import CreateLobbyModal from '@/components/CreateLobbyModal';

const emptySubscribe = () => () => {};

export default function DashboardPage() {
  const router = useRouter();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [selectedStudent, setSelectedStudent] = useState<LabStudent | null>(null);
  const [time, setTime] = useState(new Date());

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

  // Clock
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch active lobbies on load
  useEffect(() => {
    let isSubscribed = true;
    listActiveLobbies().then((list) => {
      if (isSubscribed) {
        setLobbies(list);
        if (list.length > 0) {
          setActiveLobby((prev) => prev ?? list[0]);
        }
      }
    });
    return () => {
      isSubscribed = false;
    };
  }, []);

  // Sync professor broadcast controls whenever active lobby changes
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
  }, [activeLobby]);

  const refreshLobbies = async () => {
    const list = await listActiveLobbies();
    setLobbies(list);
    if (list.length > 0) {
      setActiveLobby((prev) => {
        if (!prev) return list[0];
        const match = list.find((l) => l.room_code === prev.room_code);
        return match ?? list[0];
      });
    }
  };

  // Realtime subscription to students and room changes
  useEffect(() => {
    if (!activeLobby) return;
    const fetchStudentsAndLobby = async () => {
      const studs = await getLobbyStudents(activeLobby.room_code);
      setRealStudents(studs);
    };
    fetchStudentsAndLobby();
    const unsub = subscribeToLobbyUpdates(activeLobby.room_code, fetchStudentsAndLobby);
    return () => unsub();
  }, [activeLobby]);

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

  // Handle broadcast updates
  const handleToggleFollowMode = async () => {
    if (!activeLobby) return;
    const nextFollow = !followMode;
    setFollowMode(nextFollow);
    await updateLobbyBroadcast(activeLobby.room_code, {
      follow_mode: nextFollow,
    });
    await refreshLobbies();
  };

  const handleToggleViewingPermission = async () => {
    if (!activeLobby) return;
    const nextEnabled = !broadcastEnabled;
    setBroadcastEnabled(nextEnabled);
    await updateLobbyBroadcast(activeLobby.room_code, {
      broadcast_enabled: nextEnabled,
    });
    await refreshLobbies();
  };

  const handleBroadcastCodeSubmit = async () => {
    if (!activeLobby) return;
    setIsSavingBroadcast(true);
    try {
      await updateLobbyBroadcast(activeLobby.room_code, {
        broadcast_code: broadcastCode,
        broadcast_enabled: broadcastEnabled,
        follow_mode: followMode,
      });
      setBroadcastSuccessNotice(true);
      setTimeout(() => setBroadcastSuccessNotice(false), 2500);
      await refreshLobbies();
    } finally {
      setIsSavingBroadcast(false);
    }
  };

  // Real statistics derived strictly from real students
  const needsHelp = realStudents.filter((s) => s.status === 'needs_help');
  const stuck = realStudents.filter((s) => s.status === 'stuck');
  const coding = realStudents.filter((s) => s.status === 'coding' || s.status === 'active');
  const idle = realStudents.filter((s) => s.status === 'idle');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'needs_help': return 'var(--accent-danger)';
      case 'stuck': return 'var(--accent-warning)';
      case 'coding': return 'var(--accent-success)';
      case 'completed': return 'var(--accent-info)';
      default: return 'var(--text-tertiary)';
    }
  };

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
            {lobbies.map((lobby) => (
              <button
                key={lobby.id}
                onClick={() => setActiveLobby(lobby)}
                className={`btn ${activeLobby?.id === lobby.id ? 'btn-primary' : 'btn-ghost'}`}
                style={{
                  height: 28,
                  fontSize: 11,
                  padding: '0 10px',
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{lobby.course}: #{lobby.room_code}</span>
              </button>
            ))}
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
            >
              <Plus size={12} />
              New Lab
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: realStudents.length > 0 ? 'var(--accent-success)' : 'var(--text-muted)', fontWeight: 600, fontSize: 12 }}>
              <Users size={13} />
              {realStudents.length} {realStudents.length === 1 ? 'Student' : 'Students'} Joined
            </span>
            <button
              className="btn btn-primary"
              onClick={() => router.push(`/ide?room=${activeLobby.room_code}&role=teacher`)}
              style={{ height: 28, fontSize: 11, padding: '0 10px', gap: 5, borderRadius: 4 }}
            >
              <Code2 size={13} />
              Open Teacher IDE
              <ExternalLink size={11} />
            </button>
          </div>
        </div>
      )}

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
              { label: 'Connected Students', value: realStudents.length, icon: <Users size={16} />, color: 'var(--text-primary)' },
              { label: 'Need Assistance', value: needsHelp.length, icon: <AlertTriangle size={16} />, color: 'var(--accent-danger)' },
              { label: 'Stuck in Loop / Error', value: stuck.length, icon: <Clock size={16} />, color: 'var(--accent-warning)' },
              { label: 'Actively Coding', value: coding.length + idle.length, icon: <CheckCircle size={16} />, color: 'var(--accent-success)' },
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

          {/* Professor Code Broadcast & Live Sync Panel */}
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
                {realStudents.map((student) => {
                  const isSelected = selectedStudent?.id === student.id;
                  return (
                    <div
                      key={student.id}
                      onClick={() => setSelectedStudent(student)}
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
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                            {student.student_name}
                          </span>
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
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
                {selectedStudent.student_name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Status: {selectedStudent.status} • {selectedStudent.error_category || 'No active syntax errors reported'}
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => router.push(`/ide?room=${activeLobby?.room_code}&role=teacher&viewStudent=${encodeURIComponent(selectedStudent.student_name)}`)}
                style={{ width: '100%', height: 28, fontSize: 11, borderRadius: 4, gap: 5 }}
              >
                <Code2 size={13} />
                Open Student in Teacher IDE
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Lobby Modal */}
      <CreateLobbyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onLobbyCreated={(newLobby) => {
          setActiveLobby(newLobby);
          refreshLobbies();
        }}
      />
    </div>
  );
}
