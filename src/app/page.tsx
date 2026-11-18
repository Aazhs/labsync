'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { getTeacherSession, TeacherUser } from '@/lib/teacherAuth';

const CONTACT_EMAIL = 'aarshjozhi@gmail.com';

type SeatState = 'coding' | 'stuck' | 'help' | 'done' | 'idle';

// A 6 × 5 lab room. Initials are illustrative.
const SEATS: { initials: string; state: SeatState }[] = [
  ['AK', 'coding'], ['PS', 'coding'], ['RM', 'done'], ['NJ', 'coding'], ['SD', 'stuck'], ['VT', 'coding'],
  ['OG', 'coding'], ['HB', 'idle'], ['KP', 'coding'], ['MS', 'coding'], ['AR', 'coding'], ['YC', 'done'],
  ['TL', 'coding'], ['RI', 'help'], ['DN', 'coding'], ['SB', 'coding'], ['IK', 'coding'], ['GW', 'coding'],
  ['FA', 'done'], ['JM', 'coding'], ['EP', 'stuck'], ['UQ', 'coding'], ['CZ', 'coding'], ['LV', 'coding'],
  ['BX', 'coding'], ['WS', 'coding'], ['QH', 'coding'], ['ZO', 'idle'], ['NE', 'done'], ['MU', 'coding'],
].map(([initials, state]) => ({ initials, state: state as SeatState }));

const LEGEND: { state: SeatState; label: string }[] = [
  { state: 'help', label: 'Asked for help' },
  { state: 'stuck', label: 'Stuck' },
  { state: 'coding', label: 'Coding' },
  { state: 'done', label: 'Done' },
];

const DIAGNOSES = [
  { tier: 'Syntax', error: "SyntaxError: expected ':'", reading: 'Missing colon after the if on line 4' },
  { tier: 'Logic', error: 'IndexError: list index out of range', reading: 'The loop runs one step past the end of the list' },
  { tier: 'Conceptual', error: 'TypeError: can only concatenate str (not "int") to str', reading: 'Joining text and a number without converting' },
];

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button className="btn-icon" onClick={toggle} aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}>
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function RoomIllustration() {
  return (
    <figure className="lp-room" aria-label="Illustration of the instructor's seat map">
      <div className="lp-room-head">
        <div>
          <div className="lp-room-title">Data Structures lab</div>
          <div className="lp-room-sub">Arrays and loops, 30 students</div>
        </div>
        <div className="lp-room-code" aria-label="Room code 482913">482 913</div>
      </div>

      <div className="lp-board">Front of the room</div>

      <div className="lp-seats">
        {SEATS.map((seat, i) => (
          <div
            key={i}
            className={`lp-seat lp-seat-${seat.state}`}
            style={{ animationDelay: `${120 + i * 28}ms` }}
          >
            {seat.initials}
          </div>
        ))}
      </div>

      <figcaption className="lp-callout">
        <span className="lp-callout-dot" />
        <div>
          <div className="lp-callout-title">RI asked for help, line 7</div>
          <div className="lp-callout-body">Logic error: index out of range. The loop runs to <code>len(marks)</code> instead of stopping one before it.</div>
        </div>
      </figcaption>

      <ul className="lp-legend">
        {LEGEND.map((l) => (
          <li key={l.state}>
            <span className={`lp-legend-swatch lp-seat-${l.state}`} />
            {l.label}
          </li>
        ))}
      </ul>
    </figure>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [teacher, setTeacher] = useState<TeacherUser | null>(null);

  useEffect(() => {
    // Read after mount so server and client markup match.
    const id = requestAnimationFrame(() => setTeacher(getTeacherSession()));
    return () => cancelAnimationFrame(id);
  }, []);

  const codeComplete = code.length === 6;

  return (
    <div className="lp">
      <nav className="lp-nav">
        <Link href="/" className="lp-brand">
          <Image src="/logo.png" alt="" width={28} height={28} />
          <span>LabSync</span>
        </Link>
        <div className="lp-nav-actions">
          <ThemeToggle />
          {teacher ? (
            <Link href="/dashboard" className="btn btn-ghost lp-nav-btn">Your labs</Link>
          ) : (
            <Link href="/login" className="btn btn-ghost lp-nav-btn">Teacher sign in</Link>
          )}
          <Link href="/join" className="btn btn-primary lp-nav-btn">Join a lab</Link>
        </div>
      </nav>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <h1 className="lp-title">See every student in the lab while they code.</h1>
            <p className="lp-lede">
              LabSync is a browser IDE for college programming labs. Students join with a six-digit code.
              You get a live map of the room: who is coding, who is stuck, and exactly why.
            </p>

            <form
              className="lp-join"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(codeComplete ? `/join?code=${code}` : '/join');
              }}
            >
              <label htmlFor="lp-code" className="lp-join-label">Have a lab code?</label>
              <div className="lp-join-row">
                <input
                  id="lp-code"
                  className="lp-join-input"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                <button type="submit" className="btn btn-primary lp-join-btn">Join lab</button>
              </div>
            </form>

            <p className="lp-hero-alt">
              Teaching? <Link href={teacher ? '/dashboard' : '/login?mode=signup'}>Create a lab</Link>
              {' '}or <Link href="/ide">try the editor on its own</Link>.
            </p>
          </div>

          <RoomIllustration />
        </section>

        <section className="lp-section">
          <h2 className="lp-h2">How a lab runs</h2>
          <ol className="lp-steps">
            <li>
              <h3>Show the code</h3>
              <p>Students enter the room code. Turn on sharing and your editor appears read-only beside theirs while you explain.</p>
            </li>
            <li>
              <h3>Let them practise</h3>
              <p>Everyone codes in their own editor, with Python, C, C++, Java, JavaScript or HTML. Nothing to install.</p>
            </li>
            <li>
              <h3>Help whoever is stuck</h3>
              <p>A raised hand, or three failed runs in a row, moves a student to the top of your seat map with their code and diagnosis attached.</p>
            </li>
          </ol>
        </section>

        <section className="lp-section">
          <h2 className="lp-h2">Every error arrives already read</h2>
          <p className="lp-section-lede">
            Each failed run is sorted into one of three kinds, so you know what sort of help to give before you walk over.
          </p>
          <div className="lp-diagnoses">
            {DIAGNOSES.map((d) => (
              <div key={d.tier} className="lp-diagnosis">
                <div className={`lp-tier lp-tier-${d.tier.toLowerCase()}`}>{d.tier}</div>
                <code className="lp-diagnosis-error">{d.error}</code>
                <div className="lp-diagnosis-reading">{d.reading}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-section lp-contact">
          <h2 className="lp-h2">Run your next lab on LabSync</h2>
          <p className="lp-section-lede">We will help you set up your first session.</p>
          <a className="btn btn-primary lp-contact-btn" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('LabSync demo request')}`}>
            Email {CONTACT_EMAIL}
          </a>
        </section>
      </main>

      <footer className="lp-footer">LabSync, for college programming labs.</footer>
    </div>
  );
}
