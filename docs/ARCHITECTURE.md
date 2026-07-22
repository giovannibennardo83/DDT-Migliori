# Architettura

Descrizione dell'architettura attuale del sistema e della direzione verso l'architettura obiettivo.

---

## 1. Quadro generale

DDT Migliori è una **PWA statica** senza build step: i file sorgente vengono serviti così come
sono. Tutta la logica applicativa risiede nel browser; il backend è un servizio minimale usato
per il backup dei dati e per l'OCR.

```
┌──────────────────────────────────────────────┐
│                  BROWSER                     │
│                                              │
│  index.html ── app.js ── db.js               │
│      │           │         │                 │
│      │           │         ├─ localStorage   │  (DDT)
│      │           │         └─ IndexedDB      │  (contatori)
│      │           │                           │
│      │           ├──► servizio OCR (HTTPS)   │
│      │           └──► Google Apps Script     │
│      │                                       │
│  print.html ── print.css  ──► PDF (stampa)   │
│                                              │
│  sw.js  (cache offline)                      │
└──────────────────────────────────────────────┘
                     │              │
                     ▼              ▼
             OpenAI Vision    Google Drive
              (via /api/ocr)   (archivio JSON)
```

---

## 2. Componenti

### 2.1 Frontend

| File | Responsabilità |
| --- | --- |
| `index.html` | Struttura della UI: form di testata, contenitore righe, archivio, modale firma. |
| `app.js` | Orchestrazione completa: gestione righe, validazioni, OCR, firma, numerazione, backup, sync, rendering della lista. |
| `db.js` | Livello di persistenza: lettura/scrittura DDT, normalizzazione, contatori progressivi. |
| `styles.css` | Stili UI; su mobile le righe diventano card. |
| `print.html` / `print.css` | Documento di stampa, tabella a 15 righe fisse. |

`app.js` è un modulo unico organizzato per aree funzionali (firma, righe, OCR, backup/sync,
rendering). Non usa moduli ES né import: gli script sono caricati in sequenza dall'HTML e
condividono lo scope globale — `db.js` va caricato **prima** di `app.js`.

### 2.2 Persistenza locale

- **`localStorage`**, chiave `ddtRecords`: array JSON di tutti i DDT.
- **IndexedDB**, database `ddt-db` (v1), object store `counters` con `keyPath: 'anno'`:
  ultimo progressivo utilizzato per anno, usato come backup del calcolo della numerazione.

La fonte di verità per la numerazione è comunque la scansione dei DDT esistenti; l'IndexedDB
conserva una copia di sicurezza del contatore.

### 2.3 Livello offline

`sw.js` implementa una strategia **cache-first** su un elenco statico di asset
(`index.html`, `app.js`, `db.js`, `styles.css`, `print.html`, `print.css`, `manifest.json`).
La cache è versionata (`ddt-cache-vN`) e le versioni precedenti vengono eliminate all'`activate`.

> Ogni modifica alla lista di asset richiede l'incremento della versione della cache.

### 2.4 Servizi remoti

| Servizio | Endpoint | Ruolo |
| --- | --- | --- |
| OCR | `POST /api/ocr` (funzione serverless) | Estrazione dati da immagine tramite OpenAI Vision. |
| Backup / Sync | Google Apps Script Web App | Lettura e scrittura dell'archivio JSON su Google Drive. |

Contratti dettagliati in [API.md](API.md).

---

## 3. Flussi principali

### 3.1 Creazione di un DDT

1. L'utente compila la testata, oppure lancia l'OCR del documento di scarico che la precompila.
2. Le righe vengono aggiunte manualmente o via OCR etichetta.
3. Alla richiesta di numerazione, `getNextDDTNumber()` calcola il progressivo dell'anno.
4. Al salvataggio, i dati passano da `normalizeDDTStorage()` e vengono scritti in `localStorage`.
5. Viene avviato in background il backup verso Apps Script.

### 3.2 Sincronizzazione

`syncDDT()` viene eseguita quando il dispositivo è online e non c'è già una sync in corso:

1. Legge i DDT locali e scarica l'archivio remoto.
2. `mergeDDTLists()` unisce le due liste con chiave `id` (fallback `numero`), risolvendo i
   conflitti in base a `updatedAt` e preservando sempre la firma del destinatario più recente.
3. Il risultato viene salvato in locale, i contatori aggiornati e la lista ri-renderizzata.

Il backup applica inoltre una **safety check**: se l'archivio remoto risulta più recente di
quello locale, la scrittura viene annullata per non sovrascrivere dati altrui.

### 3.3 Stampa

`print.html` legge il DDT selezionato e lo impagina in una tabella a 15 righe fisse, con firma
mittente (PNG) e firma destinatario (immagine generata dal canvas) nel footer. Il PDF è prodotto
dal motore di stampa del browser e **non viene archiviato**.

---

## 4. Architettura obiettivo

L'evoluzione multiutente mantiene invariati frontend e persistenza locale, e concentra le
modifiche sul backend e sull'organizzazione dello storage.

| Livello | Oggi | Obiettivo |
| --- | --- | --- |
| Frontend | invariato | invariato |
| Persistenza locale | `localStorage` + IndexedDB | invariata |
| Configurazione | costanti sparse in `app.js` | `config.js` centralizzato |
| Backend | Apps Script a singolo archivio | Apps Script multiarchivio con routing |
| Storage | un JSON complessivo | un JSON per serie documentale |
| Accesso | nessuna autenticazione | login utente + selezione mittente |
| Consultazione | locale al dispositivo | dashboard amministrativa centralizzata |

Ogni archivio manterrà: progressivo, documenti e metadata. La distinzione tra mittenti avviene a
livello di archivio, non di numerazione (vedi [DATA_MODEL.md](DATA_MODEL.md) e [USERS.md](USERS.md)).

---

## 5. Vincoli e debiti tecnici noti

- Assenza di test automatici: ogni verifica è manuale.
- `app.js` è un file unico di dimensioni rilevanti, senza separazione in moduli.
- URL di produzione hard-coded nel frontend (risolto da M01 della roadmap).
- Nessuna autenticazione: l'endpoint di backup è raggiungibile da chiunque conosca l'URL.
- Il layout di stampa dipende da un modulo fisico a 15 righe: non è adattivo.
