BEGIN;

-- Past campaigns were sent privately to subscribers. Only explicitly published
-- campaigns belong in the public menu.
ALTER TABLE umma_private.cafe_connect_campaigns
 ADD COLUMN IF NOT EXISTS public_news boolean NOT NULL DEFAULT false;

DO $migration$
DECLARE
 definition text := pg_get_functiondef('public.cafe_connect(text,text,bigint,jsonb)'::regprocedure);
 dispatch_branch text := ' IF p_action IN (''lease'',''finish'') THEN';
 campaign_insert text := 'INSERT INTO umma_private.cafe_connect_campaigns(request_key,title,body,language) VALUES(k,p_data->>''title'',p_data->>''body'',coalesce(p_data->>''language'',''all''));';
BEGIN
 IF strpos(definition, 'IF p_action=''news''')>0 THEN RETURN; END IF;
 IF strpos(definition, dispatch_branch)=0 OR strpos(definition, campaign_insert)=0 THEN
  RAISE EXCEPTION 'Unexpected cafe_connect definition';
 END IF;
 definition := replace(definition, dispatch_branch, $feed$
 IF p_action='news' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(x)-'request_key' ORDER BY x.created_at DESC,x.request_key DESC),'[]') INTO result
  FROM (
   SELECT request_key,title,body,created_at
   FROM umma_private.cafe_connect_campaigns
   WHERE public_news AND created_at>=now()-interval '30 days'
   ORDER BY created_at DESC,request_key DESC
   LIMIT 5
  ) x;
  RETURN jsonb_build_object('ok',true,'news',result);
 END IF;
$feed$ || dispatch_branch);
 EXECUTE replace(definition, campaign_insert, $insert$
 INSERT INTO umma_private.cafe_connect_campaigns(request_key,title,body,language,public_news)
 VALUES(k,p_data->>'title',p_data->>'body',coalesce(p_data->>'language','all'),
        coalesce((p_data->>'publicNews')::boolean,false) AND p_data->>'language'='all'
        AND NOT coalesce((p_data->>'installedOnly')::boolean,false));
$insert$);
END $migration$;

COMMIT;
