'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createLobby, LabLobby } from '@/lib/lobbyService';
import { LANGUAGES } from '@/lib/store';
import { getTeacherSession } from '@/lib/teacherAuth';

interface CreateLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLobbyCreated?: (lobby: LabLobby) => void;
}

export default function CreateLobbyModal({ isOpen, onClose, onLobbyCreated }: CreateLobbyModalProps) {
  if (!isOpen) return null;
  // Mount a fresh form each time the modal opens.
  return <CreateLobbyForm onClose={onClose} onLobbyCreated={onLobbyCreated} />;
}

function CreateLobbyForm({ onClose, onLobbyCreated }: Omit<CreateLobbyModalProps, 'isOpen'>) {
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [language, setLanguage] = useState('python');
  // null = use the selected language's template; a string once the teacher edits it
  const [customStarterCode, setCustomStarterCode] = useState<string | null>(null);
  const [showStarter, setShowStarter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const selectedLang = LANGUAGES.find((l) => l.name === language) || LANGUAGES[0];
  const starterCode = customStarterCode ?? selectedLang.defaultCode;

  const handleCreate = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const teacher = getTeacherSession();
    if (!teacher) {
      setError('Your session has expired. Sign in again to create a lab.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const lobby = await createLobby(
        { title: title.trim() || 'Untitled lab', course: course.trim(), language, starter_code: starterCode },
        teacher
      );
      onLobbyCreated?.(lobby);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the lab.');
      setLoading(false);
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <form
        className="settings-modal form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-lab-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleCreate}
      >
        <div className="form-modal-head">
          <h2 id="create-lab-title">New lab</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="form-modal-body">
          <label className="field">
            <span className="field-label">Lab name</span>
            <input
              className="input"
              autoFocus
              placeholder="Arrays and loops"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field-label">Course</span>
              <input
                className="input"
                placeholder="Data Structures"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Language</span>
              <select
                className="input"
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setCustomStarterCode(null);
                }}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.name} value={l.name}>{l.label}</option>
                ))}
              </select>
            </label>
          </div>

          {showStarter ? (
            <label className="field">
              <span className="field-label">Starter code</span>
              <span className="field-hint">Every student starts with this in their editor.</span>
              <textarea
                className="input input-code"
                rows={9}
                spellCheck={false}
                value={starterCode}
                onChange={(e) => setCustomStarterCode(e.target.value)}
              />
            </label>
          ) : (
            <button type="button" className="link-btn" onClick={() => setShowStarter(true)}>
              Edit starter code
            </button>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
        </div>

        <div className="form-modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating…' : 'Create lab'}
          </button>
        </div>
      </form>
    </div>
  );
}
