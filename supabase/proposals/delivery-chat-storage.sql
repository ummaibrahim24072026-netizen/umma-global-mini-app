BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('delivery-chat','delivery-chat',false,20971520,ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime','audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav']) ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='delivery-chat' AND public) THEN RAISE EXCEPTION 'Chat bucket must be private'; END IF; END;$$;
CREATE POLICY delivery_chat_private ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated USING(bucket_id<>'delivery-chat') WITH CHECK(bucket_id<>'delivery-chat');
COMMIT;
