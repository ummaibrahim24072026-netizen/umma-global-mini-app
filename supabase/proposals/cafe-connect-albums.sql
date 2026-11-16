BEGIN;

UPDATE storage.buckets
SET allowed_mime_types=array_append(allowed_mime_types,'application/octet-stream')
WHERE id='cafe-connect-media'
 AND NOT ('application/octet-stream'=ANY(allowed_mime_types));

ALTER TABLE umma_private.cafe_connect_messages
 DROP CONSTRAINT cafe_connect_messages_content_check,
 ADD CONSTRAINT cafe_connect_messages_content_check CHECK (
  length(body)<=2000 AND (
   (media_kind IS NULL AND object_path IS NULL AND length(body)>=1)
   OR (media_kind IS NOT NULL AND object_path IS NOT NULL
    AND ((direction='customer' AND media_kind IN ('photo','video','voice','album'))
         OR (direction='staff' AND media_kind IN ('video','voice'))))
  )
 );

DO $migration$
DECLARE
 definition text := pg_get_functiondef('public.cafe_connect(text,text,bigint,jsonb)'::regprocedure);
 allowed text := $fragment$coalesce(p_data->>'kind','') NOT IN ('photo','video','voice')$fragment$;
 preview text := $fragment$WHEN media_kind='video' THEN 'Видео' ELSE 'Голосовое сообщение' END$fragment$;
BEGIN
 IF strpos(definition,$fragment$coalesce(p_data->>'kind','') NOT IN ('photo','video','voice','album')$fragment$)>0 THEN RETURN; END IF;
 IF strpos(definition,allowed)=0 OR strpos(definition,preview)=0 THEN
  RAISE EXCEPTION 'Unexpected cafe_connect attachment definition';
 END IF;
 definition:=replace(definition,allowed,$fragment$coalesce(p_data->>'kind','') NOT IN ('photo','video','voice','album')$fragment$);
 definition:=replace(definition,preview,$fragment$WHEN media_kind='video' THEN 'Видео' WHEN media_kind='album' THEN 'Фото и видео' ELSE 'Голосовое сообщение' END$fragment$);
 EXECUTE definition;
END $migration$;

COMMIT;
