begin;
create function public.islam_editor_operation(p_actor bigint,p_action text,p_kind text,p_document jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare is_admin boolean;editor public.islam_content_editors;target uuid;rowdata jsonb;kind_table text;
 revision integer;state text;author bigint;step jsonb;evidence jsonb;step_id uuid;trans jsonb;review_checks jsonb;decision text;
begin
 select role='super_admin' into is_admin from public.telegram_users where telegram_id=p_actor and is_active=true;
 select * into editor from public.islam_content_editors where telegram_id=p_actor and is_active=true;
 if p_kind not in ('lesson','hadith') or p_action not in ('editor_save','editor_submit','editor_review','editor_publish') then raise exception 'Unknown editorial action';end if;
 if p_action='editor_review' then
  if editor.can_review is distinct from true then raise exception 'Qualified reviewer assignment required';end if;
 elsif p_action='editor_publish' then
  if is_admin is distinct from true then raise exception 'Publisher access required';end if;
 elsif is_admin is distinct from true and editor.can_edit is distinct from true then raise exception 'Editor access required';end if;
 target:=coalesce(nullif(p_document->>'id','')::uuid,gen_random_uuid());kind_table:=case when p_kind='lesson' then 'prayer_lessons' else 'hadith_records' end;
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 execute format('select to_jsonb(t) from public.%I t where id=$1 for update',kind_table) into rowdata using target;
 if rowdata is not null then
  state:=rowdata->>'status';revision:=(rowdata->>'content_revision')::integer;author:=(rowdata->>'editor_telegram_id')::bigint;
  if coalesce((p_document->>'expected_revision')::integer,-1)<>revision then raise exception 'Revision changed; reload before editing';end if;
 end if;
 if p_action='editor_save' then
  if rowdata is not null and state<>'draft' then raise exception 'Only drafts may be edited';end if;
  if p_kind='hadith' then
   insert into public.hadith_records(id,collection_id,number,book,edition,arabic,narrator,grade,source_url,license_note,commentary,categories,editor_telegram_id,content_revision)
   values(target,p_document->>'collection_id',p_document->>'number',p_document->>'book',p_document->>'edition',p_document->>'arabic',p_document->>'narrator',p_document->>'grade',p_document->>'source_url',p_document->>'license_note',coalesce(p_document->>'commentary',''),array(select jsonb_array_elements_text(coalesce(p_document->'categories','[]'))),p_actor,coalesce(revision,0)+1)
   on conflict(id) do update set collection_id=excluded.collection_id,number=excluded.number,book=excluded.book,edition=excluded.edition,arabic=excluded.arabic,narrator=excluded.narrator,grade=excluded.grade,source_url=excluded.source_url,license_note=excluded.license_note,commentary=excluded.commentary,categories=excluded.categories,editor_telegram_id=p_actor,content_revision=excluded.content_revision;
   delete from public.hadith_translations where hadith_id=target;
   delete from public.hadith_verifications where hadith_id=target;
   for trans in select * from jsonb_array_elements(coalesce(p_document->'translations','[]')) loop
    insert into public.hadith_translations(hadith_id,language,text,translator,source_url,license_note) values(target,trans->>'language',trans->>'text',trans->>'translator',trans->>'source_url',trans->>'license_note');
   end loop;
   for trans in select * from jsonb_array_elements(coalesce(p_document->'verifications','[]')) loop
    insert into public.hadith_verifications(hadith_id,scholar,grade,source_url,note) values(target,trans->>'scholar',trans->>'grade',trans->>'source_url',coalesce(trans->>'note',''));
   end loop;
  else
   insert into public.prayer_lessons(id,slug,category,title,language,introduction,source_url,license_note,editor_telegram_id,content_revision)
   values(target,p_document->>'slug',p_document->>'category',p_document->>'title',coalesce(p_document->>'language','ru'),coalesce(p_document->>'introduction',''),p_document->>'source_url',p_document->>'license_note',p_actor,coalesce(revision,0)+1)
   on conflict(id) do update set slug=excluded.slug,category=excluded.category,title=excluded.title,language=excluded.language,introduction=excluded.introduction,source_url=excluded.source_url,license_note=excluded.license_note,editor_telegram_id=p_actor,content_revision=excluded.content_revision;
   delete from public.lesson_evidences where lesson_id=target;
   delete from public.fiqh_opinions where topic_id in(select id from public.fiqh_topics where lesson_id=target);
   delete from public.fiqh_topics where lesson_id=target;
   delete from public.prayer_lesson_steps where lesson_id=target;
   for step in select * from jsonb_array_elements(coalesce(p_document->'steps','[]')) loop
    step_id:=gen_random_uuid();
    insert into public.prayer_lesson_steps(id,lesson_id,position,variant,title,arabic,transliteration,translation,movement,explanation)
    values(step_id,target,(step->>'position')::integer,coalesce(step->>'variant','main'),step->>'title',coalesce(step->>'arabic',''),coalesce(step->>'transliteration',''),coalesce(step->>'translation',''),coalesce(step->>'movement',''),step->>'explanation');
    for evidence in select * from jsonb_array_elements(coalesce(step->'evidences','[]')) loop
     insert into public.lesson_evidences(lesson_id,step_id,hadith_id,quran_surah,quran_ayah,citation,source_url)
     values(target,step_id,nullif(evidence->>'hadith_id','')::uuid,nullif(evidence->>'quran_surah','')::integer,nullif(evidence->>'quran_ayah','')::integer,evidence->>'citation',evidence->>'source_url');
    end loop;
   end loop;
  end if;
 elsif rowdata is null then raise exception 'Content not found';
 elsif p_action='editor_submit' then
  if state<>'draft' then raise exception 'Only drafts can be submitted';end if;
  execute format('update public.%I set status=''review'' where id=$1',kind_table) using target;
 elsif p_action='editor_review' then
  if state<>'review' then raise exception 'Content must be in review';end if;
  if author=p_actor then raise exception 'Independent review required';end if;
  decision:=p_document->>'decision';if decision not in ('approved','rejected') then raise exception 'Invalid decision';end if;
  review_checks:=coalesce(p_document->'checks','{}');
  insert into public.religious_content_reviews(content_kind,content_id,content_hash,reviewer,reviewer_qualification,checks,decision,notes,reviewer_telegram_id)
  values(p_kind,target,public.islam_content_hash(rowdata),editor.name,editor.qualification||E'\n'||editor.identity_source_url,review_checks,decision,coalesce(p_document->>'notes',''),p_actor);
  execute format('update public.%I set status=$2 where id=$1',kind_table) using target,case when decision='approved' then 'approved' else 'draft' end;
 elsif p_action='editor_publish' then
  if state<>'approved' then raise exception 'Approval required before publication';end if;
  execute format('update public.%I set status=''published'' where id=$1',kind_table) using target;
 end if;
 execute format('select to_jsonb(t) from public.%I t where id=$1',kind_table) into rowdata using target;
 return rowdata;
end $$;
revoke all on function public.islam_editor_operation(bigint,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.islam_editor_operation(bigint,text,text,jsonb) to service_role;
commit;
-- The author Telegram ID is internal, not part of published religious source data.
revoke select on public.hadith_records,public.prayer_lessons from anon,authenticated;
grant select(id,collection_id,number,book,edition,arabic,narrator,grade,source_url,license_note,commentary,categories,content_revision,status,created_at) on public.hadith_records to anon,authenticated;
grant select(id,slug,category,title,language,introduction,source_url,license_note,content_revision,status,created_at) on public.prayer_lessons to anon,authenticated;
