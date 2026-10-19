-- Enable only after deployment and the worker signature/replay smoke test.
select cron.schedule('umma-prayer-reminders','* * * * *',$job$
 select net.http_post(
  url:='https://zwzojugspldexyyljwpr.supabase.co/functions/v1/islam-worker',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||umma_islam_internal.issue_worker_token()),
  body:='{}'::jsonb,timeout_milliseconds:=30000
 );
$job$);
