'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap,
  ArrowRight,
  Code2,
  LayoutDashboard,
  Sparkles,
  Shield,
  Monitor,
  BookOpen,
  Users,
  GraduationCap,
  Building2,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

function useCountUp(end: number, duration: number = 2000, start: boolean = false) {
  const [count, setCount] = useState(0);
  const ref = useRef<NodeJS.Timeout>(null);

  useEffect(() => {
    if (!start) return;
    const stepTime = 20;
    const steps = duration / stepTime;
    const increment = end / steps;
    let current = 0;

    ref.current = setInterval(() => {
      current += increment;
      if (current >= end) {
        setCount(end);
        if (ref.current) clearInterval(ref.current);
      } else {
        setCount(Math.floor(current));
      }
    }, stepTime);

    return () => { if (ref.current) clearInterval(ref.current); };
  }, [end, duration, start]);

  return count;
}

export default function LandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const stat1 = useCountUp(1457, 2200, mounted);
  const stat2 = useCountUp(60, 1800, mounted);
  const stat3 = useCountUp(5, 1400, mounted);
  const stat4 = useCountUp(90, 2000, mounted);

  const features = [
    {
      icon: <Code2 size={20} strokeWidth={2.2} />,
      title: 'Zero-Setup Cloud IDE',
      desc: 'Browser-based code editor with integrated terminal. No compiler installation, no version conflicts — students open a link and start coding.',
      color: '#6366f1',
    },
    {
      icon: <Monitor size={20} strokeWidth={2.2} />,
      title: 'Live Code Sync',
      desc: 'Follow Mode broadcasts the professor\'s code in real-time to every connected student — side-by-side with their own workspace.',
      color: '#06b6d4',
    },
    {
      icon: <Sparkles size={20} strokeWidth={2.2} />,
      title: 'AI Lab Assistant',
      desc: 'Guided hints, never answers. Asks "What happens when i reaches 5?" — not "here\'s the fix." Students build debugging instinct.',
      color: '#eab308',
    },
    {
      icon: <LayoutDashboard size={20} strokeWidth={2.2} />,
      title: 'Instructor Dashboard',
      desc: 'Real-time queue of stuck students, class-wide error heatmap, and per-student progress memory that tracks recurring struggles.',
      color: '#22c55e',
    },
    {
      icon: <BookOpen size={20} strokeWidth={2.2} />,
      title: 'Error Classification Engine',
      desc: 'Three-tier diagnosis: Syntax → Logic → Conceptual. Every error is classified, not just displayed — so the professor knows the root cause.',
      color: '#ef4444',
    },
    {
      icon: <Shield size={20} strokeWidth={2.2} />,
      title: 'Academic Integrity',
      desc: 'AST-level code similarity detection catches structural copying. AI-generated code flagging compares against student coding history.',
      color: '#3b82f6',
    },
  ];

  const makeDelay = (i: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(24px)',
    transition: `all 0.5s var(--ease-out-expo) ${0.08 * i}s`,
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', overflow: 'auto' }}>
      {/* ─── Navigation ─── */}
      <nav className="landing-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--brand-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(99, 102, 241, 0.3)',
          }}>
            <Zap size={18} color="white" strokeWidth={2.5} />
          </div>
          <span style={{
            fontSize: 19,
            fontWeight: 900,
            letterSpacing: '-0.04em',
            background: 'var(--brand-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            SignalClass
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => router.push('/ide')}>
            <Code2 size={14} />
            Student IDE
          </button>
          <button className="btn btn-primary" onClick={() => router.push('/dashboard')}>
            Professor Dashboard
            <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="hero-section">
        <div className="hero-glow" />
        <div className="hero-glow-2" />

        <div className="hero-pill" style={makeDelay(0)}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--accent-success)',
            animation: 'pulse-dot 1.5s ease-in-out infinite',
          }} />
          Prototype v1.0 — Built for SIH 2025
        </div>

        <h1 className="hero-title" style={makeDelay(1)}>
          The professor who always
          <br />
          knows{' '}
          <span className="hero-gradient-text">where to look</span>
        </h1>

        <p className="hero-subtitle" style={makeDelay(2)}>
          SignalClass replaces the passive, screen-shared lab session with
          <strong style={{ color: 'var(--text-primary)' }}> diagnostic intelligence</strong> —
          so professors spend time solving problems, not discovering them.
        </p>

        <div style={{ display: 'flex', gap: 14, ...makeDelay(3) }}>
          <button
            className="btn btn-primary"
            onClick={() => router.push('/ide')}
            style={{ padding: '11px 26px', fontSize: 14 }}
          >
            <Code2 size={16} />
            Open Student IDE
            <ExternalLink size={12} style={{ opacity: 0.6, marginLeft: 2 }} />
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/dashboard')}
            style={{ padding: '11px 26px', fontSize: 14 }}
          >
            <LayoutDashboard size={16} />
            Instructor Dashboard
          </button>
        </div>
      </section>

      {/* ─── Stats (CodeTantra-inspired counter row) ─── */}
      <section className="stats-section">
        {[
          { icon: <Building2 size={20} />, value: stat1.toLocaleString(), suffix: '+', label: 'Institutions Ready', color: 'var(--brand-primary-light)' },
          { icon: <Users size={20} />, value: stat2.toString(), suffix: '+', label: 'Students Per Lab', color: 'var(--accent-cyan)' },
          { icon: <GraduationCap size={20} />, value: stat3.toString(), suffix: '', label: 'Languages Supported', color: 'var(--accent-success)' },
          { icon: <CheckCircle2 size={20} />, value: stat4.toString(), suffix: '+', label: 'Error Patterns', color: 'var(--accent-warning)' },
        ].map((stat, i) => (
          <div key={i} className="stat-item" style={makeDelay(i + 4)}>
            <div style={{ color: stat.color, marginBottom: 8 }}>{stat.icon}</div>
            <div className="stat-number" style={{ color: stat.color }}>
              {stat.value}{stat.suffix}
            </div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </section>

      {/* ─── Features Grid ─── */}
      <section style={{ paddingTop: 60 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            ...makeDelay(8),
          }}>
            Seven core components,{' '}
            <span className="hero-gradient-text">one platform</span>
          </h2>
          <p style={{
            fontSize: 15,
            color: 'var(--text-secondary)',
            maxWidth: 500,
            margin: '12px auto 0',
            ...makeDelay(9),
          }}>
            Each built with diagnostic intelligence at its core — not just visibility.
          </p>
        </div>

        <div className="feature-grid">
          {features.map((f, i) => (
            <div
              key={i}
              className="glass-panel feature-card"
              style={makeDelay(i + 10)}
            >
              <div
                className="feature-icon"
                style={{ background: `linear-gradient(135deg, ${f.color}, ${f.color}88)` }}
              >
                {f.icon}
              </div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How it Works ─── */}
      <section style={{
        padding: '60px 40px 80px',
        maxWidth: 900,
        margin: '0 auto',
      }}>
        <h2 style={{
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          textAlign: 'center',
          marginBottom: 40,
        }}>
          How a lab session works with{' '}
          <span className="hero-gradient-text">SignalClass</span>
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { step: 1, text: 'Student opens the zero-setup cloud IDE — no local installation required.' },
            { step: 2, text: 'Professor begins in Follow Mode; live code mirrors into every student\'s reference pane.' },
            { step: 3, text: 'Lab shifts to Practice Mode; students code independently.' },
            { step: 4, text: 'When a student hits an error, the classification engine tags it — Syntax, Logic, or Conceptual.' },
            { step: 5, text: 'The AI assistant offers one guided hint — prompting the student to reason toward the fix.' },
            { step: 6, text: 'If unresolved, the issue escalates to the professor\'s live dashboard with the diagnosis attached.' },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 20,
                padding: '18px 0',
                borderBottom: i < 5 ? '1px solid var(--border)' : 'none',
                ...makeDelay(i + 16),
              }}
            >
              <div style={{
                minWidth: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--brand-glow)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--brand-primary-light)',
                flexShrink: 0,
              }}>
                {item.step}
              </div>
              <p style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: 'var(--text-secondary)',
                margin: 0,
                paddingTop: 6,
              }}>
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>SignalClass</span>
          {' · '}
          Diagnostic intelligence for college programming labs
        </div>
        <div>Prototype — Built for SIH 2025</div>
      </footer>
    </div>
  );
}
