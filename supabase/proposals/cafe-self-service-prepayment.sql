-- Existing orders keep their original workflow; new orders use the cafe setting.
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS self_service_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.cafe_orders ADD COLUMN IF NOT EXISTS requires_prepayment boolean NOT NULL DEFAULT false;
UPDATE public.locations SET self_service_enabled=true WHERE id='e22788bd-4734-4b3a-911e-ba103d52617a';

CREATE OR REPLACE FUNCTION public.cafe_self_service_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.requires_prepayment := NEW.source_module='cafe' AND NEW.order_type IN ('pickup','dine_in')
    AND coalesce((SELECT self_service_enabled FROM public.locations WHERE id=NEW.location_id),false);
  IF NEW.requires_prepayment THEN
   NEW.payment_timing:='now';
   IF NEW.payment_status<>'paid' AND NEW.status NOT IN ('pending','cancelled') THEN
    RAISE EXCEPTION 'SELF_SERVICE_PAYMENT_REQUIRED';
   END IF;
  END IF;
  RETURN NEW;
 END IF;
 -- The requirement belongs to the order and cannot be cleared by changing its type.
 NEW.requires_prepayment:=OLD.requires_prepayment;
 IF NOT OLD.requires_prepayment THEN RETURN NEW; END IF;
 IF OLD.payment_status<>'paid' AND NEW.payment_status='paid' AND OLD.status='pending' AND NEW.status='pending' THEN
  NEW.status:='preparing';
  NEW.accepted_by_telegram_id:=NEW.paid_by_telegram_id;
  NEW.accepted_at:=coalesce(NEW.accepted_at,now());
  NEW.confirmed_at:=coalesce(NEW.confirmed_at,now());
 END IF;
 IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('confirmed','preparing','ready','completed') AND NEW.payment_status<>'paid' THEN
  RAISE EXCEPTION 'SELF_SERVICE_PAYMENT_REQUIRED';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.cafe_self_service_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS cafe_self_service_guard ON public.cafe_orders;
CREATE TRIGGER cafe_self_service_guard BEFORE INSERT OR UPDATE ON public.cafe_orders FOR EACH ROW EXECUTE FUNCTION public.cafe_self_service_guard();

CREATE OR REPLACE FUNCTION public.cafe_self_service_payment_event()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF OLD.requires_prepayment AND OLD.status='pending' AND NEW.status='preparing' AND OLD.payment_status<>'paid' AND NEW.payment_status='paid' THEN
  INSERT INTO public.cafe_order_events(order_id,actor_telegram_id,from_status,to_status,note)
  VALUES(NEW.id,NEW.paid_by_telegram_id,'pending','preparing','Оплата принята; заказ передан на приготовление и сборку');
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.cafe_self_service_payment_event() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS cafe_self_service_payment_event ON public.cafe_orders;
CREATE TRIGGER cafe_self_service_payment_event AFTER UPDATE ON public.cafe_orders FOR EACH ROW EXECUTE FUNCTION public.cafe_self_service_payment_event();
