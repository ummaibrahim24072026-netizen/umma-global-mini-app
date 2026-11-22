-- Give recipients time to open the app from a notification.
alter table umma_private.cafe_connect_calls
  alter column caller_until set default now() + interval '75 seconds',
  alter column callee_until set default now() + interval '75 seconds',
  alter column expires_at set default now() + interval '75 seconds';
