/* =========================================================
   attyl.photography — script.js
   Ordine: config → tema → reveal → attrezzatura → lightbox → galleria
   ========================================================= */

/* ---------- CONFIG: la tua attrezzatura (solo roba reale) ---------- */
const GEAR = [
  { tipo:'Fotocamera', corpo:'Canon EOS 750D', obiettivo:'EF-S 18-135mm f/3.5-5.6 IS STM', focale:'18-135mm' },
  { tipo:'Smartphone', corpo:'Apple iPhone 17', obiettivo:'Fotocamera principale (Wide)', focale:'26mm (1x)' }
];


/* ---------- tema chiaro / scuro ----------
   Default: segue il dispositivo (chiaro → bianco/crema, altrimenti scuro).
   Se clicchi sole/luna la scelta viene ricordata e vince sul sistema. */
const rootEl = document.documentElement;
const themeBtns = document.querySelectorAll('[data-set-theme]');
const systemLight = window.matchMedia('(prefers-color-scheme: light)');

function storedTheme(){
  try{ return localStorage.getItem('theme'); }catch(e){ return null; }
}
function applyTheme(theme){
  rootEl.dataset.theme = theme;
  themeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.setTheme === theme)));
}

applyTheme(storedTheme() || (systemLight.matches ? 'light' : 'dark'));

// se non hai mai scelto a mano, segui i cambi del sistema (es. tema automatico giorno/notte)
systemLight.addEventListener('change', ()=>{
  if(!storedTheme()) applyTheme(systemLight.matches ? 'light' : 'dark');
});
themeBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const theme = btn.dataset.setTheme;
    try{ localStorage.setItem('theme', theme); }catch(e){}
    applyTheme(theme);
  });
});


/* ---------- scroll reveal ---------- */
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold:0.15 });

function observeReveal(els){ els.forEach(el => io.observe(el)); }
observeReveal(document.querySelectorAll('.reveal'));


/* ---------- carosello attrezzatura ---------- */
let gearIdx = 0;

const gearTipo = document.getElementById('gearTipo');
const gearCorpo = document.getElementById('gearCorpo');
const gearObiettivo = document.getElementById('gearObiettivo');
const gearFocale = document.getElementById('gearFocale');
const gearIndexEl = document.getElementById('gearIndex');
const gearTotalEl = document.getElementById('gearTotal');
const prevBtn = document.getElementById('prevGear');
const nextBtn = document.getElementById('nextGear');

function renderGear(){
  const g = GEAR[gearIdx];
  gearTipo.textContent = g.tipo;
  gearCorpo.textContent = g.corpo;
  gearObiettivo.textContent = g.obiettivo;
  gearFocale.textContent = g.focale;
  gearIndexEl.textContent = gearIdx + 1;
  gearTotalEl.textContent = GEAR.length;
  prevBtn.disabled = gearIdx === 0;
  nextBtn.disabled = gearIdx === GEAR.length - 1;
}

prevBtn.addEventListener('click', ()=>{
  if(gearIdx > 0){ gearIdx--; renderGear(); }
});
nextBtn.addEventListener('click', ()=>{
  if(gearIdx < GEAR.length - 1){ gearIdx++; renderGear(); }
});

renderGear();


/* ---------- lightbox — anteprima foto a schermo intero ---------- */
const lightbox = document.getElementById('lightbox');
const lightboxStage = document.getElementById('lightboxStage');
const lightboxPhoto = document.getElementById('lightboxPhoto');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxCtxMenu = document.getElementById('lightboxCtxMenu');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomResetBtn = document.getElementById('zoomReset');
const zoomLevelEl = document.getElementById('zoomLevel');
const lightboxInfo = document.getElementById('lightboxInfo');
const infoList = document.getElementById('infoList');
const zoomInfoBtn = document.getElementById('zoomInfo');
const infoCloseBtn = document.getElementById('infoClose');

const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
let zoomIdx = 2; // 1 = 100%, cioè la foto adattata allo schermo
let panX = 0, panY = 0;
let isDragging = false;
let dragStartX = 0, dragStartY = 0, dragStartPanX = 0, dragStartPanY = 0;

function currentScale(){ return zoomLevels[zoomIdx]; }

// limita il pan in modo che la foto non venga trascinata fuori dalla vista
function clampPan(){
  const stageRect = lightboxStage.getBoundingClientRect();
  const s = currentScale();
  const dispW = lightboxPhoto.offsetWidth * s;
  const dispH = lightboxPhoto.offsetHeight * s;
  const maxX = Math.max(0, (dispW - stageRect.width) / 2);
  const maxY = Math.max(0, (dispH - stageRect.height) / 2);
  panX = Math.min(maxX, Math.max(-maxX, panX));
  panY = Math.min(maxY, Math.max(-maxY, panY));
}

function updateCursor(){
  if(isDragging){ lightboxPhoto.style.cursor = 'grabbing'; }
  else{ lightboxPhoto.style.cursor = currentScale() > 1 ? 'grab' : 'default'; }
}

function applyTransform(){
  lightboxPhoto.style.transform = `translate(${panX}px, ${panY}px) scale(${currentScale()})`;
  updateCursor();
}

function applyZoom(){
  clampPan();
  applyTransform();
  zoomLevelEl.textContent = Math.round(currentScale() * 100) + '%';
  zoomOutBtn.disabled = zoomIdx === 0;
  zoomInBtn.disabled = zoomIdx === zoomLevels.length - 1;
}

function setZoom(idx, resetPan = true){
  zoomIdx = Math.min(zoomLevels.length - 1, Math.max(0, idx));
  if(resetPan){ panX = 0; panY = 0; }
  setInfo(false); // zoomando, il pannello info si chiude
  applyZoom();
}

/* pannello info (stile Drive): mostra solo i dati che esistono davvero per quella foto */
function renderInfo(photo){
  const e = photo.exif || {};
  const rows = [
    ['Fotocamera', e.camera],
    ['Risoluzione', photo.w && photo.h ? `${photo.w} × ${photo.h}` : null],
    ['Tempo di scatto', e.shutter],
    ['Diaframma', e.aperture],
    ['ISO', e.iso && e.iso.replace(/^ISO\s*/i, '')],
    ['Lunghezza focale', e.focal],
    ['Flash', e.flash]
  ];
  infoList.replaceChildren();
  rows.forEach(([label, value])=>{
    if(!value) return;
    const li = document.createElement('li');
    li.appendChild(make('span', '', label));
    li.appendChild(make('span', '', value));
    infoList.appendChild(li);
  });
}

function setInfo(open){
  lightbox.classList.toggle('info-open', open);
  lightboxInfo.setAttribute('aria-hidden', open ? 'false' : 'true');
}

zoomInfoBtn.addEventListener('click', ()=> setInfo(!lightbox.classList.contains('info-open')));
infoCloseBtn.addEventListener('click', ()=> setInfo(false));

function openLightbox(src, alt, photo){
  lightboxImg.src = src;
  lightboxImg.alt = alt || '';
  renderInfo(photo || {});
  hideCtxMenu();
  lightbox.classList.add('active');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  // il contenitore prende l'aspect-ratio reale della foto, così il watermark
  // (posizionato in CSS dentro il contenitore) resta sempre sull'angolo giusto
  function ready(){
    lightboxPhoto.style.aspectRatio = `${lightboxImg.naturalWidth} / ${lightboxImg.naturalHeight}`;
    setZoom(2);
  }
  if(lightboxImg.complete && lightboxImg.naturalWidth){ ready(); }
  else{ lightboxImg.onload = ready; }
}

function closeLightbox(){
  lightbox.classList.remove('active');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  hideCtxMenu();
  setTimeout(()=>{ if(!lightbox.classList.contains('active')) lightboxImg.src = ''; }, 200);
  setInfo(false);
}

// click sul bordo "vuoto" (fuori dalla foto) chiude l'anteprima, come Google Drive
lightbox.addEventListener('click', (e)=>{
  if(e.target === lightbox || e.target === lightboxStage) closeLightbox();
});
lightboxPhoto.addEventListener('click', (e)=> e.stopPropagation());
lightboxClose.addEventListener('click', closeLightbox);

document.addEventListener('keydown', (e)=>{
  if(!lightbox.classList.contains('active')) return;
  if(e.key === 'Escape') closeLightbox();
  if(e.key === 'i' || e.key === 'I') setInfo(!lightbox.classList.contains('info-open'));
});

zoomInBtn.addEventListener('click', ()=>{
  if(zoomIdx < zoomLevels.length - 1) setZoom(zoomIdx + 1, false);
});
zoomOutBtn.addEventListener('click', ()=>{
  if(zoomIdx > 0) setZoom(zoomIdx - 1, false);
});
zoomResetBtn.addEventListener('click', ()=> setZoom(2));

// trascinamento (drag) della foto quando è zoomata
function dragStart(clientX, clientY){
  if(currentScale() <= 1) return;
  isDragging = true;
  dragStartX = clientX; dragStartY = clientY;
  dragStartPanX = panX; dragStartPanY = panY;
  updateCursor();
}
function dragMove(clientX, clientY){
  if(!isDragging) return;
  panX = dragStartPanX + (clientX - dragStartX);
  panY = dragStartPanY + (clientY - dragStartY);
  clampPan();
  applyTransform();
}
function dragEnd(){
  if(!isDragging) return;
  isDragging = false;
  updateCursor();
}

lightboxPhoto.addEventListener('mousedown', (e)=>{ dragStart(e.clientX, e.clientY); e.preventDefault(); });
window.addEventListener('mousemove', (e)=> dragMove(e.clientX, e.clientY));
window.addEventListener('mouseup', dragEnd);

lightboxPhoto.addEventListener('touchstart', (e)=>{
  const t = e.touches[0];
  dragStart(t.clientX, t.clientY);
}, { passive:true });
lightboxPhoto.addEventListener('touchmove', (e)=>{
  if(!isDragging) return;
  const t = e.touches[0];
  dragMove(t.clientX, t.clientY);
  e.preventDefault();
}, { passive:false });
lightboxPhoto.addEventListener('touchend', dragEnd);

window.addEventListener('resize', ()=>{ if(lightbox.classList.contains('active')){ clampPan(); applyTransform(); } });

// menù contestuale custom al posto di quello nativo del browser
function showCtxMenu(x, y){
  lightboxCtxMenu.style.display = 'block';
  lightboxCtxMenu.style.left = x + 'px';
  lightboxCtxMenu.style.top = y + 'px';
  requestAnimationFrame(()=>{
    const r = lightboxCtxMenu.getBoundingClientRect();
    let left = x, top = y;
    if(r.right > window.innerWidth) left -= (r.right - window.innerWidth + 8);
    if(r.bottom > window.innerHeight) top -= (r.bottom - window.innerHeight + 8);
    lightboxCtxMenu.style.left = Math.max(8, left) + 'px';
    lightboxCtxMenu.style.top = Math.max(8, top) + 'px';
  });
}
function hideCtxMenu(){ lightboxCtxMenu.style.display = 'none'; }

lightboxPhoto.addEventListener('contextmenu', (e)=>{
  e.preventDefault();
  showCtxMenu(e.clientX, e.clientY);
});
lightboxCtxMenu.addEventListener('click', (e)=>{
  const action = e.target.dataset.action;
  if(!action) return;
  if(action === 'zoom-max') setZoom(zoomLevels.length - 1, false);
  if(action === 'zoom-reset') setZoom(2);
  if(action === 'close') closeLightbox();
  hideCtxMenu();
  e.stopPropagation();
});
document.addEventListener('click', hideCtxMenu);
document.addEventListener('scroll', hideCtxMenu, true);


/* ---------- galleria generata da photos.js ----------
   photos.js (creato da build-gallery.js) contiene categorie, foto, dimensioni ed EXIF.
   Qui non c'è nessuna foto scritta a mano. */
// Nella griglia le foto in verticale vengono ritagliate in questo formato (es. '1 / 1', '4 / 5').
// La parte visibile si sceglie per foto con "focus" in images/overrides.json: top | center | bottom.
const PORTRAIT_GRID_RATIO = '1 / 1';
const FOCUS_POSITION = { top:'center top', center:'center center', bottom:'center bottom' };

const DATA = window.PHOTOS || { categories:[], photos:[] };
const filtersEl = document.getElementById('filters');
const galleryEl = document.getElementById('galleryGrid');

function make(tag, className, text){
  const node = document.createElement(tag);
  if(className) node.className = className;
  if(text !== undefined) node.textContent = text;
  return node;
}

// codifica ogni segmento del percorso (spazi, accenti, ecc.) senza toccare gli "/"
function urlOf(path){ return path.split('/').map(encodeURIComponent).join('/'); }

function buildShot(photo, categoryLabel){
  const shot = make('div', 'shot reveal');
  shot.dataset.cat = photo.cat || '';

  const frame = make('div', 'shot-frame is-clickable');
  if(photo.w && photo.h){
    const isPortrait = photo.h > photo.w;
    frame.style.aspectRatio = isPortrait ? PORTRAIT_GRID_RATIO : `${photo.w} / ${photo.h}`;
  }

  const img = make('img', 'shot-img');
  img.src = urlOf(photo.src);
  img.alt = photo.alt || photo.title;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.style.objectPosition = FOCUS_POSITION[photo.focus] || FOCUS_POSITION.center;
  frame.appendChild(img);

  if(categoryLabel) frame.appendChild(make('span', 'shot-cat mono', categoryLabel));
  frame.addEventListener('click', ()=> openLightbox(img.src, img.alt, photo));
  shot.appendChild(frame);

  const bar = make('div', 'shot-exif');
  bar.appendChild(make('span', 'title', photo.title));

  // riga 1: tempo · diaframma   riga 2: focale · ISO — mostra solo ciò che esiste nell'EXIF
  const e = photo.exif || {};
  const line1 = [e.shutter, e.aperture].filter(Boolean).join(' · ');
  if(line1 || e.focal || e.iso){
    const data = make('span', 'data mono');
    if(line1) data.appendChild(document.createTextNode(line1));
    if(line1 && (e.focal || e.iso)) data.appendChild(document.createElement('br'));
    if(e.focal) data.appendChild(make('span', 'hi', e.focal));
    if(e.focal && e.iso) data.appendChild(document.createTextNode(' · '));
    if(e.iso) data.appendChild(document.createTextNode(e.iso));
    bar.appendChild(data);
  }
  shot.appendChild(bar);
  return shot;
}

function renderGallery(){
  if(!DATA.photos.length){
    filtersEl.hidden = true;
    galleryEl.appendChild(make('p', 'gallery-empty', 'Nuove foto in arrivo.'));
    return;
  }

  const labels = Object.fromEntries(DATA.categories.map(c => [c.id, c.label]));

  // filtri: "Tutti" + una categoria per ogni sottocartella di images/
  const filters = [{ id:'all', label:'Tutti' }, ...DATA.categories];
  filtersEl.hidden = DATA.categories.length === 0;
  filters.forEach((f, i)=>{
    const btn = make('button', 'filter-btn' + (i === 0 ? ' active' : ''), f.label);
    btn.type = 'button';
    btn.dataset.filter = f.id;
    filtersEl.appendChild(btn);
  });

  const shots = DATA.photos.map(p => buildShot(p, labels[p.cat]));
  shots.forEach(s => galleryEl.appendChild(s));
  observeReveal(shots);

  filtersEl.addEventListener('click', (ev)=>{
    const btn = ev.target.closest('.filter-btn');
    if(!btn) return;
    filtersEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    shots.forEach(shot=>{
      shot.style.display = (filter === 'all' || shot.dataset.cat === filter) ? '' : 'none';
    });
  });
}

renderGallery();
