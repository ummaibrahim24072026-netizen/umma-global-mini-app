-- Transactional verification: no orders, staff or payments are retained.
begin;
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $test$
declare r jsonb; replay jsonb; state jsonb; oid uuid; k uuid; method text; rejected boolean;
begin
 insert into public.telegram_users(telegram_id,role,is_active) values(8999000000777,'employee',true);
 insert into public.cafe_staff(telegram_id,location_id,staff_role,is_active,can_accept_payments) values(8999000000777,'e22788bd-4734-4b3a-911e-ba103d52617a','kitchen',true,false);
 foreach method in array array['cash','qr'] loop
 k:=gen_random_uuid();
 r:=public.submit_cafe_guest_order_v3(k,repeat(case when method='cash' then '1' else '2' end,64),'e22788bd-4734-4b3a-911e-ba103d52617a','[{"productId":"def936dc-6c57-4b06-ac32-cdf6a736c238","quantity":1}]','QA payment','','qa-payment','3',method);
 oid:=(r->'order'->>'id')::uuid;
 if r->'order'->>'paymentMethod'<>method or (r->'order'->>'totalVnd')::int<>90000 then raise exception 'Payment checkout failed'; end if;
 if not exists(select 1 from public.cafe_orders o join public.cafe_order_items i on i.order_id=o.id where o.id=oid and o.payment_method=method and o.payment_status='pending' and o.customer_name='Стол №3' and i.quantity=1) then raise exception 'Kitchen fields missing'; end if;
 replay:=public.submit_cafe_guest_order_v3(k,repeat(case when method='cash' then '1' else '2' end,64),'e22788bd-4734-4b3a-911e-ba103d52617a','[{"productId":"def936dc-6c57-4b06-ac32-cdf6a736c238","quantity":1}]','','','','',case when method='qr' then 'cash' else 'qr' end);
 if replay->'order'->>'id'<>oid::text or replay->'order'->>'paymentMethod'<>method then raise exception 'Replay changed order'; end if;
 state:=public.cafe_guest_order_status(k,oid);
 if state->'order'->>'payment_method'<>method then raise exception 'Status method missing'; end if;
 rejected:=false;
 begin perform public.cafe_guest_order_status(gen_random_uuid(),oid);exception when others then rejected:=true;end;
 if not rejected then raise exception 'Unrelated receipt allowed'; end if;
 perform public.update_cafe_order_status(oid,8999000000777,'preparing');
 if not exists(select 1 from public.cafe_orders where id=oid and status='preparing' and accepted_by_telegram_id=8999000000777 and accepted_at is not null) then raise exception 'Kitchen acceptance did not start preparation'; end if;
 perform public.update_cafe_order_status(oid,8999000000777,'ready');
 rejected:=false;begin perform public.update_cafe_order_status(oid,8999000000777,'completed');exception when others then rejected:=true;end;
 if not rejected then raise exception 'Unpaid order completed'; end if;
 update public.cafe_orders set payment_status='paid' where id=oid;
 state:=public.cafe_guest_order_status(k,oid);
 if state->'order'->>'payment_status'<>'paid' or state->'order'->>'status'<>'ready' then raise exception 'Live status not reflected'; end if;
 end loop;
 for method in select unnest(array['anon','authenticated']) loop
 if has_function_privilege(method,'public.submit_cafe_guest_order_v3(uuid,text,uuid,jsonb,text,text,text,text,text)','execute') or has_function_privilege(method,'public.cafe_guest_order_status(uuid,uuid)','execute') then raise exception 'RPC publicly exposed'; end if;
 end loop;
end $test$;
rollback;
