# DDT Migliori - Roadmap di sviluppo

## Visione del progetto

L'obiettivo è evolvere l'attuale applicazione DDT personale in una piattaforma multiutente destinata ad una microimpresa composta da circa 20 agenti commerciali e da un ufficio amministrativo centrale.

L'evoluzione dovrà avvenire mantenendo piena compatibilità con il progetto esistente.

---

# Principi di sviluppo

Ogni modifica dovrà rispettare le seguenti regole:

- NON riscrivere codice funzionante.
- Preferire piccoli refactoring incrementali.
- Ogni modifica deve essere facilmente testabile.
- Ogni milestone deve lasciare l'applicazione funzionante.
- Il frontend dovrà cambiare il meno possibile.
- La logica esistente di compilazione DDT dovrà essere preservata.
- OCR, firma, stampa PDF e funzionamento offline non devono essere alterati.

---

# Architettura attuale

Frontend

- HTML
- CSS
- JavaScript

Persistenza locale

- localStorage
- IndexedDB

Backend

- Google Apps Script

Storage

- Google Drive

Formato dati

- JSON

Output

- PDF generato dinamicamente (non archiviato)

---

# Architettura obiettivo

Frontend

- invariato

Persistenza locale

- invariata

Backend

- Google Apps Script evoluto

Storage

- Google Drive

Archivi

- un archivio JSON per ogni serie documentale

Dashboard

- consultazione centralizzata

---

# Modello dati

Ogni serie documentale possiede un archivio indipendente.

Esempio

MS_GBE_2026.json

PM_GBE_2026.json

MS_MRU_2026.json

...

Ogni archivio mantiene:

- progressivo
- documenti
- metadata

---

# Numerazione

Formato

26001GBE

dove

26 = anno

001 = progressivo

GBE = codice agente

Il mittente NON compare nella numerazione.

La stessa numerazione può esistere per due mittenti differenti.

La distinzione avviene tramite l'archivio.

---

# Gestione utenti

Circa 20 agenti.

Scenario previsto:

18 agenti

- un solo mittente

2 agenti

- due mittenti

Gli utenti con un solo mittente accederanno direttamente.

Gli utenti con due mittenti sceglieranno il mittente dopo il login.

---

# Dashboard amministrativa

Consentirà di:

- consultare tutti i DDT
- ricercare per cliente
- ricercare per agente
- ristampare PDF
- esportare dati

---

# Milestone

## M01

☐ Centralizzazione configurazione backend

- config.js
- endpoint centralizzati

---

## M02

☐ Nuovo Apps Script di test

---

## M03

☐ Nuovo Google Drive

---

## M04

☐ Archivi JSON separati

---

## M05

☐ Backend multiarchivio

---

## M06

☐ Login utenti

---

## M07

☐ Gestione mittenti

---

## M08

☐ Numerazione indipendente

---

## M09

☐ Dashboard amministrativa

---

## M10

☐ Ottimizzazione e rilascio

---

# Filosofia del progetto

Questa applicazione è già stabile.

L'obiettivo NON è riscriverla.

L'obiettivo è trasformarla gradualmente in un prodotto professionale mantenendo il comportamento esistente e riducendo al minimo il rischio di regressioni.

Ogni modifica dovrà essere:

- semplice
- reversibile
- documentata
- facilmente testabile.