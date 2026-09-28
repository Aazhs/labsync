'use client';

import { Suspense, useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { getLobbyByCode, joinLobby, LabLobby } from '@/lib/lobbyService';
import {
  ArrowRight,
  User,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams.get('code') || '';

  const [digits, setDigits] = useState<string[]>(() =>
    codeParam && codeParam.length === 6
      ? codeParam.split('').slice(0, 6)
      : ['', '', '', '', '', '']
  );
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedLobby, setVerifiedLobby] = useState<LabLobby | null>(null);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const verifyCode = useCallback(async (code: string) => {
    if (code.length !== 6) {
      setVerifiedLobby(null);
      return;
    }
    setIsVerifyingCode(true);
    try {
      const lobby = await getLobbyByCode(code);
      if (lobby) {
        setVerifiedLobby(lobby);
        setError(null);
      } else {
        setVerifiedLobby(null);
        setError(`No active lab session found with code "${code}".`);
      }
    } catch {
      setError('Failed to verify room code.');
    } finally {
      setIsVerifyingCode(false);
    }
  }, []);

  useEffect(() => {
    if (codeParam && codeParam.length === 6) {
      let isSubscribed = true;
      getLobbyByCode(codeParam).then((lobby) => {
        if (!isSubscribed) return;
        if (lobby) {
          setVerifiedLobby(lobby);
          setError(null);
        } else {
          setVerifiedLobby(null);
          setError(`No active lab session found with code "${codeParam}".`);
        }
      });
      return () => {
        isSubscribed = false;
      };
    } else if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [codeParam]);

  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const nextDigits = [...digits];
      nextDigits[index] = '';
      setDigits(nextDigits);
      setVerifiedLobby(null);
      return;
    }

    const nextDigits = [...digits];
    if (clean.length === 1) {
      nextDigits[index] = clean;
      setDigits(nextDigits);
      if (index < 5 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1]?.focus();
      }
    } else {
      const pastedChars = clean.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        nextDigits[i] = pastedChars[i] || '';
      }
      setDigits(nextDigits);
      const lastIndex = Math.min(pastedChars.length, 5);
      inputRefs.current[lastIndex]?.focus();
    }

    const fullCode = nextDigits.join('');
    if (fullCode.length === 6) {
      verifyCode(fullCode);
    } else {
      setVerifiedLobby(null);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        const nextDigits = [...digits];
        nextDigits[index - 1] = '';
        setDigits(nextDigits);
        inputRefs.current[index - 1]?.focus();
        setVerifiedLobby(null);
      } else {
        const nextDigits = [...digits];
        nextDigits[index] = '';
        setDigits(nextDigits);
        setVerifiedLobby(null);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const nextDigits = ['', '', '', '', '', ''];
    pasted.split('').forEach((char, i) => {
      if (i < 6) nextDigits[i] = char;
    });
    setDigits(nextDigits);

    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();

    if (pasted.length === 6) {
      verifyCode(pasted);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits of the room code.');
      return;
    }

    if (!studentName.trim()) {
      setError('Please enter your full name or student ID.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await joinLobby(code, studentName.trim());
      if (!res.success) {
        setError(res.error || 'Failed to join lab.');
        setLoading(false);
        return;
      }

      router.push(`/ide?room=${code}&student=${encodeURIComponent(studentName.trim())}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMsg);
      setLoading(false);
    }
  };

  const fullCode = digits.join('');
  const isCodeComplete = fullCode.length === 6;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative',
      }}
    >
      {/* Top back button */}
      <button
        onClick={() => router.push('/')}
        className="btn btn-ghost"
        style={{
          position: 'absolute',
          top: 20,
          left: 24,
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <ArrowLeft size={14} />
        Back to Home
      </button>

      <div
        style={{
          maxWidth: 460,
          width: '100%',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px 24px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-tertiary)',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Image
              src="/logo.png"
              alt="LabSync"
              width={32}
              height={32}
              style={{ borderRadius: 4 }}
            />
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              LabSync
            </span>
          </div>
          <h1 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 700, color: 'var(--text-primary)' }}>
            Join Classroom Lab
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            Enter the 6-digit access code provided by your instructor
          </p>
        </div>

        <form onSubmit={handleJoin} style={{ padding: '24px' }}>
          {error && (
            <div
              style={{
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
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* 6-Digit PIN boxes */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-secondary)',
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              6-Digit Room Code
            </label>
            <div
              className="room-code-grid"
              onPaste={handlePaste}
            >
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  className={`room-code-digit-input ${digit ? 'filled' : ''}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  autoComplete="off"
                />
              ))}
            </div>
          </div>

          {/* Verified Lobby Banner */}
          {verifiedLobby && (
            <div
              className="animate-fade-in"
              style={{
                padding: '12px',
                borderRadius: 4,
                background: 'rgba(61, 140, 111, 0.1)',
                border: '1px solid rgba(61, 140, 111, 0.3)',
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-success)', marginBottom: 4 }}>
                <CheckCircle2 size={14} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>Lab Session Found</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                {verifiedLobby.title}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
                <span>Course: {verifiedLobby.course}</span>
                <span>Host: {verifiedLobby.teacher_name}</span>
                <span style={{ textTransform: 'uppercase', color: 'var(--brand-light)' }}>{verifiedLobby.language}</span>
              </div>
            </div>
          )}

          {/* Student Name */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-secondary)',
                marginBottom: 8,
              }}
            >
              Your Full Name or Student ID
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="e.g. Maya Lin"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
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

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !isCodeComplete || isVerifyingCode}
            style={{
              width: '100%',
              height: 42,
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              opacity: !isCodeComplete ? 0.6 : 1,
            }}
          >
            {loading ? (
              <>
                <div className="loading-spinner" style={{ width: 14, height: 14 }} />
                Connecting to Lab...
              </>
            ) : (
              <>
                Enter Live Lab
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            color: 'var(--text-tertiary)',
            fontSize: 13,
          }}
        >
          <div className="loading-spinner" style={{ marginRight: 8 }} />
          Loading...
        </div>
      }
    >
      <JoinContent />
    </Suspense>
  );
}
