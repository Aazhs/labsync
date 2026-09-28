'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getLobbyByCode, joinLobby, LabLobby } from '@/lib/lobbyService';
import {
  Users,
  ArrowRight,
  X,
  User,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface JoinLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
}

export default function JoinLabModal({ isOpen, onClose, initialCode = '' }: JoinLabModalProps) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(() =>
    initialCode && initialCode.length === 6
      ? initialCode.split('').slice(0, 6)
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
        setError(`No active lab found with code "${code}".`);
      }
    } catch {
      setError('Failed to verify room code.');
    } finally {
      setIsVerifyingCode(false);
    }
  }, []);

  // Pre-fill initial code verification if provided
  useEffect(() => {
    if (initialCode && initialCode.length === 6) {
      let isSubscribed = true;
      getLobbyByCode(initialCode).then((lobby) => {
        if (!isSubscribed) return;
        if (lobby) {
          setVerifiedLobby(lobby);
          setError(null);
        } else {
          setVerifiedLobby(null);
          setError(`No active lab found with code "${initialCode}".`);
        }
      });
      return () => {
        isSubscribed = false;
      };
    }
  }, [initialCode]);

  // Focus first input on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (!initialCode && inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialCode]);

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
    // If user typed 1 digit
    if (clean.length === 1) {
      nextDigits[index] = clean;
      setDigits(nextDigits);

      // Auto-advance to next input
      if (index < 5 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1]?.focus();
      }
    } else {
      // User pasted multiple digits into one field
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
        // Move back and clear previous
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

      onClose();
      // Redirect student into IDE with their active room session
      router.push(`/ide?room=${code}&student=${encodeURIComponent(studentName.trim())}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMsg);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const fullCode = digits.join('');
  const isCodeComplete = fullCode.length === 6;

  return (
    <div
      className="settings-overlay"
      onClick={onClose}
      style={{
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
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
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.8)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                background: 'rgba(212, 148, 58, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-light)',
              }}
            >
              <Users size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                Join Live Lab Session
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Enter the 6-digit room code from your instructor
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ width: 28, height: 28 }}>
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleJoin} style={{ padding: '20px' }}>
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

          {/* 6-Digit PIN input boxes */}
          <div style={{ marginBottom: 18 }}>
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
                marginBottom: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-success)' }}>
                <CheckCircle2 size={14} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>Lab Session Found</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
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
              }}
            >
              Your Name / Student ID
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="e.g. Alex Chen (or Student #)"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
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
              disabled={loading || !isCodeComplete || isVerifyingCode}
              style={{
                flex: 2,
                height: 38,
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                opacity: !isCodeComplete ? 0.6 : 1,
              }}
            >
              {loading ? (
                <>
                  <div className="loading-spinner" style={{ width: 14, height: 14 }} />
                  Joining Lab...
                </>
              ) : (
                <>
                  Enter Lab Session
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
