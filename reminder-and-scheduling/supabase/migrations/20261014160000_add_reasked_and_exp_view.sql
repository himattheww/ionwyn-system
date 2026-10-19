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
