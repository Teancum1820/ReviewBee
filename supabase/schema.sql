create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade not null,
  ads_manager_link text not null,
  nickname text,
  owner_notes text,
  status text not null default 'pending' check (status in ('pending', 'in_review', 'reviewed')),
  review_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  reviewer_id uuid references public.profiles(id) on delete cascade not null,
  overall_notes text,
  created_at timestamptz default now(),
  constraint reviews_campaign_reviewer_unique unique (campaign_id, reviewer_id)
);

create table if not exists public.review_checklist_items (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references public.reviews(id) on delete cascade not null,
  item_key text not null,
  item_label text not null,
  status text not null check (status in ('pass', 'fail', 'not_sure')),
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  review_id uuid references public.reviews(id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.reviews enable row level security;
alter table public.review_checklist_items enable row level security;
alter table public.notifications enable row level security;

create index if not exists campaigns_owner_id_idx on public.campaigns(owner_id);
create index if not exists campaigns_status_created_at_idx on public.campaigns(status, created_at);
create index if not exists reviews_campaign_id_idx on public.reviews(campaign_id);
create index if not exists reviews_reviewer_id_created_at_idx on public.reviews(reviewer_id, created_at);
create index if not exists review_checklist_items_review_id_idx on public.review_checklist_items(review_id);
create index if not exists notifications_user_id_created_at_idx on public.notifications(user_id, created_at desc);

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.campaigns to authenticated;
grant select, insert on public.reviews to authenticated;
grant select, insert on public.review_checklist_items to authenticated;
grant select, update on public.notifications to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'username', new.raw_user_meta_data ->> 'display_name')
  )
  on conflict (id) do update
    set
      email = excluded.email,
      display_name = coalesce(public.profiles.display_name, excluded.display_name);

  return new;
end;
$$;

update public.profiles
set display_name = split_part(email, '@', 1)
where display_name is null
  and email like '%@users.reviewbee.invalid';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_campaigns_updated_at on public.campaigns;
create trigger set_campaigns_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

create or replace function public.update_campaign_review_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  review_total integer;
begin
  select count(*)
  into review_total
  from public.reviews
  where campaign_id = new.campaign_id;

  update public.campaigns
  set
    review_count = review_total,
    status = case when review_total >= 1 then 'reviewed' else status end,
    updated_at = now()
  where id = new.campaign_id;

  return new;
end;
$$;

drop trigger if exists update_campaign_review_count_after_insert on public.reviews;
create trigger update_campaign_review_count_after_insert
  after insert on public.reviews
  for each row execute function public.update_campaign_review_count();

create or replace function public.create_review_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_owner uuid;
begin
  select owner_id
  into campaign_owner
  from public.campaigns
  where id = new.campaign_id;

  if campaign_owner is not null and campaign_owner <> new.reviewer_id then
    insert into public.notifications (user_id, campaign_id, review_id, message)
    values (campaign_owner, new.campaign_id, new.id, 'Your campaign has been reviewed.');
  end if;

  return new;
end;
$$;

drop trigger if exists create_review_notification_after_insert on public.reviews;
create trigger create_review_notification_after_insert
  after insert on public.reviews
  for each row execute function public.create_review_notification();

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "Campaign owners can read reviewer profiles" on public.profiles;
create policy "Campaign owners can read reviewer profiles"
on public.profiles for select
using (
  exists (
    select 1
    from public.reviews
    join public.campaigns on campaigns.id = reviews.campaign_id
    where reviews.reviewer_id = profiles.id
      and campaigns.owner_id = auth.uid()
  )
);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can insert their own campaigns" on public.campaigns;
create policy "Users can insert their own campaigns"
on public.campaigns for insert
with check (auth.uid() = owner_id);

drop policy if exists "Users can read their own campaigns" on public.campaigns;
create policy "Users can read their own campaigns"
on public.campaigns for select
using (auth.uid() = owner_id);

drop policy if exists "Users can read campaigns available for review" on public.campaigns;
create policy "Users can read campaigns available for review"
on public.campaigns for select
using (
  auth.uid() is not null
  and owner_id <> auth.uid()
  and status in ('pending', 'in_review')
);

drop policy if exists "Users can update their own campaigns" on public.campaigns;
create policy "Users can update their own campaigns"
on public.campaigns for update
using (auth.uid() = owner_id)
with check (
  auth.uid() = owner_id
  and status in ('pending', 'in_review', 'reviewed')
);

drop policy if exists "Users can insert eligible reviews" on public.reviews;
create policy "Users can insert eligible reviews"
on public.reviews for insert
with check (
  reviewer_id = auth.uid()
  and exists (
    select 1
    from public.campaigns
    where campaigns.id = reviews.campaign_id
      and campaigns.owner_id <> auth.uid()
      and campaigns.status in ('pending', 'in_review')
  )
);

drop policy if exists "Users can read reviews they wrote" on public.reviews;
create policy "Users can read reviews they wrote"
on public.reviews for select
using (reviewer_id = auth.uid());

drop policy if exists "Campaign owners can read reviews" on public.reviews;
create policy "Campaign owners can read reviews"
on public.reviews for select
using (
  exists (
    select 1
    from public.campaigns
    where campaigns.id = reviews.campaign_id
      and campaigns.owner_id = auth.uid()
  )
);

drop policy if exists "Users can insert checklist items for their reviews" on public.review_checklist_items;
create policy "Users can insert checklist items for their reviews"
on public.review_checklist_items for insert
with check (
  exists (
    select 1
    from public.reviews
    where reviews.id = review_checklist_items.review_id
      and reviews.reviewer_id = auth.uid()
  )
);

drop policy if exists "Reviewers can read their checklist items" on public.review_checklist_items;
create policy "Reviewers can read their checklist items"
on public.review_checklist_items for select
using (
  exists (
    select 1
    from public.reviews
    where reviews.id = review_checklist_items.review_id
      and reviews.reviewer_id = auth.uid()
  )
);

drop policy if exists "Campaign owners can read checklist items" on public.review_checklist_items;
create policy "Campaign owners can read checklist items"
on public.review_checklist_items for select
using (
  exists (
    select 1
    from public.reviews
    join public.campaigns on campaigns.id = reviews.campaign_id
    where reviews.id = review_checklist_items.review_id
      and campaigns.owner_id = auth.uid()
  )
);

drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
on public.notifications for select
using (user_id = auth.uid());

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
on public.notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());
