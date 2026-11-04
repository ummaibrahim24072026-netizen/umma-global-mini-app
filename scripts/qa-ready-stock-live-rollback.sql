BEGIN;
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $$
DECLARE actor bigint; loc uuid; product uuid; key uuid:=gen_random_uuid(); oid uuid; r jsonb;
BEGIN
 SELECT telegram_id INTO STRICT actor FROM telegram_users WHERE role='super_admin' AND is_active LIMIT 1;
 SELECT l.id INTO STRICT loc FROM locations l WHERE l.is_active AND l.location_type='cafe' AND l.ready_stock_enabled LIMIT 1;
 SELECT id INTO STRICT product FROM products WHERE sku='UMMA-CAFE-FLATBREAD' AND is_active;
 PERFORM cafe_ready_adjust(actor,loc,key,'add',jsonb_build_array(jsonb_build_object('productId',product,'quantity',10)));
 PERFORM cafe_ready_adjust(actor,loc,key,'add',jsonb_build_array(jsonb_build_object('productId',product,'quantity',10)));
 IF (SELECT quantity FROM inventory WHERE product_id=product AND location_id=loc)<>10 THEN RAISE EXCEPTION 'Duplicate stock added';END IF;
 r:=submit_cafe_guest_order_v3(gen_random_uuid(),repeat('f',64),loc,jsonb_build_array(jsonb_build_object('productId',product,'quantity',2)),'QA rollback',NULL,'rollback stock verification',NULL,'cash');oid:=(r->'order'->>'id')::uuid;
 IF (SELECT quantity-reserved_quantity FROM inventory WHERE product_id=product AND location_id=loc)<>8 THEN RAISE EXCEPTION 'Stock not reserved';END IF;
 PERFORM update_cafe_order_status(oid,actor,'cancelled');
 IF (SELECT quantity-reserved_quantity FROM inventory WHERE product_id=product AND location_id=loc)<>10 THEN RAISE EXCEPTION 'Stock not released';END IF;
END $$;
ROLLBACK;
