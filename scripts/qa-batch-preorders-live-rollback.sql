BEGIN;
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $$
DECLARE actor bigint;initial inventory%rowtype;product uuid;loc uuid;revision uuid;request uuid:=gen_random_uuid();done uuid:=gen_random_uuid();batch_time text:=to_char((clock_timestamp()+interval '2 hours') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS')||'Z';a jsonb;b jsonb;items jsonb;res jsonb;base numeric;before_jobs int;
BEGIN
 SELECT telegram_id INTO STRICT actor FROM telegram_users WHERE role='super_admin' AND is_active LIMIT 1;
 SELECT i.* INTO STRICT initial FROM inventory i JOIN products p ON p.id=i.product_id JOIN locations l ON l.id=i.location_id WHERE p.is_active AND p.product_type='cafe' AND p.price_vnd>0 AND NOT p.catalog_preview AND l.is_active AND l.location_type='cafe' AND l.self_service_enabled AND i.planned_quantity=0 ORDER BY p.id LIMIT 1;
 product:=initial.product_id;loc:=initial.location_id;base:=CASE WHEN initial.ready_stock_confirmed THEN initial.quantity ELSE initial.reserved_quantity END;
 PERFORM cafe_ready_plan(actor,loc,gen_random_uuid(),'plan',jsonb_build_array(jsonb_build_object('productId',product,'quantity',5,'revision',NULL,'readyAt',batch_time)));
 SELECT plan_revision INTO revision FROM inventory WHERE id=initial.id;
 items:=jsonb_build_array(jsonb_build_object('productId',product,'quantity',3,'planRevision',revision));
 a:=submit_cafe_guest_order_v3(request,repeat('a',64),loc,items,'QA rollback',NULL,'QA preorder',NULL,'qr');
 IF (a->'order'->>'preorderWaiting')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Preorder waiting missing';END IF;
 res:=submit_cafe_guest_order_v3(request,repeat('a',64),loc,items,'QA rollback',NULL,'QA preorder',NULL,'qr');IF res->'order'->>'id'<>a->'order'->>'id' THEN RAISE EXCEPTION 'Replay duplicated order';END IF;
 BEGIN
  PERFORM submit_cafe_guest_order_v3(gen_random_uuid(),repeat('b',64),loc,items,'QA rollback',NULL,'QA preorder',NULL,'qr');RAISE EXCEPTION 'Oversell allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%READY_STOCK_UNAVAILABLE%' THEN RAISE;END IF;END;
 IF (SELECT planned_reserved_quantity FROM inventory WHERE id=initial.id)<>3 OR (SELECT quantity FROM inventory WHERE id=initial.id)<>initial.quantity THEN RAISE EXCEPTION 'Wrong future reservation';END IF;
 PERFORM update_cafe_order_payment((a->'order'->>'id')::uuid,actor,'paid','QA rollback only; no bank transfer');
 IF (SELECT status FROM cafe_orders WHERE id=(a->'order'->>'id')::uuid)<>'pending' THEN RAISE EXCEPTION 'Premature assembly after payment';END IF;
 BEGIN PERFORM update_cafe_order_status((a->'order'->>'id')::uuid,actor,'preparing','QA');RAISE EXCEPTION 'Premature assembly allowed';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Партия ещё готовится%' THEN RAISE;END IF;END;
 -- Real delivery checkout must defer all dispatch offers while its batch is cooking.
 b:=submit_cafe_guest_delivery_v4(gen_random_uuid(),repeat('c',64),loc,jsonb_build_array(jsonb_build_object('productId',product,'quantity',2,'planRevision',revision)),'QA rollback',NULL,'QA preorder',NULL,'cash','QA rollback delivery point',(SELECT latitude::double precision FROM locations WHERE id=loc),(SELECT longitude::double precision FROM locations WHERE id=loc),repeat('a',64));
 PERFORM ensure_cafe_courier_offers((b->'order'->>'id')::uuid);
 IF EXISTS(SELECT 1 FROM cafe_courier_offers WHERE order_id=(b->'order'->>'id')::uuid) THEN RAISE EXCEPTION 'Premature courier offer';END IF;
 PERFORM update_cafe_order_status((b->'order'->>'id')::uuid,actor,'cancelled','QA rollback cancellation');
 IF (SELECT planned_reserved_quantity FROM inventory WHERE id=initial.id)<>3 THEN RAISE EXCEPTION 'Cancellation did not free future portions';END IF;
 BEGIN PERFORM cafe_ready_plan(actor,loc,gen_random_uuid(),'finish',jsonb_build_array(jsonb_build_object('productId',product,'quantity',2,'revision',revision)));RAISE EXCEPTION 'Short yield allowed';EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Партия меньше резерва%' THEN RAISE;END IF;END;
 INSERT INTO umma_private.cafe_push_subscriptions(order_id,endpoint,subscription) VALUES((a->'order'->>'id')::uuid,'https://fcm.googleapis.com/QA-ROLLBACK','{}');
 PERFORM cafe_ready_plan(actor,loc,done,'finish',jsonb_build_array(jsonb_build_object('productId',product,'quantity',5,'revision',revision)));
 PERFORM cafe_ready_plan(actor,loc,done,'finish',jsonb_build_array(jsonb_build_object('productId',product,'quantity',5,'revision',revision)));
 IF (SELECT quantity FROM inventory WHERE id=initial.id)<>base+5 OR (SELECT reserved_quantity FROM inventory WHERE id=initial.id)<>initial.reserved_quantity+3 THEN RAISE EXCEPTION 'Duplicate receipt/reservation conversion';END IF;
 IF NOT EXISTS(SELECT 1 FROM cafe_orders WHERE id=(a->'order'->>'id')::uuid AND NOT preorder_waiting AND status='preparing' AND payment_status='paid') THEN RAISE EXCEPTION 'Released order not assembling';END IF;
 IF NOT EXISTS(SELECT 1 FROM umma_private.cafe_push_jobs WHERE payload->>'id'=a->'order'->>'id' AND payload->'changes'->>'preorder'='batch_ready') THEN RAISE EXCEPTION 'No batch-ready push';END IF;
 PERFORM update_cafe_order_status((a->'order'->>'id')::uuid,actor,'ready','QA rollback assembled');
 IF NOT EXISTS(SELECT 1 FROM umma_private.cafe_push_jobs WHERE payload->>'id'=a->'order'->>'id' AND payload->'changes'->>'status'='ready') THEN RAISE EXCEPTION 'No assembled push';END IF;
 PERFORM update_cafe_order_status((a->'order'->>'id')::uuid,actor,'completed','QA rollback pickup');
 IF (SELECT quantity FROM inventory WHERE id=initial.id)<>base+2 OR (SELECT reserved_quantity FROM inventory WHERE id=initial.id)<>initial.reserved_quantity THEN RAISE EXCEPTION 'Wrong final stock';END IF;
END $$;
ROLLBACK;
