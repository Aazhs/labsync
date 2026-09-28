-- ============================================================================
-- LabSync Supabase Schema: Lab Lobbies & Concurrent Multi-Lab Sessions
-- ============================================================================

-- 1. Create lab_lobbies table
CREATE TABLE IF NOT EXISTS public.lab_lobbies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(6) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    course VARCHAR(100) NOT NULL DEFAULT 'Computer Science',
    teacher_name VARCHAR(150) NOT NULL,
    teacher_email VARCHAR(255) DEFAULT 'teacher@mitaoe.ac.in',
    language VARCHAR(50) NOT NULL DEFAULT 'python',
    starter_code TEXT,
    broadcast_code TEXT DEFAULT '',
    broadcast_enabled BOOLEAN DEFAULT true,
    follow_mode BOOLEAN DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index on room_code for instant lookup
CREATE INDEX IF NOT EXISTS idx_lab_lobbies_room_code ON public.lab_lobbies (room_code);
CREATE INDEX IF NOT EXISTS idx_lab_lobbies_status ON public.lab_lobbies (status);
CREATE INDEX IF NOT EXISTS idx_lab_lobbies_teacher ON public.lab_lobbies (teacher_email);

-- 2. Create teachers table (Institutional @mitaoe.ac.in instructors only)
CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    department VARCHAR(150) DEFAULT 'School of Computer Engineering',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Create lab_students table
CREATE TABLE IF NOT EXISTS public.lab_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lobby_id UUID REFERENCES public.lab_lobbies(id) ON DELETE CASCADE,
    room_code VARCHAR(6) NOT NULL,
    student_name VARCHAR(150) NOT NULL,
    prn VARCHAR(50) NOT NULL DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'coding', 'stuck', 'needs_help', 'completed', 'idle')),
    error_tier VARCHAR(20) DEFAULT 'none',
    error_category TEXT,
    current_file VARCHAR(100) DEFAULT 'main.py',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for student lookups within a lobby
CREATE INDEX IF NOT EXISTS idx_lab_students_room_code ON public.lab_students (room_code);
CREATE INDEX IF NOT EXISTS idx_lab_students_lobby_id ON public.lab_students (lobby_id);
CREATE INDEX IF NOT EXISTS idx_lab_students_prn ON public.lab_students (prn);

-- 4. Row Level Security (RLS)
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read teachers" ON public.teachers FOR SELECT USING (true);
CREATE POLICY "Allow public create teachers" ON public.teachers FOR INSERT WITH CHECK (true);

ALTER TABLE public.lab_lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_students ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active lobbies by room code
CREATE POLICY "Allow public read active lobbies" 
    ON public.lab_lobbies FOR SELECT 
    USING (true);

-- Allow anyone to create lobbies
CREATE POLICY "Allow public create lobbies" 
    ON public.lab_lobbies FOR INSERT 
    WITH CHECK (true);

-- Allow updating lobbies
CREATE POLICY "Allow public update lobbies" 
    ON public.lab_lobbies FOR UPDATE 
    USING (true);

-- Allow reading students in a lobby
CREATE POLICY "Allow public read students" 
    ON public.lab_students FOR SELECT 
    USING (true);

-- Allow students to join (insert)
CREATE POLICY "Allow public insert students" 
    ON public.lab_students FOR INSERT 
    WITH CHECK (true);

-- Allow students to update status
CREATE POLICY "Allow public update students" 
    ON public.lab_students FOR UPDATE 
    USING (true);

-- 4. Enable Supabase Realtime for instant multi-user lobby syncing
ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_students;
