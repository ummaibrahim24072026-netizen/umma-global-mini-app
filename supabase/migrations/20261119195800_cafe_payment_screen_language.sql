-- Language selected by the cashier for each paired customer display.
alter table public.cafe_payment_screens add column if not exists display_language text not null default 'en';
alter table public.cafe_payment_screens drop constraint if exists cafe_payment_screens_display_language_check;
alter table public.cafe_payment_screens add constraint cafe_payment_screens_display_language_check check (display_language in ('ru','en','vi'));
