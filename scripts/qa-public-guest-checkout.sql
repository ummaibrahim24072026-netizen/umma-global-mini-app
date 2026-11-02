-- Run against a configured project; no orders are committed.
begin;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $test$
declare r jsonb; replay jsonb; oid uuid; k uuid:=gen_random_uuid(); rejected boolean:=false; invalid_table text;
begin
 r:=public.submit_cafe_guest_order_v2(k,repeat('a',64),'e22788bd-4734-4b3a-911e-ba103d52617a','[{"productId":"def936dc-6c57-4b06-ac32-cdf6a736c238","quantity":1}]'::jsonb,'','','qa-counter',null);
 if (r->>'ok')::boolean is distinct from true or (r->'order'->>'totalVnd')::int<>90000 then raise exception 'Anonymous checkout failed'; end if;
 oid:=(r->'order'->>'id')::uuid;
 if not exists(select 1 from public.cafe_orders where id=oid and order_type='pickup' and customer_name='Гость' and customer_phone is null) then raise exception 'Anonymous kitchen record invalid'; end if;
 replay:=public.submit_cafe_guest_order_v2(k,repeat('a',64),'e22788bd-4734-4b3a-911e-ba103d52617a','[{"productId":"def936dc-6c57-4b06-ac32-cdf6a736c238","quantity":1}]'::jsonb,'','','qa-counter',null);
 if replay->'order'->>'id'<>oid::text or (replay->>'replayed')::boolean is distinct from true then raise exception 'Replay failed'; end if;
 r:=public.submit_cafe_guest_order_v2(gen_random_uuid(),repeat('b',64),'e22788bd-4734-4b3a-911e-ba103d52617a','[{"productId":"def936dc-6c57-4b06-ac32-cdf6a736c238","quantity":1}]'::jsonb,'QA Guest','','qa-table','6');
 oid:=(r->'order'->>'id')::uuid;
 if not exists(select 1 from public.cafe_orders where id=oid and order_type='dine_in' and customer_name='Стол №6' and customer_phone is null and customer_note like '%QA Guest%') then raise exception 'Table record invalid'; end if;
 r:=public.submit_cafe_guest_order(gen_random_uuid(),repeat('c',64),'e22788bd-4734-4b3a-911e-ba103d52617a','[{"productId":"def936dc-6c57-4b06-ac32-cdf6a736c238","quantity":1}]'::jsonb,'','','qa-legacy');
 if (r->>'ok')::boolean is distinct from true then raise exception 'Legacy compatibility failed'; end if;
 foreach invalid_table in array array['0','7','1<script>','1.5'] loop
 rejected:=false;
 begin perform public.submit_cafe_guest_order_v2(gen_random_uuid(),repeat('d',64),'e22788bd-4734-4b3a-911e-ba103d52617a','[{"productId":"def936dc-6c57-4b06-ac32-cdf6a736c238","quantity":1}]'::jsonb,'','','qa-invalid',invalid_table); exception when others then rejected:=true; end;
 if not rejected then raise exception 'Invalid table accepted'; end if;
 end loop;
 if has_function_privilege('anon','public.submit_cafe_guest_order_v2(uuid,text,uuid,jsonb,text,text,text,text)','execute') or has_function_privilege('authenticated','public.submit_cafe_guest_order_v2(uuid,text,uuid,jsonb,text,text,text,text)','execute') then raise exception 'RPC exposed'; end if;
end $test$;

rollback;
