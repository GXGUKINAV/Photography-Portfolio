# attyl.photography — Portfolio

Portfolio fotografico di **attyl.photography** (Instagram: [@attyl.photography](https://www.instagram.com/attyl.photography/)), attivo dal 2023.

Sito: https://gxgukinav.github.io/Photography-Portfolio/

HTML, CSS e JavaScript puri, nessun framework. L'unica cosa "automatica" è uno script Node (senza dipendenze) che legge le cartelle delle foto.

---

## Com'è fatto

```
index.html          struttura e testi della pagina
style.css           stile, colori, tema chiaro/scuro
script.js           tema, attrezzatura, lightbox, galleria
photos.js           GENERATO: categorie, dimensioni ed EXIF delle foto
build-gallery.js    genera photos.js leggendo le cartelle
images/
  Landscape/        ← una sottocartella = una categoria
  Portraits/
  Motorsport/
  overrides.json    (facoltativo) titolo, EXIF e ritaglio per singola foto
```

`photos.js` non si modifica a mano: lo riscrive `build-gallery.js` ogni volta.

---

## Aggiungere foto (la cosa che farai più spesso)

1. Metti il file in `images/<Categoria>/`, ad esempio `images/Landscape/tramonto.jpg`.
2. Da terminale, nella cartella del progetto: `node build-gallery.js`
3. Controlla il riepilogo che stampa, poi **commit e push** di `images/` **e di `photos.js`** (senza `photos.js` aggiornato online non vedi niente di nuovo).

Cosa succede da solo:

- **Categorie:** ogni sottocartella diventa un filtro. Il nome della cartella è l'etichetta (`Motorsport` → MOTORSPORT). Una nuova cartella crea un nuovo filtro, non devi toccare l'HTML.
- **Titolo:** viene dal nome del file (`pilatus-kulm.jpg` → "Pilatus Kulm").
- **EXIF:** tempo, diaframma, focale e ISO sono letti dal file. Sugli smartphone la focale mostrata è l'equivalente 35mm, sulle fotocamere quella reale. Se un dato manca nel file, semplicemente non appare.
- **Dimensioni:** lette dal file (anche per le foto scattate in verticale).
- **Ordine:** dalla più recente alla meno recente, secondo la data di scatto nell'EXIF.

Cose da sapere:

- Formati: JPG/JPEG (consigliato, ha l'EXIF), PNG e WebP (niente EXIF).
- Le cartelle che iniziano con `_` o `.` vengono ignorate (es. `images/_originali/`).
- Una foto messa direttamente in `images/`, fuori da una sottocartella, compare solo sotto "Tutti". Lo script te lo segnala.

---

## Personalizzare una singola foto: `images/overrides.json`

Serve solo quando il valore automatico non va bene. La chiave è il percorso della foto dentro `images/` (maiuscole e minuscole non contano).

```json
{
  "Landscape/IMG_9635.jpeg": {
    "title": "Dragon Ride del Pilatus Kulm",
    "focus": "top"
  }
}
```

| Campo | Cosa fa |
|---|---|
| `title` | Titolo mostrato sulla card (al posto di quello preso dal nome del file) |
| `alt` | Testo alternativo per accessibilità (default: il titolo) |
| `focus` | Quale parte di una foto **verticale** si vede nel riquadro della griglia: `top`, `center` o `bottom` (default `center`) |
| `exif` | Sostituisce singoli valori, es. `{ "focal": "35mm", "iso": "ISO 200" }` |

I campi di `exif` sono `shutter` (`"1/250s"`), `aperture` (`"f/2.8"`), `focal` (`"35mm"`) e `iso` (`"ISO 200"`). Sono testo libero, scrivili esattamente come vuoi vederli.

Dopo ogni modifica a `overrides.json` rilancia `node build-gallery.js`. Se scrivi un `focus` non valido lo script ti avvisa e lo ignora.

---

## "Voglio fare X" → "faccio Y"

| Voglio… | Faccio così |
|---|---|
| Aggiungere una foto | La metto in `images/<Categoria>/` → `node build-gallery.js` → commit + push |
| Creare una nuova categoria (es. Ritratti) | Creo la cartella `images/Ritratti/` e ci metto le foto → `node build-gallery.js` |
| Cambiare il titolo di una foto | `title` in `images/overrides.json` → `node build-gallery.js` |
| Far vedere più la parte **alta** o **bassa** di una foto verticale nella griglia | `"focus": "top"` o `"focus": "bottom"` in `images/overrides.json` → `node build-gallery.js` |
| Cambiare la forma del riquadro delle foto verticali (ora quadrato) | In `script.js`, costante `PORTRAIT_GRID_RATIO`: `'1 / 1'` è quadrato, `'4 / 5'` è meno tagliato. Non serve rilanciare lo script |
| Correggere un EXIF sbagliato | `exif` in `images/overrides.json` → `node build-gallery.js` |
| Nascondere una foto senza cancellarla | La sposto in una cartella che inizia con `_` (es. `images/_nascoste/`) → `node build-gallery.js` |
| Cambiare nome a una categoria | Rinomino la cartella → `node build-gallery.js` |
| Aggiornare la mia attrezzatura | Array `GEAR` in cima a `script.js` |
| Cambiare la bio | Paragrafo dentro `<section id="about">` in `index.html` |
| Cambiare il titolone o il sottotitolo in alto | Sezione `.hero` in `index.html` |
| Mettere la mia email vera | In `index.html` sostituisco `tuonome@email.com` (compare due volte: bottone "Scrivimi" e footer) |
| Cambiare i link social | Footer di `index.html` |
| Cambiare il watermark sulla foto ingrandita | `<span class="lightbox-watermark">` in `index.html` |
| Cambiare i colori | Variabili in cima a `style.css`, nel blocco `:root` (ogni colore ha il valore chiaro e quello scuro: `light-dark(chiaro, scuro)`) |

---

## Tema chiaro / scuro

- Di default il sito segue il dispositivo: tema chiaro → sfondo bianco, superfici crema, testo grigio; tema scuro → nero con accenti rossi.
- Il pulsante sole/luna in alto a destra forza una scelta, che il browser ricorda. Finché non lo usi, il sito continua a seguire il sistema.
- Il tema usa `light-dark()` nel CSS, che richiede Safari 17.5 o più recente (gli altri browser moderni vanno bene).

---

## Provare il sito in locale

- Basta aprire `index.html` (anche con doppio clic, o con Live Server). Funziona perché la galleria legge `photos.js` come script normale e non con `fetch`.
- Se aggiungi foto e non le vedi: hai rilanciato `node build-gallery.js`?

## Pubblicazione (GitHub Pages)

Push su GitHub e il sito si aggiorna da solo. Ricorda di includere sempre `photos.js` e la cartella `images/`.

**Attenzione alle maiuscole.** Windows non distingue `foto.JPG` da `foto.jpg`, GitHub Pages sì. Se una foto si vede in locale ma non online, controlla che il nome del file nel repo sia identico a quello nello script. Se Git non ha registrato un rinomino che cambia solo le maiuscole, forzalo in due passaggi:

```
git mv images/Landscape/foto.JPG images/Landscape/tmp.jpg
git mv images/Landscape/tmp.jpg images/Landscape/foto.jpg
```

Per evitare il problema, usa sempre estensioni minuscole (`.jpg`).
