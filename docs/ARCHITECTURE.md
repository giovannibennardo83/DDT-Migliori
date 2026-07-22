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
| `print.html` / `print.css` | Documento di stampa, 12 righe per pagina con paginazione automatica. |

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
   Vengono conservate **tutte** le righe compilate: nessun passaggio applica un limite.
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

`print.html` legge il DDT selezionato e lo impagina in una tabella, con firma mittente (PNG) e
firma destinatario (immagine generata dal canvas) nel footer. Il PDF è prodotto dal motore di
stampa del browser e **non viene archiviato**.

**Regola sul numero di righe.** Il modulo prevede **12 righe per pagina** (`ROWS_PER_PAGE` in
`print.html`):

- fino a 12 righe si stampa **una sola pagina**, con le righe mancanti lasciate vuote per
  rispettare l'aspetto del modulo prestampato;
- oltre le 12 righe il documento prosegue su **più pagine**, ognuna **copia integrale del modulo** —
  intestazione, mittente, cliente, causale, dati paziente e blocco firme sono ripetuti — con
  l'ultima pagina completata a 12 righe.

Il 12 è quindi la capienza di una pagina, non del documento: **nessuna riga può essere omessa** da
un documento di trasporto. La stessa regola vale per il **salvataggio**, che non impone alcun
limite (§3.1) e conserva integralmente quanto compilato.

Implementazione: le pagine sono generate clonando un `<template>` e riempite per `data-field`;
`print.css` applica `page-break-after: always` a ogni `.sheet` tranne l'ultima, così da non
produrre una pagina bianca finale. Il riquadro **"Pagina X di Y"** compare solo quando le pagine
sono più di una: sul caso a pagina singola l'output resta identico al modulo storico.

---

## 4. Architettura obiettivo

L'evoluzione multiutente mantiene invariati l'interfaccia e la persistenza locale. Le modifiche si
concentrano sul backend e sull'organizzazione dello storage; sul frontend l'unica aggiunta
strutturale è lo **Storage Service**, che isola il resto del codice da entrambi.

| Livello | Oggi | Obiettivo |
| --- | --- | --- |
| Frontend | invariato | invariato |
| Persistenza locale | `localStorage` + IndexedDB | invariata |
| Configurazione | costanti in testa a `app.js` | `config.js` con serie, mittenti e archivi |
| Accesso al backend | `fetch` diretto da `app.js` | Storage Service come livello di astrazione |
| Backend | Apps Script a singolo archivio | Apps Script multiarchivio con routing |
| Storage | un JSON complessivo | un JSON per serie, agente e anno |
| Accesso | nessuna autenticazione | login utente + selezione della serie |
| Consultazione | locale al dispositivo | dashboard amministrativa centralizzata |

Ogni archivio manterrà: progressivo, documenti e metadata. La distinzione tra mittenti avviene a
livello di archivio, non di numerazione (vedi [DATA_MODEL.md](DATA_MODEL.md) e [USERS.md](USERS.md)).

### 4.1 Catena dei livelli

```
Browser
   ↓
Storage Service
   ↓
Apps Script
   ↓
Google Drive
   ↓
Archivio JSON
   ↓
Dashboard amministrativa
```

Ogni livello conosce solo quello immediatamente successivo. La dashboard amministrativa si colloca
in fondo alla catena perché **legge gli archivi** prodotti dal flusso operativo: è un consumatore
in sola lettura, non un'applicazione parallela che scrive sugli stessi dati.

### 4.2 Storage Service

Lo **Storage Service** è il livello di astrazione tra la logica applicativa e il backend. Oggi
`app.js` chiama `fetch` direttamente verso l'URL di Apps Script; nel modello obiettivo passa da
un'unica interfaccia orientata all'archivio, del tipo *leggi l'archivio X*, *scrivi il documento Y
sull'archivio X*, *ottieni il prossimo progressivo dell'archivio X*.

Cosa incapsula:

- la risoluzione **serie + agente + anno → nome archivio**;
- la scelta tra copia locale e copia remota, e la strategia offline;
- il merge tra dati locali e remoti;
- il dettaglio del trasporto (URL, formato della richiesta, gestione degli errori).

Cosa ne guadagna il progetto:

- il resto di `app.js` non conosce né URL né nomi di file: cambiare backend o convenzione di
  nomenclatura non tocca la logica di compilazione del DDT;
- il passaggio da archivio unico a multiarchivio diventa una modifica **interna a un solo
  componente**, invece che diffusa nel codice;
- la dashboard amministrativa può riusare la stessa astrazione in sola lettura;
- il comportamento offline resta concentrato in un punto solo, riducendo il rischio di regressioni
  su una delle funzionalità più delicate.

È il motivo per cui lo Storage Service (M05) precede il backend multiarchivio (M07) nella
[roadmap](../ROADMAP.md): introdurre prima l'astrazione rende le milestone successive trasparenti
al frontend.

### 4.3 Crescita da pochi utenti a decine di agenti

L'architettura scala senza modifiche sostanziali perché il carico non è condiviso:

- **Il lavoro è partizionato per archivio.** Un agente legge e scrive solo i propri archivi: il
  volume trattato dal suo dispositivo non dipende dal numero di colleghi.
- **Non esiste stato globale da coordinare.** I progressivi sono locali all'archivio, quindi non
  serve un contatore centrale né un meccanismo di lock distribuito.
- **La concorrenza in scrittura è quasi assente.** Agenti diversi scrivono file diversi; i
  conflitti restano confinati al caso di un singolo utente su più dispositivi.
- **L'aggiunta di un utente è configurazione.** Nuovi archivi nascono alla prima emissione, senza
  interventi sul codice (vedi [USERS.md](USERS.md#6-aggiungere-un-nuovo-utente)).
- **La crescita è lineare e prevedibile.** Il numero di archivi cresce con utenti × serie × anni,
  ma nessun componente deve caricarli tutti insieme.

Il limite pratico non è quindi il numero di agenti, ma la dimensione del singolo archivio, che
dipende dai documenti di un solo agente in un solo anno. Se un giorno diventasse un problema, la
risposta naturale sarebbe una partizione più fine (per esempio per semestre), senza cambiare
l'architettura.

---

## 5. Vincoli e debiti tecnici noti

- Assenza di test automatici: ogni verifica è manuale.
- `app.js` è un file unico di dimensioni rilevanti, senza separazione in moduli.
- URL di produzione hard-coded nel frontend: centralizzati in costanti in testa a `app.js` (M01),
  ma non ancora estratti in un `config.js` separato.
- `app.js` chiama `fetch` direttamente: manca il livello di astrazione previsto da M05.
- Nessuna autenticazione: l'endpoint di backup è raggiungibile da chiunque conosca l'URL.
- `ROWS_PER_PAGE` è definita in `print.html` e non deriva da una costante condivisa con il resto
  dell'applicazione: un'eventuale modifica del modulo va riportata a mano.
- Il layout di stampa non è verificato automaticamente: il caso multipagina va ricontrollato a
  vista dopo ogni modifica a `print.html` o `print.css`.
