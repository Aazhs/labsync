-- ============================================================================
-- LabSync Supabase schema
--
-- Run this whole file in the Supabase SQL editor. It is idempotent: it can be
-- applied to a fresh project or re-run on top of an older LabSync schema.
--
-- Security model
--   * Teachers sign in with Supabase Auth (email + password). Only
--     @mitaoe.ac.in accounts may create or manage labs, and only their own.
--   * Students do not have accounts. They join with a room code through the
--     join_lab() function, which hands back a private per-student token. All
--     later student writes go through update_student_state(), which checks
--     that token. Students can never read other students' rows.
--   * Only the owning teacher can read the student roster (names, PRNs, code).
-- ============================================================================

create extension if not exists pgcrypto;

-- ─── Helpers ────────────────────────────────────────────────────────────────

create or replace function public.is_institution_teacher()
returns boolean
language sql
stable
as $$
  select coalesce(lower(auth.jwt() ->> 'email') like '%@mitaoe.ac.in', false);
$$;

-- ─── Lab lobbies ────────────────────────────────────────────────────────────

create table if not exists public.lab_lobbies (
    id uuid primary key default gen_random_uuid(),
    room_code varchar(6) not null unique,
    title varchar(255) not null,
    course varchar(100) not null default 'Computer Science',
    teacher_name varchar(150) not null,
    teacher_email varchar(255),
    teacher_id uuid references auth.users(id) on delete cascade default auth.uid(),
    language varchar(50) not null default 'python',
    starter_code text,
    broadcast_code text default '',
    broadcast_enabled boolean default true,
    follow_mode boolean default false,
    status varchar(20) not null default 'active' check (status in ('active', 'paused', 'completed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Upgrades from the previous schema
alter table public.lab_lobbies add column if not exists teacher_id uuid references auth.users(id) on delete cascade;
alter table public.lab_lobbies alter column teacher_id set default auth.uid();
alter table public.lab_lobbies alter column teacher_email drop default;

create index if not exists idx_lab_lobbies_status on public.lab_lobbies (status);
create index if not exists idx_lab_lobbies_teacher on public.lab_lobbies (teacher_id);

-- ─── Lab students ───────────────────────────────────────────────────────────

create table if not exists public.lab_students (
    id uuid primary key default gen_random_uuid(),
    lobby_id uuid references public.lab_lobbies(id) on delete cascade,
    room_code varchar(6) not null,
    student_name varchar(150) not null,
    prn varchar(50) not null default '',
    status varchar(50) not null default 'coding' check (status in ('active', 'coding', 'stuck', 'needs_help', 'completed', 'idle')),
    error_tier varchar(20) default 'none',
    error_category text,
    current_file varchar(100),
    code_snapshot text,
    joined_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);

alter table public.lab_students add column if not exists code_snapshot text;

-- Older schema versions allowed duplicate joins; keep the most recent seat per PRN.
delete from public.lab_students a
using public.lab_students b
where a.lobby_id = b.lobby_id and a.prn = b.prn and a.joined_at < b.joined_at;

create index if not exists idx_lab_students_room_code on public.lab_students (room_code);
create index if not exists idx_lab_students_lobby_id on public.lab_students (lobby_id);
create unique index if not exists idx_lab_students_lobby_prn on public.lab_students (lobby_id, prn);

-- Per-student secrets. RLS is enabled with no policies, so these rows are only
-- reachable from the security-definer functions below, never through the API.
create table if not exists public.lab_student_secrets (
    student_id uuid primary key references public.lab_students(id) on delete cascade,
    access_token uuid not null default gen_random_uuid()
);
alter table public.lab_student_secrets enable row level security;

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table public.lab_lobbies enable row level security;
alter table public.lab_students enable row level security;

-- Remove policies from older versions of this schema
drop policy if exists "Allow public read active lobbies" on public.lab_lobbies;
drop policy if exists "Allow public create lobbies" on public.lab_lobbies;
drop policy if exists "Allow public update lobbies" on public.lab_lobbies;
drop policy if exists "Allow public read students" on public.lab_students;
drop policy if exists "Allow public insert students" on public.lab_students;
drop policy if exists "Allow public update students" on public.lab_students;
drop policy if exists "Lobbies are readable by room code" on public.lab_lobbies;
drop policy if exists "Teachers create their own lobbies" on public.lab_lobbies;
drop policy if exists "Teachers update their own lobbies" on public.lab_lobbies;
drop policy if exists "Teachers delete their own lobbies" on public.lab_lobbies;
drop policy if exists "Teachers read their own students" on public.lab_students;
drop policy if exists "Teachers remove their own students" on public.lab_students;

-- Students look lobbies up by room code, so lobby rows are readable.
create policy "Lobbies are readable by room code"
    on public.lab_lobbies for select
    using (true);

create policy "Teachers create their own lobbies"
    on public.lab_lobbies for insert to authenticated
    with check (teacher_id = auth.uid() and public.is_institution_teacher());

create policy "Teachers update their own lobbies"
    on public.lab_lobbies for update to authenticated
    using (teacher_id = auth.uid())
    with check (teacher_id = auth.uid());

create policy "Teachers delete their own lobbies"
    on public.lab_lobbies for delete to authenticated
    using (teacher_id = auth.uid());

create policy "Teachers read their own students"
    on public.lab_students for select to authenticated
    using (exists (
        select 1 from public.lab_lobbies l
        where l.id = lab_students.lobby_id and l.teacher_id = auth.uid()
    ));

create policy "Teachers remove their own students"
    on public.lab_students for delete to authenticated
    using (exists (
        select 1 from public.lab_lobbies l
        where l.id = lab_students.lobby_id and l.teacher_id = auth.uid()
    ));

-- ─── Student functions (the only way students write data) ───────────────────

-- Join (or re-join) a lab. Re-joining with the same PRN reuses the seat and
-- issues a fresh token, so a student can move to another computer.
create or replace function public.join_lab(p_room_code text, p_student_name text, p_prn text)
returns table (student_id uuid, access_token uuid, lobby_id uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    v_lobby public.lab_lobbies%rowtype;
    v_name text := left(trim(p_student_name), 150);
    v_prn text := left(trim(p_prn), 50);
    v_student_id uuid;
    v_token uuid := gen_random_uuid();
begin
    if v_name = '' or v_prn = '' then
        raise exception 'Name and PRN are required' using errcode = '22023';
    end if;

    select * into v_lobby from public.lab_lobbies where room_code = trim(p_room_code);
    if not found then
        raise exception 'No lab found with that code' using errcode = 'P0002';
    end if;
    if v_lobby.status = 'completed' then
        raise exception 'This lab session has ended' using errcode = '22023';
    end if;

    insert into public.lab_students (lobby_id, room_code, student_name, prn, status)
    values (v_lobby.id, v_lobby.room_code, v_name, v_prn, 'coding')
    on conflict (lobby_id, prn) do update
        set student_name = excluded.student_name,
            last_seen_at = now()
    returning id into v_student_id;

    insert into public.lab_student_secrets (student_id, access_token)
    values (v_student_id, v_token)
    on conflict (student_id) do update set access_token = excluded.access_token;

    return query select v_student_id, v_token, v_lobby.id;
end;
$$;

-- Update a student's live state. Pass null for fields that should not change.
create or replace function public.update_student_state(
    p_student_id uuid,
    p_access_token uuid,
    p_status text default null,
    p_error_tier text default null,
    p_error_category text default null,
    p_current_file text default null,
    p_code_snapshot text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.lab_students
    set status         = coalesce(p_status, status),
        error_tier     = coalesce(p_error_tier, error_tier),
        error_category = case when p_error_tier is null then error_category
                              when p_error_tier = 'none' then null
                              else left(p_error_category, 500) end,
        current_file   = coalesce(left(p_current_file, 100), current_file),
        code_snapshot  = coalesce(left(p_code_snapshot, 100000), code_snapshot),
        last_seen_at   = now()
    where id = p_student_id
      and exists (
          select 1 from public.lab_student_secrets t
          where t.student_id = p_student_id and t.access_token = p_access_token
      );

    if not found then
        raise exception 'Invalid student session' using errcode = '42501';
    end if;
end;
$$;

revoke all on function public.join_lab(text, text, text) from public;
revoke all on function public.update_student_state(uuid, uuid, text, text, text, text, text) from public;
grant execute on function public.join_lab(text, text, text) to anon, authenticated;
grant execute on function public.update_student_state(uuid, uuid, text, text, text, text, text) to anon, authenticated;

-- Older schema versions kept a separate teachers table; profiles now live in
-- Supabase Auth user metadata.
drop table if exists public.teachers;

-- ─── Realtime ───────────────────────────────────────────────────────────────

do $$
begin
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'lab_lobbies') then
        alter publication supabase_realtime add table public.lab_lobbies;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'lab_students') then
        alter publication supabase_realtime add table public.lab_students;
    end if;
end $$;
