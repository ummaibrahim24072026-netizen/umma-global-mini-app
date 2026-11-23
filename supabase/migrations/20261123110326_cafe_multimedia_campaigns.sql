BEGIN;

ALTER TABLE umma_private.cafe_connect_campaigns
 ADD COLUMN media_path text,
 ADD COLUMN push_recipients integer NOT NULL DEFAULT 0;

ALTER TABLE umma_private.cafe_connect_messages
 DROP CONSTRAINT cafe_connect_messages_content_check,
 ADD CONSTRAINT cafe_connect_messages_content_check CHECK (
  length(body)<=2000 AND (
   (media_kind IS NULL AND object_path IS NULL AND length(body)>=1)
   OR (media_kind IS NOT NULL AND object_path IS NOT NULL
    AND (media_kind IN ('photo','video','voice') OR (media_kind='album' AND direction<>'campaign')))
  )
 );

CREATE FUNCTION umma_private.cafe_campaign_targets(p_language text, p_installed boolean)
RETURNS TABLE (id uuid, has_push boolean)
LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp AS $$
 SELECT c.id, c.subscription IS NOT NULL
 FROM umma_private.cafe_connect_clients c
 WHERE c.promotions AND (p_language='all' OR c.language=p_language)
  AND (NOT p_installed OR EXISTS (
   SELECT 1 FROM umma_private.cafe_menu_visitors v
   WHERE v.token_hash=c.token_hash AND v.installed_at IS NOT NULL
  ));
$$;

REVOKE ALL ON FUNCTION umma_private.cafe_campaign_targets(text,boolean)
 FROM PUBLIC,anon,authenticated;

-- Extend the existing owner-only campaign branch without replacing chat or call behavior.
DO $migration$
DECLARE
 definition text:=pg_get_functiondef('public.cafe_connect(text,text,bigint,jsonb)'::regprocedure);
 start_at integer:=strpos(definition, '  IF p_action=''staffCampaign'' THEN');
 end_at integer:=strpos(definition, '  target:=(p_data->>''clientId'')::uuid;');
BEGIN
 IF start_at=0 OR end_at<=start_at THEN RAISE EXCEPTION 'Unexpected cafe_connect campaign definition'; END IF;
 definition:=overlay(definition placing $campaign$
  IF p_action IN ('staffCampaign','staffCampaignPrepare','staffCampaignAudience') THEN
   DECLARE
    campaign_language text:=coalesce(p_data->>'language','all');
    installed_only boolean:=coalesce((p_data->>'installedOnly')::boolean,false);
    media_path text:=p_data->>'path';
    media_kind text:=p_data->>'kind';
    public_news boolean:=coalesce((p_data->>'publicNews')::boolean,false)
     AND campaign_language='all' AND NOT installed_only AND media_path IS NULL;
    push_count integer;
   BEGIN
    IF campaign_language !~ '^(all|[a-z]{2})$' THEN RAISE EXCEPTION 'Invalid language'; END IF;
    IF p_action='staffCampaignAudience' THEN
     SELECT count(*), count(*) FILTER (WHERE has_push) INTO n,push_count
     FROM umma_private.cafe_campaign_targets(campaign_language,installed_only);
     RETURN jsonb_build_object('ok',true,'recipients',n,'pushRecipients',push_count);
    END IF;

    k:=(p_data->>'requestKey')::uuid;
    IF p_action='staffCampaign' THEN
     PERFORM pg_advisory_xact_lock(hashtextextended('cafe_connect_campaign',0));
    END IF;
    SELECT * INTO old FROM umma_private.cafe_connect_campaigns WHERE request_key=k;
    IF FOUND THEN
     RETURN jsonb_build_object('ok',true,'recipients',old.recipients,
      'pushRecipients',old.push_recipients,'path',old.media_path);
    END IF;
    IF EXISTS(SELECT 1 FROM umma_private.cafe_connect_campaigns WHERE created_at>now()-interval '30 seconds')
     THEN RAISE EXCEPTION 'Please wait before sending again'; END IF;
    IF p_action='staffCampaignPrepare' THEN RETURN '{"ok":true}'; END IF;
    IF k IS NULL OR char_length(btrim(coalesce(p_data->>'title',''))) NOT BETWEEN 1 AND 100
     OR char_length(coalesce(p_data->>'body',''))>2000 THEN RAISE EXCEPTION 'Invalid campaign'; END IF;
    IF media_path IS NULL THEN
     IF media_kind IS NOT NULL OR btrim(coalesce(p_data->>'body',''))=''
      THEN RAISE EXCEPTION 'Invalid campaign'; END IF;
    ELSIF media_path !~ ('^campaign/'||k::text||'/[0-9a-f-]{36}$')
     OR coalesce(media_kind,'') NOT IN ('photo','video','voice')
     THEN RAISE EXCEPTION 'Invalid attachment';
    END IF;

    INSERT INTO umma_private.cafe_connect_campaigns(request_key,title,body,language,public_news,media_path)
    VALUES(k,p_data->>'title',coalesce(p_data->>'body',''),campaign_language,public_news,media_path);

    WITH messages AS (
     INSERT INTO umma_private.cafe_connect_messages(client_id,request_key,direction,title,body,media_kind,object_path)
     SELECT t.id,k,'campaign',p_data->>'title',coalesce(p_data->>'body',''),media_kind,media_path
     FROM umma_private.cafe_campaign_targets(campaign_language,installed_only) t
     RETURNING id,client_id
    ), jobs AS (
     INSERT INTO umma_private.cafe_connect_jobs(message_id)
     SELECT m.id FROM messages m JOIN umma_private.cafe_connect_clients recipient ON recipient.id=m.client_id
     WHERE recipient.subscription IS NOT NULL
     RETURNING id
    )
    SELECT (SELECT count(*) FROM messages),(SELECT count(*) FROM jobs) INTO n,push_count;

    IF n=0 AND NOT public_news THEN RAISE EXCEPTION 'No campaign recipients'; END IF;
    UPDATE umma_private.cafe_connect_campaigns SET recipients=n,push_recipients=push_count WHERE request_key=k;
    IF push_count>0 THEN PERFORM public.cafe_connect_wake(); END IF;
    RETURN jsonb_build_object('ok',true,'recipients',n,'pushRecipients',push_count,'path',media_path);
   END;
  END IF;
$campaign$ from start_at for end_at-start_at);
 -- Give attachment-only pushes a useful localized body while keeping media in the private chat.
 definition:=replace(definition,
  $start$'title',m.title,'body',CASE$start$,
  $start$'title',m.title,'body',CASE WHEN m.direction='campaign' AND m.body<>'' THEN m.body$start$);
 EXECUTE replace(definition,'ELSE m.body END,',$fallback$ELSE CASE WHEN m.media_kind='photo' AND m.body='' THEN
  CASE cl.language WHEN 'ru' THEN 'Фото' WHEN 'vi' THEN 'Ảnh' ELSE 'Photo' END
  ELSE m.body END END,$fallback$);
END $migration$;

COMMIT;
