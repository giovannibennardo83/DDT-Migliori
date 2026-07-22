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
- La stampa è tarata su un modulo a **15 righe fisse**: modifiche a `print.html` / `print.css`
  vanno verificate visivamente sulla stampa reale.

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
