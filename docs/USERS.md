# Utenti e ruoli

Configurazione aziendale reale e modello di utenza della piattaforma.

Il documento è diviso in due parti:

- **Configurazione attuale** — i dati concreti dell'azienda, destinati a cambiare nel tempo.
- **Modello architetturale** — le regole che governano utenti, serie e archivi, e che non devono
  cambiare al variare del numero di utenti.

> **Stato dell'applicazione.** Il codice è oggi a **utente singolo**: non esiste autenticazione,
> il mittente è una costante applicativa (`MITTENTE_FISSO` in `app.js`) e il codice agente nella
> numerazione è fisso (`GBE`). Quanto descritto in questo documento è la configurazione di
> riferimento verso cui l'applicazione evolverà con le milestone M08–M11 della
> [roadmap](../ROADMAP.md).

---

# Parte I — Configurazione attuale

## 1. Serie documentali

Una **serie documentale** identifica il soggetto che emette il DDT. Determina il mittente stampato
in intestazione e l'archivio su cui il documento viene registrato.

| Serie | Mittente | Note |
| --- | --- | --- |
| `MS` | Zimmer Biomet Italia (c/o Migliori Service S.r.l. Unipersonale) | Serie principale, usata da tutti gli utenti. |
| `PM` | Paolo Migliori S.r.l. | Serie secondaria, usata solo da alcuni utenti. |

Entrambi i soggetti hanno sede in Via Catira Savoca 1, 95037 San Giovanni La Punta (CT).

**La quasi totalità degli utenti opera esclusivamente sulla serie `MS`.** Solo un piccolo gruppo
è abilitato anche alla serie `PM` e deve quindi poter scegliere la serie attiva dopo l'accesso.

---

## 2. Utenti abilitati

Configurazione di partenza per l'anno **2027**. Per ogni utente: nome, codice agente, ruolo,
serie abilitate e archivi JSON associati.

| Nome | Codice | Ruolo | Serie abilitate | Archivi |
| --- | --- | --- | --- | --- |
| Andrea Adragna | `AA` | Agente | MS | `MS_AA_2027.json` |
| Angelo Butera | `AB` | Agente | MS | `MS_AB_2027.json` |
| Annamaria Campo | `AMC` | Agente | MS | `MS_AMC_2027.json` |
| Antonio Cavallaro | `AC` | Agente | MS | `MS_AC_2027.json` |
| Antonio Russo | `AR` | Agente | MS | `MS_AR_2027.json` |
| Cettina Dell'Ajra | `CD` | Agente | MS | `MS_CD_2027.json` |
| David Gambino | `DG` | Agente | MS | `MS_DG_2027.json` |
| Ennio Spadaro | `ES` | Agente | MS | `MS_ES_2027.json` |
| Francesco Fragale | `FF` | Agente | MS | `MS_FF_2027.json` |
| Giovanni Bennardo | `GBE` | Agente | MS | `MS_GBE_2027.json` |
| Giovanni Incatasciato | `GI` | Agente | MS | `MS_GI_2027.json` |
| Giuseppe Butera | `GB` | Agente | MS | `MS_GB_2027.json` |
| Leonardo Pulvirenti | `LP` | Agente | MS | `MS_LP_2027.json` |
| Marcello Catanese | `MC` | Agente | MS | `MS_MC_2027.json` |
| Marcello Fragale | `MF` | Agente | MS | `MS_MF_2027.json` |
| Mario Muscolino | `MM` | Agente | MS | `MS_MM_2027.json` |
| Maurizio Raciti | `MR` | Agente | MS | `MS_MR_2027.json` |
| Maurizio Russo | `MRU` | Agente | MS · PM | `MS_MRU_2027.json` · `PM_MRU_2027.json` |
| Michele Sanseverino | `MS` | Agente | MS | `MS_MS_2027.json` |
| Nicola Quazzico | `NQ` | Agente | MS | `MS_NQ_2027.json` |
| Roberto Metta | `RM` | Agente | MS | `MS_RM_2027.json` |
| Seby Savoca | `SS` | Agente | MS · PM | `MS_SS_2027.json` · `PM_SS_2027.json` |
| Commerciale | `CS` | Postazione di struttura | MS · PM | `MS_CS_2027.json` · `PM_CS_2027.json` |
| Magazzino | `MG` | Postazione di struttura | MS · PM | `MS_MG_2027.json` · `PM_MG_2027.json` |

Sintesi: **24 utenze**, di cui 22 agenti e 2 postazioni di struttura; **20 abilitate alla sola
serie MS** e **4 abilitate a entrambe le serie**. Gli archivi risultanti per il 2027 sono 28.

> **Nota sui codici agente.** I codici hanno lunghezza variabile (2 o 3 caratteri) e alcuni non
> derivano meccanicamente dalle iniziali del nome: `GBE` per Giovanni Bennardo distingue l'utente
> da `GB` (Giuseppe Butera), `MRU` per Maurizio Russo da `MR` (Maurizio Raciti), `CS` identifica la
> postazione Commerciale. Il codice è quindi un **identificativo assegnato**, non un valore
> calcolabile dal nome: va trattato come tale e non ricostruito via codice.

> **Nota sul codice `MS`.** Michele Sanseverino ha codice agente `MS`, che coincide con la sigla
> della serie documentale `MS`. Il nome archivio risultante è `MS_MS_2027.json`: formalmente
> corretto, perché serie e codice agente occupano posizioni distinte nella nomenclatura, ma il
> parsing del nome archivio va fatto per posizione e mai per ricerca della sottostringa.

---

## 3. Ruoli

### 3.1 Agente

Ruolo operativo. Lavora prevalentemente da dispositivo mobile, anche senza connessione.

Può:

- creare, modificare e cancellare i propri DDT;
- acquisire dati tramite OCR (etichetta e documento di scarico);
- raccogliere la firma del destinatario;
- stampare / generare il PDF del documento;
- sincronizzare i propri archivi.

Non può:

- accedere agli archivi di altri agenti;
- operare su serie documentali per cui non è abilitato;
- modificare la configurazione di utenti, serie o archivi.

### 3.2 Postazione di struttura

Utenze non personali (`Commerciale`, `Magazzino`) associate a una funzione aziendale anziché a una
persona. Dal punto di vista dell'applicazione si comportano esattamente come un agente: hanno un
codice, serie abilitate e archivi propri. La distinzione è organizzativa, non tecnica, e non
richiede alcuna gestione dedicata nel codice.

### 3.3 Amministrazione

Ruolo di consultazione centralizzata, tipicamente da postazione fissa e online.

Può:

- consultare i DDT di tutti gli archivi;
- ricercare per cliente e per agente;
- ristampare il PDF di qualunque documento;
- esportare i dati.

Non può:

- creare o modificare DDT per conto di un agente.

La dashboard amministrativa è un **consumatore in sola lettura** degli archivi: non li modifica mai.

---

# Parte II — Modello architetturale

Questa parte descrive le regole del modello. Non contiene utenti reali e non va aggiornata quando
l'organico cambia.

## 4. Entità del modello

| Entità | Definizione |
| --- | --- |
| **Utente** | Chi accede all'applicazione. Ha un nome, un ruolo e un insieme di serie abilitate. |
| **Codice agente** | Identificativo breve assegnato all'utente, stabile nel tempo. Compare nella numerazione e nel nome degli archivi. |
| **Serie documentale** | Soggetto emittente. Determina il mittente stampato. |
| **Archivio** | File JSON che raccoglie i documenti di una combinazione serie + agente + anno. |

## 5. Relazioni

```
Utente ──< abilitato a >── Serie documentale
   │                              │
   └──────────┬───────────────────┘
              ▼
      Archivio (serie + agente + anno)
```

- Un utente è abilitato a **una o più serie**.
- Ogni combinazione **serie + agente + anno** genera esattamente **un archivio**.
- Un archivio appartiene a **un solo utente** e a **una sola serie**.
- Il numero di archivi cresce linearmente con utenti, serie e anni, senza che la struttura cambi.

Struttura e nomenclatura degli archivi sono definite in [DATA_MODEL.md](DATA_MODEL.md).

## 6. Aggiungere un nuovo utente

L'inserimento di un agente deve essere un'operazione di **configurazione**, mai di sviluppo.
Richiede tre passi:

1. **Inserimento dell'utente** nell'elenco delle utenze abilitate.
2. **Assegnazione del codice agente**, univoco e stabile nel tempo.
3. **Assegnazione delle serie documentali abilitate.**

Gli archivi corrispondenti vengono creati alla prima emissione di un documento, con progressivo
inizializzato a zero. Non è richiesta alcuna modifica al frontend, al modello dati o al backend.

Le stesse tre operazioni, con segno opposto, valgono per la disattivazione di un utente: gli
archivi già emessi restano consultabili dalla dashboard e non vengono rimossi.

## 7. Aggiungere una nuova serie o un nuovo anno

- **Nuova serie**: si definisce la sigla e il mittente associato, e la si abilita agli utenti
  interessati. Nessun'altra modifica.
- **Nuovo anno**: gli archivi dell'anno successivo nascono automaticamente alla prima emissione,
  con progressivo che riparte da zero. Gli archivi degli anni precedenti restano immutati e
  consultabili.

## 8. Criterio di scalabilità

Il modello si considera valido finché valgono tutte queste condizioni:

- aggiungere un utente non richiede modifiche al codice;
- aggiungere una serie non richiede modifiche al codice;
- il passaggio di anno non richiede alcun intervento manuale;
- nessun componente deve caricare tutti gli archivi insieme per funzionare;
- la dimensione del singolo archivio resta limitata dai documenti di **un agente, una serie, un
  anno**.

L'ultimo punto è il motivo principale della separazione degli archivi: il carico sul dispositivo
dell'agente non cresce con il numero di colleghi.

---

## 9. Trattamento dei dati

I DDT contengono dati sanitari indiretti — **iniziali del paziente** e **numero di cartella
clinica**. Ne consegue che:

- l'accesso agli archivi va limitato al ruolo che ne ha effettiva necessità;
- questi campi non vanno riportati in log, esempi, screenshot o issue pubbliche;
- la copia locale sul dispositivo dell'agente è soggetta alle stesse cautele dell'archivio remoto;
- la separazione degli archivi per agente limita per costruzione l'esposizione: un dispositivo
  compromesso espone i documenti di un solo agente.

---

## 10. Autenticazione — considerazioni aperte

Elementi da definire prima dell'implementazione di M08:

- meccanismo di identificazione dell'utente (account Google della microimpresa vs. credenziali
  applicative dedicate);
- gestione dell'operatività **offline** dopo il login, coerente con l'uso sul campo;
- durata e rinnovo della sessione;
- mantenimento della mappatura utente → codice agente → serie abilitate, e sua manutenzione;
- protezione degli endpoint di backup e sync, oggi pubblici
  (vedi [API.md](API.md#3-sicurezza--stato-attuale)).
