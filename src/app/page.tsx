'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTheme } from '@/lib/theme';
import {
  ArrowRight,
  Code2,
  LayoutDashboard,
  ExternalLink,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';

/* ─── Scroll reveal hook ─── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('visible');
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

function RevealDiv({ children, className = '', style = {}, delay = 0 }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}) {
  const ref = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={{ ...style, transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── High-performance RAF Counter (Isolated Leaf Component) ─── */
function StatCounter({ target, suffix = '', label, active }: {
  target: number;
  suffix?: string;
  label: string;
  active: boolean;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) return;
    let startTimestamp: number | null = null;
    const duration = 1600;
    let animId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(ease * target));

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [active, target]);

  return (
    <div style={{ textAlign: 'center' }}>
      <div className="stat-number">{count.toLocaleString()}{suffix}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      className="btn-icon"
      onClick={toggle}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);

  // Observe stats section
  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const features = [
    { num: '01', title: 'Zero-Setup Cloud IDE', desc: 'Students open a link and start coding. No compilers, no config, no version hell.' },
    { num: '02', title: 'Live Code Sync', desc: 'Follow Mode mirrors the professor\'s editor to every student in real-time.' },
    { num: '03', title: 'AI Lab Assistant', desc: 'Asks "what happens when i reaches 5?" — never gives the answer outright.' },
    { num: '04', title: 'Instructor Dashboard', desc: 'Real-time queue of stuck students with classified error diagnosis attached.' },
    { num: '05', title: 'Error Classification', desc: 'Three-tier engine: Syntax → Logic → Conceptual. Every error diagnosed, not just displayed.' },
    { num: '06', title: 'Academic Integrity', desc: 'AST-level similarity detection. AI-generated code flagging against student history.' },
  ];

  const steps = [
    'Student opens the zero-setup cloud IDE — no local installation required.',
    'Professor begins in Follow Mode; code mirrors into every student\'s reference pane.',
    'Lab shifts to Practice Mode; students code independently.',
    'When a student hits an error, the classification engine tags it — Syntax, Logic, or Conceptual.',
    'The AI assistant offers a guided hint — prompting reasoning, not spoon-feeding.',
    'If unresolved, the issue escalates to the professor\'s dashboard with the diagnosis attached.',
  ];

  return (
    <div className="landing-page">
      {/* ─── Navigation ─── */}
      <nav className="landing-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Image
            src="/logo.png"
            alt="LabSync"
            width={32}
            height={32}
            style={{ borderRadius: 'var(--radius-sm)' }}
          />
          <span style={{
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: 'var(--text-primary)',
          }}>
            LabSync
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThemeToggle />
          <button className="btn btn-ghost" onClick={() => router.push('/ide')}>
            Student IDE
          </button>
          <button className="btn btn-primary" onClick={() => router.push('/dashboard')}>
            Instructor Dashboard
            <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="hero-section">
        {/* Animated ambient glow orbs */}
        <div className="hero-glow-wrapper" aria-hidden="true">
          <div className="hero-glow-orb hero-glow-orb-amber" />
          <div className="hero-glow-orb hero-glow-orb-cyan" />
          <div className="hero-glow-orb hero-glow-orb-emerald" />
          <div className="hero-glow-orb hero-glow-orb-spotlight" />
        </div>

        <div className="hero-content">
          <div className="hero-tag hero-animate-0">
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: 'var(--accent-success-light)',
              animation: 'pulse-dot 2s ease-in-out infinite',
            }} />
            Zero-Setup Cloud IDE & Live Diagnostics
          </div>

          <h1 className="hero-title hero-animate-1">
            Diagnose every student’s code.<br />
            <span className="hero-accent">Before they even raise a hand.</span>
          </h1>

          <p className="hero-subtitle hero-animate-2">
            A zero-setup cloud IDE paired with real-time diagnostic intelligence.
            LabSync automatically classifies student errors — Syntax, Logic, or Conceptual —
            and alerts instructors with instant diagnoses across the entire lab room.
          </p>

          <div className="hero-animate-3" style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn-primary"
              onClick={() => router.push('/ide')}
              style={{ padding: '10px 22px', fontSize: 13 }}
            >
              <Code2 size={15} />
              Open Student IDE
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => router.push('/dashboard')}
              style={{ padding: '10px 22px', fontSize: 13 }}
            >
              <LayoutDashboard size={15} />
              Instructor Dashboard
            </button>
          </div>
        </div>
      </section>

      {/* ─── IDE Preview ─── */}
      <section className="preview-section">
        <RevealDiv>
          <div style={{ marginBottom: 16 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--brand-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}>
              Student Experience
            </span>
          </div>
          <div className="preview-card">
            <Image
              src="/images/ide-preview.jpg"
              alt="LabSync IDE — zero-setup cloud code editor"
              width={1200}
              height={675}
              style={{ width: '100%', height: 'auto' }}
              priority
            />
          </div>
        </RevealDiv>
      </section>

      {/* ─── Stats ─── */}
      <section className="stats-bar" ref={statsRef}>
        <StatCounter target={1457} suffix="+" label="Institutions Ready" active={statsVisible} />
        <StatCounter target={60} suffix="+" label="Students Per Lab" active={statsVisible} />
        <StatCounter target={5} label="Languages" active={statsVisible} />
        <StatCounter target={90} suffix="+" label="Error Patterns" active={statsVisible} />
      </section>

      {/* ─── Features Grid ─── */}
      <section style={{ padding: '80px 48px' }}>
        <RevealDiv style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: 12,
          }}>
            Six core components,{' '}
            <span className="hero-accent">one platform.</span>
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto' }}>
            Each built with diagnostic intelligence at its core — not just visibility.
          </p>
        </RevealDiv>

        <RevealDiv delay={100}>
          <div className="feature-grid">
            {features.map((f, i) => (
              <div key={i} className="feature-cell">
                <div className="feature-number">{f.num}</div>
                <div className="feature-title">{f.title}</div>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </RevealDiv>
      </section>

      {/* ─── Dashboard Preview ─── */}
      <section className="preview-section">
        <RevealDiv>
          <div style={{ marginBottom: 16 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--brand-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}>
              Instructor Experience
            </span>
          </div>
          <div className="preview-card">
            <Image
              src="/images/dashboard-preview.jpg"
              alt="LabSync Dashboard — real-time student monitoring"
              width={1200}
              height={675}
              style={{ width: '100%', height: 'auto' }}
            />
          </div>
        </RevealDiv>
      </section>

      {/* ─── How it Works ─── */}
      <section className="steps-section">
        <RevealDiv>
          <h2 style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: 40,
          }}>
            How a lab session works.
          </h2>
        </RevealDiv>

        {steps.map((text, i) => (
          <RevealDiv key={i} delay={i * 60}>
            <div className="step-row">
              <div className="step-num">{i + 1}</div>
              <p className="step-text">{text}</p>
            </div>
          </RevealDiv>
        ))}
      </section>

      {/* ─── CTA ─── */}
      <RevealDiv>
        <section style={{
          padding: '60px 48px',
          textAlign: 'center',
          borderTop: '1px solid var(--border)',
        }}>
          <h2 style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            marginBottom: 16,
          }}>
            Ready to try it?
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 28, maxWidth: 400, margin: '0 auto 28px' }}>
            Open the prototype — no signup, no setup. Just code.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => router.push('/ide')}
              style={{ padding: '11px 28px', fontSize: 14 }}
            >
              <Code2 size={16} />
              Launch IDE
              <ExternalLink size={12} style={{ opacity: 0.5 }} />
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => router.push('/dashboard')}
              style={{ padding: '11px 28px', fontSize: 14 }}
            >
              View Dashboard
              <ChevronRight size={14} />
            </button>
          </div>
        </section>
      </RevealDiv>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>LabSync</span>
        {' · '}
        Diagnostic intelligence for college programming labs
      </footer>
    </div>
  );
}
