BEGIN;

DO $migration$
DECLARE
 signature constant regprocedure := 'public.submit_cafe_guest_delivery_v4(uuid,text,uuid,jsonb,text,text,text,text,text,text,double precision,double precision,text)'::regprocedure;
 definition text := pg_get_functiondef(signature);
 anchor constant text := ' update public.cafe_orders set subtotal_vnd=v_total,total_vnd=v_total where id=v_order.id returning * into v_order;';
BEGIN
 IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 THEN
  RAISE EXCEPTION 'Unexpected guest web delivery totals in %', signature;
 END IF;
 EXECUTE replace(definition,anchor,$updated$
 update public.cafe_orders
 set subtotal_vnd=v_total,
     delivery_fee_vnd=fee.amount,
     total_vnd=v_total+fee.amount
 from (select case when v_total<100000 then 30000 else 0 end as amount) fee
 where cafe_orders.id=v_order.id
 returning cafe_orders.* into v_order;
$updated$);
END
$migration$;

COMMIT;
