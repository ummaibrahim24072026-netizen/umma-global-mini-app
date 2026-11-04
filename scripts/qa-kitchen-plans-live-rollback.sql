BEGIN;
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $$
DECLARE actor bigint; initial inventory%rowtype; product uuid; loc uuid; revision uuid; request uuid:=gen_random_uuid(); batch_time timestamptz:=clock_timestamp()+interval '2 hours'; base numeric; done uuid:=gen_random_uuid();
BEGIN
 SELECT telegram_id INTO STRICT actor FROM telegram_users WHERE role='super_admin' AND is_active LIMIT 1;
 SELECT i.* INTO STRICT initial FROM inventory i JOIN products p ON p.id=i.product_id JOIN locations l ON l.id=i.location_id WHERE p.is_active AND p.product_type='cafe' AND p.price_vnd>0 AND NOT p.catalog_preview AND l.is_active AND l.location_type='cafe' AND i.planned_quantity=0 LIMIT 1;
 product:=initial.product_id;loc:=initial.location_id;base:=CASE WHEN initial.ready_stock_confirmed THEN initial.quantity ELSE initial.reserved_quantity END;
 PERFORM cafe_ready_plan(actor,loc,request,'plan',jsonb_build_array(jsonb_build_object('productId',product,'quantity',10,'revision',NULL,'readyAt',to_char(batch_time AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS')||'Z')));
 IF (SELECT quantity FROM inventory WHERE id=initial.id)<>initial.quantity OR (SELECT reserved_quantity FROM inventory WHERE id=initial.id)<>initial.reserved_quantity THEN RAISE EXCEPTION 'Planning changed saleable stock';END IF;
 SELECT plan_revision INTO revision FROM inventory WHERE id=initial.id;
 PERFORM cafe_ready_plan(actor,loc,done,'finish',jsonb_build_array(jsonb_build_object('productId',product,'quantity',8,'revision',revision)));
 PERFORM cafe_ready_plan(actor,loc,done,'finish',jsonb_build_array(jsonb_build_object('productId',product,'quantity',8,'revision',revision)));
 IF (SELECT quantity FROM inventory WHERE id=initial.id)<>base+8 OR (SELECT planned_quantity FROM inventory WHERE id=initial.id)<>0 THEN RAISE EXCEPTION 'Duplicate batch receipt';END IF;
END $$;
ROLLBACK;
