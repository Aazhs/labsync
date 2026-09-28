'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createLobby, LabLobby } from '@/lib/lobbyService';
import { LANGUAGES } from '@/lib/store';
import {
  Sparkles,
  X,
  Copy,
  Check,
  ArrowRight,
  Code2,
  Share2,
  LayoutDashboard,
} from 'lucide-react';

interface CreateLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLobbyCreated?: (lobby: LabLobby) => void;
}

export default function CreateLobbyModal({ isOpen, onClose, onLobbyCreated }: CreateLobbyModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('CS 101');
  const [teacherName, setTeacherName] = useState('Instructor');
  const [language, setLanguage] = useState('python');
  const [loading, setLoading] = useState(false);
  const [createdLobby, setCreatedLobby] = useState<LabLobby | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedLangObj = LANGUAGES.find((l) => l.name === language) || LANGUAGES[0];
      const lobby = await createLobby({
        title: title.trim() || 'Untitled Lab Session',
        course: course.trim() || 'Computer Science',
        teacher_name: teacherName.trim() || 'Instructor',
        language,
        starter_code: selectedLangObj.defaultCode,
      });

      setCreatedLobby(lobby);
      if (onLobbyCreated) {
        onLobbyCreated(lobby);
      }
    } catch (err) {
      console.error('Failed to create lobby:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyCodeToClipboard = () => {
    if (!createdLobby) return;
    navigator.clipboard.writeText(createdLobby.room_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLinkToClipboard = () => {
    if (!createdLobby) return;
    const url = `${window.location.origin}/join?code=${createdLobby.room_code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

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
          maxWidth: 480,
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
              <Sparkles size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                {createdLobby ? 'Lab Lobby Created!' : 'Create New Lab Lobby'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {createdLobby
                  ? 'Share the 6-digit room code with your students'
                  : 'Configure a live collaborative classroom session'}
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ width: 28, height: 28 }}>
            <X size={15} />
          </button>
        </div>

        {/* Form or Result View */}
        {createdLobby ? (
          <div style={{ padding: '24px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand-light)', marginBottom: 8 }}>
              Room Access Code
            </div>

            {/* 6-Digit Display */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                margin: '0 auto 16px',
              }}
            >
              {createdLobby.room_code.split('').map((char, i) => (
                <div
                  key={i}
                  style={{
                    width: 44,
                    height: 54,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 4,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--brand-light)',
                    fontSize: 26,
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--text-primary)',
                    boxShadow: '0 2px 8px rgba(212, 148, 58, 0.15)',
                  }}
                >
                  {char}
                </div>
              ))}
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{createdLobby.title}</span> ({createdLobby.course})
            </div>

            {/* Quick Share Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <button
                type="button"
                onClick={copyCodeToClipboard}
                className="btn btn-secondary"
                style={{
                  height: 38,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderRadius: 4,
                }}
              >
                {copiedCode ? <Check size={14} style={{ color: 'var(--accent-success)' }} /> : <Copy size={14} />}
                {copiedCode ? 'Code Copied!' : 'Copy 6-Digit Code'}
              </button>

              <button
                type="button"
                onClick={copyLinkToClipboard}
                className="btn btn-secondary"
                style={{
                  height: 38,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderRadius: 4,
                }}
              >
                {copiedLink ? <Check size={14} style={{ color: 'var(--accent-success)' }} /> : <Share2 size={14} />}
                {copiedLink ? 'Link Copied!' : 'Copy Student Link'}
              </button>
            </div>

            {/* Navigation Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  onClose();
                  router.push('/dashboard');
                }}
                style={{ flex: 1, height: 40, fontSize: 12.5, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <LayoutDashboard size={14} />
                Dashboard View
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  router.push(`/ide?room=${createdLobby.room_code}&role=teacher`);
                }}
                style={{ flex: 1.2, height: 40, fontSize: 12.5, fontWeight: 600, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Code2 size={14} />
                Launch Teacher IDE
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} style={{ padding: '20px' }}>
            {/* Title */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 6 }}>
                Lab Session Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Lab 4: Binary Trees & Recursion"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 12px',
                  borderRadius: 4,
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>

            {/* Course & Teacher Name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Course Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. CS101"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  style={{
                    width: '100%',
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 4,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Instructor Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Mitchell"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  style={{
                    width: '100%',
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 4,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Language */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 6 }}>
                Programming Language
              </label>
              <select
                className="select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  width: '100%',
                  height: 36,
                  borderRadius: 4,
                  fontSize: 13,
                }}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.id} value={l.name}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
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
                disabled={loading}
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
                }}
              >
                {loading ? (
                  <>
                    <div className="loading-spinner" style={{ width: 14, height: 14 }} />
                    Generating Room Code...
                  </>
                ) : (
                  <>
                    Create Lab & Generate Code
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
