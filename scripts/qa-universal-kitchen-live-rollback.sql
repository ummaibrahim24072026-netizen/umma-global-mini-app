BEGIN;
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $$
DECLARE owner_id bigint;actor bigint;loc uuid:='e22788bd-4734-4b3a-911e-ba103d52617a';food_id uuid;request uuid:=gen_random_uuid();items jsonb;first jsonb;again jsonb;order_data jsonb;ingredient_name text:='QA ingredient '||gen_random_uuid()::text;stock_id uuid;stock_before numeric;
BEGIN
 SELECT telegram_id INTO STRICT owner_id FROM telegram_users WHERE is_active AND role='super_admin' LIMIT 1;
 actor:=cafe_web_invite_staff(owner_id,loc,'kitchen_cashier','QA universal rollback',md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text));
 IF NOT EXISTS(SELECT 1 FROM cafe_staff WHERE telegram_id=actor AND staff_role='kitchen' AND can_accept_payments) THEN RAISE EXCEPTION 'Combined role missing';END IF;
 items:=jsonb_build_array(jsonb_build_object('name',ingredient_name,'unit','kg','quantity',2,'unitCostVnd',50000));
 first:=cafe_ingredients_receive(actor,loc,request,(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'QA rollback supplier',items);
 again:=cafe_ingredients_receive(actor,loc,request,(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,'QA rollback supplier',items);
 IF first->>'documentId'<>again->>'documentId' OR (first->>'subtotalVnd')::bigint<>100000 THEN RAISE EXCEPTION 'Purchase replay mismatch';END IF;
 SELECT id INTO STRICT stock_id FROM stock_items WHERE name_ru=ingredient_name;
 IF NOT EXISTS(SELECT 1 FROM stock_balances WHERE stock_item_id=stock_id AND location_id=loc AND quantity_on_hand=2 AND average_unit_cost_vnd=50000) THEN RAISE EXCEPTION 'Ingredient stock/cost mismatch';END IF;
 SELECT p.id INTO STRICT food_id FROM products p WHERE p.is_active AND p.product_type='cafe' AND NOT p.catalog_preview AND p.price_vnd>0 ORDER BY p.id LIMIT 1;
 PERFORM cafe_ready_adjust(owner_id,loc,gen_random_uuid(),'add',jsonb_build_array(jsonb_build_object('productId',food_id,'quantity',2)));
 SELECT quantity INTO stock_before FROM inventory WHERE location_id=loc AND product_id=food_id;
 order_data:=create_cafe_staff_order(actor,loc,jsonb_build_array(jsonb_build_object('productId',food_id,'quantity',1)),'pickup','QA universal sale',NULL,NULL,'cash');
 PERFORM update_cafe_order_payment_cash((order_data->'order'->>'id')::uuid,actor,'paid','QA rollback',coalesce((order_data->'order'->>'totalVnd')::int,0),0);
 PERFORM update_cafe_order_status((order_data->'order'->>'id')::uuid,actor,'ready','QA rollback');
 PERFORM update_cafe_order_status((order_data->'order'->>'id')::uuid,actor,'completed','QA rollback');
 IF (SELECT quantity FROM inventory WHERE product_id=food_id AND location_id=loc)<>stock_before-1 THEN RAISE EXCEPTION 'Combined sale did not deduct stock once';END IF;
 PERFORM cafe_web_change_staff_role(owner_id,actor,loc,'kitchen');
 IF EXISTS(SELECT 1 FROM cafe_staff WHERE telegram_id=actor AND can_accept_payments) THEN RAISE EXCEPTION 'Separate kitchen still has cash capability';END IF;
END $$;
ROLLBACK;
