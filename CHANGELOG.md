# Changelog

Tutte le modifiche rilevanti a questo progetto sono documentate in questo file.

Il formato è ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.1.0/)
e il progetto adotta il [Versionamento Semantico](https://semver.org/lang/it/).

---

## [Non rilasciato]

### Aggiunto
- Struttura documentale del progetto: `README.md`, `CLAUDE.md`, `ROADMAP.md`, `CHANGELOG.md`
  e cartella `docs/` con architettura, modello dati, API e utenti.

### Modificato
- _nulla_

### Corretto
- _nulla_

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
- Layout di stampa tabellare a 15 righe fisse.
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
