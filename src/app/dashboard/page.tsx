'use client';

import { useState, useEffect } from 'react';
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
  TrendingUp,
  Flame,
  CircleAlert,
  Brain,
  Activity,
} from 'lucide-react';

// Mock student data for prototype
const MOCK_STUDENTS = [
  { id: 1, name: 'Arjun Patel', status: 'needs_help', errorTier: 'conceptual', errorCategory: 'Recursion misunderstanding', stuckDuration: '8m 23s', attempts: 7, hintUsed: true, hintResolved: false },
  { id: 2, name: 'Priya Sharma', status: 'stuck', errorTier: 'logic', errorCategory: 'Off-by-one in loop', stuckDuration: '4m 12s', attempts: 4, hintUsed: true, hintResolved: false },
  { id: 3, name: 'Rahul Verma', status: 'stuck', errorTier: 'syntax', errorCategory: 'Missing semicolon', stuckDuration: '2m 05s', attempts: 3, hintUsed: false, hintResolved: false },
  { id: 4, name: 'Sneha Gupta', status: 'coding', errorTier: 'none', errorCategory: '', stuckDuration: '', attempts: 2, hintUsed: false, hintResolved: false },
  { id: 5, name: 'Vikram Singh', status: 'coding', errorTier: 'none', errorCategory: '', stuckDuration: '', attempts: 1, hintUsed: false, hintResolved: false },
  { id: 6, name: 'Ananya Reddy', status: 'needs_help', errorTier: 'logic', errorCategory: 'Incorrect condition check', stuckDuration: '6m 45s', attempts: 5, hintUsed: true, hintResolved: false },
  { id: 7, name: 'Karthik Iyer', status: 'idle', errorTier: 'none', errorCategory: '', stuckDuration: '', attempts: 0, hintUsed: false, hintResolved: false },
  { id: 8, name: 'Meera Nair', status: 'coding', errorTier: 'none', errorCategory: '', stuckDuration: '', attempts: 3, hintUsed: false, hintResolved: false },
  { id: 9, name: 'Rohan Das', status: 'stuck', errorTier: 'syntax', errorCategory: 'Undefined variable', stuckDuration: '1m 30s', attempts: 2, hintUsed: false, hintResolved: false },
  { id: 10, name: 'Divya Menon', status: 'resolved', errorTier: 'none', errorCategory: '', stuckDuration: '', attempts: 4, hintUsed: true, hintResolved: true },
];

// Heatmap data: concepts × error density
const HEATMAP_DATA = [
  { concept: 'Variables', syntax: 2, logic: 0, conceptual: 0 },
  { concept: 'Loops', syntax: 3, logic: 4, conceptual: 1 },
  { concept: 'Conditions', syntax: 1, logic: 3, conceptual: 0 },
  { concept: 'Functions', syntax: 2, logic: 1, conceptual: 2 },
  { concept: 'Recursion', syntax: 0, logic: 2, conceptual: 5 },
  { concept: 'Arrays', syntax: 3, logic: 3, conceptual: 1 },
  { concept: 'Pointers', syntax: 1, logic: 1, conceptual: 4 },
];

type Student = typeof MOCK_STUDENTS[0];

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [sessionMode, setSessionMode] = useState<'follow' | 'practice'>('practice');
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const needsHelp = MOCK_STUDENTS.filter((s) => s.status === 'needs_help');
  const stuck = MOCK_STUDENTS.filter((s) => s.status === 'stuck');
  const coding = MOCK_STUDENTS.filter((s) => s.status === 'coding');
  const idle = MOCK_STUDENTS.filter((s) => s.status === 'idle');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'needs_help': return 'var(--accent-danger)';
      case 'stuck': return 'var(--accent-warning)';
      case 'coding': return 'var(--accent-success)';
      case 'resolved': return 'var(--accent-info)';
      default: return 'var(--text-tertiary)';
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'syntax': return 'badge-error';
      case 'logic': return 'badge-warning';
      case 'conceptual': return 'badge-info';
      default: return '';
    }
  };

  const getHeatColor = (value: number) => {
    if (value === 0) return 'rgba(48, 54, 61, 0.4)';
    if (value <= 1) return 'rgba(239, 68, 68, 0.2)';
    if (value <= 2) return 'rgba(239, 68, 68, 0.35)';
    if (value <= 3) return 'rgba(239, 68, 68, 0.5)';
    if (value <= 4) return 'rgba(239, 68, 68, 0.7)';
    return 'rgba(239, 68, 68, 0.9)';
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost" onClick={() => router.push('/')}>
            <ArrowLeft size={16} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Zap size={14} color="white" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Instructor Dashboard</span>
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--border-default)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            CS201 — Data Structures Lab
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Session Mode Toggle */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-default)',
            overflow: 'hidden',
          }}>
            <button
              className={sessionMode === 'follow' ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)', fontSize: 12 }}
              onClick={() => setSessionMode('follow')}
            >
              Follow
            </button>
            <button
              className={sessionMode === 'practice' ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', fontSize: 12 }}
              onClick={() => setSessionMode('practice')}
            >
              Practice
            </button>
          </div>

          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {time.toLocaleTimeString()}
          </span>
        </div>
      </header>

      {/* Mode Banner */}
      <div className={`mode-banner ${sessionMode === 'follow' ? 'mode-follow' : 'mode-practice'}`}>
        {sessionMode === 'follow' 
          ? '📡 Follow Mode Active — your code is broadcasting to all students'
          : '✏️ Practice Mode — students are coding independently'
        }
      </div>

      {/* Dashboard Content */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 360px',
        gap: 16,
        padding: 16,
        height: 'calc(100vh - 120px)',
        overflow: 'hidden',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.3s ease-out',
      }}>
        {/* Left: Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Total Students', value: MOCK_STUDENTS.length, icon: <Users size={16} />, color: 'var(--text-primary)' },
              { label: 'Need Help', value: needsHelp.length, icon: <AlertTriangle size={16} />, color: 'var(--accent-danger)' },
              { label: 'Stuck', value: stuck.length, icon: <Clock size={16} />, color: 'var(--accent-warning)' },
              { label: 'Coding', value: coding.length + idle.length, icon: <CheckCircle size={16} />, color: 'var(--accent-success)' },
            ].map((stat, i) => (
              <div key={i} className="glass-panel" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {stat.label}
                  </span>
                  <span style={{ color: stat.color }}>{stat.icon}</span>
                </div>
                <span style={{ fontSize: 28, fontWeight: 800, color: stat.color }}>
                  {stat.value}
                </span>
              </div>
            ))}
          </div>

          {/* Student Queue + Heatmap Row */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, overflow: 'hidden' }}>
            {/* Student Queue */}
            <div className="panel" style={{ overflow: 'hidden' }}>
              <div className="panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Flame size={13} style={{ color: 'var(--accent-danger)' }} />
                  <span>Student Help Queue</span>
                </div>
                <span style={{ fontSize: 11 }}>{needsHelp.length + stuck.length} pending</span>
              </div>
              <div className="panel-body" style={{ padding: 8, overflow: 'auto' }}>
                {[...needsHelp, ...stuck, ...coding, ...idle].map((student) => (
                  <div
                    key={student.id}
                    className={`student-card ${student.status === 'needs_help' ? 'needs-help' : student.status === 'stuck' ? 'stuck' : 'coding'}`}
                    style={{ marginBottom: 6 }}
                    onClick={() => setSelectedStudent(student)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${getStatusColor(student.status)}, var(--bg-elevated))`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 600,
                        }}>
                          {student.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{student.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            {student.errorCategory || (student.status === 'coding' ? 'Working...' : student.status === 'idle' ? 'Not started' : 'Resolved')}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        {student.errorTier !== 'none' && (
                          <span className={`badge ${getTierBadge(student.errorTier)}`} style={{ fontSize: 10 }}>
                            {student.errorTier.toUpperCase()}
                          </span>
                        )}
                        {student.stuckDuration && (
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                            <Clock size={9} style={{ marginRight: 2 }} />
                            {student.stuckDuration}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Class Heatmap */}
            <div className="panel" style={{ overflow: 'hidden' }}>
              <div className="panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={13} style={{ color: 'var(--accent-warning)' }} />
                  <span>Class Error Heatmap</span>
                </div>
              </div>
              <div className="panel-body" style={{ padding: 16 }}>
                {/* Legend */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CircleAlert size={10} style={{ color: 'var(--accent-danger)' }} />
                    <span>Syntax</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Brain size={10} style={{ color: 'var(--accent-warning)' }} />
                    <span>Logic</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <TrendingUp size={10} style={{ color: 'var(--accent-info)' }} />
                    <span>Conceptual</span>
                  </div>
                </div>

                {/* Heatmap Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '100px repeat(3, 1fr)', gap: 4 }}>
                  {/* Header row */}
                  <div />
                  <div style={{ fontSize: 10, textAlign: 'center', color: 'var(--text-tertiary)', padding: 4 }}>Syntax</div>
                  <div style={{ fontSize: 10, textAlign: 'center', color: 'var(--text-tertiary)', padding: 4 }}>Logic</div>
                  <div style={{ fontSize: 10, textAlign: 'center', color: 'var(--text-tertiary)', padding: 4 }}>Concept</div>

                  {HEATMAP_DATA.map((row) => (
                    <>
                      <div key={`label-${row.concept}`} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0', display: 'flex', alignItems: 'center' }}>
                        {row.concept}
                      </div>
                      {[row.syntax, row.logic, row.conceptual].map((val, j) => (
                        <div
                          key={`${row.concept}-${j}`}
                          className="heatmap-cell"
                          style={{
                            background: getHeatColor(val),
                            height: 36,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 600,
                            color: val > 2 ? 'white' : 'var(--text-tertiary)',
                            cursor: 'pointer',
                          }}
                          title={`${row.concept}: ${val} errors`}
                        >
                          {val > 0 ? val : ''}
                        </div>
                      ))}
                    </>
                  ))}
                </div>

                {/* Insight */}
                <div style={{
                  marginTop: 16,
                  padding: '10px 14px',
                  background: 'rgba(245, 158, 11, 0.08)',
                  borderLeft: '3px solid var(--accent-warning)',
                  borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: 'var(--text-secondary)',
                }}>
                  🔥 <strong>Hot spot:</strong> Recursion (Conceptual) — 5 students are struggling with the concept itself, not just the syntax. Consider pausing for a class-wide explanation.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Student Detail Panel */}
        <div className="panel" style={{ overflow: 'hidden' }}>
          <div className="panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Eye size={13} />
              <span>Student Detail</span>
            </div>
          </div>
          <div className="panel-body" style={{ padding: 16 }}>
            {selectedStudent ? (
              <div className="animate-fade-in">
                {/* Student info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${getStatusColor(selectedStudent.status)}, var(--bg-elevated))`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    fontWeight: 700,
                  }}>
                    {selectedStudent.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{selectedStudent.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {selectedStudent.status === 'needs_help' ? '🔴 Needs Help' :
                       selectedStudent.status === 'stuck' ? '🟡 Stuck' :
                       selectedStudent.status === 'coding' ? '🟢 Coding' :
                       selectedStudent.status === 'idle' ? '⚪ Idle' : '🔵 Resolved'}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                  <div className="glass-panel" style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Attempts</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedStudent.attempts}</div>
                  </div>
                  <div className="glass-panel" style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>Stuck For</div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{selectedStudent.stuckDuration || '—'}</div>
                  </div>
                </div>

                {/* Error info */}
                {selectedStudent.errorTier !== 'none' && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>Current Error</div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 8,
                    }}>
                      <span className={`badge ${getTierBadge(selectedStudent.errorTier)}`}>
                        {selectedStudent.errorTier.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 13 }}>{selectedStudent.errorCategory}</span>
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: 'var(--text-tertiary)',
                    }}>
                      {selectedStudent.hintUsed ? (
                        selectedStudent.hintResolved 
                          ? '✅ AI hint resolved the issue'
                          : '⚠️ AI hint was not sufficient — manual intervention needed'
                      ) : (
                        '💡 Student has not requested AI hint yet'
                      )}
                    </div>
                  </div>
                )}

                {/* Mock code preview */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Student&apos;s Code Preview
                  </div>
                  <div style={{
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                    padding: '12px',
                    fontFamily: 'var(--font-mono), monospace',
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: 'var(--text-secondary)',
                    maxHeight: 200,
                    overflow: 'auto',
                  }}>
                    <div style={{ color: 'var(--text-tertiary)' }}>{`def fibonacci(n):`}</div>
                    <div style={{ color: selectedStudent.errorTier === 'conceptual' ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
                      {`    if n == 0:`}
                    </div>
                    <div>{`        return 0`}</div>
                    <div style={{ color: 'var(--accent-danger)' }}>{`    # Missing base case for n == 1`}</div>
                    <div>{`    return fibonacci(n-1) + fibonacci(n-2)`}</div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: 12 }}>
                    <Code2 size={13} />
                    View Full Code
                  </button>
                  <button className="btn btn-success" style={{ flex: 1, fontSize: 12 }}>
                    <CheckCircle size={13} />
                    Mark Resolved
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-tertiary)',
                fontSize: 13,
                gap: 8,
                textAlign: 'center',
              }}>
                <Eye size={28} style={{ opacity: 0.3 }} />
                <span>Select a student to view details</span>
                <span style={{ fontSize: 11 }}>Click on any student in the queue</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
