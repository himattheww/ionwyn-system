select cron.schedule('ionwyn-garmin', '0 1,5,10,13 * * *', $$ select public.ionwyn_call('/fit/api/sync') $$);
