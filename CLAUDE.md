# CLAUDE.md

Istruzioni per Claude Code (e altri assistenti AI) che lavorano su questo repository.

---

## Contesto del progetto

DDT Migliori è una PWA statica (HTML + CSS + JavaScript vanilla, senza framework né build step)
per la gestione di Documenti di Trasporto nel settore dei dispositivi medici.

**L'applicazione è già stabile e in uso reale.** L'obiettivo non è riscriverla, ma evolverla
gradualmente riducendo al minimo il rischio di regressioni.

---

## Regole di sviluppo

Da rispettare in ogni intervento:

- **Non riscrivere codice funzionante.** Preferire refactoring incrementali e circoscritti.
- **Non introdurre framework, bundler o dipendenze frontend.** Il codice resta JS vanilla.
- **Il frontend deve cambiare il meno possibile.** Modifiche invasive alla UI vanno concordate.
- **Non alterare** le funzionalità critiche già collaudate:
  - OCR (etichetta e documento di scarico)
  - firma destinatario e firma mittente
  - layout e resa della stampa PDF
  - funzionamento offline (Service Worker)
- Ogni modifica deve essere **semplice, reversibile, documentata e testabile**.
- Ogni milestone deve lasciare l'applicazione **funzionante**.

---

## Decisioni architetturali consolidate

Scelte già prese e non più in discussione. Valgono come regole permanenti del progetto: non vanno
rimesse in dubbio a ogni intervento, e una proposta che le contraddice va segnalata come tale.

### Documento e formati

- **Il JSON è il documento ufficiale.** È la fonte di verità del DDT; tutto il resto ne è una
  rappresentazione.
- **I PDF non vengono archiviati.**
- **I PDF vengono sempre generati dinamicamente** a partire dal JSON, al momento della stampa o
  della ristampa.
- **La firma del destinatario viene salvata in Base64** all'interno del documento JSON, come data
  URL PNG, non come file esterno.
- **Il numero di righe di un DDT non ha limite superiore.** La regola vale identica in
  **salvataggio** e in **stampa**: il modulo prevede 12 righe per pagina, ma un documento più lungo
  va salvato e stampato per intero, proseguendo su più pagine. Il 12 è la capienza di una pagina,
  non del documento. Nessun componente può troncare, scartare o ignorare righe.

### Archivi e identità del documento

- **Ogni serie documentale possiede un archivio JSON indipendente**, nominato secondo lo standard
  `<SERIE>_<CODICEAGENTE>_<ANNO>.json`.
- **Numerazioni uguali appartenenti a mittenti diversi sono corrette** e non costituiscono un
  errore da correggere.
- **L'univocità è garantita dall'archivio JSON e non dal numero DDT.** L'identità completa di un
  documento è `archivio + numero DDT`.
- **Il mittente non compare nella numerazione**: deriva dalla serie documentale.

### Frontend e processo

- **Il frontend rimane HTML + CSS + JavaScript vanilla**, senza framework, bundler o build step.
- **Evitare qualsiasi riscrittura completa dell'applicazione.**
- **Privilegiare sempre piccoli refactoring incrementali**, verificabili uno alla volta.
- **L'applicazione deve restare utilizzabile offline**: la connettività è un'ottimizzazione, non
  un prerequisito operativo.

### Scala e ruoli

- **Il progetto è dimensionato su una ventina di agenti ma deve poter crescere senza modifiche
  architetturali.** Aggiungere un utente, una serie o un anno è configurazione, non sviluppo.
- **La dashboard amministrativa consulta gli archivi senza modificarli**: è un consumatore in sola
  lettura.

---

## Vincoli tecnici

- Nessun processo di build: i file sorgente sono serviti così come sono.
- `package.json` copre solo l'endpoint OCR serverless (`api/ocr.js`), non il frontend.
- Il salvataggio locale usa `localStorage` (chiave `ddtRecords`); i contatori usano IndexedDB
  (database `ddt-db`, store `counters`).
- Ogni DDT passa da `normalizeDDTStorage()` in `db.js` in lettura e scrittura: **qualsiasi nuovo
  campo persistito va aggiunto lì**, altrimenti viene silenziosamente perso.
- Il Service Worker (`sw.js`) usa una cache con nome versionato (`ddt-cache-vN`).
  Se cambiano gli asset in cache, **incrementare la versione**, altrimenti gli utenti resteranno
  su file vecchi.
- La stampa è tarata su un modulo da **12 righe per pagina** (`ROWS_PER_PAGE` in `print.html`).
  Fino a 12 righe si stampa una pagina sola, completata con righe vuote; oltre le 12 il documento
  prosegue su più pagine, **ciascuna copia integrale del modulo** (intestazione, mittente, cliente,
  causale, dati paziente e firme ripetuti), con l'ultima pagina completata a 12 righe.
  Il riquadro "Pagina X di Y" compare **solo** sui documenti multipagina, così la stampa a pagina
  singola resta identica al modulo storico.
  Il salvataggio non impone alcun limite (`extractAndValidateRighe()` in `app.js`,
  `normalizeDDTStorage()` in `db.js`): non introdurne.
  Modifiche a `print.html` / `print.css` vanno verificate visivamente sulla stampa reale, sia sul
  caso a pagina singola (≤ 12 righe) sia sul caso multipagina (> 12), controllando che non compaia
  una pagina bianca finale.

---

## Convenzioni di codice

- Lingua dell'interfaccia e dei nomi di dominio: **italiano** (`righe`, `lotto`, `quantita`,
  `causale_trasporto`, `iniziali_paziente`).
- Nomi di funzioni e variabili tecniche: inglese o italiano coerentemente con il file circostante.
- Indentazione a 2 spazi, punto e virgola espliciti, virgolette singole in `app.js` / `db.js`.
- Nessun commento superfluo: commentare solo il "perché", non il "cosa".

---

## Workflow

- Lavorare su branch dedicati; il branch principale è `main`.
- **Non eseguire commit o push senza richiesta esplicita** dell'utente.
- Descrivere sempre cosa è stato modificato e cosa va verificato manualmente.
- Non esistono test automatici: la verifica è manuale (compilazione, salvataggio, stampa, OCR).

---

## Dati sensibili

- Il repository contiene URL di endpoint di produzione (Apps Script, servizio OCR).
  Non pubblicarli in contesti esterni e non introdurre nuovi segreti nel codice frontend.
- Le chiavi API (es. `OPENAI_API_KEY`) vivono **solo** come variabili d'ambiente lato server.
- I DDT contengono dati sanitari indiretti (iniziali paziente, cartella clinica):
  trattarli con la dovuta riservatezza e non inserirli in esempi o log.

---

## Riferimenti

- [ROADMAP.md](ROADMAP.md) — direzione del progetto e milestone.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — come è fatto il sistema.
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — struttura dei dati persistiti.
- [docs/API.md](docs/API.md) — contratti degli endpoint remoti.
- [docs/USERS.md](docs/USERS.md) — utenti e ruoli previsti.
