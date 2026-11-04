-- Run only through a trusted service connection. Every synthetic row and HTTP wake is rolled back.
BEGIN;
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $$
DECLARE owner_id bigint; cashier bigint; kitchen bigint; courier bigint; loc uuid; product uuid; price int; oid uuid; key uuid; items jsonb; r jsonb; proof uuid; total int; denied boolean; method text; before_count bigint;
BEGIN
 SELECT telegram_id INTO STRICT owner_id FROM telegram_users WHERE role='super_admin' AND is_active LIMIT 1;
 SELECT id INTO STRICT loc FROM locations WHERE id='e22788bd-4734-4b3a-911e-ba103d52617a' AND is_active;
 SELECT id,price_vnd INTO STRICT product,price FROM products WHERE sku='UMMA-CAFE-FLATBREAD' AND is_active;
 items:=jsonb_build_array(jsonb_build_object('productId',product,'quantity',1));
 cashier:=cafe_web_invite_staff(owner_id,loc,'cashier','QA rollback cashier',replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''));
 kitchen:=cafe_web_invite_staff(owner_id,loc,'kitchen','QA rollback kitchen',replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''));
 courier:=cafe_web_invite_staff(owner_id,loc,'courier','QA rollback courier',replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''));
 -- Cash/QR: customer -> cashier -> kitchen -> collection -> guest receipt + durable push.
 FOREACH method IN ARRAY ARRAY['cash','qr'] LOOP
  key:=gen_random_uuid();
  r:=submit_cafe_guest_order_v3(key,repeat('c',64),loc,items,'QA rollback',NULL,'automated rollback',NULL,method);oid:=(r->'order'->>'id')::uuid;
  IF (submit_cafe_guest_order_v3(key,repeat('c',64),loc,items,'QA rollback',NULL,'automated rollback',NULL,method)->'order'->>'id')::uuid<>oid THEN RAISE EXCEPTION 'Duplicate customer order'; END IF;
  PERFORM cafe_push_subscribe(oid,key,jsonb_build_object('endpoint','https://fcm.googleapis.com/fcm/send/rollback-only','keys',jsonb_build_object('auth',repeat('a',22),'p256dh',repeat('a',87))),'ru');
  denied:=false;BEGIN PERFORM update_cafe_order_status(oid,kitchen,'preparing');EXCEPTION WHEN OTHERS THEN denied:=true;END;
  IF NOT denied THEN RAISE EXCEPTION 'Unpaid customer order entered kitchen'; END IF;
  IF method='cash' THEN PERFORM update_cafe_order_payment_cash(oid,cashier,'paid',NULL,price+10000,10000);ELSE PERFORM update_cafe_order_payment_cash(oid,cashier,'paid');END IF;
  IF NOT EXISTS(SELECT 1 FROM cafe_orders WHERE id=oid AND status='preparing' AND payment_status='paid' AND total_vnd=price) THEN RAISE EXCEPTION 'Cashier/kitchen synchronization failed'; END IF;
  PERFORM update_cafe_order_status(oid,kitchen,'ready');PERFORM update_cafe_order_status(oid,cashier,'completed');
  r:=cafe_guest_order_status(key,oid);
  IF r->'order'->>'status'<>'completed' OR r->'order'->>'payment_status'<>'paid' THEN RAISE EXCEPTION 'Customer receipt not synchronized'; END IF;
  IF (SELECT count(*) FROM cafe_payment_receipts WHERE order_id=oid)<>1 THEN RAISE EXCEPTION 'Duplicate/missing receipt'; END IF;
  IF (SELECT count(*) FROM umma_private.cafe_push_jobs j JOIN umma_private.cafe_push_subscriptions s ON s.id=j.subscription_id WHERE s.order_id=oid)<3 THEN RAISE EXCEPTION 'Missing background updates'; END IF;
 END LOOP;
 -- Delivery: actual DB operations; photo metadata simulated, Storage uploads tested in isolation.
 PERFORM set_courier_dispatch_presence(courier,true);
 key:=gen_random_uuid();
 r:=submit_cafe_guest_delivery_v4(key,repeat('d',64),loc,items,'QA rollback',NULL,'automated rollback',NULL,'cash','QA rollback address Nha Trang',12.274,109.201,repeat('e',64));oid:=(r->'order'->>'id')::uuid;
 PERFORM offer_cafe_courier(oid,owner_id,courier);PERFORM respond_cafe_courier_offer(oid,courier,true);
 PERFORM update_cafe_order_status(oid,kitchen,'confirmed');PERFORM update_cafe_order_status(oid,kitchen,'preparing');PERFORM update_cafe_order_status(oid,kitchen,'ready');
 r:=begin_cafe_delivery_proof(oid,courier,gen_random_uuid(),'pickup',repeat('a',64),'image/jpeg',1024);proof:=(r->'proof'->>'id')::uuid;PERFORM confirm_cafe_delivery_proof(proof,courier);
 SELECT total_vnd INTO total FROM cafe_orders WHERE id=oid;PERFORM update_cafe_order_payment_cash(oid,courier,'paid',NULL,total+10000,10000);
 r:=begin_cafe_delivery_proof(oid,courier,gen_random_uuid(),'handover',repeat('b',64),'image/jpeg',1024);proof:=(r->'proof'->>'id')::uuid;PERFORM confirm_cafe_delivery_proof(proof,courier);
 IF NOT EXISTS(SELECT 1 FROM cafe_orders WHERE id=oid AND status='completed' AND delivery_status='delivered' AND payment_status='paid' AND courier_telegram_id=courier) THEN RAISE EXCEPTION 'Delivery completion not synchronized'; END IF;
END $$;
ROLLBACK;
