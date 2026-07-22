# Changelog

Tutte le modifiche rilevanti a questo progetto sono documentate in questo file.

Il formato è ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/)
e il progetto adotta il [Versionamento Semantico](https://semver.org/lang/it/).

---

## [Non rilasciato]

### Aggiunto
- Struttura documentale del progetto: `README.md`, `CLAUDE.md`, `ROADMAP.md`, `CHANGELOG.md`
  e cartella `docs/` con architettura, modello dati, API e utenti.
- Stampa multipagina: i DDT con più di 12 righe proseguono su più pagine, ciascuna copia
  integrale del modulo, con indicatore "Pagina X di Y" presente solo sui documenti multipagina.

### Corretto
- La stampa non tronca più i DDT con più di 12 righe. `print.html` applicava `slice(0, 12)`
  all'elenco righe: le eccedenti non comparivano sul documento stampato, senza alcuna
  segnalazione all'utente. I dati salvati non erano interessati.

### Modificato
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
