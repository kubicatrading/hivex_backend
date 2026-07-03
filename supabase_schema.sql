-- ==========================================
-- HIVEX SAAS DOCUMENT MANAGER SCHEMA
-- ==========================================

-- 1. Tabla de Perfiles de Usuario (Profiles)
-- Vinculada con auth.users de Supabase Auth
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar Row Level Security (RLS) en profiles
alter table public.profiles enable row level security;

-- Políticas de RLS para Profiles
create policy "Los usuarios pueden leer su propio perfil" 
  on public.profiles for select 
  using (auth.uid() = id);

create policy "Los usuarios pueden actualizar su propio perfil" 
  on public.profiles for update 
  using (auth.uid() = id);

-- Trigger para crear un perfil automáticamente al registrarse un usuario
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'Usuario Nuevo'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. Tabla de Documentos (documents)
-- Gestiona metadatos de charts, audios y vídeos
create table public.documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  type text check (type in ('chart', 'audio', 'video', 'knowledge_transcription', 'knowledge_summary', 'knowledge_charts', 'knowledge_analysis')) not null,
  file_url text, -- URL del archivo subido en Storage o enlace externo
  metadata jsonb default '{}'::jsonb, -- Datos para gráficos o duración
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS en documents
alter table public.documents enable row level security;

-- Políticas de RLS para Documents
create policy "Los usuarios pueden ver sus propios documentos" 
  on public.documents for select 
  using (auth.uid() = user_id);

create policy "Los usuarios pueden crear sus propios documentos" 
  on public.documents for insert 
  with check (auth.uid() = user_id);

create policy "Los usuarios pueden actualizar sus propios documentos" 
  on public.documents for update 
  using (auth.uid() = user_id);

create policy "Los usuarios pueden eliminar sus propios documentos" 
  on public.documents for delete 
  using (auth.uid() = user_id);


-- 3. Configuración de Almacenamiento (Supabase Storage Buckets)
-- Para almacenar audios, vídeos e imágenes de charts
-- Crea un bucket público o privado llamado 'documents' en la sección Storage
-- y configura las siguientes políticas:

-- POLÍTICAS DE STORAGE:
-- Permiso de Select para ver archivos:
--   using (bucket_id = 'documents' and auth.role() = 'authenticated');
-- Permiso de Insert para subir archivos:
--   with check (bucket_id = 'documents' and auth.role() = 'authenticated');
-- Permiso de Delete para eliminar archivos:
--   using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
