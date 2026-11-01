-- Both syncs every 10 minutes (WHOOP on the tens, FatSecret five minutes after).
select cron.alter_job((select jobid from cron.job where jobname = 'mustanir-whoop'), schedule := '*/10 * * * *');
select cron.alter_job((select jobid from cron.job where jobname = 'mustanir-fatsecret'), schedule := '5-59/10 * * * *');
