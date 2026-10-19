"""Prepare private DRAFT imports from official HadeethEnc XLSX exports.
Never approves/publishes content and never changes source text. No network or DB write.
Usage: python3 scripts/import-islam-sources.py /tmp/umma-hadeeth /tmp/islam-import
"""
import sys,json,uuid,re,hashlib
from pathlib import Path
import openpyxl
prefix,out=map(Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
def load(language):
 rows=list(openpyxl.load_workbook(str(prefix)+'-'+language+'.xlsx',read_only=True,data_only=True).active.values)
 return rows[0][0],{int(r[0]):dict(zip(rows[1],r)) for r in rows[2:] if r[0]}
exports={l:load(l) for l in ['ru','en','vi']}
ru=exports['ru'][1]
essential=[3059,3185,3095,10925,3096,10943,10596,3104,3727,5216,10906,10902,10908]
others=[i for i,d in ru.items() if re.search('омовени|пятничн|витр|истихар|приветстви.*мечети|таямм|обтира.*нос|духа|намаз|молитв',d['title'],re.I) and 'Достоверный' in str(d['grade']) and re.search('Бухари|Муслим',str(d['takhrij']))]
ids=list(dict.fromkeys(essential+others))[:60]
q=lambda v:"'"+str(v).replace("'","''")+"'"
uid=lambda i:str(uuid.uuid5(uuid.NAMESPACE_URL,'https://hadeethenc.com/hadith/'+str(i)))
manifest=[];statements=[]
statements.append("insert into public.hadith_collections(id,title,source_url,license_note) values('hadeethenc','HadeethEnc — материалы для редакционной сверки','https://hadeethenc.com','Условия: неизменённый текст, источник, версия и сведения оригинала; обновления по источнику. Каждая запись требует рецензии UMMA перед публикацией.') on conflict(id) do nothing;")
for i in ids:
 d=ru[i];id=uid(i);header=exports['ru'][0];version=re.search(r'\(v[^)]+\)',header).group(0).strip('()');url=d['link'] or 'https://hadeethenc.com/ru/browse/hadith/'+str(i)
 notes=header+'\n\nУсловия использования: https://hadeethenc.com/ru/home — текст не изменяется; указываются источник и версия; обновление по источнику. Импорт является черновиком, не религиозным утверждением UMMA.'
 statement="insert into public.hadith_records(id,collection_id,number,book,edition,arabic,narrator,grade,source_url,license_note,commentary,categories) values("+','.join(map(q,[id,'hadeethenc',str(i),'Нумерация HadeethEnc; первичный сборник и номер требуют сверки',version,d['hadith_text_ar'],'Передатчик указан в начале исходного текста',d['grade'],url,notes,str(d['explanation'] or '')+'\n\n'+str(d['benefits'] or '')]))+",array['prayer','purification']) on conflict(id) do nothing;"
 for language,(meta,items) in exports.items():
  if i not in items:continue
  source=items[i];link=source['link'] or 'https://hadeethenc.com/'+language+'/browse/hadith/'+str(i)
  statement+="\ninsert into public.hadith_translations(hadith_id,language,text,translator,source_url,license_note) select "+','.join(map(q,[id,language,source['hadith_text'],'HadeethEnc.com — опубликованный перевод',link,meta]))+" where exists(select 1 from public.hadith_records where id="+q(id)+" and status='draft') on conflict(hadith_id,language) do nothing;"
 manifest.append({'id':id,'provider_id':i,'source_url':url,'version':version,'title':d['title'],'sha256_arabic':hashlib.sha256(d['hadith_text_ar'].encode()).hexdigest(),'status':'draft','primary_number_verified':False})
 statements.append(statement)
for n,s in enumerate(statements): (out/f'{n:03d}.sql').write_text(s+'\n')
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(json.dumps({'records':len(manifest),'statements':len(statements),'output':str(out),'versions':{l:meta.split('Last update: ')[-1].split('\n')[0] for l,(meta,_) in exports.items()}},ensure_ascii=False))
