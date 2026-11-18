'use client';

import type { User } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

export interface TeacherUser {
  id: string;
  name: string;
  email: string;
  department?: string;
  role: 'teacher';
}

export type AuthResult = {
  success: boolean;
  teacher?: TeacherUser;
  error?: string;
  /** Informational message, e.g. "check your inbox to confirm your account". */
  notice?: string;
};

export const TEACHER_EMAIL_DOMAIN = '@mitaoe.ac.in';
export const MIN_PASSWORD_LENGTH = 8;

const TEACHER_SESSION_KEY = 'labsync_teacher_session';
// Demo mode only (no Supabase configured): accounts live in this browser.
const DEMO_TEACHERS_KEY = 'labsync_demo_teachers';

export function isValidTeacherEmail(email: string): boolean {
  const clean = email.trim().toLowerCase();
  return clean.endsWith(TEACHER_EMAIL_DOMAIN) && clean.length > TEACHER_EMAIL_DOMAIN.length;
}

function nameFromEmail(email: string): string {
  return email
    .split('@')[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function teacherFromUser(user: User): TeacherUser {
  const meta = user.user_metadata || {};
  const email = (user.email || '').toLowerCase();
  return {
    id: user.id,
    name: meta.name || nameFromEmail(email) || 'Instructor',
    email,
    department: meta.department || undefined,
    role: 'teacher',
  };
}

// ─── Cached session (lets pages render the signed-in state synchronously) ───

export function getTeacherSession(): TeacherUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TEACHER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cacheTeacherSession(teacher: TeacherUser | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (teacher) localStorage.setItem(TEACHER_SESSION_KEY, JSON.stringify(teacher));
    else localStorage.removeItem(TEACHER_SESSION_KEY);
  } catch {}
}

/**
 * Confirms the cached session against Supabase Auth (when configured) and returns the
 * signed-in teacher, or null. Use this before showing teacher-only screens.
 */
export async function restoreTeacherSession(): Promise<TeacherUser | null> {
  const supabase = getSupabase();
  if (!supabase) return getTeacherSession();

  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  const teacher = user && isValidTeacherEmail(user.email || '') ? teacherFromUser(user) : null;
  cacheTeacherSession(teacher);
  return teacher;
}

// ─── Demo-mode account store ───

type DemoAccount = TeacherUser & { passwordHash: string };

async function hashPassword(email: string, password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`labsync:${email}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function getDemoAccounts(): DemoAccount[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_TEACHERS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveDemoAccounts(accounts: DemoAccount[]) {
  try {
    localStorage.setItem(DEMO_TEACHERS_KEY, JSON.stringify(accounts));
  } catch {}
}

function stripPassword({ passwordHash, ...teacher }: DemoAccount): TeacherUser {
  return teacher;
}

// ─── Public API ───

function validateCredentials(email: string, password: string): string | null {
  if (!email) return 'Please enter your institutional email address.';
  if (!isValidTeacherEmail(email)) {
    return `Instructor accounts are limited to ${TEACHER_EMAIL_DOMAIN} email addresses.`;
  }
  if (!password) return 'Please enter your password.';
  return null;
}

export async function loginTeacher(email: string, password: string): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  const invalid = validateCredentials(cleanEmail, password);
  if (invalid) return { success: false, error: invalid };

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (error || !data.user) {
      const message = error?.message || '';
      if (/email not confirmed/i.test(message)) {
        return { success: false, error: 'Please confirm your email address first — check your inbox for the link.' };
      }
      return { success: false, error: 'Incorrect email or password.' };
    }
    const teacher = teacherFromUser(data.user);
    cacheTeacherSession(teacher);
    return { success: true, teacher };
  }

  const account = getDemoAccounts().find((a) => a.email === cleanEmail);
  if (!account || account.passwordHash !== (await hashPassword(cleanEmail, password))) {
    return { success: false, error: 'Incorrect email or password.' };
  }
  const teacher = stripPassword(account);
  cacheTeacherSession(teacher);
  return { success: true, teacher };
}

export async function signupTeacher(
  name: string,
  email: string,
  password: string,
  department?: string
): Promise<AuthResult> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanDepartment = department?.trim() || undefined;

  if (!cleanName) return { success: false, error: 'Please enter your full name.' };
  const invalid = validateCredentials(cleanEmail, password);
  if (invalid) return { success: false, error: invalid };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { name: cleanName, department: cleanDepartment },
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
      },
    });
    if (error) return { success: false, error: error.message };
    if (!data.session || !data.user) {
      return {
        success: false,
        notice: `Almost done — we sent a confirmation link to ${cleanEmail}. Open it, then sign in.`,
      };
    }
    const teacher = teacherFromUser(data.user);
    cacheTeacherSession(teacher);
    return { success: true, teacher };
  }

  const accounts = getDemoAccounts();
  if (accounts.some((a) => a.email === cleanEmail)) {
    return { success: false, error: 'An account with this email already exists. Sign in instead.' };
  }
  const account: DemoAccount = {
    id: `teacher-${crypto.randomUUID()}`,
    name: cleanName,
    email: cleanEmail,
    department: cleanDepartment,
    role: 'teacher',
    passwordHash: await hashPassword(cleanEmail, password),
  };
  saveDemoAccounts([...accounts, account]);
  const teacher = stripPassword(account);
  cacheTeacherSession(teacher);
  return { success: true, teacher };
}

export async function logoutTeacher(): Promise<void> {
  cacheTeacherSession(null);
  await getSupabase()?.auth.signOut();
}

// ─── Shared demo account ───
//
// One click signs in as a shared demo instructor so anyone can try LabSync, including on the
// deployed site with Supabase, where students can then join from their own devices. Everyone
// who clicks shares this account and its labs; Row Level Security keeps it away from other
// teachers' labs. Set NEXT_PUBLIC_DISABLE_DEMO_ACCOUNT=true to remove the button.

export const DEMO_ACCOUNT_ENABLED = process.env.NEXT_PUBLIC_DISABLE_DEMO_ACCOUNT !== 'true';

const DEMO_TEACHER = {
  name: 'Demo Instructor',
  email: `demo.instructor${TEACHER_EMAIL_DOMAIN}`,
  password: 'labsync-demo-account',
};

const CONFIRM_EMAIL_HELP =
  'The demo account needs email confirmation turned off: in Supabase, open Authentication → Sign In / Providers → Email and switch off “Confirm email”.';

export async function signInDemoTeacher(): Promise<AuthResult> {
  const login = await loginTeacher(DEMO_TEACHER.email, DEMO_TEACHER.password);
  if (login.success) return login;
  if (/confirm/i.test(login.error || '')) return { success: false, error: CONFIRM_EMAIL_HELP };

  const signup = await signupTeacher(DEMO_TEACHER.name, DEMO_TEACHER.email, DEMO_TEACHER.password);
  if (signup.success) return signup;
  if (signup.notice) return { success: false, error: CONFIRM_EMAIL_HELP };
  if (/already|registered|exists/i.test(signup.error || '')) {
    return { success: false, error: 'The demo account exists with a different password. Delete demo.instructor in Supabase → Authentication → Users, then try again.' };
  }
  return { success: false, error: signup.error || 'Could not open the demo account.' };
}
