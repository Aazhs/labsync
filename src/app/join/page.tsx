'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getLobbyByCode,
  getStudentSession,
  joinLobby,
  LabLobby,
  StudentSession,
} from '@/lib/lobbyService';

type Lookup =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'found'; lobby: LabLobby }
  | { state: 'error'; message: string };

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = (searchParams.get('code') || '').replace(/\D/g, '').slice(0, 6);

  const [code, setCode] = useState(initialCode);
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' });
  const [name, setName] = useState('');
  const [prn, setPrn] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<StudentSession | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Look the lab up as soon as six digits are in.
  useEffect(() => {
    if (code.length !== 6) return;
    let cancelled = false;
    const run = async () => {
      setLookup({ state: 'checking' });
      try {
        const lobby = await getLobbyByCode(code);
        if (cancelled) return;
        if (!lobby) setLookup({ state: 'error', message: `No lab uses the code ${code}. Check it with your instructor.` });
        else if (lobby.status === 'completed') setLookup({ state: 'error', message: 'This lab has ended. Ask your instructor for the new code.' });
        else {
          setLookup({ state: 'found', lobby });
          setExisting(getStudentSession(code));
          requestAnimationFrame(() => nameRef.current?.focus());
        }
      } catch {
        if (!cancelled) setLookup({ state: 'error', message: 'Could not reach LabSync. Check your internet connection and try again.' });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (!initialCode) codeRef.current?.focus();
  }, [initialCode]);

  const lobby = lookup.state === 'found' ? lookup.lobby : null;

  const handleJoin = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!lobby) return;
    if (!name.trim()) return setError('Enter your full name so your instructor knows who you are.');
    if (!prn.trim()) return setError('Enter your PRN.');
    setJoining(true);
    setError(null);
    try {
      await joinLobby(code, name, prn);
      router.push(`/ide?room=${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join the lab.');
      setJoining(false);
    }
  };

  return (
    <div className="auth">
      <Link href="/" className="auth-brand">
        <Image src="/logo.png" alt="" width={28} height={28} />
        LabSync
      </Link>

      <form className="auth-card" onSubmit={handleJoin} noValidate>
        <h1 className="auth-title">Join a lab</h1>
        <p className="auth-sub">Enter the six-digit code your instructor is showing.</p>

        <label className="field">
          <span className="field-label">Lab code</span>
          <input
            ref={codeRef}
            className="input auth-code-input"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000000"
            maxLength={7}
            value={code}
            aria-invalid={lookup.state === 'error'}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, '').slice(0, 6);
              setCode(next);
              if (next.length !== 6) setLookup({ state: 'idle' });
              setError(null);
            }}
          />
        </label>

        {lookup.state === 'checking' && <p className="auth-status">Looking up the lab…</p>}
        {lookup.state === 'error' && <p className="form-error" role="alert">{lookup.message}</p>}

        {lobby && (
          <>
            <div className="auth-lab">
              <div className="auth-lab-title">{lobby.title}</div>
              <div className="auth-lab-sub">
                {lobby.teacher_name}
                {lobby.status === 'paused' ? ', paused for now' : ''}
              </div>
            </div>

            {existing && (
              <button type="button" className="btn btn-secondary auth-btn" onClick={() => router.push(`/ide?room=${code}`)}>
                Continue as {existing.name}
              </button>
            )}

            <label className="field">
              <span className="field-label">Full name</span>
              <input
                ref={nameRef}
                className="input"
                autoComplete="name"
                placeholder="Priya Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">PRN</span>
              <input
                className="input input-mono"
                autoComplete="off"
                placeholder="202501040430"
                value={prn}
                onChange={(e) => setPrn(e.target.value)}
              />
            </label>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button type="submit" className="btn btn-primary auth-btn" disabled={joining}>
              {joining ? 'Joining…' : 'Join lab'}
            </button>
          </>
        )}
      </form>

      <p className="auth-foot">
        Teaching this lab? <Link href="/login">Sign in as a teacher</Link>
      </p>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="auth" />}>
      <JoinContent />
    </Suspense>
  );
}
