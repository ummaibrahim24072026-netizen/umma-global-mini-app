BEGIN;

ALTER TABLE umma_private.cafe_connect_messages
 DROP CONSTRAINT cafe_connect_messages_content_check,
 ADD CONSTRAINT cafe_connect_messages_content_check CHECK (
  length(body)<=2000 AND (
   (media_kind IS NULL AND object_path IS NULL AND length(body)>=1)
   OR (media_kind IS NOT NULL AND object_path IS NOT NULL
    AND ((direction='customer' AND media_kind IN ('photo','video','voice'))
         OR (direction='staff' AND media_kind IN ('video','voice'))))
  )
 );

CREATE TABLE umma_private.cafe_connect_voice_translations (
 message_id uuid REFERENCES umma_private.cafe_connect_messages(id) ON DELETE CASCADE,
 language text CHECK (language IN ('ar','de','en','fr','id','ja','ko','ms','pt','ru','tg','th','tk','tr','ug','uz','vi','zh')),
 lease uuid NOT NULL,
 attempted_at timestamptz NOT NULL DEFAULT now(),
 attempts int NOT NULL DEFAULT 1,
 translated_text text CHECK(length(translated_text) BETWEEN 1 AND 4000),
 audio_path text,
 PRIMARY KEY(message_id,language)
);
ALTER TABLE umma_private.cafe_connect_voice_translations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON umma_private.cafe_connect_voice_translations FROM PUBLIC,anon,authenticated;

UPDATE storage.buckets SET allowed_mime_types=array_append(allowed_mime_types,'audio/mpeg')
 WHERE id='cafe-connect-media' AND NOT ('audio/mpeg'=ANY(allowed_mime_types));

DO $migration$
DECLARE
 definition text := pg_get_functiondef('public.cafe_connect(text,text,bigint,jsonb)'::regprocedure);
 media_actions text := 'p_action IN (''mediaPrepare'',''mediaSend'')';
 media_insert text := 'INSERT INTO umma_private.cafe_connect_messages(client_id,request_key,direction,body,media_kind,object_path)
  VALUES(c.id,k,''customer'',p_data->>''body'',p_data->>''kind'',p_data->>''path'') RETURNING id INTO target;
  UPDATE umma_private.cafe_connect_clients SET updated_at=now() WHERE id=c.id;';
 translation_anchor text := ' IF p_action IN (''mediaGet'',''staffMediaGet'') THEN';
 push_body text := '''body'',m.body,''messageId''';
BEGIN
 IF strpos(definition,media_actions)=0 OR strpos(definition,media_insert)=0
 OR strpos(definition,translation_anchor)=0 OR strpos(definition,push_body)=0
 THEN RAISE EXCEPTION 'Unexpected cafe_connect definition'; END IF;
 definition := replace(definition,media_actions,
  'p_action IN (''mediaPrepare'',''mediaSend'',''staffMediaPrepare'',''staffMediaSend'')');
 definition := replace(definition,'IF p_action=''mediaPrepare'' THEN RETURN',
  'IF p_action IN (''mediaPrepare'',''staffMediaPrepare'') THEN RETURN');
 definition := replace(definition,
  'WHERE client_id=c.id AND direction=''customer'' AND created_at>now()-interval ''1 minute'')>=5
   OR (SELECT count(*) FROM umma_private.cafe_connect_messages WHERE client_id=c.id AND media_kind IS NOT NULL',
  'WHERE client_id=c.id AND direction=CASE WHEN p_action LIKE ''staff%'' THEN ''staff'' ELSE ''customer'' END AND created_at>now()-interval ''1 minute'')>=5
   OR (SELECT count(*) FROM umma_private.cafe_connect_messages WHERE client_id=c.id AND direction=CASE WHEN p_action LIKE ''staff%'' THEN ''staff'' ELSE ''customer'' END AND media_kind IS NOT NULL');
 definition := replace(definition,media_insert,$send$
  INSERT INTO umma_private.cafe_connect_messages(client_id,request_key,direction,title,body,media_kind,object_path)
  VALUES(c.id,k,CASE WHEN p_action='staffMediaSend' THEN 'staff' ELSE 'customer' END,
   CASE WHEN p_action='staffMediaSend' THEN 'UMMA' ELSE '' END,p_data->>'body',p_data->>'kind',p_data->>'path')
  RETURNING id INTO target;
  UPDATE umma_private.cafe_connect_clients SET updated_at=now() WHERE id=c.id;
  IF p_action='staffMediaSend' AND c.subscription IS NOT NULL THEN
   INSERT INTO umma_private.cafe_connect_jobs(message_id) VALUES(target);
   PERFORM public.cafe_connect_wake();
  END IF;
$send$);
 definition := replace(definition,push_body,$push$'body',CASE
  WHEN m.media_kind='voice' THEN CASE cl.language WHEN 'ru' THEN 'Голосовое сообщение' WHEN 'vi' THEN 'Tin nhắn thoại' ELSE 'Voice message' END
  WHEN m.media_kind='video' THEN CASE cl.language WHEN 'ru' THEN 'Видеосообщение' WHEN 'vi' THEN 'Tin nhắn video' ELSE 'Video message' END
  ELSE m.body END,'messageId'$push$);
 definition := replace(definition,translation_anchor,$voice$
 IF p_action IN ('voiceClaim','staffVoiceClaim','voiceComplete','staffVoiceComplete') THEN
  SELECT m.id,to_jsonb(m.object_path) INTO target,result
  FROM umma_private.cafe_connect_messages m
  WHERE m.client_id=c.id AND m.id=(p_data->>'messageId')::uuid AND m.media_kind='voice'
   AND m.direction=CASE WHEN p_action LIKE 'staff%' THEN 'customer' ELSE 'staff' END;
  IF NOT FOUND THEN RAISE EXCEPTION 'Access denied'; END IF;
  IF p_action IN ('voiceClaim','staffVoiceClaim') THEN
   INSERT INTO umma_private.cafe_connect_voice_translations AS t(message_id,language,lease)
   VALUES(target,p_data->>'language',gen_random_uuid())
   ON CONFLICT(message_id,language) DO UPDATE
   SET lease=excluded.lease, attempted_at=now(), attempts=t.attempts+1
   WHERE t.translated_text IS NULL AND t.attempts<2 AND t.attempted_at<now()-interval '2 minutes'
   RETURNING lease INTO k;
   IF FOUND THEN RETURN jsonb_build_object('ok',true,'status','claimed','lease',k,'path',result); END IF;
   SELECT jsonb_build_object('ok',true,
    'status',CASE WHEN t.translated_text IS NOT NULL THEN 'ready'
     WHEN t.attempts>=2 AND t.attempted_at<now()-interval '2 minutes' THEN 'failed' ELSE 'pending' END,
    'text',t.translated_text,'audioPath',t.audio_path)
   INTO result FROM umma_private.cafe_connect_voice_translations t
   WHERE t.message_id=target AND t.language=p_data->>'language';
   RETURN result;
  END IF;
  UPDATE umma_private.cafe_connect_voice_translations
  SET translated_text=p_data->>'text',audio_path=p_data->>'audioPath'
  WHERE message_id=target AND language=p_data->>'language' AND lease=(p_data->>'lease')::uuid AND translated_text IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voice lease expired'; END IF;
  RETURN jsonb_build_object('ok',true);
 END IF;
$voice$ || translation_anchor);
 EXECUTE definition;
END $migration$;

COMMIT;
