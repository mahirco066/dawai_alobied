-- أضف هذا الجزء إلى Supabase بعد تنفيذ supabase_schema.sql السابق.

create table if not exists pharmacy_accounts (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null unique references pharmacies(id) on delete cascade,
  email text not null unique,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_pharmacy_accounts_email on pharmacy_accounts(email);

alter table pharmacy_accounts enable row level security;

-- لا نعطي الواجهة العامة صلاحية قراءة الحسابات.
-- الخادم يستخدم service_role فقط للوصول إليها.

-- تحديث سياسات inventory: لا نسمح بالكتابة من الواجهة العامة.
-- تحديث المخزون يتم عبر API بعد تسجيل الصيدلية.
