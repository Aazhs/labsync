'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  loginTeacher,
  MIN_PASSWORD_LENGTH,
  signupTeacher,
  TEACHER_EMAIL_DOMAIN,
} from '@/lib/teacherAuth';
import { isDemoMode } from '@/lib/lobbyService';

const DEMO_TEACHER = {
  name: 'Demo Instructor',
  email: `demo.instructor${TEACHER_EMAIL_DOMAIN}`,
  password: 'labsync-demo',
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next')?.startsWith('/') ? searchParams.get('next')! : '/dashboard';

  const [mode, setMode] = useState<'login' | 'signup'>(searchParams.get('mode') === 'signup' ? 'signup' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (m: 'login' | 'signup') => {
    setMode(m);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = mode === 'signup' ? await signupTeacher(name, email, password) : await loginTeacher(email, password);
      if (res.success) {
        router.push(next);
        return;
      }
      if (res.notice) {
        setNotice(res.notice);
        setMode('login');
      } else {
        setError(res.error || 'Could not sign you in.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign you in.');
    }
    setLoading(false);
  };

  const useDemoAccount = async () => {
    setLoading(true);
    setError(null);
    let res = await loginTeacher(DEMO_TEACHER.email, DEMO_TEACHER.password);
    if (!res.success) res = await signupTeacher(DEMO_TEACHER.name, DEMO_TEACHER.email, DEMO_TEACHER.password);
    if (res.success) {
      router.push(next);
      return;
    }
    setError(res.error || 'Could not open the demo account.');
    setLoading(false);
  };

  const signup = mode === 'signup';

  return (
    <div className="auth">
      <Link href="/" className="auth-brand">
        <Image src="/logo.png" alt="" width={28} height={28} />
        LabSync
      </Link>

      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <h1 className="auth-title">{signup ? 'Create a teacher account' : 'Teacher sign in'}</h1>
        <p className="auth-sub">Use your {TEACHER_EMAIL_DOMAIN} email address.</p>

        {signup && (
          <label className="field">
            <span className="field-label">Full name</span>
            <input className="input" autoComplete="name" placeholder="Prof. Anjali Kulkarni" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label className="field">
          <span className="field-label">Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            placeholder={`name${TEACHER_EMAIL_DOMAIN}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          {signup && <span className="field-hint">At least {MIN_PASSWORD_LENGTH} characters.</span>}
          <input
            className="input"
            type="password"
            autoComplete={signup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-notice">{notice}</p>}

        <button type="submit" className="btn btn-primary auth-btn" disabled={loading}>
          {loading ? 'One moment…' : signup ? 'Create account' : 'Sign in'}
        </button>

        <p className="auth-switch">
          {signup ? 'Already have an account?' : 'New to LabSync?'}{' '}
          <button type="button" className="link-btn" onClick={() => switchMode(signup ? 'login' : 'signup')}>
            {signup ? 'Sign in' : 'Create an account'}
          </button>
        </p>

        {isDemoMode && (
          <div className="auth-demo">
            <button type="button" className="btn btn-secondary auth-btn" disabled={loading} onClick={useDemoAccount}>
              Continue with a demo teacher account
            </button>
            <p>Demo mode: accounts and labs are stored in this browser only.</p>
          </div>
        )}
      </form>

      <p className="auth-foot">
        Are you a student? <Link href="/join">Join a lab with a code</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth" />}>
      <LoginContent />
    </Suspense>
  );
}
