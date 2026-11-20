'use client';

import {
  createLobby,
  type ErrorTier,
  type LabLobby,
  registerStudent,
  type StudentSession,
  type StudentStatus,
  updateStudentState,
} from './lobbyService';
import type { TeacherUser } from './teacherAuth';

/**
 * A ready-made C++ lab with sample students, so a teacher can try the dashboard and open
 * any student's screen without a real class. Seats are created through the same join and
 * update calls real students use, so the demo exercises the real data path.
 */

export const DEMO_LAB_TITLE = 'Demo · Arrays and searching in C++';

const STARTER = `#include <iostream>
using namespace std;

// Lab 4: Arrays and searching
// 1. Read n marks into an array.
// 2. Print the highest mark and the class average.
// 3. Sort the marks, then use binary search to find a target mark.

int main() {
    int n;
    cin >> n;
    int marks[100];

    // TODO: read the marks

    // TODO: highest mark and average

    // TODO: sort, then binary search

    return 0;
}
`;

const SOLVED = `#include <iostream>
#include <algorithm>
using namespace std;

int binarySearch(int a[], int n, int target) {
    int low = 0, high = n - 1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (a[mid] == target) return mid;
        if (a[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}

int main() {
    int n;
    cin >> n;
    int marks[100];
    for (int i = 0; i < n; i++) cin >> marks[i];

    int best = marks[0], total = 0;
    for (int i = 0; i < n; i++) {
        best = max(best, marks[i]);
        total += marks[i];
    }
    cout << "Highest: " << best << "\\n";
    cout << "Average: " << (double)total / n << "\\n";

    sort(marks, marks + n);
    int target;
    cin >> target;
    int at = binarySearch(marks, n, target);
    if (at == -1) cout << target << " not found\\n";
    else cout << target << " found at position " << at << "\\n";
    return 0;
}
`;

type SampleStudent = {
  name: string;
  prn: string;
  status: Exclude<StudentStatus, 'idle' | 'active'>;
  tier: ErrorTier;
  category?: string;
  code: string;
};

const SAMPLE_STUDENTS: SampleStudent[] = [
  {
    name: 'Priya Sharma',
    prn: '202501040101',
    status: 'needs_help',
    tier: 'logic',
    category: 'Index out of range',
    code: `#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    int marks[100];
    for (int i = 0; i <= n; i++) cin >> marks[i];   // reads one mark too many

    int best = marks[0];
    for (int i = 1; i <= n; i++)
        if (marks[i] > best) best = marks[i];
    cout << "Highest: " << best << "\\n";
    return 0;
}
`,
  },
  {
    name: 'Rohan Kulkarni',
    prn: '202501040102',
    status: 'stuck',
    tier: 'syntax',
    category: 'Missing semicolon',
    code: `#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n
    int marks[100];
    int total = 0;
    for (int i = 0; i < n; i++) {
        cin >> marks[i];
        total += marks[i]
    }
    cout << "Average: " << total / n << endl;
    return 0;
}
`,
  },
  {
    name: 'Ananya Deshpande',
    prn: '202501040103',
    status: 'completed',
    tier: 'none',
    code: SOLVED,
  },
  {
    name: 'Arjun Patil',
    prn: '202501040104',
    status: 'coding',
    tier: 'none',
    code: `#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    int marks[100];
    for (int i = 0; i < n; i++) cin >> marks[i];

    int best = marks[0], total = 0;
    for (int i = 0; i < n; i++) {
        if (marks[i] > best) best = marks[i];
        total += marks[i];
    }
    cout << "Highest: " << best << "\\n";
    cout << "Average: " << (double)total / n << "\\n";

    // next: sort and binary search
    return 0;
}
`,
  },
  {
    name: 'Sneha Joshi',
    prn: '202501040105',
    status: 'stuck',
    tier: 'logic',
    category: 'Runaway loop',
    code: `#include <iostream>
#include <algorithm>
using namespace std;

int main() {
    int n, target;
    cin >> n;
    int marks[100];
    for (int i = 0; i < n; i++) cin >> marks[i];
    sort(marks, marks + n);
    cin >> target;

    int low = 0, high = n - 1;
    while (low <= high) {
        int mid = (low + high) / 2;
        if (marks[mid] == target) { cout << "Found at " << mid << endl; break; }
        if (marks[mid] < target) low = mid;     // never moves past mid
        else high = mid;
    }
    return 0;
}
`,
  },
  {
    name: 'Kabir Mehta',
    prn: '202501040106',
    status: 'coding',
    tier: 'syntax',
    category: 'Undeclared name',
    code: `#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    int marks[100];
    for (int i = 0; i < n; i++) cin >> marks[i];

    for (int i = 0; i < n; i++) total += marks[i];
    cout << "Average: " << total / n << endl;
    return 0;
}
`,
  },
  {
    name: 'Isha Kapoor',
    prn: '202501040107',
    status: 'completed',
    tier: 'none',
    code: SOLVED.replace('int mid = low + (high - low) / 2;', 'int mid = (low + high) / 2;'),
  },
  {
    name: 'Vedant Rao',
    prn: '202501040108',
    status: 'needs_help',
    tier: 'conceptual',
    category: 'Integer division',
    code: `#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    int marks[100];
    int total = 0;
    for (int i = 0; i < n; i++) {
        cin >> marks[i];
        total += marks[i];
    }
    double average = total / n;   // why is the decimal part always lost?
    cout << "Average: " << average << endl;
    return 0;
}
`,
  },
];

export type DemoSeat = StudentSession & { code: string };

const seatsKey = (roomCode: string) => `labsync_demo_seats_${roomCode}`;

export function getDemoSeats(roomCode: string): Record<string, DemoSeat> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(seatsKey(roomCode)) || '{}');
  } catch {
    return {};
  }
}

export function getDemoSeat(roomCode: string, studentId: string): DemoSeat | null {
  return getDemoSeats(roomCode)[studentId] ?? null;
}

/** Help buttons in the student's editor start out matching the seat's sample status. */
function seedHelpState(seat: DemoSeat, status: SampleStudent['status']) {
  try {
    localStorage.setItem(
      `labsync_student_help_${seat.roomCode}_${seat.studentId}`,
      JSON.stringify({ handRaised: status === 'needs_help', done: status === 'completed' }),
    );
  } catch {}
}

export async function createDemoClass(teacher: TeacherUser): Promise<LabLobby> {
  const lobby = await createLobby(
    { title: DEMO_LAB_TITLE, course: 'Programming Lab (C++)', language: 'cpp', starter_code: STARTER },
    teacher,
  );
  const seats: Record<string, DemoSeat> = {};
  // One at a time, so seats appear in roster order and a failure stops cleanly.
  for (const sample of SAMPLE_STUDENTS) {
    const { session } = await registerStudent(lobby.room_code, sample.name, sample.prn);
    await updateStudentState(session, {
      status: sample.status,
      errorTier: sample.tier,
      errorCategory: sample.category ?? null,
      currentFile: 'main.cpp',
      codeSnapshot: sample.code,
    });
    const seat = { ...session, code: sample.code };
    seats[session.studentId] = seat;
    seedHelpState(seat, sample.status);
  }
  try {
    localStorage.setItem(seatsKey(lobby.room_code), JSON.stringify(seats));
  } catch {}
  return lobby;
}
