# Roadmap

Piano di evoluzione di DDT Migliori da applicazione personale a piattaforma multiutente.

---

## Visione

Trasformare l'applicazione DDT a uso singolo in una piattaforma destinata a una microimpresa
composta da una **ventina di agenti commerciali** e da un **ufficio amministrativo centrale**.

**Stato (luglio 2026): la trasformazione multiutente è realizzata** — login, archivi separati,
operazioni per documento, coda offline. Restano la dashboard amministrativa (M11) e la
pubblicazione (M12).

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

| Ambito | Stato raggiunto (07/2026) |
| --- | --- |
| Frontend | HTML / CSS / JS vanilla, invariato ✅ |
| Persistenza locale | `localStorage` + IndexedDB, invariata ✅ |
| Accesso al backend | Storage Service (`storage.js`) come livello di astrazione ✅ |
| Backend | Apps Script v3.1: un file per DDT, sync incrementale, login a PIN, firme ✅ |
| Storage | Google Drive dedicato (`DDT-Migliori/Archivio/<Agente>/<Serie>/<Anno>/`) ✅ |
| Archivi | un file JSON per documento ✅ |
| Consultazione | dashboard amministrativa centralizzata ⏳ (M11) |

Dettagli in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Milestone

Legenda stato: ☐ da fare · ◐ in corso · ☑ completata

### ☑ M01 — Centralizzazione configurazione backend
Endpoint remoti prima raccolti in costanti in testa a `app.js`, poi estratti nel `config.js`
dedicato (con M05). Serie, mittenti e utenti sono invece configurazione **lato backend**
(`utenti.json` su Drive), scelta maturata con il login: modificarli non richiede deploy del
frontend.

### ☑ M02 — Riorganizzazione documentazione
Struttura documentale completa: `README.md`, `CLAUDE.md`, `ROADMAP.md`, `CHANGELOG.md` e la
cartella `docs/` con architettura, modello dati, contratti API e modello utenti. La documentazione
descrive sia lo stato attuale sia l'architettura obiettivo, così da accompagnare le milestone
successive senza dover essere riscritta.

### ☑ M03 — Nuovo backend Apps Script
Nuovo Apps Script nel Google account del progetto, con Drive dedicato. Deviazione rispetto al
piano originale (che prevedeva un ambiente di test separato): la produzione è stata **duplicata**
dall'utente, quindi il repository corrente è a tutti gli effetti l'ambiente di evoluzione e il
nuovo backend vi è andato direttamente. Lo storico (60 DDT) è stato migrato e verificato.

### ☑ M04 — Nuovo Google Drive
Struttura dedicata `DDT-Migliori/Archivi/` nel Drive del progetto, con `utenti.json` in radice.

### ☑ M05 — Storage Service
`storage.js`: unico punto di contatto col backend. Sessione con token, operazioni per documento,
coda offline con invio automatico al ritorno della rete. `app.js` non esegue più `fetch` diretti
verso il backend dati.

### ☑ M06 — Archivi JSON separati
Un file per ogni combinazione serie + agente + anno, standard
`<SERIE>_<CODICEAGENTE>_<ANNO>.json`, creato alla prima scrittura. *(Organizzazione poi superata
dall'evoluzione E1: un file per documento.)*

### ☑ M07 — Backend multiarchivio a operazioni per documento
Deviazione migliorativa rispetto al piano: oltre al routing per serie/agente/anno, il contratto è
passato dalla sovrascrittura integrale dell'archivio alle operazioni sul singolo documento
(`upsert` / `delete`), con lock sulle scritture. La compatibilità col vecchio contratto **non** è
stata mantenuta: non essendoci utenti in produzione sul nuovo backend, non serviva. Questo chiude
per costruzione l'incidente di svuotamento del 22/07/2026.

### ☑ M08 — Login utenti
Autenticazione con codice agente + PIN (hash lato server, sessioni a token con scadenza a
scorrimento di 30 giorni). PIN iniziali a schema `CODICE1234` con **cambio obbligatorio al primo
accesso**; cambio PIN autonomo dalla barra utente; reset da amministratore via editor Apps Script.
Al cambio di utente sul dispositivo i dati locali del precedente vengono azzerati.

### ☑ M09 — Gestione serie documentali e mittenti
Serie e mittenti configurati in `utenti.json` sul Drive. Gli utenti abilitati a più serie
scelgono quella attiva al login e possono cambiarla dalla barra; il mittente stampato deriva
dalla serie del documento.

### ☑ M10 — Numerazione per archivio
Progressivi calcolati per serie attiva e anno del documento, formato `<AA><PPP><CODICEAGENTE>`;
il codice agente arriva dalla sessione.

### ☐ M11 — Dashboard amministrativa
Consultazione centralizzata in sola lettura con l'utenza `ADMIN` (già prevista dal backend):
ricerca per cliente e per agente, ristampa PDF dal JSON, export dati.

### ☐ M12 — Pubblicazione
Deploy della PWA su Vercel, repository GitHub reso privato, consolidamento e distribuzione dei
PIN iniziali agli agenti.

---

## Evoluzioni post-baseline (luglio 2026)

Completate le milestone, tre evoluzioni decise sull'uso reale, tutte ☑:

### ☑ E1 — Backend v3: un file per documento e sync incrementale
Ogni DDT diventa un file JSON a sé (`Archivio/<Nome Agente>/<Serie>/<Anno>/<Numero>.json`);
la sincronizzazione scarica solo i documenti modificati (parametro `dopo` + elenco per le
eliminazioni); i file eliminati vanno nel cestino di Drive. Dati locali separati per agente.

### ☑ E2 — Vista archivio
Elenco con ultimi 5 di default, chip `Ultimi 5 · 30 · Tutti` e ricerca live su numero e
cliente. Corretto in corsa un difetto latente (risoluzione dei documenti per posizione anziché
per id).

### ☑ E3 — Firma mittente per agente (backend v3.1)
Firma personale disegnata nell'app al primo accesso (saltabile), salvata sul backend e usata in
stampa; rimossa la firma cablata negli asset; ritaglio automatico e vincolo 200×48 px in stampa.

> **Baseline.** Le milestone M01–M10 più le evoluzioni E1–E3 costituiscono la **baseline
> definitiva del backend v3.1**: un file per documento, sincronizzazione incrementale,
> operazioni atomiche, autenticazione a PIN con autorizzazioni lato server, firme per agente.
> Gli sviluppi successivi (dashboard, pubblicazione, futuri irrobustimenti) si costruiscono
> sopra questa base senza rimetterla in discussione; ogni proposta che la contraddica va
> trattata come revisione architetturale, non come evoluzione.

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
