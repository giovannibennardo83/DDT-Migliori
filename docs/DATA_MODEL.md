# Modello dati

Struttura dei dati persistiti dall'applicazione, regole di normalizzazione e migrazioni.

---

## 1. Dove risiedono i dati

| Dato | Tecnologia | Chiave | Contenuto |
| --- | --- | --- | --- |
| DDT dell'utente | `localStorage` | `ddtRecords` | Array JSON dei documenti (cache locale degli archivi dell'utente). |
| Sessione | `localStorage` | `ddtSession` | Token, profilo utente, mittenti per serie, serie attiva. |
| Coda offline | `localStorage` | `ddtOpsPending` | Operazioni `upsert`/`delete` in attesa di invio. |
| Ultimo utente | `localStorage` | `ddtLastUser` | Codice agente dell'ultimo login sul dispositivo. |
| Contatori | IndexedDB `ddt-db` v1, store `counters` | `anno` | Ultimo progressivo per anno (copia di sicurezza). |
| **Archivi** | Google Drive via Apps Script v2 | nome file | Un file JSON per serie + agente + anno (vedi §10). |
| Utenti | Google Drive (`DDT-Migliori/utenti.json`) | — | Configurazione di utenti, serie e mittenti (vedi [USERS.md](USERS.md)). |

La **fonte di verità** è l'insieme degli archivi su Drive; il `localStorage` è la copia operativa
del dispositivo, riallineata dalla sincronizzazione.

---

## 2. Entità `DDT`

```json
{
  "id": "0f1c9b3e-7a44-4a0d-9f0e-6f6a1c2d3e4f",
  "numero": "26001GBE",
  "serie": "MS",
  "data": "2026-01-15",
  "cliente": {
    "riga1": "Ospedale Esempio",
    "riga2": "Via Roma 1",
    "riga3": "95100 Catania (CT)"
  },
  "causale_trasporto": "Conto visione",
  "iniziali_paziente": "AB",
  "cartella_clinica": "12345",
  "firma_destinatario": "data:image/png;base64,...",
  "righe": [],
  "createdAt": "2026-01-15T09:12:00.000Z",
  "updatedAt": "2026-01-15T09:40:00.000Z"
}
```

| Campo | Tipo | Note |
| --- | --- | --- |
| `id` | `string` | UUID generato con `crypto.randomUUID()`; fallback `ddt-<timestamp>-<random>`. Chiave primaria per il merge. |
| `numero` | `string` | Numero documento, formato `<AA><PPP><CODICEAGENTE>` (vedi §5). |
| `serie` | `string` | Serie documentale di appartenenza (default `MS` per i documenti storici). Determina archivio di destinazione e mittente di stampa. |
| `data` | `string` | Data documento in formato ISO `AAAA-MM-GG`. L'anno della data determina l'archivio annuale. |
| `cliente` | `object` | Destinatario su tre righe libere (vedi §3). |
| `causale_trasporto` | `string` | Causale del trasporto. |
| `iniziali_paziente` | `string` | Iniziali del paziente (dato sanitario indiretto). |
| `cartella_clinica` | `string` | Numero cartella clinica / SDO. |
| `firma_destinatario` | `string \| null` | Data URL PNG della firma tracciata; `null` se assente. |
| `righe` | `Riga[]` | Righe articolo (vedi §4). |
| `createdAt` | `string?` | ISO 8601, presente solo se già valorizzato. |
| `updatedAt` | `string?` | ISO 8601; usato per risolvere i conflitti in sincronizzazione. |

Il **mittente non è persistito nel documento**: deriva dalla serie (`utenti.json` → `serieInfo`)
e viene allegato al solo payload di stampa (`printDDT`).

---

## 3. Entità `Cliente`

```json
{ "riga1": "Ospedale Esempio", "riga2": "Via Roma 1", "riga3": "95100 Catania (CT)" }
```

Tutte le righe sono stringhe con `trim()` applicato. Non esiste un'anagrafica clienti
strutturata: il destinatario è testo libero su tre righe, per adattarsi al modulo di stampa.

**Compatibilità.** Se `cliente` è una stringa (formato legacy) viene convertito in oggetto con il
valore in `riga1`. Se assente, si usa il campo legacy `destinatario`. Se l'oggetto ha `nome`
invece di `riga1`, viene mappato su `riga1`.

---

## 4. Entità `Riga`

```json
{
  "codice_articolo": "ART-001",
  "description": "Stelo femorale 71mm",
  "lotto": "L-2401",
  "quantita": 1
}
```

| Campo | Tipo | Regole |
| --- | --- | --- |
| `codice_articolo` | `string` | REF del dispositivo, normalizzato in maiuscolo dall'OCR. |
| `description` | `string` | Descrizione breve (2-4 parole), eventualmente con misura. |
| `lotto` | `string` | LOT del dispositivo; stringa vuota se assente. |
| `quantita` | `number` | Intero, minimo `1`. Valori non validi collassano a `1`. |

**Numero di righe.** L'array `righe` **non ha un limite superiore**: un DDT può contenerne quante
ne servono. Le 12 righe per pagina della stampa sono la capienza del modulo, non un vincolo del modello
dati. Nessuno dei passaggi di persistenza — `extractAndValidateRighe()` in `app.js`,
`normalizeDDTStorage()` / `normalizeRigaStorage()` in `db.js`, il payload di backup (§8) — applica
tagli o soglie, e non devono essere introdotti.

**Compatibilità.** I campi legacy `descrizione` e `articolo` vengono mappati su
`codice_articolo`, con precedenza `codice_articolo` → `descrizione` → `articolo`.
Un DDT legacy privo di `righe` ma con `articolo`/`descrizione` a livello di testata viene
convertito in un documento con una singola riga.

---

## 5. Numerazione

Formato: **`<AA><PPP><CODICEAGENTE>`**

| Segmento | Lunghezza | Significato |
| --- | --- | --- |
| `AA` | 2 | Ultime due cifre dell'**anno del documento**. |
| `PPP` | 3 | Progressivo annuale, con zeri iniziali. |
| `CODICEAGENTE` | 2–3 | Codice agente dell'utente autenticato (dalla sessione di login). |

### 5.1 Il prefisso segue l'anno

**Il prefisso numerico cambia con l'anno del documento e il progressivo riparte da `001` a ogni
cambio di anno.** Non esiste una numerazione continua tra un anno e il successivo.

| Anno | Prefisso | Primo numero | Esempi |
| --- | --- | --- | --- |
| 2026 | `26` | `26001` | `26001GB`, `26014GBE`, `26007MRU` |
| 2027 | `27` | `27001` | `27001GB`, `27014GBE`, `27007MRU` |
| 2028 | `28` | `28001` | `28001GB`, `28014GBE`, `28007MRU` |

L'anno usato è quello della **data del documento** (campo `data`), non la data di emissione: un DDT
datato 2026 compilato a gennaio 2027 riceve comunque un numero `26xxx`. Nel codice questa regola è
applicata da `getYearCode()`, che ricava il prefisso dal parametro passato a `getNextDDTNumber()`.

Il passaggio di anno non richiede alcun intervento manuale: cambia il prefisso, riparte il
progressivo e nasce il nuovo archivio annuale (vedi §10.4).

### 5.2 Altre regole

- Il progressivo è calcolato scansionando i DDT locali **della serie attiva e dello stesso
  anno** — confrontando serie e primi due caratteri del numero — e prendendo il massimo + 1.
  Serie diverse hanno progressivi indipendenti. Il contatore su IndexedDB viene aggiornato come
  copia di sicurezza.
- Il codice agente ha **lunghezza variabile** (2 o 3 caratteri) ed è un identificativo assegnato,
  non derivabile meccanicamente dal nome dell'utente: vedi [USERS.md](USERS.md#2-utenti-abilitati).
  Il parsing del numero deve quindi basarsi sui **primi 5 caratteri** (anno + progressivo) e
  trattare il resto come codice agente, non su posizioni fisse in coda.
- **Il mittente non compare nella numerazione.** La stessa numerazione può esistere per mittenti
  diversi: la distinzione avviene tramite l'archivio di appartenenza (vedi §11).
- Attenzione a non confondere i due formati dell'anno: **2 cifre nel numero DDT** (`27001GBE`),
  **4 cifre nel nome dell'archivio** (`MS_GBE_2027.json`).

---

## 6. Contatori

Record dello store `counters`:

```json
{ "anno": "26", "last": 42 }
```

`updateCountersFromDDT()` ricalcola l'intera mappa dei contatori a partire dalla lista dei DDT
(dopo una sincronizzazione), e `saveCounters()` riscrive lo store da zero.

---

## 7. Normalizzazione

Ogni lettura e ogni scrittura dei DDT passa da `normalizeDDTStorage()` in `db.js`.
La funzione garantisce che il record abbia sempre tutti i campi previsti, con i tipi corretti e i
valori legacy convertiti.

> **Regola operativa:** qualsiasi nuovo campo che debba essere persistito va aggiunto a
> `normalizeDDTStorage()` (o a `normalizeRigaStorage()` per le righe), altrimenti viene scartato
> silenziosamente al primo salvataggio o alla prima sincronizzazione.

---

## 8. Coda offline

Le scritture eseguite senza rete vengono accodate in `localStorage` (`ddtOpsPending`) come
operazioni autocontenute:

```json
{ "azione": "upsert", "serie": "MS", "anno": 2026, "ddt": { "id": "…", "…": "…" } }
```

```json
{ "azione": "delete", "serie": "MS", "anno": 2026, "id": "…" }
```

Regole:

- un'operazione più recente sullo **stesso documento** sostituisce quella in coda;
- la coda viene svuotata in ordine al ritorno della rete, all'avvio e prima di ogni sync;
- un errore di rete interrompe lo svuotamento (si riproverà); una sessione scaduta lo sospende
  fino al nuovo login; un errore applicativo scarta la singola operazione.

---

## 9. Sincronizzazione e merge

La sincronizzazione legge gli archivi remoti dell'utente (ogni serie abilitata × anno corrente e
precedente). **A coda vuota il server è autorevole**: la lista locale viene sostituita da quella
remota, propagando anche le eliminazioni fatte da altri dispositivi.

Con operazioni ancora in coda — o con un remoto inaspettatamente vuoto a fronte di dati locali —
si applica il merge conservativo di `mergeDDTLists()`:

1. Chiave di identità: `id`; in mancanza, `numero`. I record senza entrambi vengono scartati.
2. In caso di duplicato vince il record con `updatedAt` più recente, che sovrascrive l'altro
   campo per campo.
3. `firma_destinatario` è trattata a parte: si preserva sempre il valore non vuoto, anche se
   proviene dal record più vecchio.
4. Il risultato è ordinato per progressivo numerico decrescente.

---

## 10. Archivi separati

### 10.1 Serie documentale

Una **serie documentale** identifica il soggetto che emette il DDT. Determina il mittente stampato
in intestazione e l'archivio su cui il documento viene registrato. Le serie in uso sono `MS` e
`PM`; l'elenco aggiornato e i mittenti associati sono in [USERS.md](USERS.md#1-serie-documentali).

La serie è un **dato di configurazione**, non una costante di codice: aggiungerne una non deve
comportare modifiche al modello dati.

### 10.2 Nomenclatura degli archivi

Standard definitivo:

```
<SERIE>_<CODICEAGENTE>_<ANNO>.json
```

| Segmento | Contenuto |
| --- | --- |
| `SERIE` | Sigla della serie documentale (`MS`, `PM`). |
| `CODICEAGENTE` | Codice agente assegnato all'utente (2–3 caratteri). |
| `ANNO` | Anno a 4 cifre. |

Esempi:

```
MS_GBE_2027.json
MS_MRU_2027.json
PM_MRU_2027.json
PM_SS_2027.json
```

Il nome va interpretato **per posizione**, separando sui due underscore. Non va cercato per
sottostringa: il codice agente può coincidere con una sigla di serie (`MS_MS_2027.json` è un nome
valido, vedi [USERS.md](USERS.md#2-utenti-abilitati)).

### 10.3 Struttura di un archivio

```json
{
  "version": 1,
  "updatedAt": "2026-07-22T09:40:00.000Z",
  "ddt": [],
  "counters": []
}
```

| Campo | Tipo | Significato |
| --- | --- | --- |
| `version` | `number` | Versione dello schema dell'archivio, per future migrazioni. |
| `updatedAt` | `string \| null` | Timestamp ISO dell'ultima scrittura, valorizzato dal backend. |
| `ddt` | `DDT[]` | Elenco dei documenti, nel formato descritto in §2. |
| `counters` | `array` | Residuo storico dei contatori; non usato dalle operazioni v2. |

Serie, agente e anno dell'archivio sono espressi dal **nome del file**, interpretato per
posizione (§10.2); il backend lo risolve da token + parametri, il contenuto non li ripete.

> **Scelta di progetto.** Una versione precedente di questo documento prevedeva un involucro
> `{ metadata, progressivo, documenti }`. L'implementazione ha mantenuto invece lo schema
> storico `{ version, updatedAt, ddt, counters }`, identico per ogni archivio: nessuna
> conversione in migrazione, nessun doppio formato. Un blocco `metadata` autodescrittivo resta
> un'estensione possibile (campo nuovo, non breaking) se la dashboard ne avrà bisogno.

### 10.4 Gestione del progressivo

- Il progressivo è **locale all'archivio**: ogni combinazione serie + agente + anno ha la propria
  sequenza, indipendente da tutte le altre.
- Non esiste un campo contatore nell'archivio: il prossimo numero si ricava scansionando i
  documenti della serie per l'anno dato e prendendo il massimo + 1 (§5.2). I documenti sono
  l'unica fonte di verità.
- Al cambio di anno nasce un nuovo archivio e il progressivo riparte da zero.

### 10.5 Vantaggi degli archivi separati

- **Isolamento**: il dispositivo di un agente lavora solo sui propri archivi; un errore o una
  corruzione resta circoscritta.
- **Dimensione contenuta**: la crescita di un archivio dipende dai documenti di un solo agente in
  un solo anno, non dal volume aziendale complessivo.
- **Concorrenza ridotta**: agenti diversi scrivono su file diversi, eliminando gran parte dei
  conflitti di scrittura simultanea.
- **Numerazione semplice**: i progressivi non devono essere coordinati tra utenti.
- **Riservatezza**: la separazione limita per costruzione l'esposizione dei dati sanitari indiretti.
- **Storicizzazione naturale**: gli archivi degli anni chiusi diventano immutabili.

### 10.6 Estendibilità

Aggiungere un archivio è un'operazione di configurazione: nasce alla prima emissione di un
documento per una combinazione serie + agente + anno non ancora presente. Nuovi agenti, nuove
serie e nuovi anni non richiedono modifiche al modello dati, al frontend o al backend.

### 10.7 Origine dei dati storici

Lo storico dell'applicazione a utente singolo (60 DDT al 22/07/2026) è stato migrato in
`MS_GBE_2026.json` senza alcuna modifica alla struttura dei documenti; i DDT privi di campo
`serie` ricevono `MS` in normalizzazione.

---

## 11. Identità del documento

**Il numero DDT non identifica univocamente il documento.** Lo stesso numero può esistere
legittimamente in archivi diversi: è una conseguenza voluta del fatto che il mittente non compare
nella numerazione.

L'identità completa di un documento è:

```
serie documentale + codice agente + anno + numero DDT
```

ovvero, in forma equivalente e più compatta:

```
nome archivio + numero DDT
```

Esempio: `27001MRU` non è sufficiente; `MS_MRU_2027.json` + `27001MRU` lo è.

Conseguenze operative:

- ogni ricerca, esportazione o ristampa deve trasportare l'archivio di provenienza insieme al
  numero;
- la dashboard amministrativa non può indicizzare i documenti sul solo numero;
- il campo `id` (UUID) resta l'unica chiave tecnica globalmente univoca e va preservato in
  qualunque migrazione.

Vedi [ARCHITECTURE.md](ARCHITECTURE.md) e [USERS.md](USERS.md).
