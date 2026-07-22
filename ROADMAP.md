# Roadmap

Piano di evoluzione di DDT Migliori da applicazione personale a piattaforma multiutente.

---

## Visione

Trasformare l'attuale applicazione DDT a uso singolo in una piattaforma destinata a una
microimpresa composta da circa **20 agenti commerciali** e da un **ufficio amministrativo
centrale**, mantenendo piena compatibilità con il progetto esistente.

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
| Backend | Google Apps Script | Apps Script evoluto, multiarchivio |
| Storage | Google Drive | Google Drive |
| Archivi | archivio JSON unico | un archivio JSON per serie documentale |
| Consultazione | solo device dell'agente | dashboard amministrativa centralizzata |

Dettagli in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Milestone

Legenda stato: ☐ da fare · ◐ in corso · ☑ completata

### ☐ M01 — Centralizzazione configurazione backend
Estrazione di URL ed endpoint in un `config.js` unico, eliminando le costanti sparse nel codice.

### ☐ M02 — Nuovo Apps Script di test
Ambiente backend separato da quello di produzione per sperimentare senza rischi.

### ☐ M03 — Nuovo Google Drive
Spazio di storage dedicato al nuovo modello ad archivi separati.

### ☐ M04 — Archivi JSON separati
Un file JSON per ogni serie documentale (es. `MS_GBE_2026.json`, `PM_GBE_2026.json`).

### ☐ M05 — Backend multiarchivio
Apps Script capace di leggere e scrivere su più archivi, con routing per serie.

### ☐ M06 — Login utenti
Autenticazione degli agenti e associazione utente → archivi accessibili.

### ☐ M07 — Gestione mittenti
Selezione del mittente per gli utenti che ne gestiscono più di uno.

### ☐ M08 — Numerazione indipendente
Progressivi calcolati per archivio, formato `AAPPPAGE` (es. `26001GBE`).

### ☐ M09 — Dashboard amministrativa
Consultazione centralizzata: ricerca per cliente e per agente, ristampa PDF, export dati.

### ☐ M10 — Ottimizzazione e rilascio
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
