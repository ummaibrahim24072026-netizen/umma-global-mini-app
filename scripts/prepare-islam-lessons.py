"""Prepare private draft lesson source bundles after import-islam-sources.py.
These are editorial work items, not completed prayer teaching or approved rulings.
"""
from pathlib import Path
import sys,json,uuid,openpyxl
folder=Path(sys.argv[1]);rows=list(openpyxl.load_workbook('/tmp/umma-hadeeth-ru.xlsx',read_only=True,data_only=True).active.values);items={int(r[0]):dict(zip(rows[1],r)) for r in rows[2:] if r[0]};manifest=json.loads((folder/'manifest.json').read_text());ids={x['provider_id']:x['id'] for x in manifest}
q=lambda v:"'"+str(v).replace("'","''")+"'"
plans=[('prayer-complete','learn','Намаз: подготовка и последовательность',[3059,3185,3095,3104,3727,10925,3096,5216]),('fajr','learn','Фаджр',[10596,3185]),('dhuhr','learn','Зухр',[10596,3185]),('asr','learn','Аср',[10596,3185]),('maghrib','learn','Магриб',[10596,3185]),('isha','learn','Иша',[10596,3185]),('prayer-variants','learn','Подтверждённые варианты движений и чтения',[10902,10908,10943]),('prayer-times-evidence','learn','Время молитв: первоисточники',[10596]),('prayer-transitions','learn','Переходы между положениями молитвы',[5216,3185])]
statement=[];summary=[]
for slug,category,title,sources in plans:
 id=str(uuid.uuid5(uuid.NAMESPACE_URL,'https://umma.global/lessons/'+slug));source=items[sources[0]];source_url=source['link'];note=exports_note=rows[0][0]
 statement.append("insert into public.prayer_lessons(id,slug,category,title,introduction,source_url,license_note) values("+','.join(map(q,[id,slug,category,title,'Редакционная подборка источников. Требуются проверка, учебная компоновка, транслитерация и независимое утверждение перед публикацией.',source_url,note]))+") on conflict(id) do nothing;")
 for n,i in enumerate(sources,1):
  d=items[i];sid=str(uuid.uuid5(uuid.NAMESPACE_URL,'https://umma.global/lessons/'+slug+'/'+str(i)))
  statement.append("insert into public.prayer_lesson_steps(id,lesson_id,position,title,arabic,translation,explanation) values("+','.join([q(sid),q(id),str(n),q(d['title']),q(d['hadith_text_ar']),q(d['hadith_text']),q(d['explanation'] or '')])+") on conflict(id) do nothing;")
  statement.append("insert into public.lesson_evidences(lesson_id,step_id,hadith_id,citation,source_url) select "+','.join(map(q,[id,sid,ids[i],'HadeethEnc № '+str(i)+'; первичная нумерация требует сверки',d['link']]))+" where not exists(select 1 from public.lesson_evidences where step_id="+q(sid)+");")
 summary.append({'id':id,'slug':slug,'title':title,'sources':sources,'status':'draft','complete_teaching_guide':False})
(folder/'lessons.sql').write_text('\n'.join(statement));(folder/'lesson-manifest.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));print(json.dumps({'draft_lessons':len(summary),'not_published':True}))
