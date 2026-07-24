# Utenti e ruoli

Configurazione aziendale reale e modello di utenza della piattaforma.

Il documento è diviso in due parti:

- **Configurazione attuale** — i dati concreti dell'azienda, destinati a cambiare nel tempo.
- **Modello architetturale** — le regole che governano utenti, serie e archivi, e che non devono
  cambiare al variare del numero di utenti.

> **Stato dell'applicazione.** Il modello descritto è **implementato** (luglio 2026): login con
> codice agente + PIN, serie selezionabile, firma mittente personale, un file JSON per documento
> in cartelle per agente/serie/anno. La configurazione reale vive in **`utenti.json`** nella
> cartella `DDT-Migliori` su Google Drive — utenti, serie abilitate, hash dei PIN e mittenti per
> serie — letta dal backend a ogni richiesta. Le tabelle di questo documento ne sono la
> descrizione, non la fonte.

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

Utenze configurate in `utenti.json` (esempio di archivi riferito all'anno **2027**; gli archivi
di ciascun anno nascono alla prima emissione). Oltre alle utenze in tabella esiste **`ADMIN`**
(Amministrazione, ruolo `admin`, abilitata in lettura a entrambe le serie) per la dashboard.

| Nome | Codice | Ruolo | Serie abilitate | Cartelle archivio (es. 2027) |
| --- | --- | --- | --- | --- |
| Andrea Adragna | `AA` | Agente | MS | `Andrea Adragna/MS/2027/` |
| Angelo Butera | `AB` | Agente | MS | `Angelo Butera/MS/2027/` |
| Annamaria Campo | `AMC` | Agente | MS | `Annamaria Campo/MS/2027/` |
| Antonio Cavallaro | `AC` | Agente | MS | `Antonio Cavallaro/MS/2027/` |
| Antonio Russo | `AR` | Agente | MS | `Antonio Russo/MS/2027/` |
| Cettina Dell'Ajra | `CD` | Agente | MS | `Cettina Dell'Ajra/MS/2027/` |
| David Gambino | `DG` | Agente | MS | `David Gambino/MS/2027/` |
| Ennio Spadaro | `ES` | Agente | MS | `Ennio Spadaro/MS/2027/` |
| Francesco Fragale | `FF` | Agente | MS | `Francesco Fragale/MS/2027/` |
| Giovanni Bennardo | `GBE` | Agente | MS | `Giovanni Bennardo/MS/2027/` |
| Giovanni Incatasciato | `GI` | Agente | MS | `Giovanni Incatasciato/MS/2027/` |
| Giuseppe Butera | `GB` | Agente | MS | `Giuseppe Butera/MS/2027/` |
| Leonardo Pulvirenti | `LP` | Agente | MS | `Leonardo Pulvirenti/MS/2027/` |
| Marcello Catanese | `MC` | Agente | MS | `Marcello Catanese/MS/2027/` |
| Marcello Fragale | `MF` | Agente | MS | `Marcello Fragale/MS/2027/` |
| Mario Muscolino | `MM` | Agente | MS | `Mario Muscolino/MS/2027/` |
| Maurizio Raciti | `MR` | Agente | MS | `Maurizio Raciti/MS/2027/` |
| Maurizio Russo | `MRU` | Agente | MS · PM | `Maurizio Russo/MS/2027/` · `Maurizio Russo/PM/2027/` |
| Michele Sanseverino | `MS` | Agente | MS | `Michele Sanseverino/MS/2027/` |
| Nicola Quazzico | `NQ` | Agente | MS | `Nicola Quazzico/MS/2027/` |
| Roberto Metta | `RM` | Agente | MS | `Roberto Metta/MS/2027/` |
| Seby Savoca | `SS` | Agente | MS · PM | `Seby Savoca/MS/2027/` · `Seby Savoca/PM/2027/` |
| Commerciale | `CS` | Postazione di struttura | MS · PM | `Commerciale/MS/2027/` · `Commerciale/PM/2027/` |
| Magazzino | `MG` | Postazione di struttura | MS · PM | `Magazzino/MS/2027/` · `Magazzino/PM/2027/` |

Sintesi: **25 utenze** — 22 agenti, 2 postazioni di struttura e l'utenza amministrativa;
**20 abilitate alla sola serie MS** e **4 operative su entrambe le serie**. Gli archivi
risultanti per un anno pieno sono 28.

### 2.1 Credenziali

- Ogni utenza accede con **codice + PIN**. I PIN iniziali seguono lo schema `CODICE1234`
  (es. `GBE1234`) e l'app **impone la sostituzione al primo accesso**.
- L'agente cambia il PIN in autonomia dalla barra utente (serve il PIN attuale).
- Reset di un PIN dimenticato: l'amministratore esegue `impostaPin('CODICE', 'nuovo')`
  dall'editor Apps Script. La funzione `setupPinIniziali()` riporta **tutti** i PIN allo schema
  iniziale: è solo per emergenze.
- Le sessioni durano 30 giorni e si rinnovano a ogni uso; il logout le revoca.
- Al primo accesso l'app propone anche il **passo firma** (saltabile): l'agente disegna la
  propria firma mittente, salvata sul backend (`Firme/<CODICE>.txt`) e usata in stampa.
  Resta modificabile in ogni momento da "La mia firma". Le postazioni di struttura possono
  saltare il passo: i loro documenti si firmano a penna.

> **Nota sui codici agente.** I codici hanno lunghezza variabile (2 o 3 caratteri) e alcuni non
> derivano meccanicamente dalle iniziali del nome: `GBE` per Giovanni Bennardo distingue l'utente
> da `GB` (Giuseppe Butera), `MRU` per Maurizio Russo da `MR` (Maurizio Raciti), `CS` identifica la
> postazione Commerciale. Il codice è quindi un **identificativo assegnato**, non un valore
> calcolabile dal nome: va trattato come tale e non ricostruito via codice.

> **Nota sul codice `MS`.** Michele Sanseverino ha codice agente `MS`, che coincide con la sigla
> della serie documentale `MS`. Con la struttura a cartelle l'ambiguità non esiste: il livello
> agente usa il **nome esteso** (`Michele Sanseverino/MS/2027/`) e la sigla della serie occupa
> un livello dedicato. Resta la regola generale: serie e codice non vanno mai dedotti per
> ricerca di sottostringa, solo per posizione.

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
| **Utente** | Chi accede all'applicazione. Ha un nome, un ruolo, un insieme di serie abilitate e una firma personale. |
| **Codice agente** | Identificativo breve assegnato all'utente, stabile nel tempo. Compare nella numerazione. |
| **Serie documentale** | Soggetto emittente. Determina il mittente stampato. |
| **Partizione** | Cartella `Archivio/<Nome>/<Serie>/<Anno>/` che contiene i documenti (un file JSON per DDT). |

## 5. Relazioni

```
Utente ──< abilitato a >── Serie documentale
   │                              │
   └──────────┬───────────────────┘
              ▼
   Partizione (agente / serie / anno)
              │
              ▼
     un file JSON per DDT
```

- Un utente è abilitato a **una o più serie**.
- Ogni combinazione **agente + serie + anno** è una **partizione**: una cartella con un file
  JSON per ciascun documento.
- Una partizione appartiene a **un solo utente** e a **una sola serie**.
- Il numero di partizioni cresce linearmente con utenti, serie e anni, senza che la struttura
  cambi.

Percorsi e nomi dei file sono definiti in [DATA_MODEL.md](DATA_MODEL.md#102-percorso-e-nome-dei-file).

## 6. Aggiungere un nuovo utente

L'inserimento di un agente è un'operazione di **configurazione**, mai di sviluppo. In pratica:

1. **Aggiungere l'utente a `utenti.json`** su Drive (a mano o dall'editor Apps Script):
   `{ "codice": "XY", "nome": "Nome Cognome", "serie": ["MS"], "ruolo": "agente", "attivo": true, "pinHash": null }`.
2. **Assegnare il PIN iniziale** con `impostaPin('XY', 'XY1234')` dall'editor Apps Script.
3. **Consegnare codice e PIN** all'agente: al primo accesso sostituirà il PIN e disegnerà la
   propria firma — il resto dell'onboarding è self-service.

Le cartelle dell'agente nascono alla prima emissione di un documento. Non è richiesta alcuna
modifica al frontend, al modello dati o al codice del backend.

Per **disattivare** un utente basta impostare `"attivo": false` in `utenti.json`: login e
operazioni vengono rifiutati, gli archivi già emessi restano consultabili dalla dashboard.

## 7. Aggiungere una nuova serie o un nuovo anno

- **Nuova serie**: si aggiunge la voce in `utenti.json` (sigla + righe del mittente nella sezione
  `serie`) e la si abilita agli utenti interessati. Nessun'altra modifica.
- **Nuovo anno**: le cartelle dell'anno successivo nascono automaticamente alla prima emissione,
  con progressivo che riparte da zero. Le cartelle degli anni precedenti restano immutate e
  consultabili (l'app sincronizza anno corrente e precedente; gli anni più vecchi restano su
  Drive per la dashboard).

## 8. Criterio di scalabilità

Il modello si considera valido finché valgono tutte queste condizioni:

- aggiungere un utente non richiede modifiche al codice;
- aggiungere una serie non richiede modifiche al codice;
- il passaggio di anno non richiede alcun intervento manuale;
- nessun componente deve caricare tutti i documenti dell'azienda insieme per funzionare;
- il traffico di sincronizzazione resta proporzionale alle **modifiche**, non alla dimensione
  dell'archivio.

Il carico sul dispositivo dell'agente non cresce né con il numero di colleghi né, a regime, con
lo storico accumulato.

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

## 10. Autenticazione — scelte fatte e limiti noti

Le considerazioni un tempo aperte sono state decise così:

- **Credenziali applicative dedicate** (codice + PIN), non account Google: nessun requisito
  esterno per gli agenti, revoca individuale possibile.
- **Offline**: il login richiede la rete; la sessione (30 giorni, rinnovo a scorrimento) vale
  anche offline e le operazioni si accodano.
- **Mappatura utente → serie → archivi** in `utenti.json` sul Drive, letta dal backend a ogni
  richiesta: modificarla non richiede deploy.
- **Protezione dell'endpoint**: l'autorizzazione è applicativa (token, ruoli, serie abilitate);
  il deployment resta pubblico e senza rate limiting — limiti descritti in
  [API.md](API.md#3-sicurezza--stato-attuale).
