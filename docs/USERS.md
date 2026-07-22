# Utenti e ruoli

Modello di utenza previsto per l'evoluzione multiutente della piattaforma.

> **Stato attuale.** L'applicazione è oggi a **utente singolo**: non esiste autenticazione, il
> mittente è una costante applicativa e il codice agente nella numerazione è fisso (`GBE`).
> Quanto segue descrive il modello obiettivo (milestone M06–M09 della [roadmap](../ROADMAP.md)).

---

## 1. Popolazione prevista

| Categoria | Numero indicativo | Descrizione |
| --- | --- | --- |
| Agenti commerciali | ~20 | Compilano, firmano e stampano DDT sul campo, spesso offline. |
| Ufficio amministrativo | 1 sede | Consulta, ricerca, ristampa ed esporta i documenti di tutti gli agenti. |

---

## 2. Ruoli

### 2.1 Agente

Ruolo operativo. Lavora prevalentemente da dispositivo mobile, anche senza connessione.

Può:

- creare, modificare e cancellare i propri DDT;
- acquisire dati tramite OCR (etichetta e documento di scarico);
- raccogliere la firma del destinatario;
- stampare / generare il PDF del documento;
- sincronizzare i propri archivi.

Non può:

- accedere ai DDT di altri agenti;
- modificare la configurazione degli archivi o dei mittenti.

### 2.2 Amministrazione

Ruolo di consultazione centralizzata, tipicamente da postazione fissa e online.

Può:

- consultare tutti i DDT di tutti gli agenti;
- ricercare per cliente e per agente;
- ristampare il PDF di qualunque documento;
- esportare i dati.

Non può (in prima release):

- creare o modificare DDT per conto di un agente.

---

## 3. Utenti e mittenti

Un **mittente** è la ragione sociale che emette il documento e compare nell'intestazione di
stampa. La relazione utente → mittente non è uno a uno.

| Scenario | Agenti | Comportamento al login |
| --- | --- | --- |
| Mittente unico | ~18 | Accesso diretto all'operatività, nessuna scelta richiesta. |
| Mittenti multipli | ~2 | Dopo il login viene richiesta la selezione del mittente attivo. |

Il mittente selezionato determina l'**archivio** su cui l'agente lavora nella sessione corrente.

---

## 4. Utenti, archivi e numerazione

- Ogni combinazione **serie documentale + agente + anno** corrisponde a un archivio JSON
  indipendente (es. `MS_GBE_2026.json`).
- La numerazione ha formato `AAPPPAGE` (es. `26001GBE`) e **non contiene il mittente**.
- Di conseguenza **lo stesso numero può esistere per mittenti diversi**: l'univocità è garantita
  dall'archivio di appartenenza, non dal numero in sé.
- Il progressivo è calcolato per archivio, in modo indipendente dagli altri.

Dettagli in [DATA_MODEL.md](DATA_MODEL.md).

---

## 5. Dashboard amministrativa

Interfaccia dedicata al ruolo Amministrazione, con funzioni di:

- elenco unificato dei DDT di tutti gli archivi;
- ricerca per cliente;
- ricerca per agente;
- ristampa del PDF;
- esportazione dei dati.

I PDF non sono archiviati: la ristampa rigenera il documento dai dati JSON.

---

## 6. Trattamento dei dati

I DDT contengono dati sanitari indiretti — **iniziali del paziente** e **numero di cartella
clinica**. Ne consegue che:

- l'accesso ai documenti va limitato al ruolo che ne ha effettiva necessità;
- questi campi non vanno riportati in log, esempi, screenshot o issue pubbliche;
- la copia locale sul dispositivo dell'agente è soggetta alle stesse cautele dell'archivio remoto.

---

## 7. Autenticazione — considerazioni aperte

Elementi da definire prima dell'implementazione di M06:

- meccanismo di identificazione dell'utente (account Google della microimpresa vs. credenziali
  applicative dedicate);
- gestione dell'operatività **offline** dopo il login, coerente con l'uso sul campo;
- durata e rinnovo della sessione;
- mappatura utente → archivi accessibili e sua manutenzione;
- protezione degli endpoint di backup e sync, oggi pubblici (vedi [API.md](API.md#3-sicurezza--stato-attuale)).
