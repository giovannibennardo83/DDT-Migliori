# Roadmap

Piano di evoluzione di DDT Migliori da applicazione personale a piattaforma multiutente.

---

## Visione

Trasformare l'attuale applicazione DDT a uso singolo in una piattaforma destinata a una
microimpresa composta da una **ventina di agenti commerciali** e da un **ufficio amministrativo
centrale**, mantenendo piena compatibilità con il progetto esistente.

Il dimensionamento è indicativo: l'architettura è pensata per non dover cambiare al variare del
numero di utenti. La configurazione aziendale reale è documentata in [docs/USERS.md](docs/USERS.md).

---

## Principi guida

- Non riscrivere codice funzionante.
- Preferire piccoli refactoring incrementali.
- Ogni modifica deve essere facilmente testabile.
- Ogni milestone deve lasciare l'applicazione funzionante.
- Il frontend deve cambiare il meno possibile.
- La logica esistente di compilazione DDT va preservata.
- OCR, firma, stampa PDF e funzionamento offline non devono essere alterati.

---

## Direzione architetturale

| Ambito | Oggi | Obiettivo |
| --- | --- | --- |
| Frontend | HTML / CSS / JS vanilla | invariato |
| Persistenza locale | `localStorage` + IndexedDB | invariata |
| Accesso al backend | `fetch` diretto da `app.js` | Storage Service come livello di astrazione |
| Backend | Google Apps Script | Apps Script evoluto, multiarchivio |
| Storage | Google Drive | Google Drive |
| Archivi | archivio JSON unico | un archivio JSON per serie, agente e anno |
| Consultazione | solo device dell'agente | dashboard amministrativa centralizzata |

Dettagli in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Milestone

Legenda stato: ☐ da fare · ◐ in corso · ☑ completata

### ☑ M01 — Centralizzazione configurazione backend
Endpoint remoti raccolti in costanti dedicate (`BACKUP_URL`, `OCR_URL`) in testa a `app.js`,
al posto degli URL ripetuti nei punti di chiamata. Resta come passo successivo, non bloccante,
l'estrazione delle costanti in un `config.js` separato: sarà affrontata insieme a M05, quando
la configurazione dovrà includere anche serie, mittenti e archivi.

### ☑ M02 — Riorganizzazione documentazione
Struttura documentale completa: `README.md`, `CLAUDE.md`, `ROADMAP.md`, `CHANGELOG.md` e la
cartella `docs/` con architettura, modello dati, contratti API e modello utenti. La documentazione
descrive sia lo stato attuale sia l'architettura obiettivo, così da accompagnare le milestone
successive senza dover essere riscritta.

### ☐ M03 — Nuovo Apps Script di test
Ambiente backend separato da quello di produzione per sperimentare senza rischi.

### ☐ M04 — Nuovo Google Drive
Spazio di storage dedicato al nuovo modello ad archivi separati.

### ☐ M05 — Storage Service
Livello di astrazione lato frontend tra la logica applicativa e il backend: `app.js` smette di
chiamare `fetch` direttamente e passa da un'interfaccia unica orientata all'archivio. È il
prerequisito che rende trasparenti al frontend tutte le milestone successive.

### ☐ M06 — Archivi JSON separati
Un file JSON per ogni combinazione serie + agente + anno, secondo lo standard
`<SERIE>_<CODICEAGENTE>_<ANNO>.json` (es. `MS_GBE_2027.json`, `PM_MRU_2027.json`).

### ☐ M07 — Backend multiarchivio
Apps Script capace di leggere e scrivere su più archivi, con routing per serie, agente e anno,
mantenendo la compatibilità con gli endpoint attuali.

### ☐ M08 — Login utenti
Autenticazione degli agenti e associazione utente → archivi accessibili.

### ☐ M09 — Gestione serie documentali e mittenti
Selezione della serie attiva per gli utenti abilitati a più di una; il mittente stampato deriva
dalla serie e non è più una costante applicativa.

### ☐ M10 — Numerazione per archivio
Progressivi calcolati indipendentemente su ciascun archivio, formato `<AA><PPP><CODICEAGENTE>`
(es. `27001GBE`).

### ☐ M11 — Dashboard amministrativa
Consultazione centralizzata in sola lettura: ricerca per cliente e per agente, ristampa PDF,
export dati.

### ☐ M12 — Ottimizzazione e rilascio
Consolidamento, verifica delle prestazioni e messa in produzione.

---

## Fuori ambito (per ora)

- Riscrittura del frontend con un framework.
- Archiviazione dei PDF generati (restano prodotti dinamicamente).
- Integrazioni con gestionali esterni.

---

## Filosofia

Questa applicazione è già stabile. L'obiettivo non è riscriverla, ma trasformarla gradualmente in
un prodotto professionale mantenendo il comportamento esistente e riducendo al minimo il rischio
di regressioni.

Criterio di verifica trasversale a tutte le milestone: **aggiungere un agente, una serie o un anno
deve essere un'operazione di configurazione, non una modifica architetturale.** Se una milestone
non soddisfa questo criterio, va riprogettata.
