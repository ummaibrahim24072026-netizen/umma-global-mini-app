-- Durable private inbox; Telegram delivery is separate from order transactions.
BEGIN;
CREATE SCHEMA IF NOT EXISTS umma_private;
REVOKE ALL ON SCHEMA umma_private FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS umma_private.cafe_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.cafe_orders(id),
 recipient bigint NOT NULL REFERENCES public.telegram_users(telegram_id),workspace text NOT NULL DEFAULT 'customer',kind text NOT NULL,title text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),read_at timestamptz,
 send_to_bot boolean NOT NULL DEFAULT false,sent_at timestamptz,telegram_message_id bigint,
 attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 lease_id uuid,leased_until timestamptz,last_error text
);
CREATE INDEX IF NOT EXISTS cafe_notifications_inbox ON umma_private.cafe_notifications(recipient,created_at DESC,id);
CREATE INDEX IF NOT EXISTS cafe_notifications_unread ON umma_private.cafe_notifications(recipient) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS cafe_notifications_pending ON umma_private.cafe_notifications(next_attempt_at) WHERE send_to_bot AND sent_at IS NULL;
ALTER TABLE umma_private.cafe_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON umma_private.cafe_notifications FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_cafe_order_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE event_kind text; event_title text; courier_name text;
BEGIN
 IF TG_OP='INSERT' THEN event_kind:='created';event_title:='Заказ оформлен';
 ELSIF NEW.courier_telegram_id IS DISTINCT FROM OLD.courier_telegram_id OR NEW.delivery_status IS DISTINCT FROM OLD.delivery_status THEN
  event_kind:='delivery';
  SELECT first_name INTO courier_name FROM public.telegram_users WHERE telegram_id=NEW.courier_telegram_id;
  event_title:=CASE NEW.delivery_status WHEN 'courier_assigned' THEN 'Курьер принял ваш заказ'||coalesce(': '||nullif(courier_name,''),'') WHEN 'picked_up' THEN 'Курьер забрал заказ и направляется к вам' WHEN 'delivered' THEN 'Заказ доставлен' ELSE 'Ожидаем курьера' END;
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
  event_kind:='status';event_title:=CASE NEW.status WHEN 'confirmed' THEN 'Кафе приняло заказ' WHEN 'preparing' THEN 'Заказ готовится' WHEN 'ready' THEN 'Заказ готов' WHEN 'completed' THEN 'Заказ закрыт. Спасибо, что выбрали UMMA!' WHEN 'cancelled' THEN 'Заказ отменён' ELSE 'Статус заказа обновлён' END;
 ELSIF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
  event_kind:='payment';event_title:=CASE NEW.payment_status WHEN 'paid' THEN 'Оплата подтверждена' WHEN 'refunded' THEN 'Возврат оплаты зарегистрирован' ELSE 'Статус оплаты обновлён' END;
 ELSIF NEW.total_vnd IS DISTINCT FROM OLD.total_vnd AND OLD.total_vnd>0 THEN event_kind:='items';event_title:='Состав или сумма заказа изменились';
 ELSE RETURN NEW;
 END IF;
 INSERT INTO umma_private.cafe_notifications(order_id,recipient,workspace,kind,title,send_to_bot)
 SELECT NEW.id,recipient,CASE WHEN recipient=NEW.customer_telegram_id THEN 'customer' WHEN recipient=NEW.courier_telegram_id THEN 'courier' ELSE 'staff' END,event_kind,'UMMA Cafe · Заказ №'||NEW.order_number||E'\n'||event_title,coalesce(recipient=NEW.customer_telegram_id,false)
 FROM (
  SELECT NEW.customer_telegram_id recipient UNION SELECT NEW.courier_telegram_id
  UNION SELECT s.telegram_id FROM public.cafe_staff s WHERE s.location_id=NEW.location_id AND s.is_active AND s.staff_role<>'courier'
  UNION SELECT u.telegram_id FROM public.telegram_users u WHERE u.role='super_admin' AND u.is_active
 ) recipients WHERE recipient IS NOT NULL AND EXISTS(SELECT 1 FROM public.telegram_users u WHERE u.telegram_id=recipient AND u.is_active);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cafe_order_notification ON public.cafe_orders;
CREATE TRIGGER cafe_order_notification AFTER INSERT OR UPDATE OF status,payment_status,delivery_status,courier_telegram_id,total_vnd ON public.cafe_orders FOR EACH ROW EXECUTE FUNCTION public.enqueue_cafe_order_notification();

CREATE OR REPLACE FUNCTION public.enqueue_cafe_offer_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE number bigint;
BEGIN
 IF NEW.status='offered' AND (TG_OP='INSERT' OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
  SELECT order_number INTO number FROM public.cafe_orders WHERE id=NEW.order_id;
  INSERT INTO umma_private.cafe_notifications(order_id,recipient,workspace,kind,title) VALUES(NEW.order_id,NEW.courier_telegram_id,'courier','offer','UMMA Cafe · Доставка №'||number||E'\nНовая доставка: можно принять заказ');
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cafe_offer_notification ON public.cafe_courier_offers;
CREATE TRIGGER cafe_offer_notification AFTER INSERT OR UPDATE ON public.cafe_courier_offers FOR EACH ROW EXECUTE FUNCTION public.enqueue_cafe_offer_notification();

CREATE OR REPLACE FUNCTION public.get_cafe_notifications(p_actor bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE items jsonb; unread bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active) THEN RAISE EXCEPTION 'Notification access denied'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC,n.id),'[]') INTO items FROM (SELECT id,order_id,workspace,kind,title,created_at,read_at FROM umma_private.cafe_notifications WHERE recipient=p_actor AND created_at>clock_timestamp()-interval '30 days' ORDER BY created_at DESC,id LIMIT 50) n;
 SELECT count(*) INTO unread FROM umma_private.cafe_notifications WHERE recipient=p_actor AND read_at IS NULL AND created_at>clock_timestamp()-interval '30 days';
 RETURN jsonb_build_object('ok',true,'notifications',items,'unreadCount',unread);
END $$;
CREATE OR REPLACE FUNCTION public.read_cafe_notifications(p_actor bigint,p_ids uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF cardinality(p_ids)>50 THEN RAISE EXCEPTION 'Too many notification IDs'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=p_actor AND is_active) THEN RAISE EXCEPTION 'Notification access denied'; END IF;
 UPDATE umma_private.cafe_notifications SET read_at=coalesce(read_at,clock_timestamp()) WHERE recipient=p_actor AND id=ANY(p_ids);
 RETURN public.get_cafe_notifications(p_actor);
END $$;
CREATE OR REPLACE FUNCTION public.lease_cafe_customer_notifications() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE jobs jsonb;
BEGIN
 WITH candidates AS (SELECT id FROM umma_private.cafe_notifications n WHERE send_to_bot AND sent_at IS NULL AND attempts<6 AND next_attempt_at<=clock_timestamp() AND (leased_until IS NULL OR leased_until<clock_timestamp()) AND EXISTS(SELECT 1 FROM public.telegram_users WHERE telegram_id=n.recipient AND is_active) ORDER BY created_at,id LIMIT 10 FOR UPDATE SKIP LOCKED), leased AS (
 UPDATE umma_private.cafe_notifications n SET lease_id=gen_random_uuid(),leased_until=clock_timestamp()+interval '30 seconds',attempts=attempts+1 FROM candidates c WHERE n.id=c.id RETURNING n.id,n.recipient,n.title,n.lease_id)
 SELECT coalesce(jsonb_agg(to_jsonb(leased)),'[]') INTO jobs FROM leased;
 RETURN jobs;
END $$;
CREATE OR REPLACE FUNCTION public.finish_cafe_customer_notification(p_id uuid,p_lease uuid,p_success boolean,p_message_id bigint,p_error text,p_terminal boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE umma_private.cafe_notifications SET sent_at=CASE WHEN p_success THEN clock_timestamp() ELSE sent_at END,telegram_message_id=CASE WHEN p_success THEN p_message_id ELSE telegram_message_id END,
 attempts=CASE WHEN p_terminal THEN 6 ELSE attempts END,lease_id=NULL,leased_until=NULL,last_error=CASE WHEN p_success THEN NULL ELSE left(p_error,200) END,next_attempt_at=clock_timestamp()+interval '1 minute'
 WHERE id=p_id AND lease_id=p_lease AND sent_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_cafe_order_notification(),public.enqueue_cafe_offer_notification(),public.get_cafe_notifications(bigint),public.read_cafe_notifications(bigint,uuid[]),public.lease_cafe_customer_notifications(),public.finish_cafe_customer_notification(uuid,uuid,boolean,bigint,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_cafe_notifications(bigint),public.read_cafe_notifications(bigint,uuid[]),public.lease_cafe_customer_notifications(),public.finish_cafe_customer_notification(uuid,uuid,boolean,bigint,text,boolean) TO service_role;
COMMIT;
