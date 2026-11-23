-- Immutable audit documents for the existing cafe stock and ready portions.
create table umma_private.owner_operations (
  id uuid primary key,
  location_id uuid not null references public.locations(id),
  actor bigint not null,
  kind text not null,
  payload jsonb not null,
  result jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index owner_operations_location_date on umma_private.owner_operations(location_id,created_at desc);
create table umma_private.owner_kitchen (
  location_id uuid references public.locations(id),
  item_id uuid references public.stock_items(id),
  quantity numeric(14,3) not null check(quantity>=0),
  unit_cost numeric(18,4) check(unit_cost>=0),
  primary key(location_id,item_id)
);
create table umma_private.owner_recipes (
  recipe_id uuid primary key references public.recipes(id),
  location_id uuid not null references public.locations(id),
  output_id uuid not null references public.stock_items(id),
  approved_by bigint not null,
  approved_at timestamptz not null default clock_timestamp()
);
create table umma_private.owner_modes (
  location_id uuid primary key references public.locations(id),
  mode text not null check(mode in ('A','B','C'))
);
create table umma_private.owner_invoices (
  location_id uuid references public.locations(id),
  file_hash text check(file_hash ~ '^[a-f0-9]{64}$'),
  fingerprint text,
  purchase_id uuid unique references public.purchase_documents(id),
  primary key(location_id,file_hash),
  unique(location_id,fingerprint)
);
alter table umma_private.owner_operations enable row level security;
alter table umma_private.owner_kitchen enable row level security;
alter table umma_private.owner_recipes enable row level security;
alter table umma_private.owner_modes enable row level security;
alter table umma_private.owner_invoices enable row level security;
alter table public.stock_items drop constraint stock_items_item_type_check;
alter table public.stock_items add constraint stock_items_item_type_check
  check(item_type in ('raw_material','semi_finished','finished_good','packaging','other'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('cafe-owner-invoices','cafe-owner-invoices',false,10000000,array['application/pdf','image/jpeg','image/png','image/webp']);

create function umma_private.owner_permission(p_actor bigint,p_location uuid) returns text
language sql stable set search_path='' as $$
  select case when u.role='super_admin' then 'owner' else s.staff_role end
  from public.telegram_users u
  join public.locations l on l.id=p_location and l.location_type in ('cafe','restaurant') and l.is_active
  left join public.cafe_staff s on s.telegram_id=u.telegram_id and s.location_id=l.id and s.is_active
  where u.telegram_id=p_actor and u.is_active
    and (u.role='super_admin' or (u.role in ('admin','employee') and s.staff_role in ('manager','kitchen')))
$$;

create function umma_private.owner_catalog()
returns setof public.stock_items language sql stable set search_path='' as $$
  select s.* from public.stock_items s where s.is_active and not exists(
    select 1 from public.market_product_variants m where m.stock_item_id=s.id)
$$;

create function umma_private.owner_quantity(p_qty text,p_unit text,p_base text,p_zero boolean)
returns numeric language plpgsql immutable set search_path='' as $$
declare q numeric;
begin
  if coalesce(p_qty,'') !~ '^[0-9]{1,7}(\.[0-9]{1,6})?$' or p_unit is null then
    raise exception 'Укажите количество и единицу измерения';
  end if;
  q:=p_qty::numeric;
  if (p_unit,p_base) in (('g','kg'),('ml','l')) then q:=q/1000;
  elsif (p_unit,p_base) in (('kg','g'),('l','ml')) then q:=q*1000;
  elsif p_unit<>p_base then raise exception 'Единица измерения не соответствует складской позиции'; end if;
  if (q=0 and not p_zero) or q>9999999 or q<>round(q,3)
     or (p_base in ('pcs','portion') and q<>trunc(q)) then raise exception 'Проверьте количество и точность'; end if;
  return q;
end $$;

create function umma_private.owner_change(p_location uuid,p_item public.stock_items,p_area text,p_delta numeric,
  p_expected numeric,p_price numeric,p_kind text,p_key uuid,p_actor bigint,p_reason text) returns jsonb
language plpgsql set search_path='' as $$
declare before_qty numeric; prior_cost numeric; cost numeric; qty numeric; reserved numeric;
  inv public.inventory%rowtype; product uuid:=p_item.linked_product_id;
begin
  if p_area is null or p_area not in ('main','kitchen') or (p_area='kitchen' and p_item.item_type='finished_good') then
    raise exception 'Проверьте место хранения';
  end if;
  if product is not null then
    if not exists(select 1 from public.locations where id=p_location and ready_stock_enabled) then
      raise exception 'Для блюда нужно включить готовые порции в рабочем кабинете';
    end if;
    insert into public.inventory(product_id,location_id,quantity,reserved_quantity)
      values(product,p_location,0,0) on conflict(product_id,location_id) do nothing;
    select * into inv from public.inventory where location_id=p_location and product_id=product for update;
    if p_kind='production_in' and coalesce((to_jsonb(inv)->>'planned_quantity')::int,0)>0 then
      raise exception 'По блюду открыт план кухни. Выпустите эту партию через план';
    end if;
    before_qty:=case when inv.ready_stock_confirmed then inv.quantity else inv.reserved_quantity end;
    reserved:=inv.reserved_quantity;
  elsif p_area='kitchen' then
    insert into umma_private.owner_kitchen values(p_location,p_item.id,0,null) on conflict do nothing;
    select quantity,unit_cost into before_qty,prior_cost from umma_private.owner_kitchen
      where location_id=p_location and item_id=p_item.id for update;
    reserved:=0;
  else
    insert into public.stock_balances(location_id,stock_item_id,quantity_on_hand,quantity_reserved,average_unit_cost_vnd)
      values(p_location,p_item.id,0,0,0) on conflict(location_id,stock_item_id) do nothing;
    select quantity_on_hand,nullif(average_unit_cost_vnd,0),quantity_reserved into before_qty,prior_cost,reserved
      from public.stock_balances where location_id=p_location and stock_item_id=p_item.id for update;
  end if;
  if p_kind='count' and before_qty is distinct from p_expected then
    raise exception 'Остаток изменился во время пересчёта. Обновите ведомость';
  end if;
  qty:=before_qty+p_delta;
  if qty<reserved then raise exception 'Недостаточно свободного остатка в выбранном месте хранения'; end if;
  cost:=case when p_delta<=0 then prior_cost when before_qty=0 then p_price
    when prior_cost is not null and p_price is not null then round((before_qty*prior_cost+p_delta*p_price)/qty,4) end;
  if product is not null then
    if qty<>trunc(qty) then raise exception 'Для меню укажите целые порции'; end if;
    update public.inventory set quantity=qty,ready_stock_confirmed=true,
      ready_stock_state=case when p_kind='production_in' then 'ready' else ready_stock_state end,
      is_available=case when p_kind='production_in' then true else is_available end,updated_at=now()
      where id=inv.id;
    insert into public.cafe_inventory_movements(location_id,product_id,actor_telegram_id,movement_type,quantity,note)
      values(p_location,product,p_actor,'stock_set',qty,'AI Управляющий: '||p_kind||' '||p_key::text);
  elsif p_area='kitchen' then
    update umma_private.owner_kitchen set quantity=qty,unit_cost=cost where location_id=p_location and item_id=p_item.id;
  else
    update public.stock_balances set quantity_on_hand=qty,average_unit_cost_vnd=coalesce(cost,0),updated_at=now()
      where location_id=p_location and stock_item_id=p_item.id;
  end if;
  if p_delta<>0 then
    insert into public.stock_movements(location_id,stock_item_id,movement_type,quantity_delta,unit_cost_vnd,source_id,actor_telegram_id,note)
      values(p_location,p_item.id,case when p_kind<>'count' then p_kind when p_delta>0 then 'adjustment_in' else 'adjustment_out' end,
        p_delta,coalesce(case when p_delta<0 then prior_cost else p_price end,0),p_key,p_actor,p_area||': '||p_reason);
  end if;
  return jsonb_build_object('itemId',p_item.id,'area',p_area,'before',before_qty,'quantity',qty,'cost',prior_cost);
end $$;

create function public.cafe_owner_post(p_actor bigint,p_location uuid,p_key uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
<<operation>>
declare
  v_role text:=umma_private.owner_permission(p_actor,p_location);
  action_kind text:=p_payload->>'kind'; source text:=p_payload->>'source'; area text;
  lines jsonb:=p_payload->'lines'; inputs jsonb:=coalesce(p_payload->'inputs','[]'::jsonb);
  line jsonb; entries jsonb:='[]'; normalized jsonb:='[]'; item public.stock_items%rowtype;
  prev umma_private.owner_operations%rowtype; change_row jsonb; out_id uuid; v_recipe uuid; v_product uuid;
  qty numeric; output_qty numeric; before_qty numeric; cost numeric; raw_cost numeric; mode text;
  total numeric; input_cost numeric:=0; known boolean; used_recipe boolean:=false;
  purchase_id uuid; supplier_id uuid; supplier_name text:=nullif(trim(p_payload->>'supplier'),'');
  invoice_number text:=nullif(trim(p_payload->>'number'),''); part text:=nullif(trim(p_payload->>'part'),'');
  v_hash text:=p_payload->>'hash'; fingerprint text; invoice_date date; line_total numeric;
  base_total numeric:=0; extra_amount numeric; distributed numeric:=0; amount numeric; previous_total numeric:=0;
  full_count boolean:=coalesce((p_payload->>'full')::boolean,false);
  reason text:=left(trim(coalesce(p_payload->>'note','')),500);
begin
  if v_role is null then raise exception 'Нет доступа к этому кафе' using errcode='42501'; end if;
  if p_key is null or coalesce(action_kind,'') not in ('purchase','transfer','production','count','waste','return','recipe','mode')
    or coalesce(source,'') not in ('manual','text','voice','invoice') or (source='invoice' and action_kind<>'purchase') then
    raise exception 'Проверьте параметры документа';
  end if;
  if (action_kind in ('mode','recipe') and v_role<>'owner') or (action_kind in ('count','purchase') and v_role='kitchen') then
    raise exception 'Недостаточно прав для этой операции' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('owner-manager:'||p_location,0));
  select * into prev from umma_private.owner_operations where id=p_key;
  if found then
    if (prev.actor,prev.location_id,prev.payload) is distinct from (p_actor,p_location,p_payload) then
      raise exception 'Ключ запроса уже использован';
    end if;
    return case when v_role='kitchen' then prev.result-'rows'-'total' else prev.result end;
  end if;
  insert into umma_private.owner_operations(id,location_id,actor,kind,payload) values(p_key,p_location,p_actor,action_kind,p_payload);
  if action_kind='mode' then
    if coalesce(p_payload->>'mode','') not in ('A','B','C') then raise exception 'Выберите режим учёта'; end if;
    insert into umma_private.owner_modes values(p_location,p_payload->>'mode') on conflict(location_id) do update set mode=excluded.mode;
  else
    if coalesce(jsonb_typeof(lines),'')<>'array' or jsonb_array_length(lines) not between 1 and 350 then
      raise exception 'Заполните позиции документа';
    end if;
    if action_kind<>'purchase' and (select count(distinct (value->>'itemId',coalesce(value->>'area',p_payload->>'area','main')))
      from jsonb_array_elements(lines))<>jsonb_array_length(lines) then raise exception 'Позиция повторяется'; end if;
    if action_kind='count' and full_count and exists(
      select 1 from umma_private.owner_catalog() s where
        not exists(select 1 from jsonb_array_elements(lines) l where l.value->>'itemId'=s.id::text and coalesce(l.value->>'area','main')='main')
        or (s.item_type<>'finished_good' and not exists(select 1 from jsonb_array_elements(lines) l
          where l.value->>'itemId'=s.id::text and l.value->>'area'='kitchen'))
    ) then raise exception 'Для полного пересчёта заполните все позиции, включая нулевые'; end if;
    if action_kind='purchase' then
      invoice_date:=(p_payload->>'date')::date;
      if invoice_date is null or invoice_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date
        or length(coalesce(supplier_name,''))>150 or length(coalesce(invoice_number,''))>100 then
        raise exception 'Проверьте дату, поставщика и номер накладной';
      end if;
      if part is not null then
        if part !~ '^[1-9][0-9]{0,2}$' or invoice_number is null or supplier_name is null then raise exception 'Укажите номер части, поставщика и накладную'; end if;
        invoice_number:=invoice_number||' / часть '||part;
      end if;
      if source='invoice' and (supplier_name is null or coalesce(v_hash,'') !~ '^[a-f0-9]{64}$' or not exists(
        select 1 from storage.objects where bucket_id='cafe-owner-invoices' and name=p_location::text||'/'||v_hash
      )) then raise exception 'Нужны поставщик и оригинал накладной'; end if;
      if exists(select 1 from jsonb_each_text(p_payload) a where a.key in ('discount','delivery','tax','total')
          and a.value !~ '^[0-9]{1,12}$') then raise exception 'Проверьте итоговые суммы'; end if;
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ingredient-purchase:'||p_location,0));
      if supplier_name is not null then
        perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('owner-supplier:'||lower(supplier_name),0));
        select s.id into supplier_id from public.suppliers s where lower(trim(s.name))=lower(supplier_name) order by s.id limit 1;
        if supplier_id is null then insert into public.suppliers(name) values(supplier_name) returning id into supplier_id; end if;
      end if;
      if invoice_number is not null and supplier_id is not null and exists(
        select 1 from public.purchase_documents d where d.location_id=p_location and d.supplier_id=operation.supplier_id
          and d.purchase_date=invoice_date and lower(trim(d.document_number))=lower(invoice_number) and d.status<>'cancelled'
      ) then raise exception 'Накладная с таким поставщиком, датой и номером уже зарегистрирована'; end if;
      for line in select value from jsonb_array_elements(lines) loop
        select * into item from umma_private.owner_catalog() where id=(line->>'itemId')::uuid
          and linked_product_id is null and item_type in ('raw_material','packaging','other');
        if not found then raise exception 'Выберите сырьё или упаковку для закупки'; end if;
        qty:=umma_private.owner_quantity(line->>'quantity',line->>'unit',item.base_unit,false);
        if coalesce(line->>'unitCost','') !~ '^[0-9]{1,10}(\.[0-9]{1,4})?$' then raise exception 'Укажите цену за исходную единицу'; end if;
        raw_cost:=(line->>'unitCost')::numeric;
        line_total:=round((line->>'quantity')::numeric*raw_cost);
        if line->>'lineTotal' is not null and (line->>'lineTotal')::numeric<>line_total then raise exception 'Сумма строки не совпадает с количеством и ценой'; end if;
        base_total:=base_total+line_total;
        normalized:=normalized||jsonb_build_array(jsonb_build_object('itemId',item.id,'quantity',qty,'subtotal',line_total));
      end loop;
      extra_amount:=coalesce((p_payload->>'delivery')::numeric,0)+coalesce((p_payload->>'tax')::numeric,0)-coalesce((p_payload->>'discount')::numeric,0);
      total:=base_total+extra_amount;
      if total<0 or (base_total=0 and extra_amount<>0) or
        (p_payload->>'total' is not null and (p_payload->>'total')::numeric<>total) then raise exception 'Проверьте скидку, доставку, налог и итог'; end if;
      if source='invoice' then
        select md5(jsonb_build_array(lower(supplier_name),invoice_date,lower(invoice_number),total,
          jsonb_agg(value order by value->>'itemId',value->>'quantity',value->>'subtotal'))::text)
          into fingerprint from jsonb_array_elements(normalized);
        if exists(select 1 from umma_private.owner_invoices i where i.location_id=p_location and
          (i.file_hash=v_hash or i.fingerprint=operation.fingerprint)) then raise exception 'Такая накладная уже проведена'; end if;
      end if;
      insert into public.purchase_documents(location_id,supplier_id,document_number,purchase_date,created_by_telegram_id,notes)
        values(p_location,supplier_id,invoice_number,invoice_date,p_actor,nullif(reason,'')) returning id into purchase_id;
      for line in select value from jsonb_array_elements(normalized) order by value->>'itemId' loop
        qty:=(line->>'quantity')::numeric;
        previous_total:=previous_total+(line->>'subtotal')::numeric;
        amount:=case when base_total=0 then 0 else round(total*previous_total/base_total) end;
        cost:=round((amount-distributed)/qty,4);
        if round(cost*qty)<>amount-distributed then raise exception 'Недостаточно точности для распределения расходов'; end if;
        insert into public.purchase_items(purchase_document_id,stock_item_id,quantity,unit_cost_vnd,line_total_vnd)
          values(purchase_id,(line->>'itemId')::uuid,qty,cost,amount-distributed);
        distributed:=amount;
      end loop;
      perform public.post_purchase_document(purchase_id,p_actor);
      entries:=normalized;
      if source='invoice' then insert into umma_private.owner_invoices values(p_location,v_hash,fingerprint,purchase_id); end if;
    elsif action_kind in ('recipe','production') then
      if jsonb_array_length(lines)<>1 then raise exception 'Укажите одно блюдо или полуфабрикат'; end if;
      line:=lines->0;
      select * into item from umma_private.owner_catalog() where id=(line->>'itemId')::uuid and item_type in ('finished_good','semi_finished');
      if not found then raise exception 'Выберите блюдо или полуфабрикат'; end if;
      out_id:=item.id;
      v_product:=item.linked_product_id;
      output_qty:=umma_private.owner_quantity(line->>'quantity',line->>'unit',item.base_unit,false);
      if jsonb_typeof(inputs)<>'array' or jsonb_array_length(inputs)>80 then raise exception 'Проверьте ингредиенты'; end if;
      select m.mode into mode from umma_private.owner_modes m where m.location_id=p_location;
      if action_kind='production' and mode='C' and jsonb_array_length(inputs)=0 then
        select r.recipe_id into v_recipe from umma_private.owner_recipes r where location_id=p_location and r.output_id=out_id
          order by approved_at desc limit 1;
        if found then
          select coalesce(jsonb_agg(jsonb_build_object('itemId',ri.stock_item_id,'unit',s.base_unit,
              'quantity',round(ri.quantity*output_qty/r.yield_quantity,3))),'[]') into inputs
            from public.recipe_items ri join public.recipes r on r.id=ri.recipe_id
            join public.stock_items s on s.id=ri.stock_item_id where r.id=v_recipe;
          used_recipe:=true;
        end if;
      end if;
      if (select count(distinct value->>'itemId') from jsonb_array_elements(inputs))<>jsonb_array_length(inputs) then
        raise exception 'Ингредиент повторяется';
      end if;
      if action_kind='recipe' then
        if v_product is null or jsonb_array_length(inputs)=0 then raise exception 'Укажите блюдо меню и состав'; end if;
        perform 1 from public.products where id=v_product for update;
        insert into public.recipes(product_id,version,yield_quantity,yield_unit,is_active,notes,created_by_telegram_id)
          select v_product,coalesce(max(version),0)+1,output_qty,item.base_unit,true,'Утверждено владельцем в AI Управляющем',p_actor
          from public.recipes where product_id=v_product returning id into v_recipe;
      end if;
      known:=jsonb_array_length(inputs)>0;
      for line in select value from jsonb_array_elements(inputs) order by value->>'itemId' loop
        select * into item from umma_private.owner_catalog() where id=(line->>'itemId')::uuid
          and linked_product_id is null and item_type<>'finished_good' and id<>out_id;
        if not found then raise exception 'Проверьте ингредиент'; end if;
        qty:=umma_private.owner_quantity(line->>'quantity',line->>'unit',item.base_unit,false);
        if action_kind='recipe' then
          insert into public.recipe_items(recipe_id,stock_item_id,quantity) values(v_recipe,item.id,qty);
        else
          change_row:=umma_private.owner_change(p_location,item,'kitchen',-qty,null,null,'production_out',p_key,p_actor,'Расход партии');
          cost:=(change_row->>'cost')::numeric;
          known:=known and cost is not null;
          input_cost:=input_cost+qty*coalesce(cost,0);
        end if;
        entries:=entries||jsonb_build_array(jsonb_build_object('itemId',item.id,'quantity',qty,'cost',cost,'category',item.item_type));
      end loop;
      if action_kind='recipe' then
        insert into umma_private.owner_recipes values(v_recipe,p_location,out_id,p_actor,clock_timestamp());
      else
        total:=case when known then round(input_cost,2) end;
        select * into item from umma_private.owner_catalog() where id=out_id;
        perform umma_private.owner_change(p_location,item,case when item.item_type='semi_finished' then 'kitchen' else 'main' end,
          output_qty,null,round(total/output_qty,4),'production_in',p_key,p_actor,'Выпуск партии');
      end if;
    else
      known:=true;
      for line in select value from jsonb_array_elements(lines) order by value->>'itemId',value->>'area' loop
        area:=coalesce(line->>'area',p_payload->>'area','main');
        select * into item from umma_private.owner_catalog() where id=(line->>'itemId')::uuid;
        if not found or (action_kind='transfer' and item.item_type='finished_good') then raise exception 'Проверьте позицию'; end if;
        qty:=umma_private.owner_quantity(line->>'quantity',line->>'unit',item.base_unit,action_kind='count');
        if action_kind='count' then
          before_qty:=(line->>'expected')::numeric;
          change_row:=umma_private.owner_change(p_location,item,area,qty-before_qty,before_qty,null,'count',p_key,p_actor,'Инвентаризация');
        elsif action_kind='transfer' then
          change_row:=umma_private.owner_change(p_location,item,area,-qty,null,null,'transfer_out',p_key,p_actor,'Перемещение');
          perform umma_private.owner_change(p_location,item,case when area='main' then 'kitchen' else 'main' end,
            qty,null,(change_row->>'cost')::numeric,'transfer_in',p_key,p_actor,'Перемещение');
        else
          if reason='' then raise exception 'Укажите причину списания или возврата'; end if;
          change_row:=umma_private.owner_change(p_location,item,area,case when action_kind='return' then qty else -qty end,
            null,null,case when action_kind='return' then 'adjustment_in' else 'waste_out' end,p_key,p_actor,reason);
          cost:=(change_row->>'cost')::numeric;
          known:=known and cost is not null;
          input_cost:=input_cost+qty*coalesce(cost,0);
        end if;
        entries:=entries||jsonb_build_array(change_row);
      end loop;
      total:=case when action_kind='waste' and known then round(input_cost,2) end;
    end if;
  end if;
  update umma_private.owner_operations set result=jsonb_build_object('id',p_key,'kind',action_kind,'rows',entries,'total',total,
    'purchaseId',purchase_id,'outputId',out_id,'yield',output_qty,'usedRecipe',used_recipe,'recipeId',v_recipe,'full',full_count,
    'postedAt',clock_timestamp()) where id=p_key returning result into prev.result;
  return case when v_role='kitchen' then prev.result-'rows'-'total' else prev.result end;
end $$;

create function public.cafe_owner_dashboard(p_actor bigint,p_location uuid,p_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_role text:=umma_private.owner_permission(p_actor,p_location); start_at timestamptz;
  stock jsonb; history jsonb; valuation jsonb; flows jsonb; norms jsonb; sales jsonb;
begin
  if v_role is null then raise exception 'Нет доступа к этому кафе' using errcode='42501'; end if;
  if p_days is null or p_days not between 1 and 90 then raise exception 'Выберите период от 1 до 90 дней'; end if;
  start_at:=((now() at time zone 'Asia/Ho_Chi_Minh')::date-(p_days-1))::timestamp at time zone 'Asia/Ho_Chi_Minh';
  with quantities as (
    select s.id,s.name_ru,s.name_vi,s.name_en,s.base_unit,s.item_type,s.linked_product_id,
      case when s.linked_product_id is not null then case when i.ready_stock_confirmed then i.quantity else coalesce(i.reserved_quantity,0) end
        else coalesce(b.quantity_on_hand,0) end quantity, coalesce(k.quantity,0) kitchen,
      case when s.linked_product_id is null then nullif(b.average_unit_cost_vnd,0) end unit_cost,k.unit_cost kitchen_cost
    from umma_private.owner_catalog() s
    left join public.stock_balances b on b.location_id=p_location and b.stock_item_id=s.id
    left join public.inventory i on i.location_id=p_location and i.product_id=s.linked_product_id
    left join umma_private.owner_kitchen k on k.location_id=p_location and k.item_id=s.id
  )
  select coalesce(jsonb_agg(to_jsonb(q)-case when v_role='kitchen' then array['unit_cost','kitchen_cost'] else array[]::text[] end order by name_ru,id),'[]'),
    jsonb_build_object('knownValue',round(coalesce(sum(quantity*unit_cost),0)+coalesce(sum(kitchen*kitchen_cost),0)),
      'unpriced',count(*) filter(where quantity>0 and unit_cost is null or kitchen>0 and kitchen_cost is null))
    into stock,valuation from quantities q;
  if v_role<>'kitchen' then
    select coalesce(jsonb_agg(jsonb_build_object('result',o.result,'at',o.created_at,'actor',o.actor,'source',o.payload->>'source',
      'note',o.payload->>'note','supplier',o.payload->>'supplier','hash',o.payload->>'hash') order by o.created_at desc),'[]')
      into history from (select * from umma_private.owner_operations where location_id=p_location order by created_at desc limit 50) o;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into flows from (
      select m.stock_item_id item_id,sum(-m.quantity_delta) filter(where m.movement_type='production_out') used,
        sum(-m.quantity_delta) filter(where m.movement_type='waste_out') wasted,
        sum(-m.quantity_delta*m.unit_cost_vnd) filter(where m.movement_type='waste_out' and m.unit_cost_vnd>0) known_loss,
        min(m.unit_cost_vnd) filter(where m.movement_type='purchase_in') min_purchase,
        max(m.unit_cost_vnd) filter(where m.movement_type='purchase_in') max_purchase
      from public.stock_movements m where m.location_id=p_location and m.created_at>=start_at
        and m.movement_type in ('production_out','waste_out','purchase_in') group by m.stock_item_id
    ) x;
    with measured as (
      select o.result->>'outputId' dish,r.value->>'itemId' ingredient,(r.value->>'quantity')::numeric/(o.result->>'yield')::numeric per_unit
      from umma_private.owner_operations o cross join lateral jsonb_array_elements(o.result->'rows') r
      where o.location_id=p_location and o.kind='production' and o.created_at>now()-interval '90 days'
        and not (o.result->>'usedRecipe')::boolean
        and o.created_at>coalesce((select max(a.approved_at) from umma_private.owner_recipes a
          where a.location_id=p_location and a.output_id::text=o.result->>'outputId'),'-infinity')
    ), estimates as (
      select dish,ingredient,count(*) n,min(per_unit) lo,max(per_unit) hi,
        (percentile_cont(0.5) within group(order by per_unit))::numeric median from measured group by dish,ingredient
    )
    select coalesce(jsonb_agg(jsonb_build_object('outputId',dish,'itemId',ingredient,'observations',n,'low',round(lo,4),'high',round(hi,4),
      'quantity',case when n>=2 then round(median,4) end,'confidence',case when n>=2 then 'preliminary' else 'insufficient' end)),'[]')
      into norms from estimates;
    select jsonb_build_object('portions',coalesce(sum(oi.quantity),0),'grossLineRevenue',coalesce(sum(oi.line_total_vnd),0))
      into sales from public.cafe_orders o join public.cafe_order_items oi on oi.order_id=o.id
      where o.location_id=p_location and o.source_module='cafe' and o.status='completed' and o.payment_status='paid'
          and coalesce(o.completed_at,o.updated_at)>=start_at;
  end if;
  return jsonb_build_object('role',v_role,'stock',stock,'history',history,'flows',flows,'norms',norms,'sales',sales,'days',p_days,
    'valuation',case when v_role<>'kitchen' then valuation end,
    'mode',coalesce((select mode from umma_private.owner_modes where location_id=p_location),'A'),
    'initialCount',(select min(created_at) from umma_private.owner_operations where location_id=p_location and kind='count' and (result->>'full')::boolean),
    'recipes',case when v_role<>'kitchen' then (select coalesce(jsonb_agg(to_jsonb(r)),'[]') from umma_private.owner_recipes r where location_id=p_location) end);
end $$;

create function public.cafe_owner_invoice_access(p_actor bigint,p_location uuid,p_hash text,p_write boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare allowed boolean;
begin
  if coalesce(umma_private.owner_permission(p_actor,p_location),'') not in ('owner','manager') then
    raise exception 'Нет доступа к накладным' using errcode='42501';
  end if;
  if coalesce(p_hash,'') !~ '^[a-f0-9]{64}$' then raise exception 'Проверьте файл'; end if;
  select exists(select 1 from umma_private.owner_invoices where location_id=p_location and file_hash=p_hash) into allowed;
  if p_write and allowed then raise exception 'Такая накладная уже проведена';
  elsif not p_write and not allowed then raise exception 'Оригинал не найден'; end if;
  return jsonb_build_object('path',p_location::text||'/'||p_hash);
end $$;

revoke all on function umma_private.owner_permission(bigint,uuid),umma_private.owner_catalog(),
  umma_private.owner_quantity(text,text,text,boolean),
  umma_private.owner_change(uuid,public.stock_items,text,numeric,numeric,numeric,text,uuid,bigint,text)
  from public,anon,authenticated;
revoke all on function public.cafe_owner_post(bigint,uuid,uuid,jsonb),
  public.cafe_owner_dashboard(bigint,uuid,integer),public.cafe_owner_invoice_access(bigint,uuid,text,boolean)
  from public,anon,authenticated;
grant execute on function public.cafe_owner_post(bigint,uuid,uuid,jsonb),
  public.cafe_owner_dashboard(bigint,uuid,integer),public.cafe_owner_invoice_access(bigint,uuid,text,boolean)
  to service_role;
