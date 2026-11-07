BEGIN;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('cafe-connect-media','cafe-connect-media',false,20971520,
 ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime','audio/webm','audio/mp4','audio/ogg']);
CREATE POLICY cafe_connect_media_private ON storage.objects AS RESTRICTIVE
 FOR ALL TO anon,authenticated USING(bucket_id<>'cafe-connect-media') WITH CHECK(bucket_id<>'cafe-connect-media');

ALTER TABLE umma_private.cafe_connect_messages
 ADD COLUMN media_kind text,
 ADD COLUMN object_path text,
 DROP CONSTRAINT cafe_connect_messages_body_check,
 ADD CONSTRAINT cafe_connect_messages_content_check CHECK (
  length(body)<=2000 AND (
   (media_kind IS NULL AND object_path IS NULL AND length(body)>=1)
   OR (media_kind IS NOT NULL AND media_kind IN ('photo','video','voice')
       AND object_path IS NOT NULL AND direction='customer')
  )
 );

-- Patch the current function in place, preserving its grants and existing actions.
DO $migration$
DECLARE
 definition text := pg_get_functiondef('public.cafe_connect(text,text,bigint,jsonb)'::regprocedure);
 anchor text := ' IF p_action=''preferences'' THEN';
 columns text := 'SELECT id,direction,title,body,created_at,read_at FROM umma_private.cafe_connect_messages';
 send_insert text := 'INSERT INTO umma_private.cafe_connect_messages(client_id,request_key,direction,title,body) VALUES(c.id,k,CASE WHEN p_action=''send'' THEN ''customer'' ELSE ''staff'' END,CASE WHEN p_action=''send'' THEN '''' ELSE ''UMMA'' END,p_data->>''body'') RETURNING id INTO target;';
 inbox text := 'SELECT body FROM umma_private.cafe_connect_messages m WHERE m.client_id=cl.id';
BEGIN
 IF strpos(definition,anchor)=0 OR strpos(definition,columns)=0
 OR strpos(definition,send_insert)=0 OR strpos(definition,inbox)=0 THEN
  RAISE EXCEPTION 'Unexpected cafe_connect definition';
 END IF;
 definition := replace(definition,anchor,$media$
 IF p_action IN ('mediaPrepare','mediaSend') THEN
  k:=(p_data->>'requestKey')::uuid;
  SELECT jsonb_build_object('ok',true,'id',id,'path',object_path) INTO result
  FROM umma_private.cafe_connect_messages WHERE client_id=c.id AND request_key=k;
  IF FOUND THEN RETURN result; END IF;
  IF (SELECT count(*) FROM umma_private.cafe_connect_messages WHERE client_id=c.id AND direction='customer' AND created_at>now()-interval '1 minute')>=5
   OR (SELECT count(*) FROM umma_private.cafe_connect_messages WHERE client_id=c.id AND media_kind IS NOT NULL AND created_at>now()-interval '1 day')>=30
  THEN RAISE EXCEPTION 'Please wait before sending again'; END IF;
  IF p_action='mediaPrepare' THEN RETURN jsonb_build_object('ok',true,'clientId',c.id); END IF;
  IF coalesce(p_data->>'path','') !~ ('^'||c.id::text||'/[a-f0-9-]{36}$')
   OR coalesce(p_data->>'kind','') NOT IN ('photo','video','voice')
  THEN RAISE EXCEPTION 'Invalid attachment'; END IF;
  INSERT INTO umma_private.cafe_connect_messages(client_id,request_key,direction,body,media_kind,object_path)
  VALUES(c.id,k,'customer',p_data->>'body',p_data->>'kind',p_data->>'path') RETURNING id INTO target;
  UPDATE umma_private.cafe_connect_clients SET updated_at=now() WHERE id=c.id;
  RETURN jsonb_build_object('ok',true,'id',target,'path',p_data->>'path');
 END IF;
 IF p_action IN ('mediaGet','staffMediaGet') THEN
  SELECT jsonb_build_object('ok',true,'path',object_path) INTO result
  FROM umma_private.cafe_connect_messages
  WHERE client_id=c.id AND id=(p_data->>'messageId')::uuid AND object_path IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN result;
 END IF;
$media$ || anchor);
 definition := replace(definition,columns,
  'SELECT id,direction,title,body,created_at,read_at,media_kind FROM umma_private.cafe_connect_messages');
 definition := replace(definition,inbox,$preview$
 SELECT CASE WHEN body<>'' THEN body WHEN media_kind='photo' THEN 'Фото'
 WHEN media_kind='video' THEN 'Видео' ELSE 'Голосовое сообщение' END
 FROM umma_private.cafe_connect_messages m WHERE m.client_id=cl.id$preview$);
 EXECUTE definition;
END $migration$;

COMMIT;
