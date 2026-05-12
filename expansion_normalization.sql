-- ============================================
-- GhostPrint Expansion Data Normalization Fix
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Add email_domain column for grouping (the "real" key)
alter table expansion_requests add column if not exists email_domain text;

-- 2. Backfill email_domain from existing student_email
update expansion_requests
set email_domain = lower(split_part(student_email, '@', 2))
where email_domain is null;

-- 3. Drop the old unique constraint (was: email+college_name — allowed same email for different college names)
-- This may fail if the constraint doesn't exist by this name — that's fine
alter table expansion_requests drop constraint if exists expansion_requests_student_email_college_name_key;

-- 4. New unique constraint: one request per email, period.
-- A student can only request expansion once, for their OWN college.
-- First clean up duplicates before adding the constraint:
delete from expansion_requests a
using expansion_requests b
where a.id > b.id
  and lower(a.student_email) = lower(b.student_email);

alter table expansion_requests add constraint expansion_requests_student_email_key unique (student_email);

-- 5. Rebuild the leaderboard view — group by EMAIL DOMAIN, not college_name
-- This kills the "IEM Kolkata" vs "iem kolkata" split forever
create or replace view campus_leaderboard as
select
  email_domain,
  -- Pick the most popular college_name for this domain
  mode() within group (order by college_name) as college_name,
  count(distinct lower(student_email)) as request_count,
  25 as target_count
from expansion_requests
where email_domain is not null
group by email_domain
order by request_count desc;

-- 6. Create index on email_domain for fast lookups
create index if not exists idx_expansion_email_domain on expansion_requests (email_domain);
