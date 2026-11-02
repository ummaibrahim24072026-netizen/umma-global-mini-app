-- Exercises production constraints/triggers; all rows and outbox entries roll back.
begin;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $test$
declare r jsonb; replay jsonb; oid uuid; k uuid:=gen_random_uuid(); method text; rejected boolean; count_before int;
begin
 foreach method in array array['cash','qr'] loop
 k:=gen_random_uuid();
 r:=public.submit_cafe_guest_delivery_v4(k,repeat('f',64),'e22788bd-4734-4b3a-911e-ba103d52617a','[{"productId":"def936dc-6c57-4b06-ac32-cdf6a736c238","quantity":1}]','', '', 'qa-rollback',null,method,'QA Scenia Bay address',12.28,109.20,encode(sha256(k::text::bytea),'hex'));
 oid:=(r->'order'->>'id')::uuid;
 if not exists(select 1 from public.cafe_orders where id=oid and order_type='delivery' and total_vnd=90000 and payment_method=method and delivery_status='waiting_courier' and customer_phone is null and payment_timing=case when method='qr' then 'now' else 'on_delivery' end) then raise exception 'Invalid delivery record'; end if;
 if not exists(select 1 from public.cafe_order_items where order_id=oid and quantity=1 and unit_price_vnd=90000) then raise exception 'Missing kitchen items'; end if;
 if not exists(select 1 from public.umma_guest_delivery_grants where order_id=oid and expires_at>now() and token_hash=encode(sha256(k::text::bytea),'hex')) then raise exception 'Missing tracking grant'; end if;
 replay:=public.submit_cafe_guest_delivery_v4(k,repeat('f',64),'e22788bd-4734-4b3a-911e-ba103d52617a','[{"productId":"def936dc-6c57-4b06-ac32-cdf6a736c238","quantity":1}]','','','qa-rollback',null,method,'QA Scenia Bay address',12.28,109.20,encode(sha256(k::text::bytea),'hex'));
 if replay->'order'->>'id'<>oid::text or (replay->>'replayed')::boolean is distinct from true or (select count(*) from public.umma_guest_delivery_grants where order_id=oid)<>1 or (select count(*) from public.cafe_order_items where order_id=oid)<>1 then raise exception 'Replay duplicated order'; end if;
 r:=public.cafe_guest_order_status(k,oid);
 if r->'order'->>'payment_method'<>method then raise exception 'Receipt cannot read payment'; end if;
 end loop;
 rejected:=false;
 begin perform public.submit_cafe_guest_delivery_v4(gen_random_uuid(),repeat('f',64),'e22788bd-4734-4b3a-911e-ba103d52617a','[{"productId":"def936dc-6c57-4b06-ac32-cdf6a736c238","quantity":1}]','','','qa-rollback',null,'cash','Outside delivery zone',21.02,105.84,repeat('a',64));exception when others then rejected:=true;end;
 if not rejected then raise exception 'Outside zone accepted'; end if;
 rejected:=false;
 begin perform public.cafe_guest_order_status(gen_random_uuid(),oid);exception when others then rejected:=true;end;
 if not rejected then raise exception 'Another receipt accepted'; end if;
 if has_function_privilege('anon','public.submit_cafe_guest_delivery_v4(uuid,text,uuid,jsonb,text,text,text,text,text,text,double precision,double precision,text)','execute') or has_function_privilege('authenticated','public.submit_cafe_guest_delivery_v4(uuid,text,uuid,jsonb,text,text,text,text,text,text,double precision,double precision,text)','execute') then raise exception 'RPC publicly exposed';end if;
end $test$;
rollback;
