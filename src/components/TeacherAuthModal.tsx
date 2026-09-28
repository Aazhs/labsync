'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Lock,
  Mail,
  User,
  GraduationCap,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Building,
} from 'lucide-react';
import {
  loginTeacher,
  signupTeacher,
  isValidTeacherEmail,
  TeacherUser,
} from '@/lib/teacherAuth';

interface TeacherAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (teacher: TeacherUser) => void;
  initialMode?: 'login' | 'signup';
}

export default function TeacherAuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
}: TeacherAuthModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('School of Computer Engineering');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

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
          setError('Please enter your full name and designation (e.g. Dr. / Prof.).');
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
          onSuccess?.(res.teacher!);
          onClose();
          router.push('/dashboard');
        }, 800);
      } else {
        const res = await loginTeacher(cleanEmail, password);
        if (!res.success || !res.teacher) {
          setError(res.error || 'Authentication failed.');
          setLoading(false);
          return;
        }

        setSuccessMsg(`Signed in as ${res.teacher.name}! Loading dashboard...`);
        setTimeout(() => {
          onSuccess?.(res.teacher!);
          onClose();
          router.push('/dashboard');
        }, 800);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication encountered an error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="settings-overlay"
      onClick={onClose}
      style={{
        zIndex: 1100,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
      }}
    >
      <div
        className="settings-modal animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 440,
          width: '92%',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 24px 50px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-tertiary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                background: 'rgba(212, 148, 58, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-light)',
              }}
            >
              <GraduationCap size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                Teacher Portal Authentication
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                MIT Academy of Engineering (MITAOE)
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ width: 28, height: 28 }}>
            <X size={15} />
          </button>
        </div>

        {/* Informational student badge */}
        <div
          style={{
            padding: '8px 16px',
            background: 'rgba(91, 141, 184, 0.08)',
            borderBottom: '1px solid rgba(91, 141, 184, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            color: 'var(--accent-info)',
          }}
        >
          <ShieldCheck size={14} style={{ flexShrink: 0 }} />
          <span>
            <strong>Instructor Access Only:</strong> Students do not require an account. Students join labs via 6-digit PIN & PRN.
          </span>
        </div>

        {/* Tab switch */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-tertiary)',
          }}
        >
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            style={{
              flex: 1,
              padding: '10px 0',
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
            Faculty Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); }}
            style={{
              flex: 1,
              padding: '10px 0',
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
            New Teacher Registration
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 12px',
                borderRadius: 4,
                background: 'rgba(224, 74, 59, 0.1)',
                border: '1px solid rgba(224, 74, 59, 0.3)',
                color: 'var(--accent-danger-light)',
                fontSize: 12,
                marginBottom: 16,
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 12px',
                borderRadius: 4,
                background: 'rgba(61, 140, 111, 0.12)',
                border: '1px solid rgba(61, 140, 111, 0.35)',
                color: 'var(--accent-success-light)',
                fontSize: 12,
                marginBottom: 16,
              }}
            >
              <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Teacher Full Name (Signup only) */}
          {mode === 'signup' && (
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-secondary)',
                  marginBottom: 6,
                }}
              >
                Teacher Full Name & Title
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="e.g. Dr. Sarah Mitchell"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    height: 38,
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
                <User
                  size={14}
                  style={{
                    position: 'absolute',
                    left: 11,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Email Address */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-secondary)',
                }}
              >
                Institutional Email
              </label>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: isEmailValidMitaoe ? 'var(--accent-success)' : 'var(--brand-light)',
                }}
              >
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
                  height: 38,
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
              <Mail
                size={14}
                style={{
                  position: 'absolute',
                  left: 11,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: isEmailValidMitaoe ? 'var(--accent-success)' : 'var(--text-muted)',
                }}
              />
            </div>
            {email && !email.endsWith('@mitaoe.ac.in') && (
              <span style={{ fontSize: 10, color: 'var(--accent-danger)', marginTop: 4, display: 'block' }}>
                * Must end with @mitaoe.ac.in
              </span>
            )}
          </div>

          {/* Password */}
          <div style={{ marginBottom: mode === 'signup' ? 14 : 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-secondary)',
                }}
              >
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
                  height: 38,
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
              <Lock
                size={14}
                style={{
                  position: 'absolute',
                  left: 11,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
            </div>
          </div>

          {/* Department (Signup only) */}
          {mode === 'signup' && (
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-secondary)',
                  marginBottom: 6,
                }}
              >
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
                    height: 38,
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
                <Building
                  size={14}
                  style={{
                    position: 'absolute',
                    left: 11,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ flex: 1, height: 38, fontSize: 13, borderRadius: 4 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !isEmailValidMitaoe}
              style={{
                flex: 2,
                height: 38,
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 4,
                gap: 6,
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
                  Create Account
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
