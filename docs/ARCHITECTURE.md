# Architettura

Descrizione dell'architettura del sistema. Dal luglio 2026 l'architettura multiutente descritta
in origine come "obiettivo" è **realizzata**: questo documento la descrive al presente.

---

## 1. Quadro generale

DDT Migliori è una **PWA statica multiutente** senza build step: i file sorgente vengono serviti
così come sono. Tutta la logica applicativa risiede nel browser; il backend Apps Script gestisce
autenticazione e archivi su Google Drive, il servizio OCR è una funzione serverless separata.

```
┌────────────────────────────────────────────────────┐
│                     BROWSER                        │
│                                                    │
│  index.html (login + app)                          │
│      │                                             │
│  app.js ─── db.js ──┬─ localStorage  (DDT, coda,   │
│      │      │       │                 sessione)    │
│      │      │       └─ IndexedDB     (contatori)   │
│      │      │                                      │
│      │   storage.js ──► Apps Script v2 (HTTPS)     │
│      │                  login·leggi·upsert·delete  │
│      ├──► servizio OCR (HTTPS)                     │
│      │                                             │
│  print.html ── print.css  ──► PDF (stampa)         │
│  sw.js  (cache offline, ddt-cache-vN)              │
└────────────────────────────────────────────────────┘
                     │                    │
                     ▼                    ▼
             OpenAI Vision          Google Drive
              (via /api/ocr)   DDT-Migliori/Archivi/
                                <SERIE>_<COD>_<ANNO>.json
                                + utenti.json
```

---

## 2. Componenti

### 2.1 Frontend

| File | Responsabilità |
| --- | --- |
| `index.html` | Struttura della UI: schermata di login, form di testata, contenitore righe, archivio, modale firma, barra utente. |
| `config.js` | Endpoint dell'applicazione (`backendUrl`, `ocrUrl`). |
| `storage.js` | **Storage Service**: sessione e token, login/logout/cambio PIN, operazioni per documento, coda offline, lettura archivi remoti. |
| `app.js` | Orchestrazione: gestione righe, validazioni, OCR, firma, numerazione, sync, login UI, rendering della lista. |
| `db.js` | Persistenza locale: lettura/scrittura DDT, normalizzazione, contatori progressivi. |
| `styles.css` | Stili UI; su mobile le righe diventano card. |
| `print.html` / `print.css` | Documento di stampa, 12 righe per pagina con paginazione automatica. |

Gli script non usano moduli ES né import: sono caricati in sequenza dall'HTML e condividono lo
scope globale. L'ordine è vincolante: `config.js` → `storage.js` → `db.js` → `app.js`.

### 2.2 Persistenza locale

- **`localStorage`** — `ddtRecords`: i DDT dell'utente; `ddtSession`: token e profilo di
  sessione; `ddtOpsPending`: coda delle operazioni offline; `ddtLastUser`: ultimo codice agente
  (per azzerare i dati locali al cambio di utente); `printDDT`: payload di stampa.
- **IndexedDB**, database `ddt-db` (v1), object store `counters` con `keyPath: 'anno'`:
  ultimo progressivo utilizzato per anno, usato come backup del calcolo della numerazione.

La fonte di verità per la numerazione è comunque la scansione dei DDT esistenti (filtrata per
serie attiva); l'IndexedDB conserva una copia di sicurezza del contatore.

### 2.3 Livello offline

`sw.js` implementa una strategia **cache-first** su un elenco statico di asset
(`index.html`, `config.js`, `storage.js`, `app.js`, `db.js`, `styles.css`, `print.html`,
`print.css`, `manifest.json`). La cache è versionata (`ddt-cache-vN`) e le versioni precedenti
vengono eliminate all'`activate`.

> Ogni modifica alla lista di asset richiede l'incremento della versione della cache.

L'offline applicativo è gestito dallo Storage Service: le scritture senza rete finiscono in una
**coda persistente** e vengono reinviate automaticamente (evento `online`, avvio, prima di ogni
sync). Il login richiede la rete; la sessione, una volta creata, vale anche offline.

### 2.4 Servizi remoti

| Servizio | Endpoint | Ruolo |
| --- | --- | --- |
| OCR | `POST /api/ocr` (funzione serverless) | Estrazione dati da immagine tramite OpenAI Vision. |
| Backend dati | Apps Script v2 Web App (`POST` con `azione`) | Login, autorizzazione, lettura archivi, upsert/delete per documento su Google Drive. |

Contratti dettagliati in [API.md](API.md).

---

## 3. Flussi principali

### 3.0 Accesso

1. Senza sessione, l'app mostra la **schermata di login** (codice agente + PIN).
2. Al primo accesso il PIN iniziale (schema `CODICE1234`) va sostituito obbligatoriamente.
3. Gli utenti abilitati a più serie scelgono la **serie attiva**; il profilo e i mittenti per
   serie arrivano dal backend col login e restano nella sessione.
4. Se sul dispositivo accede un codice diverso dal precedente, i dati locali vengono azzerati e
   riscaricati dagli archivi del nuovo utente.

### 3.1 Creazione di un DDT

1. L'utente compila la testata, oppure lancia l'OCR del documento di scarico che la precompila.
2. Le righe vengono aggiunte manualmente o via OCR etichetta.
3. Alla richiesta di numerazione, `getNextDDTNumber()` calcola il progressivo per **serie attiva
   e anno del documento**, col codice agente della sessione.
4. Al salvataggio, i dati passano da `normalizeDDTStorage()` e vengono scritti in `localStorage`.
   Vengono conservate **tutte** le righe compilate: nessun passaggio applica un limite.
5. Lo Storage Service invia l'**`upsert` del solo documento** all'archivio corrispondente
   (serie del documento + anno della sua data); senza rete l'operazione va in coda.

L'eliminazione segue lo stesso schema con l'operazione `delete`.

### 3.2 Sincronizzazione

`syncDDT()` viene eseguita all'avvio, ogni 5 minuti e all'evento `online`, se esiste una
sessione e non c'è già una sync in corso:

1. **Svuota la coda** delle operazioni in attesa.
2. Legge gli archivi remoti dell'utente: ogni serie abilitata × anno corrente e precedente.
3. A coda vuota **il server è autorevole**: la lista locale viene sostituita, così le
   eliminazioni fatte da altri dispositivi si propagano. Con operazioni ancora in coda — o con
   un remoto inaspettatamente vuoto a fronte di dati locali — si applica il merge conservativo
   di `mergeDDTLists()` (chiave `id`, conflitti risolti su `updatedAt`, firma del destinatario
   sempre preservata).
4. Il risultato viene salvato in locale, i contatori aggiornati e la lista ri-renderizzata.

Non esiste più alcuna scrittura dell'archivio completo: la classe di incidenti "un client
sovrascrive tutto" (accaduto il 22/07/2026 col vecchio contratto) è chiusa per costruzione.

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

## 4. Architettura multiutente

L'evoluzione multiutente (completata a luglio 2026) ha mantenuto invariati l'interfaccia di
compilazione e la persistenza locale. Le modifiche si sono concentrate sul backend e
sull'organizzazione dello storage; sul frontend le aggiunte strutturali sono lo **Storage
Service** e la **schermata di login**.

| Livello | Realizzazione |
| --- | --- |
| Frontend | invariato nella compilazione; aggiunti login e barra utente |
| Persistenza locale | `localStorage` + IndexedDB, invariata; aggiunte sessione e coda |
| Configurazione | endpoint in `config.js`; utenti, serie e mittenti in `utenti.json` sul Drive |
| Accesso al backend | Storage Service (`storage.js`) come livello di astrazione |
| Backend | Apps Script v2 multiarchivio, operazioni per documento, lock sulle scritture |
| Storage | un JSON per serie, agente e anno |
| Accesso | login con codice + PIN, token di sessione, selezione della serie |
| Consultazione | dashboard amministrativa centralizzata (M11, in arrivo) |

La distinzione tra mittenti avviene a livello di archivio, non di numerazione (vedi
[DATA_MODEL.md](DATA_MODEL.md) e [USERS.md](USERS.md)).

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

Lo **Storage Service** (`storage.js`) è il livello di astrazione tra la logica applicativa e il
backend: `app.js` e `db.js` non eseguono `fetch` verso Apps Script, passano da un'unica
interfaccia orientata al documento (`login`, `leggiRemoti`, `upsert`, `remove`, `cambiaPin`,
`flushQueue`).

Cosa incapsula:

- la sessione: token, profilo utente, serie attiva, mittenti per serie;
- il routing delle operazioni: la serie del documento e l'anno della sua data determinano
  l'archivio di destinazione (il codice agente lo mette il server, dal token);
- la **coda offline** e le regole di reinvio;
- il dettaglio del trasporto (URL, formato della richiesta, mappatura degli errori, evento di
  sessione scaduta).

Cosa ne guadagna il progetto:

- il resto del codice non conosce né URL né nomi di file: cambiare backend o convenzione di
  nomenclatura è una modifica interna a un solo componente;
- la dashboard amministrativa potrà riusare la stessa astrazione in sola lettura;
- il comportamento offline resta concentrato in un punto solo, riducendo il rischio di
  regressioni su una delle funzionalità più delicate.

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

- Assenza di test automatici: ogni verifica è manuale (le verifiche di milestone sono state
  eseguite con batterie di chiamate reali, ma non sono ripetibili con un comando).
- `app.js` è un file unico di dimensioni rilevanti, senza separazione in moduli.
- L'autenticazione è applicativa su deployment pubblico, senza rate limiting; il salt dei PIN è
  una costante nello script Apps Script (vedi [API.md](API.md#3-sicurezza--stato-attuale)).
- Il codice del backend Apps Script v2 non è versionato in questo repository: vive solo
  nell'editor di Apps Script. Una copia andrebbe salvata nel repo o in un repo dedicato.
- Un DDT eliminato mentre un altro dispositivo dello **stesso utente** è offline può riapparire
  sul dispositivo offline fino alla sua prima sync a coda vuota (poi il server, autorevole, lo
  rimuove anche lì). Non ci sono tombstone.
- `ROWS_PER_PAGE` è definita in `print.html` e non deriva da una costante condivisa con il resto
  dell'applicazione: un'eventuale modifica del modulo va riportata a mano.
- Il layout di stampa non è verificato automaticamente: il caso multipagina va ricontrollato a
  vista dopo ogni modifica a `print.html` o `print.css`.
