-- Email is an alternative login identifier; all access rules stay unchanged.
ALTER TABLE public.cafe_web_accounts DROP CONSTRAINT cafe_web_accounts_login_check;
ALTER TABLE public.cafe_web_accounts ADD CONSTRAINT cafe_web_accounts_login_check CHECK (
 char_length(login) BETWEEN 3 AND 254 AND login=lower(login) AND
 (login ~ '^[a-z0-9_.-]{3,60}$' OR login ~ '^[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9]([a-z0-9.-]*[a-z0-9])?[.][a-z]{2,63}$')
);
