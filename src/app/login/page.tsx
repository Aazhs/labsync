'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Lock,
  Mail,
  User,
  GraduationCap,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Building,
  ArrowLeft,
  Users,
} from 'lucide-react';
import {
  loginTeacher,
  signupTeacher,
  isValidTeacherEmail,
} from '@/lib/teacherAuth';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('School of Computer Engineering');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isEmailValidMitaoe = isValidTeacherEmail(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError('Please enter your official instructor email address.');
      return;
    }

    if (!cleanEmail.endsWith('@mitaoe.ac.in')) {
      setError('Access Restricted: Only institutional @mitaoe.ac.in emails are authorized for instructors.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          setError('Please enter your full name and title (e.g. Dr. / Prof.).');
          setLoading(false);
          return;
        }

        const res = await signupTeacher(name.trim(), cleanEmail, password, department);
        if (!res.success || !res.teacher) {
          setError(res.error || 'Registration failed.');
          setLoading(false);
          return;
        }

        setSuccessMsg(`Welcome, ${res.teacher.name}! Redirecting to Instructor Dashboard...`);
        setTimeout(() => {
          router.push('/dashboard');
        }, 600);
      } else {
        const res = await loginTeacher(cleanEmail, password);
        if (!res.success || !res.teacher) {
          setError(res.error || 'Authentication failed.');
          setLoading(false);
          return;
        }

        setSuccessMsg(`Signed in as ${res.teacher.name}! Loading dashboard...`);
        setTimeout(() => {
          router.push('/dashboard');
        }, 600);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication encountered an error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      padding: '24px',
      position: 'relative',
    }}>
      {/* Background ambient glow */}
      <div className="hero-glow-wrapper" aria-hidden="true">
        <div className="hero-glow-orb hero-glow-orb-amber" />
        <div className="hero-glow-orb hero-glow-orb-cyan" />
      </div>

      <div style={{
        maxWidth: 440,
        width: '100%',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Top brand header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <Image
              src="/logo.png"
              alt="LabSync"
              width={30}
              height={30}
              style={{ borderRadius: 4 }}
            />
            <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              LabSync
            </span>
          </Link>

          <Link href="/" className="btn btn-ghost" style={{ height: 28, fontSize: 11, padding: '0 8px', gap: 4 }}>
            <ArrowLeft size={12} />
            Back to Home
          </Link>
        </div>

        {/* Informational student badge */}
        <div style={{
          padding: '10px 20px',
          background: 'rgba(91, 141, 184, 0.08)',
          borderBottom: '1px solid rgba(91, 141, 184, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--accent-info)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <GraduationCap size={15} style={{ flexShrink: 0 }} />
            <span>
              <strong>Instructor Portal Only</strong> (@mitaoe.ac.in)
            </span>
          </div>
          <Link href="/join" style={{ color: 'var(--brand-light)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Users size={11} />
            Student Join
          </Link>
        </div>

        {/* Tab switch */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-tertiary)',
        }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            style={{
              flex: 1,
              padding: '11px 0',
              fontSize: 12,
              fontWeight: 700,
              background: mode === 'login' ? 'var(--bg-secondary)' : 'transparent',
              color: mode === 'login' ? 'var(--brand-light)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: mode === 'login' ? '2px solid var(--brand-light)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Instructor Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); }}
            style={{
              flex: 1,
              padding: '11px 0',
              fontSize: 12,
              fontWeight: 700,
              background: mode === 'signup' ? 'var(--bg-secondary)' : 'transparent',
              color: mode === 'signup' ? 'var(--brand-light)' : 'var(--text-muted)',
              border: 'none',
              borderBottom: mode === 'signup' ? '2px solid var(--brand-light)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Teacher Registration
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 4,
              background: 'rgba(224, 74, 59, 0.1)',
              border: '1px solid rgba(224, 74, 59, 0.3)',
              color: 'var(--accent-danger-light)',
              fontSize: 12,
              marginBottom: 18,
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 4,
              background: 'rgba(61, 140, 111, 0.12)',
              border: '1px solid rgba(61, 140, 111, 0.35)',
              color: 'var(--accent-success-light)',
              fontSize: 12,
              marginBottom: 18,
            }}>
              <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Teacher Full Name (Signup only) */}
          {mode === 'signup' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-secondary)',
                marginBottom: 6,
              }}>
                Full Name & Title
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="e.g. Dr. Sarah Mitchell"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    height: 40,
                    padding: '0 12px 0 34px',
                    borderRadius: 4,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <User size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>
          )}

          {/* Email Address */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-secondary)',
              }}>
                Official Email
              </label>
              <span style={{ fontSize: 10, fontWeight: 600, color: isEmailValidMitaoe ? 'var(--accent-success)' : 'var(--brand-light)' }}>
                @mitaoe.ac.in
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                placeholder="teachername@mitaoe.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  height: 40,
                  padding: '0 12px 0 34px',
                  borderRadius: 4,
                  background: 'var(--bg-tertiary)',
                  border: isEmailValidMitaoe
                    ? '1px solid var(--accent-success)'
                    : email && !email.endsWith('@mitaoe.ac.in')
                    ? '1px solid var(--accent-danger)'
                    : '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <Mail size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: isEmailValidMitaoe ? 'var(--accent-success)' : 'var(--text-muted)' }} />
            </div>
            {email && !email.endsWith('@mitaoe.ac.in') && (
              <span style={{ fontSize: 10, color: 'var(--accent-danger)', marginTop: 4, display: 'block' }}>
                * Must end with @mitaoe.ac.in
              </span>
            )}
          </div>

          {/* Password */}
          <div style={{ marginBottom: mode === 'signup' ? 16 : 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-secondary)',
              }}>
                Password
              </label>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                any password
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  height: 40,
                  padding: '0 12px 0 34px',
                  borderRadius: 4,
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <Lock size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          {/* Department (Signup only) */}
          {mode === 'signup' && (
            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-secondary)',
                marginBottom: 6,
              }}>
                Department / School
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="School of Computer Engineering"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  style={{
                    width: '100%',
                    height: 40,
                    padding: '0 12px 0 34px',
                    borderRadius: 4,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <Building size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !isEmailValidMitaoe}
            style={{
              width: '100%',
              height: 42,
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 4,
              gap: 7,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !isEmailValidMitaoe ? 0.6 : 1,
            }}
          >
            {loading ? (
              'Authenticating...'
            ) : mode === 'login' ? (
              <>
                Instructor Sign In
                <ArrowRight size={14} />
              </>
            ) : (
              <>
                Complete Teacher Registration
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Footer info for students */}
        <div style={{
          padding: '14px 24px',
          background: 'var(--bg-tertiary)',
          borderTop: '1px solid var(--border)',
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--text-muted)',
        }}>
          <span>Are you a student? </span>
          <Link href="/join" style={{ color: 'var(--brand-light)', fontWeight: 600, textDecoration: 'none' }}>
            Join Lab Session with PRN →
          </Link>
        </div>
      </div>
    </div>
  );
}
