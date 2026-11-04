import { getSupabase, isSupabaseConfigured } from './supabase';
import type { TeacherUser } from './teacherAuth';

/**
 * Lab lobbies & students.
 *
 * With Supabase configured, everything goes through Supabase (see supabase/schema.sql
 * for the security model) and errors are surfaced to the caller. Without it, LabSync
 * runs in demo mode: data lives in this browser's localStorage and only syncs between
 * tabs of the same browser.
 */

export const isDemoMode = !isSupabaseConfigured;

export type LobbyStatus = 'active' | 'paused' | 'completed';
export type StudentStatus = 'active' | 'coding' | 'stuck' | 'needs_help' | 'completed' | 'idle';
export type ErrorTier = 'syntax' | 'logic' | 'conceptual' | 'none';

export interface LabLobby {
  id: string;
  room_code: string;
  title: string;
  course: string;
  teacher_name: string;
  teacher_email?: string | null;
  teacher_id?: string | null;
  language: string;
  starter_code?: string | null;
  broadcast_code?: string | null;
  broadcast_enabled?: boolean | null;
  follow_mode?: boolean | null;
  status: LobbyStatus;
  created_at: string;
  updated_at?: string;
}

export interface LabStudent {
  id: string;
  lobby_id?: string;
  room_code: string;
  student_name: string;
  prn: string;
  status: StudentStatus;
  error_tier?: ErrorTier | null;
  error_category?: string | null;
  current_file?: string | null;
  code_snapshot?: string | null;
  joined_at: string;
  last_seen_at: string;
}

/** What a student's browser keeps after joining, used to authorize their updates. */
export interface StudentSession {
  studentId: string;
  accessToken: string;
  lobbyId: string;
  roomCode: string;
  name: string;
  prn: string;
}

export interface CreateLobbyParams {
  title: string;
  course: string;
  language: string;
  starter_code?: string;
}

export interface StudentStatePatch {
  status?: StudentStatus;
  errorTier?: ErrorTier;
  errorCategory?: string | null;
  currentFile?: string;
  codeSnapshot?: string;
}

/** A student is shown as idle when they haven't been seen for this long. */
export const STUDENT_IDLE_AFTER_MS = 3 * 60 * 1000;

export function isValidRoomCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

function generateRoomCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 900000;
  return String(100000 + n);
}

function describeError(error: { message?: string } | null | undefined, fallback: string): Error {
  return new Error(error?.message || fallback);
}

// ─── Demo-mode storage (single browser, synced across tabs) ───

const DEMO_LOBBIES_KEY = 'labsync_local_lobbies';
const DEMO_STUDENTS_KEY = 'labsync_local_students';
const STUDENT_SESSION_PREFIX = 'labsync_student_session_';

let demoChannel: BroadcastChannel | null = null;
function getDemoChannel(): BroadcastChannel | null {
  if (!demoChannel && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    demoChannel = new BroadcastChannel('labsync_lobbies_channel');
  }
  return demoChannel;
}

function readDemo<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

function writeDemo<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {}
  const roomCodes = new Set((items as { room_code?: string }[]).map((i) => i.room_code));
  for (const roomCode of roomCodes) getDemoChannel()?.postMessage({ type: 'CHANGED', roomCode });
}

// ─── Student session (per room, in this browser) ───

export function saveStudentSession(session: StudentSession): void {
  try {
    localStorage.setItem(STUDENT_SESSION_PREFIX + session.roomCode, JSON.stringify(session));
  } catch {}
}

export function getStudentSession(roomCode: string): StudentSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STUDENT_SESSION_PREFIX + roomCode);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearStudentSession(roomCode: string): void {
  try {
    localStorage.removeItem(STUDENT_SESSION_PREFIX + roomCode);
  } catch {}
}

// ─── Lobbies ───

export async function createLobby(params: CreateLobbyParams, teacher: TeacherUser): Promise<LabLobby> {
  const base = {
    title: params.title.trim() || 'Untitled Lab Session',
    course: params.course.trim() || 'Computer Science',
    teacher_name: teacher.name,
    teacher_email: teacher.email,
    language: params.language || 'python',
    starter_code: params.starter_code || '',
    broadcast_code: params.starter_code || '',
    broadcast_enabled: true,
    follow_mode: false,
    status: 'active' as const,
  };

  const supabase = getSupabase();
  if (supabase) {
    // Room codes are unique in the database; retry on the rare collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase
        .from('lab_lobbies')
        .insert({ ...base, room_code: generateRoomCode() })
        .select()
        .single();
      if (!error) return data as LabLobby;
      if (error.code !== '23505') {
        if (error.code === '42501') {
          throw new Error('You are not allowed to create labs. Sign in with your institutional account.');
        }
        throw describeError(error, 'Could not create the lab.');
      }
    }
    throw new Error('Could not generate a unique room code. Please try again.');
  }

  const lobbies = readDemo<LabLobby>(DEMO_LOBBIES_KEY);
  let roomCode = generateRoomCode();
  while (lobbies.some((l) => l.room_code === roomCode)) roomCode = generateRoomCode();
  const lobby: LabLobby = {
    ...base,
    id: crypto.randomUUID(),
    room_code: roomCode,
    teacher_id: teacher.id,
    created_at: new Date().toISOString(),
  };
  writeDemo(DEMO_LOBBIES_KEY, [lobby, ...lobbies]);
  return lobby;
}

/** Look up a lab by room code, whatever its status. Returns null when no lab matches. */
export async function getLobbyByCode(roomCode: string): Promise<LabLobby | null> {
  const code = roomCode.trim();
  if (!isValidRoomCode(code)) return null;

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.from('lab_lobbies').select('*').eq('room_code', code).maybeSingle();
    if (error) throw describeError(error, 'Could not reach the lab server.');
    return (data as LabLobby) ?? null;
  }

  return readDemo<LabLobby>(DEMO_LOBBIES_KEY).find((l) => l.room_code === code) ?? null;
}

/** The teacher's labs that haven't ended, newest first. */
export async function listTeacherLobbies(teacher: TeacherUser): Promise<LabLobby[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('lab_lobbies')
      .select('*')
      .eq('teacher_id', teacher.id)
      .neq('status', 'completed')
      .order('created_at', { ascending: false });
    if (error) throw describeError(error, 'Could not load your labs.');
    return data as LabLobby[];
  }

  return readDemo<LabLobby>(DEMO_LOBBIES_KEY).filter(
    (l) => l.teacher_id === teacher.id && l.status !== 'completed'
  );
}

export function isLobbyOwner(lobby: LabLobby, teacher: TeacherUser | null): boolean {
  return Boolean(teacher && lobby.teacher_id && lobby.teacher_id === teacher.id);
}

export async function updateLobby(
  roomCode: string,
  updates: Partial<Pick<LabLobby, 'broadcast_code' | 'broadcast_enabled' | 'follow_mode' | 'status'>>
): Promise<LabLobby> {
  const code = roomCode.trim();
  const updated_at = new Date().toISOString();

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('lab_lobbies')
      .update({ ...updates, updated_at })
      .eq('room_code', code)
      .select()
      .maybeSingle();
    if (error) throw describeError(error, 'Could not update the lab.');
    if (!data) throw new Error('You can only change labs you created.');
    return data as LabLobby;
  }

  const lobbies = readDemo<LabLobby>(DEMO_LOBBIES_KEY);
  const idx = lobbies.findIndex((l) => l.room_code === code);
  if (idx === -1) throw new Error('Lab not found.');
  lobbies[idx] = { ...lobbies[idx], ...updates, updated_at };
  writeDemo(DEMO_LOBBIES_KEY, lobbies);
  return lobbies[idx];
}

export const updateLobbyBroadcast = (
  roomCode: string,
  updates: Partial<Pick<LabLobby, 'broadcast_code' | 'broadcast_enabled' | 'follow_mode'>>
) => updateLobby(roomCode, updates);

export const updateLobbyStatus = (roomCode: string, status: LobbyStatus) => updateLobby(roomCode, { status });

// ─── Students ───

export async function joinLobby(
  roomCode: string,
  studentName: string,
  prn: string
): Promise<{ session: StudentSession; lobby: LabLobby }> {
  const code = roomCode.trim();
  const name = studentName.trim();
  const cleanPrn = prn.trim().toUpperCase();

  if (!isValidRoomCode(code)) throw new Error('Please enter a valid 6-digit room code.');
  if (!name) throw new Error('Please enter your full name.');
  if (!cleanPrn) throw new Error('Please enter your PRN.');

  const lobby = await getLobbyByCode(code);
  if (!lobby) throw new Error(`No lab found with code ${code}. Check the code with your instructor.`);
  if (lobby.status === 'completed') throw new Error('This lab session has already ended.');

  let session: StudentSession;
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.rpc('join_lab', {
      p_room_code: code,
      p_student_name: name,
      p_prn: cleanPrn,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) throw describeError(error, 'Could not join the lab.');
    session = {
      studentId: row.student_id,
      accessToken: row.access_token,
      lobbyId: row.lobby_id,
      roomCode: code,
      name,
      prn: cleanPrn,
    };
  } else {
    const students = readDemo<LabStudent & { access_token: string }>(DEMO_STUDENTS_KEY);
    const now = new Date().toISOString();
    const existing = students.find((s) => s.lobby_id === lobby.id && s.prn === cleanPrn);
    const accessToken = crypto.randomUUID();
    const student = existing ?? {
      id: crypto.randomUUID(),
      lobby_id: lobby.id,
      room_code: code,
      student_name: name,
      prn: cleanPrn,
      status: 'coding' as const,
      joined_at: now,
      last_seen_at: now,
      access_token: accessToken,
    };
    Object.assign(student, { student_name: name, last_seen_at: now, access_token: accessToken });
    writeDemo(DEMO_STUDENTS_KEY, existing ? students : [...students, student]);
    session = { studentId: student.id, accessToken, lobbyId: lobby.id, roomCode: code, name, prn: cleanPrn };
  }

  saveStudentSession(session);
  return { session, lobby };
}

export async function getLobbyStudents(roomCode: string): Promise<LabStudent[]> {
  const code = roomCode.trim();
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('lab_students')
      .select('id, lobby_id, room_code, student_name, prn, status, error_tier, error_category, current_file, code_snapshot, joined_at, last_seen_at')
      .eq('room_code', code)
      .order('joined_at', { ascending: true });
    if (error) throw describeError(error, 'Could not load students.');
    return data as LabStudent[];
  }

  return readDemo<LabStudent & { access_token?: string }>(DEMO_STUDENTS_KEY)
    .filter((s) => s.room_code === code)
    .map(({ access_token, ...s }) => s);
}

export async function updateStudentState(session: StudentSession, patch: StudentStatePatch): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.rpc('update_student_state', {
      p_student_id: session.studentId,
      p_access_token: session.accessToken,
      p_status: patch.status ?? null,
      p_error_tier: patch.errorTier ?? null,
      p_error_category: patch.errorCategory ?? null,
      p_current_file: patch.currentFile ?? null,
      p_code_snapshot: patch.codeSnapshot ?? null,
    });
    if (error) throw describeError(error, 'Could not sync your status.');
    return;
  }

  const students = readDemo<LabStudent & { access_token: string }>(DEMO_STUDENTS_KEY);
  const student = students.find((s) => s.id === session.studentId && s.access_token === session.accessToken);
  if (!student) throw new Error('Invalid student session.');
  if (patch.status) student.status = patch.status;
  if (patch.errorTier) {
    student.error_tier = patch.errorTier;
    student.error_category = patch.errorTier === 'none' ? null : patch.errorCategory ?? null;
  }
  if (patch.currentFile) student.current_file = patch.currentFile;
  if (patch.codeSnapshot !== undefined) student.code_snapshot = patch.codeSnapshot;
  student.last_seen_at = new Date().toISOString();
  writeDemo(DEMO_STUDENTS_KEY, students);
}

/** Display status, accounting for students who have gone quiet. */
export function effectiveStudentStatus(student: LabStudent, now = Date.now()): StudentStatus {
  if (student.status === 'completed' || student.status === 'needs_help') return student.status;
  const lastSeen = new Date(student.last_seen_at).getTime();
  return now - lastSeen > STUDENT_IDLE_AFTER_MS ? 'idle' : student.status;
}

// ─── Realtime ───

export type LobbyChange =
  | { table: 'lab_lobbies'; lobby: LabLobby }
  | { table: 'lab_students'; student: LabStudent; deleted?: boolean }
  /** Something changed but the details are unknown (demo mode); refetch. */
  | { table: 'unknown' };

/**
 * Subscribe to changes in one room. In Supabase mode the callback receives the changed
 * row so callers can merge it instead of refetching everything.
 */
export function subscribeToLobbyUpdates(roomCode: string, onChange: (change: LobbyChange) => void): () => void {
  const supabase = getSupabase();
  if (supabase) {
    const channel = supabase
      .channel(`lobby-room-${roomCode}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_students', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          const deleted = payload.eventType === 'DELETE';
          const row = (deleted ? payload.old : payload.new) as LabStudent;
          if (row?.id) onChange({ table: 'lab_students', student: row, deleted });
          else onChange({ table: 'unknown' });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_lobbies', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          const row = payload.new as LabLobby;
          if (row?.id) onChange({ table: 'lab_lobbies', lobby: row });
          else onChange({ table: 'unknown' });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }

  const channel = getDemoChannel();
  const listener = (event: MessageEvent) => {
    if (event.data?.type === 'CHANGED' && event.data.roomCode === roomCode) onChange({ table: 'unknown' });
  };
  channel?.addEventListener('message', listener);
  return () => channel?.removeEventListener('message', listener);
}
