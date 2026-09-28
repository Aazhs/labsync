'use client';

import { getSupabase } from './supabase';

export interface TeacherUser {
  id: string;
  name: string;
  email: string;
  department?: string;
  role: 'teacher';
}

const TEACHER_SESSION_KEY = 'labsync_teacher_session';
const TEACHER_USERS_KEY = 'labsync_registered_teachers';

// Pre-seeded verified MITAOE instructors
const DEFAULT_TEACHERS: TeacherUser[] = [
  {
    id: 'teacher-mitaoe-1',
    name: 'Dr. Sarah Mitchell',
    email: 'sarah.mitchell@mitaoe.ac.in',
    department: 'School of Computer Engineering',
    role: 'teacher',
  },
  {
    id: 'teacher-mitaoe-2',
    name: 'Prof. David Vance',
    email: 'david.vance@mitaoe.ac.in',
    department: 'School of Computer Engineering',
    role: 'teacher',
  },
  {
    id: 'teacher-mitaoe-demo',
    name: 'Faculty Instructor',
    email: 'instructor@mitaoe.ac.in',
    department: 'Computer Engineering (MITAOE)',
    role: 'teacher',
  },
];

/**
 * Validates that the email belongs to the required @mitaoe.ac.in institutional domain.
 */
export function isValidTeacherEmail(email: string): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return clean.endsWith('@mitaoe.ac.in') && clean.length > '@mitaoe.ac.in'.length;
}

function getRegisteredTeachers(): TeacherUser[] {
  if (typeof window === 'undefined') return DEFAULT_TEACHERS;
  try {
    const raw = localStorage.getItem(TEACHER_USERS_KEY);
    if (!raw) {
      localStorage.setItem(TEACHER_USERS_KEY, JSON.stringify(DEFAULT_TEACHERS));
      return DEFAULT_TEACHERS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_TEACHERS;
  }
}

function saveRegisteredTeachers(teachers: TeacherUser[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TEACHER_USERS_KEY, JSON.stringify(teachers));
  } catch {}
}

/**
 * Get currently logged in teacher from local session.
 */
export function getTeacherSession(): TeacherUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TEACHER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Set teacher session.
 */
export function setTeacherSession(teacher: TeacherUser): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TEACHER_SESSION_KEY, JSON.stringify(teacher));
  } catch {}
}

/**
 * Sign in a teacher.
 * Validates email domain @mitaoe.ac.in and accepts any password.
 */
export async function loginTeacher(
  email: string,
  password?: string
): Promise<{ success: boolean; teacher?: TeacherUser; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    return { success: false, error: 'Please enter your teacher email address.' };
  }

  if (!isValidTeacherEmail(cleanEmail)) {
    return {
      success: false,
      error: 'Access restricted: Only institutional @mitaoe.ac.in emails are authorized for instructor accounts.',
    };
  }

  // Password requirement check
  if (password !== undefined && password.trim().length === 0) {
    return { success: false, error: 'Please enter a password.' };
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data } = await supabase
        .from('teachers')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (data) {
        const teacherObj: TeacherUser = {
          id: data.id,
          name: data.name || cleanEmail.split('@')[0],
          email: data.email,
          department: data.department || 'Computer Engineering',
          role: 'teacher',
        };
        setTeacherSession(teacherObj);
        return { success: true, teacher: teacherObj };
      }
    } catch (err) {
      console.warn('Supabase teacher lookup error, falling back to local:', err);
    }
  }

  // Local authentication & auto-registration
  const teachers = getRegisteredTeachers();
  let teacher = teachers.find((t) => t.email.toLowerCase() === cleanEmail);

  if (!teacher) {
    // Generate name from email username (e.g. "prof.sharma@mitaoe.ac.in" -> "Prof. Sharma")
    const username = cleanEmail.split('@')[0];
    const formattedName = username
      .split(/[._-]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    teacher = {
      id: `teacher-${Date.now()}`,
      name: formattedName || 'MITAOE Faculty',
      email: cleanEmail,
      department: 'School of Computer Engineering',
      role: 'teacher',
    };
    teachers.push(teacher);
    saveRegisteredTeachers(teachers);
  }

  setTeacherSession(teacher);
  return { success: true, teacher };
}

/**
 * Sign up a new teacher with name and @mitaoe.ac.in email.
 */
export async function signupTeacher(
  name: string,
  email: string,
  password?: string,
  department?: string
): Promise<{ success: boolean; teacher?: TeacherUser; error?: string }> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanName) {
    return { success: false, error: 'Please enter your full name and title (e.g. Dr. / Prof.).' };
  }

  if (!cleanEmail) {
    return { success: false, error: 'Please enter your official email address.' };
  }

  if (!isValidTeacherEmail(cleanEmail)) {
    return {
      success: false,
      error: 'Invalid domain: Teacher registration is strictly limited to official @mitaoe.ac.in email addresses.',
    };
  }

  if (password !== undefined && password.trim().length === 0) {
    return { success: false, error: 'Please provide a password.' };
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('teachers')
        .insert({
          name: cleanName,
          email: cleanEmail,
          department: department?.trim() || 'School of Computer Engineering',
        })
        .select()
        .single();

      if (!error && data) {
        const teacherObj: TeacherUser = {
          id: data.id,
          name: data.name,
          email: data.email,
          department: data.department,
          role: 'teacher',
        };
        setTeacherSession(teacherObj);
        return { success: true, teacher: teacherObj };
      }
    } catch (err) {
      console.warn('Supabase teacher signup error, using local:', err);
    }
  }

  const teachers = getRegisteredTeachers();
  const existing = teachers.find((t) => t.email.toLowerCase() === cleanEmail);

  if (existing) {
    // If already registered, update name if needed and log in
    existing.name = cleanName;
    if (department) existing.department = department.trim();
    saveRegisteredTeachers(teachers);
    setTeacherSession(existing);
    return { success: true, teacher: existing };
  }

  const newTeacher: TeacherUser = {
    id: `teacher-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    name: cleanName,
    email: cleanEmail,
    department: department?.trim() || 'School of Computer Engineering',
    role: 'teacher',
  };

  teachers.push(newTeacher);
  saveRegisteredTeachers(teachers);
  setTeacherSession(newTeacher);

  return { success: true, teacher: newTeacher };
}

/**
 * Log out teacher session.
 */
export function logoutTeacher(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TEACHER_SESSION_KEY);
  } catch {}
}
