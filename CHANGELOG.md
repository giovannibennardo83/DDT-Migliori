# Changelog

Tutte le modifiche rilevanti a questo progetto sono documentate in questo file.

Il formato è ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/)
e il progetto adotta il [Versionamento Semantico](https://semver.org/lang/it/).

---

## [Non rilasciato]

### Aggiunto
- Struttura documentale del progetto: `README.md`, `CLAUDE.md`, `ROADMAP.md`, `CHANGELOG.md`
  e cartella `docs/` con architettura, modello dati, API e utenti.
- Backend v3: un file JSON per DDT su Drive (`Archivio/<Nome Agente>/<Serie>/<Anno>/<Numero>.json`)
  al posto dell'archivio unico per serie/anno. Sincronizzazione **incrementale** (parametro
  `dopo`: viaggiano solo i documenti modificati, con l'elenco dei numeri per rilevare le
  eliminazioni); i file eliminati finiscono nel cestino di Drive. Dati locali separati per
  agente (`ddtRecords_<CODICE>`, coda e marcatori di sync per codice): sulle postazioni
  condivise il cambio utente non azzera più nulla. Migrazione dei 60 DDT esistenti nella
  nuova struttura, per anno del documento.
- Piattaforma multiutente: login con codice agente e PIN (cambio obbligatorio del PIN
  iniziale, cambio volontario dalla barra utente, logout), Storage Service (`storage.js`)
  come unico punto di contatto col backend, scritture per singolo documento (upsert/delete)
  al posto della sovrascrittura integrale dell'archivio, coda offline con invio automatico
  al ritorno della rete, selezione della serie documentale per gli utenti abilitati a più
  serie, mittente di stampa derivato dalla serie del documento. Backend Apps Script v2
  multiarchivio (`<SERIE>_<CODICE>_<ANNO>.json`) con autenticazione, autorizzazione per
  archivio, lock sulle scritture e ruolo admin in sola lettura.
- Campo persistito `serie` sui DDT (default `MS`); numerazione calcolata per serie attiva
  con codice agente dalla sessione.
- `config.js` con la configurazione dell'applicazione (`APP_CONFIG`): il codice agente usato
  nella numerazione non è più hardcoded in `db.js` ma letto dalla configurazione. Formato del
  numero invariato. Cache del Service Worker a `ddt-cache-v7` per includere il nuovo file.
- Stampa multipagina: i DDT con più di 12 righe proseguono su più pagine, ciascuna copia
  integrale del modulo, con indicatore "Pagina X di Y" presente solo sui documenti multipagina.

### Corretto
- Il backup non può più sovrascrivere un archivio remoto popolato con una lista locale vuota:
  è lo scenario di un dispositivo appena ripulito che salva prima di aver sincronizzato, che
  il 22/07/2026 ha causato lo svuotamento (poi ripristinato) dell'archivio su Drive.
- La stampa non tronca più i DDT con più di 12 righe. `print.html` applicava `slice(0, 12)`
  all'elenco righe: le eccedenti non comparivano sul documento stampato, senza alcuna
  segnalazione all'utente. I dati salvati non erano interessati.

### Modificato
- Archivio più leggibile: di default mostra gli **ultimi 5** DDT, con chip `Ultimi 5 ·
  Ultimi 30 · Tutti` (scelta ricordata per agente), **ricerca live** su numero e cliente che
  ignora il limite attivo, e riga di stato "Mostrati X di Y · Mostra tutti".
- Corretto un difetto latente della lista: Modifica ed Elimina risolvevano il documento per
  posizione nella lista ordinata anziché per id — con ordinamenti o filtri potevano agire sul
  documento sbagliato.
- Documentazione riallineata allo stato multiutente realizzato: README, ROADMAP (M01–M10
  completate, deviazioni annotate), CLAUDE (nuove decisioni consolidate e vincoli tecnici),
  `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/API.md` (contratto v2 come attuale) e
  `docs/USERS.md` (configurazione in `utenti.json`, credenziali, procedura di onboarding).
- Revisione e consolidamento della documentazione sulla configurazione aziendale reale:
  - `ROADMAP.md`: milestone completate segnate come tali e sequenza estesa a M12, con
    l'introduzione dello Storage Service;
  - `CLAUDE.md`: nuova sezione "Decisioni architetturali consolidate";
  - `docs/USERS.md`: serie documentali `MS` e `PM`, elenco delle utenze abilitate e modello
    di crescita indipendente dal numero di utenti;
  - `docs/DATA_MODEL.md`: modello definitivo degli archivi, standard
    `<SERIE>_<CODICEAGENTE>_<ANNO>.json` e definizione dell'identità del documento;
  - `docs/ARCHITECTURE.md`: catena dei livelli, ruolo dello Storage Service e criteri di
    scalabilità;
  - `docs/API.md`: contratto del backend multiarchivio e regole di compatibilità.
- Regola sulle righe precisata in `README.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md` e
  `docs/DATA_MODEL.md`: 12 righe per pagina, con proseguimento su più pagine per i documenti più
  lunghi e nessun limite in salvataggio.
- Versione della cache del Service Worker incrementata a `ddt-cache-v5`, essendo cambiati
  `print.html` e `print.css`.
- Codice agente letto dalla configurazione (M05): nuovo `config.js` con
  `APP_CONFIG.agent` (`code`, `name`), caricato prima di `db.js`; il suffisso del numero DDT
  non è più cablato in `getNextDDTNumber()`. Formato della numerazione invariato. Cache del
  Service Worker incrementata a `ddt-cache-v7` con `config.js` tra gli asset.
- Migrazione del backend su un nuovo Google Drive dedicato (M03): `BACKUP_URL` in `app.js`
  punta al nuovo deployment Apps Script, che legge e scrive
  `DDT-Migliori/Archivi/MS_GBE_2026.json`. Contratto API e comportamento invariati; storico
  (59 DDT) migrato e verificato. Cache del Service Worker incrementata a `ddt-cache-v6`.
  Il vecchio backend resta attivo come rollback.

### Rimosso
- File `# DDT Migliori - Roadmap di svilupp.md` in root, i cui contenuti sono confluiti in
  `ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md` e `docs/USERS.md`.

---

## Storico precedente

Le versioni antecedenti all'introduzione di questo changelog non sono state tracciate in modo
strutturato. Lo storico completo degli interventi è ricostruibile dalla cronologia Git e dalle
pull request del repository; di seguito i temi principali già rilasciati.

- Gestione firma del destinatario: acquisizione a canvas, persistenza e resa in stampa.
- Firma del mittente come immagine PNG con dimensionamento controllato nel footer di stampa.
- OCR documento di scarico sala operatoria, con estrazione di testata e righe articolo.
- OCR etichetta singola per codice articolo, lotto e descrizione.
- Backup e sincronizzazione con Google Drive tramite Google Apps Script, con merge dei
  documenti locali e remoti.
- Numerazione automatica progressiva annuale dei DDT.
- Normalizzazione dello schema righe e migrazione automatica dei campi legacy
  (`articolo` / `descrizione` → `codice_articolo`).
- Layout di stampa tabellare tarato sul modulo a 12 righe.
- Supporto PWA: manifest, Service Worker e funzionamento offline.

---

## Convenzioni

Ogni voce va classificata sotto una di queste categorie:

- **Aggiunto** — nuove funzionalità.
- **Modificato** — cambiamenti a funzionalità esistenti.
- **Deprecato** — funzionalità che verranno rimosse.
- **Rimosso** — funzionalità eliminate.
- **Corretto** — bug fix.
- **Sicurezza** — vulnerabilità risolte.

Al momento del rilascio, la sezione `[Non rilasciato]` va rinominata in
`[X.Y.Z] - AAAA-MM-GG` e va creata una nuova sezione `[Non rilasciato]` vuota.
