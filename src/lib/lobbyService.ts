import { getSupabase } from './supabase';

export interface LabLobby {
  id: string;
  room_code: string;
  title: string;
  course: string;
  teacher_name: string;
  language: string;
  starter_code?: string;
  broadcast_code?: string;
  broadcast_enabled?: boolean;
  follow_mode?: boolean;
  status: 'active' | 'paused' | 'completed';
  created_at: string;
  updated_at?: string;
  students_count?: number;
}

export interface LabStudent {
  id: string;
  lobby_id?: string;
  room_code: string;
  student_name: string;
  status: 'active' | 'coding' | 'stuck' | 'needs_help' | 'completed' | 'idle';
  error_tier?: 'syntax' | 'logic' | 'conceptual' | 'none';
  error_category?: string;
  current_file?: string;
  joined_at: string;
  last_seen_at: string;
}

export interface CreateLobbyParams {
  title: string;
  course: string;
  teacher_name: string;
  language: string;
  starter_code?: string;
}

const LOCAL_STORAGE_LOBBIES_KEY = 'labsync_local_lobbies';
const LOCAL_STORAGE_STUDENTS_KEY = 'labsync_local_students';

// Generate a random 6-digit numeric room code (e.g. "492018")
export function generate6DigitCode(): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code;
}

// ─── Local Fallback Store (Synchronized across tabs via BroadcastChannel) ───
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  broadcastChannel = new BroadcastChannel('labsync_lobbies_channel');
}

function getLocalLobbies(): LabLobby[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LOBBIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalLobbies(lobbies: LabLobby[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_LOBBIES_KEY, JSON.stringify(lobbies));
    broadcastChannel?.postMessage({ type: 'LOBBIES_UPDATED', lobbies });
  } catch {}
}

function getLocalStudents(): LabStudent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_STUDENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalStudents(students: LabStudent[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_STUDENTS_KEY, JSON.stringify(students));
    broadcastChannel?.postMessage({ type: 'STUDENTS_UPDATED', students });
  } catch {}
}

// Seed initial demo lobby if empty
export function initSeedLobbies() {
  if (typeof window === 'undefined') return;
  const existing = getLocalLobbies();
  if (existing.length === 0) {
    const sampleLobbies: LabLobby[] = [
      {
        id: 'seed-lobby-1',
        room_code: '482910',
        title: 'CS 101: Introduction to Algorithms & Functions',
        course: 'CS101',
        teacher_name: 'Dr. Sarah Mitchell',
        language: 'python',
        starter_code: '# CS101 Lab: Write a function to check if a string is a palindrome\n\ndef is_palindrome(text):\n    # TODO: Implement this function\n    pass\n\nif __name__ == "__main__":\n    print(is_palindrome("racecar"))\n',
        broadcast_code: '# Dr. Sarah Mitchell - Demonstration Code\ndef is_palindrome(text):\n    clean = "".join(c.lower() for c in text if c.isalnum())\n    return clean == clean[::-1]\n\nprint("Test racecar:", is_palindrome("racecar"))\n',
        broadcast_enabled: true,
        follow_mode: false,
        status: 'active',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        students_count: 0,
      },
      {
        id: 'seed-lobby-2',
        room_code: '719302',
        title: 'CS 204: Object Oriented Programming & Pointers',
        course: 'CS204',
        teacher_name: 'Prof. David Vance',
        language: 'cpp',
        starter_code: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // CS204 Lab: Memory Management\n    cout << "Ready for OOP Lab" << endl;\n    return 0;\n}\n',
        broadcast_code: '#include <iostream>\nusing namespace std;\n\n// Prof. David Vance - Reference Pointer Demo\nvoid swap(int* a, int* b) {\n    int temp = *a;\n    *a = *b;\n    *b = temp;\n}\n\nint main() {\n    int x = 10, y = 20;\n    swap(&x, &y);\n    cout << "x=" << x << " y=" << y << endl;\n    return 0;\n}\n',
        broadcast_enabled: true,
        follow_mode: false,
        status: 'active',
        created_at: new Date(Date.now() - 1800000).toISOString(),
        students_count: 0,
      },
    ];
    saveLocalLobbies(sampleLobbies);
  }
}

// ─── Lobby Service APIs ───

/**
 * Create a new lab lobby with a unique 6-digit code.
 */
export async function createLobby(params: CreateLobbyParams): Promise<LabLobby> {
  const supabase = getSupabase();
  let roomCode = generate6DigitCode();

  if (supabase) {
    // Generate unique code in Supabase
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 5) {
      attempts++;
      const { data } = await supabase
        .from('lab_lobbies')
        .select('id')
        .eq('room_code', roomCode)
        .maybeSingle();
      if (!data) {
        exists = false;
      } else {
        roomCode = generate6DigitCode();
      }
    }

    const { data, error } = await supabase
      .from('lab_lobbies')
      .insert({
        room_code: roomCode,
        title: params.title.trim() || 'Untitled Lab Session',
        course: params.course.trim() || 'Computer Science',
        teacher_name: params.teacher_name.trim() || 'Instructor',
        language: params.language || 'python',
        starter_code: params.starter_code || '',
        broadcast_code: params.starter_code || '',
        broadcast_enabled: true,
        follow_mode: false,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase createLobby error, falling back to local:', error);
    } else if (data) {
      return data as LabLobby;
    }
  }

  // Fallback / Local storage implementation
  const lobbies = getLocalLobbies();
  // Ensure unique 6-digit code locally
  while (lobbies.some((l) => l.room_code === roomCode)) {
    roomCode = generate6DigitCode();
  }

  const newLobby: LabLobby = {
    id: `lobby-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    room_code: roomCode,
    title: params.title.trim() || 'Untitled Lab Session',
    course: params.course.trim() || 'Computer Science',
    teacher_name: params.teacher_name.trim() || 'Instructor',
    language: params.language || 'python',
    starter_code: params.starter_code || '',
    broadcast_code: params.starter_code || '',
    broadcast_enabled: true,
    follow_mode: false,
    status: 'active',
    created_at: new Date().toISOString(),
    students_count: 0,
  };

  lobbies.unshift(newLobby);
  saveLocalLobbies(lobbies);
  return newLobby;
}

/**
 * Fetch a lobby by its 6-digit room code.
 */
export async function getLobbyByCode(roomCode: string): Promise<LabLobby | null> {
  const cleanCode = roomCode.trim();
  if (!cleanCode) return null;

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('lab_lobbies')
        .select('*')
        .eq('room_code', cleanCode)
        .eq('status', 'active')
        .maybeSingle();

      if (!error && data) {
        return data as LabLobby;
      }
    } catch (err) {
      console.warn('Supabase fetch lobby failed, checking local:', err);
    }
  }

  // Local fallback
  initSeedLobbies();
  const lobbies = getLocalLobbies();
  const match = lobbies.find((l) => l.room_code === cleanCode && l.status === 'active');
  return match || null;
}

/**
 * List all active lobbies (supports concurrent multiple classrooms).
 */
export async function listActiveLobbies(): Promise<LabLobby[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('lab_lobbies')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data as LabLobby[];
      }
    } catch (err) {
      console.warn('Supabase listActiveLobbies failed, checking local:', err);
    }
  }

  initSeedLobbies();
  const lobbies = getLocalLobbies();
  return lobbies.filter((l) => l.status === 'active');
}

/**
 * Join a lab lobby with student name and 6-digit code.
 */
export async function joinLobby(roomCode: string, studentName: string): Promise<{ success: boolean; student?: LabStudent; lobby?: LabLobby; error?: string }> {
  const cleanCode = roomCode.trim();
  const cleanName = studentName.trim();

  if (!cleanCode || cleanCode.length !== 6) {
    return { success: false, error: 'Please enter a valid 6-digit room code' };
  }

  if (!cleanName) {
    return { success: false, error: 'Please enter your name' };
  }

  const lobby = await getLobbyByCode(cleanCode);
  if (!lobby) {
    return { success: false, error: `No active lab session found with code "${cleanCode}". Please verify with your instructor.` };
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('lab_students')
        .insert({
          lobby_id: lobby.id,
          room_code: cleanCode,
          student_name: cleanName,
          status: 'coding',
          current_file: lobby.language === 'web' ? 'index.html' : 'main.py',
        })
        .select()
        .single();

      if (!error && data) {
        return { success: true, student: data as LabStudent, lobby };
      }
    } catch (err) {
      console.warn('Supabase join failed, falling back to local:', err);
    }
  }

  // Local fallback
  const students = getLocalStudents();
  const newStudent: LabStudent = {
    id: `student-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    lobby_id: lobby.id,
    room_code: cleanCode,
    student_name: cleanName,
    status: 'coding',
    current_file: lobby.language === 'web' ? 'index.html' : 'main.py',
    joined_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  };

  students.push(newStudent);
  saveLocalStudents(students);

  // Increment student count in local lobby
  const lobbies = getLocalLobbies();
  const lobbyIndex = lobbies.findIndex((l) => l.id === lobby.id);
  if (lobbyIndex !== -1) {
    lobbies[lobbyIndex].students_count = (lobbies[lobbyIndex].students_count || 0) + 1;
    saveLocalLobbies(lobbies);
  }

  return { success: true, student: newStudent, lobby };
}

/**
 * List all students in a given room.
 */
export async function getLobbyStudents(roomCode: string): Promise<LabStudent[]> {
  const cleanCode = roomCode.trim();
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('lab_students')
        .select('*')
        .eq('room_code', cleanCode)
        .order('joined_at', { ascending: false });

      if (!error && data) {
        return data as LabStudent[];
      }
    } catch (err) {
      console.warn('Supabase getLobbyStudents error:', err);
    }
  }

  const students = getLocalStudents();
  return students.filter((s) => s.room_code === cleanCode);
}

/**
 * Update student status (e.g. 'needs_help', 'stuck', 'coding', 'completed').
 */
export async function updateStudentStatus(
  studentId: string,
  roomCode: string,
  status: LabStudent['status'],
  errorInfo?: { tier?: LabStudent['error_tier']; category?: string }
): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase
        .from('lab_students')
        .update({
          status,
          error_tier: errorInfo?.tier || 'none',
          error_category: errorInfo?.category || null,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', studentId);
      return;
    } catch {}
  }

  const students = getLocalStudents();
  const idx = students.findIndex((s) => s.id === studentId || (s.room_code === roomCode && s.student_name === studentId));
  if (idx !== -1) {
    students[idx].status = status;
    if (errorInfo?.tier) students[idx].error_tier = errorInfo.tier;
    if (errorInfo?.category) students[idx].error_category = errorInfo.category;
    students[idx].last_seen_at = new Date().toISOString();
    saveLocalStudents(students);
  }
}

/**
 * End/close a lobby session.
 */
export async function endLobby(roomCode: string): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase
        .from('lab_lobbies')
        .update({ status: 'completed' })
        .eq('room_code', roomCode);
    } catch {}
  }

  const lobbies = getLocalLobbies();
  const updated = lobbies.map((l) => (l.room_code === roomCode ? { ...l, status: 'completed' as const } : l));
  saveLocalLobbies(updated);
}

/**
 * Update professor broadcast code, student viewing permission, or follow mode.
 */
export async function updateLobbyBroadcast(
  roomCode: string,
  updates: {
    broadcast_code?: string;
    broadcast_enabled?: boolean;
    follow_mode?: boolean;
  }
): Promise<LabLobby | null> {
  const cleanCode = roomCode.trim();
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('lab_lobbies')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('room_code', cleanCode)
        .select()
        .single();

      if (!error && data) {
        // Also sync local cache
        const lobbies = getLocalLobbies();
        const idx = lobbies.findIndex((l) => l.room_code === cleanCode);
        if (idx !== -1) {
          lobbies[idx] = { ...lobbies[idx], ...updates, updated_at: new Date().toISOString() };
          saveLocalLobbies(lobbies);
        }
        return data as LabLobby;
      }
    } catch (err) {
      console.warn('Supabase updateLobbyBroadcast error:', err);
    }
  }

  // Local fallback
  const lobbies = getLocalLobbies();
  const idx = lobbies.findIndex((l) => l.room_code === cleanCode);
  if (idx !== -1) {
    lobbies[idx] = {
      ...lobbies[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    saveLocalLobbies(lobbies);
    broadcastChannel?.postMessage({
      type: 'BROADCAST_UPDATED',
      roomCode: cleanCode,
      updates,
    });
    return lobbies[idx];
  }
  return null;
}

/**
 * Realtime subscription to lobby changes and student activity.
 */
export function subscribeToLobbyUpdates(roomCode: string, onChange: () => void): () => void {
  const supabase = getSupabase();

  if (supabase) {
    const channel = supabase
      .channel(`lobby-room-${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_students', filter: `room_code=eq.${roomCode}` },
        () => onChange()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lab_lobbies', filter: `room_code=eq.${roomCode}` },
        () => onChange()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // Local BroadcastChannel listener
  const listener = (event: MessageEvent) => {
    if (
      event.data?.type === 'STUDENTS_UPDATED' ||
      event.data?.type === 'LOBBIES_UPDATED' ||
      event.data?.type === 'BROADCAST_UPDATED'
    ) {
      onChange();
    }
  };

  broadcastChannel?.addEventListener('message', listener);
  return () => {
    broadcastChannel?.removeEventListener('message', listener);
  };
}
