-- Gabungan: skema Jadwal (reminder-and-scheduling) dan Learn, ditambah data Learn.
-- Jalankan sekali di SQL Editor project Keuangan.
begin;

create table routine_templates (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  title text not null check (length(trim(title)) > 0),
  module text not null default 'umum' check (module in ('umum', 'kesehatan', 'belajar', 'keuangan', 'kerja')),
  kind text not null check (kind in ('fixed', 'flexible')),
  start_time time,
  duration_min integer not null check (duration_min > 0),
  activity_type text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind <> 'fixed' or start_time is not null)
);

create table schedule_items (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  module text not null default 'umum' check (module in ('umum', 'kesehatan', 'belajar', 'keuangan', 'kerja')),
  kind text not null check (kind in ('fixed', 'flexible')),
  date date not null,
  start_time time,
  duration_min integer not null check (duration_min > 0),
  status text not null default 'terencana' check (status in ('terencana', 'selesai', 'dilewati', 'digeser')),
  reschedule_count integer not null default 0 check (reschedule_count >= 0),
  rescheduled_from_id uuid references schedule_items (id) on delete set null,
  routine_id uuid references routine_templates (id) on delete set null,
  activity_type text,
  reminded_at timestamptz,
  asked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind <> 'fixed' or start_time is not null)
);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  module text not null default 'umum' check (module in ('umum', 'kesehatan', 'belajar', 'keuangan', 'kerja')),
  type text not null,
  occurred_at timestamptz not null,
  ended_at timestamptz,
  value numeric,
  unit text,
  note text,
  meta jsonb not null default '{}'::jsonb,
  item_id uuid references schedule_items (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at > occurred_at)
);

create table planner_settings (
  owner uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  quiet_start time not null default '22:00',
  quiet_end time not null default '04:00',
  slot_buffer_min integer not null default 10 check (slot_buffer_min >= 0),
  min_lead_min integer not null default 30 check (min_lead_min >= 0),
  max_free_shifts integer not null default 2 check (max_free_shifts >= 0),
  remind_before_min integer not null default 10 check (remind_before_min >= 0),
  morning_summary time not null default '04:30',
  evening_summary time not null default '20:30'
);

create index schedule_items_owner_date_idx on schedule_items (owner, date);
create index schedule_items_rescheduled_from_idx on schedule_items (rescheduled_from_id);
create index schedule_items_routine_idx on schedule_items (routine_id);
create index routine_templates_owner_idx on routine_templates (owner);
create index activity_logs_owner_occurred_idx on activity_logs (owner, occurred_at);
create index activity_logs_item_idx on activity_logs (item_id);
create unique index activity_logs_one_per_item on activity_logs (item_id) where item_id is not null;
create unique index activity_logs_one_open_idle on activity_logs (owner) where type = 'idle' and ended_at is null;

alter table routine_templates enable row level security;
alter table schedule_items enable row level security;
alter table activity_logs enable row level security;
alter table planner_settings enable row level security;

create policy routine_templates_owner on routine_templates for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy schedule_items_owner on schedule_items for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy activity_logs_owner on activity_logs for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy planner_settings_owner on planner_settings for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

alter table schedule_items add column reasked_at timestamptz;

create view exp_events with (security_invoker = true) as
select
  id as item_id,
  owner,
  module,
  activity_type,
  date,
  start_time,
  duration_min,
  status,
  reschedule_count,
  completed_at
from schedule_items
where status <> 'digeser';

create table tracks (
  id bigint generated always as identity primary key,
  goal text not null check (char_length(goal) between 2 and 200),
  current_level text not null check (current_level in ('pemula', 'menengah', 'mahir')),
  hours_per_week int not null check (hours_per_week between 1 and 80),
  domain_hint text check (char_length(domain_hint) <= 200),
  status text not null default 'aktif' check (status in ('aktif', 'selesai', 'arsip')),
  created_at timestamptz not null default now()
);

create table topics (
  id bigint generated always as identity primary key,
  track_id bigint not null references tracks (id) on delete cascade,
  "order" int not null check ("order" > 0),
  title text not null,
  objective text not null,
  status text not null default 'belum' check (status in ('belum', 'sedang', 'selesai', 'sudah_bisa')),
  est_sessions int not null check (est_sessions > 0),
  prerequisites text[] not null default '{}',
  sources jsonb not null default '[]',
  unique (track_id, "order")
);

create table study_cases (
  id bigint generated always as identity primary key,
  topic_id bigint not null unique references topics (id) on delete cascade,
  title text not null,
  scenario text not null,
  requirements text[] not null,
  acceptance_criteria text[] not null,
  stretch_goals text[] not null default '{}',
  difficulty text not null check (difficulty in ('mudah', 'sedang', 'sulit')),
  est_sessions int not null check (est_sessions > 0),
  status text not null default 'belum' check (status in ('belum', 'dikerjakan', 'selesai')),
  result_link text,
  created_at timestamptz not null default now()
);

create table learning_sessions (
  id bigint generated always as identity primary key,
  track_id bigint not null references tracks (id) on delete cascade,
  topic_id bigint references topics (id) on delete set null,
  occurred_at date not null,
  duration_min int not null check (duration_min between 1 and 1440),
  summary text not null check (char_length(summary) between 1 and 200)
);

create index on learning_sessions (track_id, occurred_at);

alter table tracks enable row level security;
alter table topics enable row level security;
alter table study_cases enable row level security;
alter table learning_sessions enable row level security;

create function create_track(track jsonb, topic_list jsonb)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  new_id bigint;
begin
  insert into tracks (goal, current_level, hours_per_week, domain_hint)
  values (track->>'goal', track->>'currentLevel', (track->>'hoursPerWeek')::int, nullif(track->>'domainHint', ''))
  returning id into new_id;

  insert into topics (track_id, "order", title, objective, status, est_sessions, prerequisites, sources)
  select new_id,
         t.ordinality,
         t.value->>'title',
         t.value->>'objective',
         case when (t.value->>'known')::boolean then 'sudah_bisa' else 'belum' end,
         (t.value->>'estSessions')::int,
         array(select jsonb_array_elements_text(t.value->'prerequisites')),
         t.value->'sources'
  from jsonb_array_elements(topic_list) with ordinality t;

  return new_id;
end;
$$;

revoke execute on function create_track(jsonb, jsonb) from public, anon, authenticated;

insert into tracks (id, goal, current_level, hours_per_week, domain_hint, status, created_at) overriding system value values
  (1, 'Belajar Ulang C# pelajari yang penting saja', 'pemula', 4, null, 'aktif', '2026-10-19T03:18:57.076945+00:00'),
  (2, 'Belajar 3js', 'pemula', 3, null, 'aktif', '2026-10-19T03:23:16.670983+00:00');
select setval(pg_get_serial_sequence('tracks', 'id'), (select max(id) from tracks));

insert into topics (id, track_id, "order", title, objective, status, est_sessions, prerequisites, sources) overriding system value values
  (1, 1, 1, 'Setup .NET dan Program Pertama', 'Bisa meng-install .NET SDK, membuat, dan menjalankan console app dengan dotnet CLI.', 'selesai', 1, array[]::text[], '[{"url":"https://learn.microsoft.com/en-us/dotnet/csharp/","title":"Learn C# - Microsoft Learn"},{"url":"https://learn.microsoft.com/en-us/dotnet/core/tutorials/with-visual-studio-code","title":"Get started with .NET"}]'::jsonb),
  (2, 1, 2, 'Variables, Types, dan Operators', 'Bisa mendeklarasikan variable, memakai built-in types, dan operator dasar.', 'belum', 2, array['Setup .NET dan Program Pertama']::text[], '[{"url":"https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/","title":"C# Type System"}]'::jsonb),
  (3, 1, 3, 'Control Flow', 'Bisa menulis logika dengan if, switch, for, foreach, dan while.', 'belum', 2, array['Variables, Types, dan Operators']::text[], '[{"url":"https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/selection-statements","title":"Selection statements"}]'::jsonb),
  (4, 1, 4, 'Methods', 'Bisa membuat method dengan parameter, return value, dan optional/named arguments.', 'belum', 2, array['Control Flow']::text[], '[{"url":"https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/methods","title":"Methods in C#"}]'::jsonb),
  (5, 1, 5, 'Classes dan Object-Oriented Programming', 'Bisa mendesain class dengan properties, constructors, inheritance, dan interface.', 'belum', 3, array['Methods']::text[], '[{"url":"https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/tutorials/oop","title":"Object-oriented programming in C#"}]'::jsonb),
  (6, 1, 6, 'Collections dan Generics', 'Bisa memakai List, Dictionary, dan generics untuk mengelola data.', 'belum', 2, array['Classes dan Object-Oriented Programming']::text[], '[{"url":"https://learn.microsoft.com/en-us/dotnet/standard/collections/","title":"Collections in .NET"}]'::jsonb),
  (7, 1, 7, 'LINQ', 'Bisa memfilter, mengubah, dan mengelompokkan data dengan LINQ.', 'belum', 2, array['Collections dan Generics']::text[], '[{"url":"https://learn.microsoft.com/en-us/dotnet/csharp/linq/","title":"LINQ overview"}]'::jsonb),
  (8, 1, 8, 'Null Safety dan Exception Handling', 'Bisa menangani null dengan nullable reference types dan error dengan try/catch.', 'belum', 2, array['Classes dan Object-Oriented Programming']::text[], '[{"url":"https://learn.microsoft.com/en-us/dotnet/csharp/nullable-references","title":"Nullable reference types"},{"url":"https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/exceptions/","title":"Exception handling"}]'::jsonb),
  (9, 1, 9, 'Async dan Await', 'Bisa menulis kode asynchronous dengan Task, async, dan await.', 'belum', 2, array['Null Safety dan Exception Handling']::text[], '[{"url":"https://learn.microsoft.com/en-us/dotnet/csharp/asynchronous-programming/","title":"Asynchronous programming"}]'::jsonb),
  (10, 1, 10, 'Fitur Modern C#', 'Bisa memakai records, pattern matching, dan top-level statements secara tepat.', 'belum', 2, array['Classes dan Object-Oriented Programming']::text[], '[{"url":"https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/","title":"What''s new in C#"}]'::jsonb),
  (11, 1, 11, 'File I/O dan JSON', 'Bisa membaca/menulis file dan serialize/deserialize JSON.', 'belum', 1, array['Null Safety dan Exception Handling']::text[], '[{"url":"https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/overview","title":"System.Text.Json overview"}]'::jsonb),
  (12, 1, 12, 'Proyek Mini Console App', 'Bisa membangun aplikasi console lengkap yang menggabungkan OOP, LINQ, async, dan JSON.', 'belum', 3, array['LINQ', 'Async dan Await', 'Fitur Modern C#', 'File I/O dan JSON']::text[], '[]'::jsonb),
  (13, 2, 1, 'Dasar JavaScript Modern', 'Menulis kode JavaScript dengan let/const, function, arrow function, array, dan object.', 'belum', 3, array[]::text[], '[{"url":"https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide","title":"MDN JavaScript Guide"}]'::jsonb),
  (14, 2, 2, 'ES Modules dan Tooling Vite', 'Membuat project dengan Vite dan meng-import package three menggunakan ES Modules.', 'belum', 2, array['Dasar JavaScript Modern']::text[], '[{"url":"https://threejs.org/docs/#manual/en/introduction/Installation","title":"Three.js Installation"},{"url":"https://vite.dev/guide/","title":"Vite Guide"}]'::jsonb),
  (15, 2, 3, 'Scene, Camera, dan Renderer', 'Membuat scene dasar dengan PerspectiveCamera dan WebGLRenderer yang tampil di canvas.', 'belum', 2, array['ES Modules dan Tooling Vite']::text[], '[{"url":"https://threejs.org/docs/#manual/en/introduction/Creating-a-scene","title":"Three.js Creating a Scene"}]'::jsonb),
  (16, 2, 4, 'Geometry, Material, dan Mesh', 'Menampilkan objek 3D dengan berbagai geometry dan material.', 'belum', 2, array['Scene, Camera, dan Renderer']::text[], '[{"url":"https://threejs.org/docs/","title":"Three.js Docs"}]'::jsonb),
  (17, 2, 5, 'Transformasi dan Animation Loop', 'Menganimasikan objek memakai position, rotation, scale, dan requestAnimationFrame.', 'belum', 2, array['Geometry, Material, dan Mesh']::text[], '[{"url":"https://threejs.org/manual/#en/fundamentals","title":"Three.js Fundamentals"}]'::jsonb),
  (18, 2, 6, 'Lighting dan Shadows', 'Menerangi scene dengan berbagai jenis light dan mengaktifkan shadow.', 'belum', 2, array['Geometry, Material, dan Mesh']::text[], '[{"url":"https://threejs.org/manual/#en/lights","title":"Three.js Lights"},{"url":"https://threejs.org/manual/#en/shadows","title":"Three.js Shadows"}]'::jsonb),
  (19, 2, 7, 'Texture dan Loading Asset', 'Menerapkan texture pada material dan memuat asset dengan TextureLoader.', 'belum', 2, array['Lighting dan Shadows']::text[], '[{"url":"https://threejs.org/manual/#en/textures","title":"Three.js Textures"}]'::jsonb),
  (20, 2, 8, 'Kontrol Kamera dan Interaksi', 'Menambahkan OrbitControls dan interaksi mouse memakai Raycaster.', 'belum', 2, array['Transformasi dan Animation Loop']::text[], '[{"url":"https://threejs.org/manual/#en/picking","title":"Three.js Picking"}]'::jsonb),
  (21, 2, 9, 'Memuat Model glTF', 'Memuat dan menampilkan model 3D glTF dengan GLTFLoader.', 'belum', 2, array['Texture dan Loading Asset', 'Lighting dan Shadows']::text[], '[{"url":"https://threejs.org/manual/#en/load-gltf","title":"Three.js Load glTF"}]'::jsonb),
  (22, 2, 10, 'Animasi Model dengan AnimationMixer', 'Memutar animation clip dari model glTF.', 'belum', 2, array['Memuat Model glTF']::text[], '[{"url":"https://threejs.org/docs/#api/en/animation/AnimationMixer","title":"Three.js AnimationMixer"}]'::jsonb),
  (23, 2, 11, 'Responsive dan Optimasi Performa', 'Membuat canvas responsif dan mengoptimalkan performa scene.', 'belum', 2, array['Kontrol Kamera dan Interaksi']::text[], '[{"url":"https://threejs.org/manual/#en/responsive","title":"Three.js Responsive Design"}]'::jsonb),
  (24, 2, 12, 'Proyek Akhir 3D', 'Membangun dan men-deploy scene 3D interaktif yang lengkap.', 'belum', 4, array['Animasi Model dengan AnimationMixer', 'Responsive dan Optimasi Performa']::text[], '[]'::jsonb);
select setval(pg_get_serial_sequence('topics', 'id'), (select max(id) from topics));

insert into study_cases (id, topic_id, title, scenario, requirements, acceptance_criteria, stretch_goals, difficulty, est_sessions, status, result_link, created_at) overriding system value values
  (1, 1, 'Kartu Sapa Digital: Console App Pertama dengan dotnet CLI', 'Kamu baru kembali belajar C# dan ingin memastikan lingkungan kerja .NET di laptop sudah siap. Sebagai latihan, buat console app kecil bernama "KartuSapa" yang menyapa pengguna dan menampilkan informasi dasar tentang lingkungan tempat program berjalan (misalnya nama pengguna yang diketik, tanggal hari ini, dan versi runtime). Semua langkah setup, pembuatan project, build, dan run harus dilakukan lewat dotnet CLI di terminal, bukan lewat tombol di IDE. Catat hasil langkahmu dalam file NOTES.md agar nanti bisa dipakai sebagai cheat sheet pribadi.', array['Install .NET SDK (versi LTS terbaru yang tersedia) jika belum ada, lalu verifikasi dengan `dotnet --version` dan `dotnet --list-sdks`. Catat outputnya di NOTES.md.', 'Buat folder kerja bernama KartuSapa, lalu buat console project baru di dalamnya menggunakan `dotnet new console`. Pastikan struktur file (.csproj, Program.cs) terbentuk.', 'Jalankan program bawaan dengan `dotnet run` dan catat output yang muncul.', 'Ubah Program.cs agar program meminta pengguna mengetik nama lewat Console.ReadLine, lalu mencetak sapaan yang memuat nama tersebut.', 'Tambahkan output tanggal hari ini (DateTime) dan versi runtime (misalnya lewat Environment.Version) pada sapaan.', 'Tangani kasus input kosong: jika pengguna hanya menekan Enter, tampilkan nama default "Teman" alih-alih sapaan kosong.', 'Jalankan `dotnet build` dan temukan di folder mana hasil build (bin/) tersimpan. Catat path-nya di NOTES.md.', 'Di NOTES.md, tulis minimal 5 perintah dotnet CLI yang kamu pakai beserta penjelasan satu kalimat untuk masing-masing, dan jelaskan dengan kata-katamu sendiri fungsi file .csproj dan Program.cs.']::text[], array['`dotnet --version` menampilkan versi SDK dan hasilnya tercatat di NOTES.md.', 'Folder KartuSapa berisi KartuSapa.csproj dan Program.cs yang dibuat lewat `dotnet new console`.', '`dotnet run` dari folder project berjalan tanpa error dan program menunggu input nama.', 'Mengetik "Budi" menghasilkan sapaan yang memuat "Budi", tanggal hari ini, dan versi runtime.', 'Menekan Enter tanpa mengetik apa pun menghasilkan sapaan dengan nama "Teman".', '`dotnet build` selesai dengan 0 error dan path folder output di bin/ tercatat di NOTES.md.', 'NOTES.md berisi minimal 5 perintah CLI dengan penjelasan serta penjelasan fungsi .csproj dan Program.cs.', 'Seluruh langkah dapat diulang oleh orang lain hanya dengan mengikuti NOTES.md.']::text[], array['Jalankan program langsung dari file hasil build (misalnya `dotnet bin/Debug/<net-version>/KartuSapa.dll`) tanpa `dotnet run`, lalu jelaskan perbedaannya di NOTES.md.', 'Tambahkan dukungan argumen command line sehingga `dotnet run -- Budi` langsung memakai nama dari argumen tanpa meminta input.']::text[], 'mudah', 1, 'selesai', null, '2026-10-19T03:20:58.023+00:00');
select setval(pg_get_serial_sequence('study_cases', 'id'), (select max(id) from study_cases));

insert into learning_sessions (id, track_id, topic_id, occurred_at, duration_min, summary) overriding system value values
  (1, 1, 1, '2026-10-19', 60, 'Setup');
select setval(pg_get_serial_sequence('learning_sessions', 'id'), (select max(id) from learning_sessions));

commit;
