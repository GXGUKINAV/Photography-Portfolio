#!/usr/bin/env node
/* =========================================================
   build-gallery.js — nessuna dipendenza, serve solo Node.

   Uso:   node build-gallery.js

   Scansiona images/<Categoria>/*.jpg (una sottocartella = una categoria),
   legge dimensioni ed EXIF REALI dai file e scrive photos.js,
   che il sito carica per costruire filtri e griglia.

   Facoltativo: images/overrides.json per cambiare titolo/alt/EXIF di una foto:
   {
     "Landscape/IMG_9635.jpeg": { "title": "Dragon Ride del Pilatus Kulm", "focus": "center" }
   }
   "exif" accetta anche camera e flash: compaiono nel pannello info.
   "focus" (top | center | bottom) sceglie quale parte di una foto verticale
   si vede nel riquadro ritagliato della griglia. Default: center.
   ========================================================= */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const IMAGES_DIR = path.join(ROOT, 'images');
const OUT_FILE = path.join(ROOT, 'photos.js');
const OVERRIDES_FILE = path.join(IMAGES_DIR, 'overrides.json');
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const PHONE_MAKE = /apple|samsung|google|huawei|xiaomi|oneplus|oppo|vivo|motorola/i;

/* ---------- lettura JPEG + EXIF (parser minimale) ---------- */
const TYPE_SIZE = { 1:1, 2:1, 3:2, 4:4, 5:8, 7:1, 9:4, 10:8 };

function parseTiff(buf, t){
  const le = buf.toString('latin1', t, t + 2) === 'II';
  const u16 = o => le ? buf.readUInt16LE(o) : buf.readUInt16BE(o);
  const u32 = o => le ? buf.readUInt32LE(o) : buf.readUInt32BE(o);

  function readIFD(rel){
    const tags = {};
    const base = t + rel;
    if(base + 2 > buf.length) return tags;
    const n = u16(base);
    for(let i = 0; i < n; i++){
      const e = base + 2 + i * 12;
      if(e + 12 > buf.length) break;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
      const size = (TYPE_SIZE[type] || 1) * count;
      const vo = size <= 4 ? e + 8 : t + u32(e + 8);
      if(vo + size > buf.length) continue;
      let val;
      if(type === 2) val = buf.toString('latin1', vo, vo + count).replace(/\0[\s\S]*$/, '').trim();
      else if(type === 3) val = u16(vo);
      else if(type === 4) val = u32(vo);
      else if(type === 5){ const d = u32(vo + 4); val = d ? u32(vo) / d : undefined; }
      if(val !== undefined) tags[tag] = val;
    }
    return tags;
  }

  const ifd0 = readIFD(u32(t + 4));
  const exif = ifd0[0x8769] ? readIFD(ifd0[0x8769]) : {};
  return { ifd0, exif };
}

function parseJpeg(buf){
  const out = { width:null, height:null, ifd0:{}, exif:{} };
  if(buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) return out;
  let off = 2;
  while(off + 4 <= buf.length){
    if(buf[off] !== 0xFF){ off++; continue; }
    const marker = buf[off + 1];
    if(marker === 0xFF){ off++; continue; }
    if(marker === 0x01 || (marker >= 0xD0 && marker <= 0xD8)){ off += 2; continue; }
    if(marker === 0xD9 || marker === 0xDA) break;
    const len = buf.readUInt16BE(off + 2);
    if(marker === 0xE1 && buf.toString('latin1', off + 4, off + 8) === 'Exif'){
      try{ Object.assign(out, parseTiff(buf, off + 10)); }catch(e){}
    }else if(marker >= 0xC0 && marker <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(marker)){
      out.height = buf.readUInt16BE(off + 5);
      out.width = buf.readUInt16BE(off + 7);
    }
    off += 2 + len;
  }
  return out;
}

function parsePngSize(buf){
  if(buf.length > 24 && buf.toString('latin1', 1, 4) === 'PNG')
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  return { width:null, height:null };
}

/* ---------- formattazione dei valori ---------- */
const fmtShutter  = t => !t ? null : (t >= 1 ? `${+t.toFixed(1)}s` : `1/${Math.round(1 / t)}s`);
const fmtAperture = f => f ? `f/${+f.toFixed(1)}` : null;
const fmtISO      = v => v ? `ISO ${v}` : null;
// tag Flash: il bit 0 dice se il flash è scattato
const fmtFlash    = v => v === undefined ? null : (v & 1 ? 'Sì, scattato' : 'No, disattivato');

// Focale reale; sugli smartphone (sensore minuscolo) l'equivalente 35mm, che è quello sensato da mostrare
function fmtFocal(ifd0, exif){
  const real = exif[0x920A], eq = exif[0xA405];
  const isPhone = PHONE_MAKE.test(ifd0[0x010F] || '') || (real && real < 7);
  const mm = (isPhone && eq) ? eq : real;
  return mm ? `${Math.round(mm)}mm` : null;
}

const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function titleFromFile(file){
  return path.parse(file).name.replace(/[-_]+/g, ' ').trim().replace(/\b[a-z]/g, c => c.toUpperCase());
}

/* ---------- scansione ---------- */
if(!fs.existsSync(IMAGES_DIR)){
  console.error('Cartella "images" non trovata accanto a build-gallery.js');
  process.exit(1);
}

let overrides = {};
if(fs.existsSync(OVERRIDES_FILE)){
  try{
    const raw = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8'));
    for(const k of Object.keys(raw)) overrides[k.toLowerCase()] = raw[k];
  }catch(e){
    console.warn('! images/overrides.json non è un JSON valido, lo ignoro:', e.message);
  }
}

const photos = [];
const categories = new Map(); // id → label
const looseFiles = [];

function addPhoto(dirName, file){
  const rel = dirName ? `${dirName}/${file}` : file;
  const full = path.join(IMAGES_DIR, ...rel.split('/'));
  const buf = fs.readFileSync(full);
  const isJpeg = /\.jpe?g$/i.test(file);
  const info = isJpeg ? parseJpeg(buf)
             : /\.png$/i.test(file) ? { ...parsePngSize(buf), ifd0:{}, exif:{} }
             : { width:null, height:null, ifd0:{}, exif:{} };

  let { width: w, height: h } = info;
  const orientation = info.ifd0[0x0112];
  if(w && h && orientation >= 5 && orientation <= 8) [w, h] = [h, w]; // foto scattata in verticale

  const ex = info.exif;
  const make = info.ifd0[0x010F] || '', model = info.ifd0[0x0110] || '';
  const camera = !model ? null
    : (make && !model.toLowerCase().includes(make.split(' ')[0].toLowerCase()) ? `${make} ${model}` : model);
  const exif = {
    shutter:  fmtShutter(ex[0x829A]),
    aperture: fmtAperture(ex[0x829D]),
    focal:    fmtFocal(info.ifd0, ex),
    iso:      fmtISO(ex[0x8827]),
    camera,
    flash:    fmtFlash(ex[0x9209])
  };

  const taken = typeof ex[0x9003] === 'string'
    ? ex[0x9003].replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
    : fs.statSync(full).mtime.toISOString();

  const ov = overrides[rel.toLowerCase()] || {};
  const title = ov.title || titleFromFile(file);

  let cat = null;
  if(dirName){
    cat = slug(dirName);
    if(!categories.has(cat)) categories.set(cat, dirName.replace(/[-_]+/g, ' ').trim());
  }else{
    looseFiles.push(file);
  }

  const photo = {
    src: `images/${rel}`,
    cat, title,
    alt: ov.alt || title,
    w, h,
    exif: { ...exif, ...(ov.exif || {}) },
    _taken: taken
  };
  if(ov.focus !== undefined){
    const f = String(ov.focus).toLowerCase();
    if(['top', 'center', 'bottom'].includes(f)){ if(f !== 'center') photo.focus = f; }
    else console.warn(`  ! focus "${ov.focus}" non valido per ${rel} (usa top, center o bottom)`);
  }
  for(const k of Object.keys(photo.exif)) if(!photo.exif[k]) delete photo.exif[k];
  if(!photo.cat) delete photo.cat;
  if(!photo.w) { delete photo.w; delete photo.h; }
  photos.push(photo);
}

for(const entry of fs.readdirSync(IMAGES_DIR, { withFileTypes:true })){
  if(entry.name.startsWith('.') || entry.name.startsWith('_')) continue; // es. _originali è ignorata
  if(entry.isDirectory()){
    for(const f of fs.readdirSync(path.join(IMAGES_DIR, entry.name)).sort()){
      if(IMAGE_EXT.test(f)) addPhoto(entry.name, f);
    }
  }else if(entry.isFile() && IMAGE_EXT.test(entry.name)){
    addPhoto(null, entry.name);
  }
}

// più recenti per prime
photos.sort((a, b) => b._taken.localeCompare(a._taken) || a.src.localeCompare(b.src));
photos.forEach(p => delete p._taken);

const cats = [...categories].map(([id, label]) => ({ id, label }))
  .sort((a, b) => a.label.localeCompare(b.label, 'it'));

fs.writeFileSync(
  OUT_FILE,
  '// Generato da build-gallery.js — non modificare a mano (rilancia: node build-gallery.js)\n' +
  'window.PHOTOS = ' + JSON.stringify({ categories: cats, photos }, null, 2) + ';\n'
);

/* ---------- riepilogo ---------- */
console.log(`\nphotos.js aggiornato: ${photos.length} foto, ${cats.length} categorie`);
for(const c of cats) console.log(`  • ${c.label}: ${photos.filter(p => p.cat === c.id).length}`);
for(const p of photos){
  if(!p.exif || !Object.keys(p.exif).length) console.log(`  ! nessun EXIF in ${p.src}`);
  if(!p.w) console.log(`  ! dimensioni sconosciute per ${p.src} (uso il formato di default)`);
}
if(looseFiles.length){
  console.log(`\n  ! ${looseFiles.length} foto fuori da una sottocartella (compaiono solo in "Tutti"):`);
  looseFiles.forEach(f => console.log('    - images/' + f));
}
console.log('');
