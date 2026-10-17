// Strict RFC-style CSV; never coerce identifiers/barcodes to numbers.
export function parseCSV(source) {
 if(typeof source!=='string'||source.length>80000)throw Error('CSV: максимум 80 КБ');
 source=source.replace(/^\uFEFF/,'');
 const delimiter=source.slice(0,source.indexOf('\n')<0?source.length:source.indexOf('\n')).includes(';')?';':',';
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 const push=()=>{row.push(cell);cell='';closed=false;};
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(quoted){if(c==='"'){if(source[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='"'){if(cell||closed)throw Error('CSV: неверные кавычки');quoted=true;}
  else if(c===delimiter){push();}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&source[i+1]==='\n')i++;push();if(row.some(Boolean))rows.push(row);row=[];}
  else{if(closed)throw Error('CSV: лишние символы после кавычек');cell+=c;}
 }
 if(quoted)throw Error('CSV: незакрытые кавычки');
 push();if(row.some(Boolean))rows.push(row);
 const headers=rows.shift()?.map(x=>x.trim());
 if(!headers?.length||headers.some(h=>!h||!(/^[a-z][a-z0-9_]*$/).test(h))||new Set(headers).size!==headers.length)throw Error('CSV: некорректные или повторяющиеся заголовки');
 if(rows.length<1||rows.length>100)throw Error('CSV: от 1 до 100 строк за импорт');
 return rows.map((values,index)=>{if(values.length!==headers.length)throw Error(`CSV: число столбцов в строке ${index+2}`);return Object.fromEntries(headers.map((key,i)=>[key,values[i].trim()]));});
}
