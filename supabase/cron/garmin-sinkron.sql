select cron.schedule('ionwyn-garmin', '15 */3 * * *', $$ select public.ionwyn_call('/fit/api/sync') $$);
