
// scripts/update.mjs
// ルデヤ/森森/wiki + 海峡通信 + モバイルミックス + ★モバステ（pastec.net）
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';

const urls = {
  rudeya: {
    base: 'https://kaitori-rudeya.com/category/detail/218',
    pro: 'https://kaitori-rudeya.com/category/detail/219',
    promax: 'https://kaitori-rudeya.com/category/detail/220',
  },
  morimori: {
    base: 'https://www.morimori-kaitori.jp/search?price-list=true&sk=iphone+17',
    pro: 'https://www.morimori-kaitori.jp/category/price-list/0301065',
    promax: 'https://www.morimori-kaitori.jp/category/price-list/0301066',
  },
  wiki: { series: 'https://iphonekaitori.tokyo/series/iphone/' },
  mobileMix: { category: process.env.MOBILE_MIX_URL || 'https://mobile-mix.jp/?category=7' },
  mobileIchiban: { list: 'https://www.mobile-ichiban.com/Prod/1' },
  mobaste: {
    main: process.env.MOBASTE_URL || 'https://pastec.net/iphone',
    search: 'https://pastec.net/search'
  }
};

function yenToNumber(s){return Number((s||'').toString().replace(/[^\d]/g,''))||null}
async function fetchText(url){
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (PriceBot/1.3; +https://example.com)' } });
  if(!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}
function readData(){
  const js = readFileSync(new URL('../assets/data.js', import.meta.url), 'utf8');
  const json = js.replace(/^window\.PRICE_DATA\s*=\s*/, '').replace(/;\s*$/, '');
  return JSON.parse(json);
}
async function writeData(data){
  const js = 'window.PRICE_DATA = ' + JSON.stringify(data, null, 2) + ';';
  await fs.writeFile(new URL('../assets/data.js', import.meta.url), js, 'utf8');
}
function upsertColor(v, color, store, price){ v.colors ||= {"全色":{}}; v.colors[color] ||= {}; v.colors[color][store] = price; }
function upsertPriceFallback(v, store, price, link){
  const f=(v.prices||[]).find(p=>p.store===store);
  if (f){ if (price!=null) f.price_jpy=price; if(link) f.link=link; }
  else { v.prices ||= []; v.prices.push({store,price_jpy:price??null,link:link||'#'}); }
}
function normalizeColorName(s){ if(!s) return null; s=s.replace(/\s+/g,''); if(/オレンジ|コズミック/i.test(s))return'コズミックオレンジ'; if(/青|ブルー/i.test(s))return'ブルー'; if(/銀|シルバー/i.test(s))return'シルバー'; if(/黒|ブラック/i.test(s))return'ブラック'; if(/白|ホワイト/i.test(s))return'ホワイト'; if(/ラベンダ/i.test(s))return'ラベンダー'; if(/セージ/i.test(s))return'セージ'; if(/ミスト|ブルー/i.test(s))return'ミストブルー'; return s; }
function pickMax(html, re){ const m=[...html.matchAll(re)].map(x=>yenToNumber(x[1]||x[2]||x[3]||'')); return m.length? Math.max(...m): null; }

// Parsers (略式: 既存3店舗・モバイルミックス・海峡通信)
function parseRudeya(html, model){ const caps=[256,512]; const out={256:null,512:null,ts:null}; const ts=html.match(/(\d{4}年\d{1,2}月\d{1,2}日\s*\d{1,2}時\d{1,2}分)\s*現在/); if(ts) out.ts=ts[1]; for(const cap of caps){ const re = model==='base' ? new RegExp(`iPhone\\s*17\\s*${cap}GB[\\s\\S]*?(\\d{1,3}(?:,\\d{3})*)\\s*円`,'g') : model==='pro' ? new RegExp(`iPhone\\s*17\\s*Pro\\s*${cap}GB[\\s\\S]*?(\\d{1,3}(?:,\\d{3})*)\\s*円`,'g') : new RegExp(`iPhone\\s*17\\s*Pro\\s*Max\\s*${cap}GB[\\s\\S]*?(\\d{1,3}(?:,\\d{3})*)\\s*円`,'g'); out[cap]=pickMax(html,re) } return out; }
function parseMorimori(html, model){ const caps=[256,512]; const out={256:null,512:null}; const word=model==='base'?'iPhone17\\s':(model==='pro'?'iPhone17\\s*Pro\\s':'iPhone17\\s*Pro\\s*Max\\s'); for(const cap of caps){ const re=new RegExp(`新品\\s*Apple\\s*${word}${cap}GB[\\s\\S]*?(\\d{1,3}(?:,\\d{3})*)円\\(通常\\)`,'g'); out[cap]=pickMax(html,re) } return out; }
function parseWikiSeries(html, model){ const caps=[256,512]; const out={256:null,512:null}; const word=model==='base'?'iPhone\\s*17(?!\\s*Pro)':(model==='pro'?'iPhone\\s*17\\s*Pro(?!\\s*Max)':'iPhone\\s*17\\s*Pro\\s*Max'); for(const cap of caps){ const re=new RegExp(`${word}\\s*${cap}GB[\\s\\S]*?買取価格:\\s*(\\d{1,3}(?:,\\d{3})*)円`,'g'); out[cap]=pickMax(html,re) } return out; }
function parseMobileMix(html){ const out={'iphone17-256':{base:null,colors:{}},'iphone17-512':{base:null,colors:{}},'iphone17pro-256':{base:null,colors:{}},'iphone17pro-512':{base:null,colors:{}},'iphone17promax-256':{base:null,colors:{}},'iphone17promax-512':{base:null,colors:{}}}; const blocks=html.split(/iPhone\\s*17/).slice(1).map(b=>'iPhone 17'+b); for(const b of blocks){ const m=b.match(/iPhone\\s*17(\\s*Pro\\s*Max|\\s*Pro)?\\s*(\\d+)\\s*GB[\\s\\S]*?(\\d{1,3}(?:,\\d{3})*)\\s*円/); if(!m) continue; const tier=(m[1]||'').replace(/\\s+/g,'').toLowerCase(); const cap=m[2]; const base=yenToNumber(m[3]); let sku=tier===''?`iphone17-${cap}`: tier==='pro'?`iphone17pro-${cap}`:`iphone17promax-${cap}`; if(!(sku in out)) continue; out[sku].base=base; const colorLine=b.match(/(青|ブルー|銀|シルバー|オレンジ|コズミック)[^\\n<]{0,40}?-?\\s*\\d{1,3}(?:,\\d{3})*/g); if(colorLine){ const s=colorLine.join(' '); for(const m2 of s.matchAll(/([^\\s、・/]+)\\s*[-−]?\\s*(\\d{1,3}(?:,\\d{3})*)/g)){ const color=normalizeColorName(m2[1]); const delta=yenToNumber(m2[2]); if(color&&delta) out[sku].colors[color]=base-delta } } else { out[sku].colors['全色']=base } } return out; }
function parseMobileIchiban(html){ const out={'iphone17-256':{base:null,colors:{}},'iphone17-512':{base:null,colors:{}},'iphone17pro-256':{base:null,colors:{}},'iphone17pro-512':{base:null,colors:{}},'iphone17promax-256':{base:null,colors:{}},'iphone17promax-512':{base:null,colors:{}}}; const re=/iPhone\\s*17(\\s*Pro\\s*Max|\\s*Pro)?\\s*(\\d+)\\s*GB[\\s\\S]{0,120}?([青ブルー銀シルバーオレンジコズミック\\-0-9,\\s]*)[\\s\\S]{0,80}?(\\d{1,3}(?:,\\d{3})*)\\s*円/gi; let m; while((m=re.exec(html))){ const tier=(m[1]||'').replace(/\\s+/g,'').toLowerCase(); const cap=m[2]; const base=yenToNumber(m[4]); let sku=tier===''?`iphone17-${cap}`: tier==='pro'?`iphone17pro-${cap}`:`iphone17promax-${cap}`; if(!(sku in out)) continue; out[sku].base=base; const hint=m[3]||''; for(const m2 of hint.matchAll(/([^\\s、・/]+)\\s*[-−]?\\s*(\\d{1,3}(?:,\\d{3})*)/g)){ const color=normalizeColorName(m2[1]); const delta=yenToNumber(m2[2]); if(color&&delta) out[sku].colors[color]=base-delta } if(!Object.keys(out[sku].colors).length) out[sku].colors['全色']=base } return out; }

// ★ モバステ（pastec.net）
function parseMobaste(html){
  // 例： "iPhone17 Pro Max 256GB ... 205,000円" 近傍に "シルバー：-8,000円、ブルー：-9,000円(未開封) 一般郵送買取：-2000円(未開封)"
  const out={'iphone17-256':{base:null,colors:{}},'iphone17-512':{base:null,colors:{}},'iphone17pro-256':{base:null,colors:{}},'iphone17pro-512':{base:null,colors:{}},'iphone17promax-256':{base:null,colors:{}},'iphone17promax-512':{base:null,colors:{}}};
  // スニペット単位に分割（カードやテーブル行）
  const chunks = html.split(/iPhone\\s*17/i).slice(1).map(b=>'iPhone 17'+b);
  for (const b of chunks){
    const m=b.match(/iPhone\\s*17(\\s*Pro\\s*Max|\\s*Pro)?\\s*(\\d+)\\s*GB[\\s\\S]{0,200}?(\\d{1,3}(?:,\\d{3})*)\\s*円/);
    if(!m) continue;
    const tier=(m[1]||'').replace(/\\s+/g,'').toLowerCase();
    const cap=m[2]; const base=yenToNumber(m[3]);
    let sku = tier===''?`iphone17-${cap}`: tier==='pro'?`iphone17pro-${cap}`:`iphone17promax-${cap}`;
    if(!(sku in out)) continue;
    out[sku].base = base;

    // 色減額の抽出："シルバー：-8,000円、ブルー：-9,000円" など（コロン/全角コロン両対応）
    const near = b.slice(0, 400); // 先頭付近を優先
    for (const m2 of near.matchAll(/(シルバー|ブルー|青|銀|オレンジ|コズミック|ブラック|ホワイト|ラベンダー|セージ|ミスト)[：:ｰ-−]?\s*[-−]?\s*(\d{1,3}(?:,\d{3})*)/g)){
      const color = normalizeColorName(m2[1]);
      const delta = yenToNumber(m2[2]);
      if (color && delta!=null) out[sku].colors[color] = base - delta;
    }
    if (!Object.keys(out[sku].colors).length) out[sku].colors['全色'] = base;
  }
  return out;
}

async function main(){
  const data = readData();
  const jstNow = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }) + '+09:00';
  data.last_built_at = jstNow;

  // Fetch
  const [rb,rp,rpm] = await Promise.allSettled([fetchText(urls.rudeya.base), fetchText(urls.rudeya.pro), fetchText(urls.rudeya.promax)]);
  const [mb,mp,mpm] = await Promise.allSettled([fetchText(urls.morimori.base), fetchText(urls.morimori.pro), fetchText(urls.morimori.promax)]);
  const ws = await Promise.allSettled([fetchText(urls.wiki.series)]);
  const mix = await Promise.allSettled([fetchText(urls.mobileMix.category)]);
  const ichi = await Promise.allSettled([fetchText(urls.mobileIchiban.list)]);
  const mobMain = await Promise.allSettled([fetchText(urls.mobaste.main)]);
  const mobSearch = await Promise.allSettled([fetchText(urls.mobaste.search)]);

  // Parse
  const rudeyaB = rb.status==='fulfilled'? parseRudeya(rb.value,'base') : {256:null,512:null};
  const rudeyaP = rp.status==='fulfilled'? parseRudeya(rp.value,'pro') : {256:null,512:null};
  const rudeyaPM= rpm.status==='fulfilled'? parseRudeya(rpm.value,'promax') : {256:null,512:null};
  const moriB = mb.status==='fulfilled'? parseMorimori(mb.value,'base') : {256:null,512:null};
  const moriP = mp.status==='fulfilled'? parseMorimori(mp.value,'pro') : {256:null,512:null};
  const moriPM= mpm.status==='fulfilled'? parseMorimori(mpm.value,'promax') : {256:null,512:null};
  const wikiS = ws[0].status==='fulfilled'? parseWikiSeries(ws[0].value,'base') : {256:null,512:null};
  const wikiP = ws[0].status==='fulfilled'? parseWikiSeries(ws[0].value,'pro') : {256:null,512:null};
  const wikiPM= ws[0].status==='fulfilled'? parseWikiSeries(ws[0].value,'promax') : {256:null,512:null};
  const mmix  = mix[0].status==='fulfilled'? parseMobileMix(mix[0].value) : null;
  const ichiban = ichi[0].status==='fulfilled'? parseMobileIchiban(ichi[0].value) : null;
  const mobaste = (mobMain[0].status==='fulfilled'||mobSearch[0].status==='fulfilled')? parseMobaste((mobMain[0].value||'') + '\\n' + (mobSearch[0].value||'')) : null;

  function applySku(v, sku){
    const modelKey = sku.includes('promax')?'promax':(sku.includes('pro')?'pro':'base');
    const capKey = sku.endsWith('256')?256:512;
    // 既存3店舗（容量共通）
    if (rudeyaB && rudeyaP && rudeyaPM){
      const val = modelKey==='promax'? rudeyaPM[capKey] : modelKey==='pro'? rudeyaP[capKey] : rudeyaB[capKey];
      if (val!=null) upsertPriceFallback(v,'買取ルデヤ',val, urls.rudeya[modelKey]);
    }
    if (moriB && moriP && moriPM){
      const val = modelKey==='promax'? moriPM[capKey] : modelKey==='pro'? moriP[capKey] : moriB[capKey];
      if (val!=null) upsertPriceFallback(v,'森森買取',val, urls.morimori[modelKey]);
    }
    if (wikiS && wikiP && wikiPM){
      const val = modelKey==='promax'? wikiPM[capKey] : modelKey==='pro'? wikiP[capKey] : wikiS[capKey];
      if (val!=null) upsertPriceFallback(v,'買取wiki',val, urls.wiki.series);
    }
    // 追加店舗（色別優先）
    if (mmix && mmix[sku]){
      const cols = mmix[sku].colors;
      if (Object.keys(cols).length){ for (const [c,p] of Object.entries(cols)) upsertColor(v,c,'モバイルミックス',p); }
      else if (mmix[sku].base){ upsertColor(v,'全色','モバイルミックス',mmix[sku].base); }
      upsertPriceFallback(v,'モバイルミックス', mmix[sku].base ?? null, urls.mobileMix.category);
    }
    if (ichiban && ichiban[sku]){
      const cols = ichiban[sku].colors;
      if (Object.keys(cols).length){ for (const [c,p] of Object.entries(cols)) upsertColor(v,c,'海峡通信',p); }
      else if (ichiban[sku].base){ upsertColor(v,'全色','海峡通信',ichiban[sku].base); }
      upsertPriceFallback(v,'海峡通信', ichiban[sku].base ?? null, urls.mobileIchiban.list);
    }
    if (mobaste && mobaste[sku]){
      const cols = mobaste[sku].colors;
      if (Object.keys(cols).length){ for (const [c,p] of Object.entries(cols)) upsertColor(v,c,'モバステ',p); }
      else if (mobaste[sku].base){ upsertColor(v,'全色','モバステ',mobaste[sku].base); }
      upsertPriceFallback(v,'モバステ', mobaste[sku].base ?? null, urls.mobaste.main);
    }
  }

  for (const v of data.variants){
    applySku(v, v.sku);
  }
  await writeData(data);
  console.log('Updated at', jstNow);
}
main().catch(e=>{ console.error(e); process.exit(1); });
