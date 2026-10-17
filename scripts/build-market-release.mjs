import {readFileSync,writeFileSync} from 'node:fs';
export const sources=['market-stock-scan.sql','market-commerce.sql','market-management.sql','market-launch-setup.sql','market-quality.sql','market-unpriced-catalog.sql','cafe-catalog-preview.sql'];
export const marketRelease=()=> '-- UMMA Market: atomic versioned release; never rerun against an installed database.\nBEGIN;\nSET LOCAL lock_timeout = \'10s\';\n'+sources.map(name=>'\n-- Source: '+name+'\n'+readFileSync('supabase/proposals/'+name,'utf8').replace(/^BEGIN;\s*$/gm,'').replace(/^COMMIT;\s*$/gm,'')).join('\n')+'\nCOMMIT;\n';
if(process.argv[1]?.endsWith('/build-market-release.mjs')){writeFileSync('supabase/release/market-launch.sql',marketRelease());console.log('Prepared atomic Market release');}
