-- Separate owner-approved production storage step; private bucket only, no public policies.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='cafe-delivery-evidence' AND public) THEN RAISE EXCEPTION 'Existing evidence bucket is public; stop for access review'; END IF;
END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('cafe-delivery-evidence','cafe-delivery-evidence',false,8388608,ARRAY['image/jpeg','image/png']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY cafe_delivery_evidence_private ON storage.objects AS RESTRICTIVE FOR ALL TO anon,authenticated USING(bucket_id<>'cafe-delivery-evidence') WITH CHECK(bucket_id<>'cafe-delivery-evidence');
COMMIT;
