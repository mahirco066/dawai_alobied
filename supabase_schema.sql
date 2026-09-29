create extension if not exists pgcrypto;

create table if not exists pharmacies (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 phone text,
 address text,
 latitude double precision,
 longitude double precision,
 status text not null default 'pending' check(status in('pending','approved','suspended')),
 opening_hours text,
 delivery boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists medicines (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 generic_name text,
 strength text,
 form text,
 active boolean not null default true,
 created_at timestamptz not null default now()
);

create table if not exists pharmacy_inventory (
 id uuid primary key default gen_random_uuid(),
 pharmacy_id uuid not null references pharmacies(id) on delete cascade,
 medicine_id uuid not null references medicines(id) on delete cascade,
 quantity integer not null default 0,
 availability text not null default 'unavailable'
   check(availability in('available','limited','unavailable')),
 updated_at timestamptz not null default now(),
 unique(pharmacy_id,medicine_id)
);

create index if not exists idx_medicine_name on medicines(name);
create index if not exists idx_medicine_generic on medicines(generic_name);
create index if not exists idx_inventory_medicine on pharmacy_inventory(medicine_id);

alter table pharmacies enable row level security;
alter table medicines enable row level security;
alter table pharmacy_inventory enable row level security;

drop policy if exists public_approved_pharmacies on pharmacies;
create policy public_approved_pharmacies on pharmacies for select
using(status='approved');

drop policy if exists public_active_medicines on medicines;
create policy public_active_medicines on medicines for select
using(active=true);

drop policy if exists public_available_inventory on pharmacy_inventory;
create policy public_available_inventory on pharmacy_inventory for select
using(availability in('available','limited') and exists(
 select 1 from pharmacies p where p.id=pharmacy_id and p.status='approved'
));

insert into pharmacies(name,phone,address,latitude,longitude,status,delivery) values
('صيدلية الشفاء','0123456789','شارع السوق الكبير - الأبيض',13.184,30.216,'approved',true),
('صيدلية الأمل','0123456790','حي الوحدة - الأبيض',13.190,30.210,'approved',false),
('صيدلية السلام','0123456791','المنطقة الوسطى - الأبيض',13.180,30.225,'approved',true),
('صيدلية النور','0123456792','حي الثورة - الأبيض',13.195,30.230,'approved',false)
on conflict do nothing;

insert into medicines(name,generic_name,strength,form) values
('Augmentin 625 mg','Amoxicillin + Clavulanic Acid','625 mg','Tablets'),
('Panadol 500 mg','Paracetamol','500 mg','Tablets'),
('Amoxicillin 500 mg','Amoxicillin','500 mg','Capsules'),
('Vitamin D 1000 IU','Cholecalciferol','1000 IU','Capsules')
on conflict do nothing;

insert into pharmacy_inventory(pharmacy_id,medicine_id,quantity,availability)
select p.id,m.id,20,'available' from pharmacies p,m medicines m
where p.name='صيدلية الشفاء' and m.name in('Augmentin 625 mg','Panadol 500 mg','Amoxicillin 500 mg','Vitamin D 1000 IU')
on conflict(pharmacy_id,medicine_id) do nothing;

insert into pharmacy_inventory(pharmacy_id,medicine_id,quantity,availability)
select p.id,m.id,8,'available' from pharmacies p,m medicines m
where p.name='صيدلية الأمل' and m.name in('Augmentin 625 mg','Panadol 500 mg')
on conflict(pharmacy_id,medicine_id) do nothing;

insert into pharmacy_inventory(pharmacy_id,medicine_id,quantity,availability)
select p.id,m.id,12,'available' from pharmacies p,m medicines m
where p.name='صيدلية السلام' and m.name in('Augmentin 625 mg','Amoxicillin 500 mg')
on conflict(pharmacy_id,medicine_id) do nothing;

insert into pharmacy_inventory(pharmacy_id,medicine_id,quantity,availability)
select p.id,m.id,10,'available' from pharmacies p,m medicines m
where p.name='صيدلية النور' and m.name in('Panadol 500 mg','Vitamin D 1000 IU')
on conflict(pharmacy_id,medicine_id) do nothing;
