delete from topic_attempts where kind = 'quiz';

alter table topic_attempts drop constraint topic_attempts_kind_check;
alter table topic_attempts add constraint topic_attempts_kind_check check (kind = 'code');

alter table topic_lessons
  drop column sections,
  drop column examples,
  drop column key_points,
  drop column quiz;

alter table topic_lessons rename column overview to summary;
