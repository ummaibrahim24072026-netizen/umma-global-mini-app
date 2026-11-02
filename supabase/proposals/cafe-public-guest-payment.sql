CREATE OR REPLACE FUNCTION public.submit_cafe_guest_order_v3(p_request_key uuid, p_ip_hash text, p_location_id uuid, p_items jsonb, p_customer_name text, p_customer_phone text, p_source text, p_table_number text, p_payment_method text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_order public.cafe_orders%rowtype; v_item jsonb; v_product public.products%rowtype; v_qty int; v_total int:=0; v_old uuid; v_count int; v_table text:=nullif(trim(p_table_number),'');
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Access denied'; end if;
 if p_payment_method is null or p_payment_method not in ('cash','qr') then raise exception 'Invalid payment method'; end if;
 if p_request_key is null or p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid request'; end if;
 if length(coalesce(p_customer_name,''))>100 or length(coalesce(p_customer_phone,''))>32 or length(coalesce(p_source,''))>80 then raise exception 'Invalid customer data'; end if;
 if nullif(trim(p_customer_phone),'') is not null and p_customer_phone !~ '^[+0-9 ()-]{8,32}$' then raise exception 'Invalid phone'; end if;
 if v_table is not null and v_table !~ '^[1-6]$' then raise exception 'Invalid table'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 25 then raise exception 'Invalid items'; end if;
 if not exists(select 1 from public.locations where id=p_location_id and is_active and location_type in ('cafe','restaurant')) then raise exception 'Cafe unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_ip_hash,0));
 select count(*) into v_count from umma_private.public_guest_requests where ip_hash=p_ip_hash and created_at>now()-interval '1 hour';
 select order_id into v_old from umma_private.public_guest_requests where request_key=p_request_key;
 if v_old is not null then
   select * into v_order from public.cafe_orders where id=v_old;
   return jsonb_build_object('ok',true,'replayed',true,'order',jsonb_build_object('id',v_order.id,'orderNumber',v_order.order_number,'totalVnd',v_order.total_vnd,'paymentMethod',v_order.payment_method,'paymentStatus',v_order.payment_status,'status',v_order.status));
 end if;
 if v_count>=5 then raise exception 'Too many requests. Contact cafe'; end if;
 insert into umma_private.public_guest_requests(request_key,ip_hash) values(p_request_key,p_ip_hash);
 insert into public.cafe_orders(location_id,order_type,payment_method,payment_status,customer_name,customer_phone,customer_note,created_via)
 values(p_location_id,case when v_table is null then 'pickup' else 'dine_in' end,p_payment_method,'pending',case when v_table is not null then 'Стол №'||v_table else left(coalesce(nullif(trim(p_customer_name),''),'Гость'),100) end,nullif(trim(p_customer_phone),''),left(concat_ws(E'\n',case when v_table is not null and nullif(trim(p_customer_name),'') is not null then 'Гость: '||trim(p_customer_name) end,'Web · '||coalesce(p_source,'')),250),'customer')
 returning * into v_order;
 for v_item in select value from jsonb_array_elements(p_items) loop
   if v_item->>'productId' is null or v_item->>'quantity' is null or jsonb_typeof(v_item)<>'object' or (v_item->>'productId') !~ '^[0-9a-f-]{36}$' or (v_item->>'quantity') !~ '^[0-9]{1,2}$' then raise exception 'Invalid item'; end if;
   v_qty:=(v_item->>'quantity')::int;
   if v_qty not between 1 and 20 then raise exception 'Invalid quantity'; end if;
   select * into v_product from public.products where id=(v_item->>'productId')::uuid and is_active and product_type='cafe' and catalog_preview=false and price_vnd>0;
   if not found then raise exception 'Product unavailable'; end if;
   insert into public.cafe_order_items(order_id,product_id,product_name_ru,product_name_vi,product_name_en,quantity,unit_price_vnd)
   values(v_order.id,v_product.id,v_product.name_ru,v_product.name_vi,v_product.name_en,v_qty,v_product.price_vnd);
   v_total:=v_total+v_qty*v_product.price_vnd;
 end loop;
 update public.cafe_orders set subtotal_vnd=v_total,total_vnd=v_total where id=v_order.id returning * into v_order;
 update umma_private.public_guest_requests set order_id=v_order.id where request_key=p_request_key;
 return jsonb_build_object('ok',true,'replayed',false,'order',jsonb_build_object('id',v_order.id,'orderNumber',v_order.order_number,'totalVnd',v_order.total_vnd,'paymentMethod',v_order.payment_method,'paymentStatus',v_order.payment_status,'status',v_order.status));
end $function$
;
REVOKE ALL ON FUNCTION public.submit_cafe_guest_order_v3(uuid,text,uuid,jsonb,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_cafe_guest_order_v3(uuid,text,uuid,jsonb,text,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.cafe_guest_order_status(p_request_key uuid, p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public,pg_temp AS $function$
declare v_order public.cafe_orders%rowtype;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Access denied'; end if;
 if not exists(select 1 from umma_private.public_guest_requests where request_key=p_request_key and order_id=p_order_id) then raise exception 'Order unavailable'; end if;
 select * into v_order from public.cafe_orders where id=p_order_id;
 return jsonb_build_object('ok',true,'order',jsonb_build_object('id',v_order.id,'orderNumber',v_order.order_number,'totalVnd',v_order.total_vnd,'location_id',v_order.location_id,'payment_method',v_order.payment_method,'payment_status',v_order.payment_status,'currency',v_order.currency,'status',v_order.status));
end $function$;
REVOKE ALL ON FUNCTION public.cafe_guest_order_status(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cafe_guest_order_status(uuid,uuid) TO service_role;
