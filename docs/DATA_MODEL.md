# Modello dati

Struttura dei dati persistiti dall'applicazione, regole di normalizzazione e migrazioni.

---

## 1. Dove risiedono i dati

| Archivio | Tecnologia | Chiave | Contenuto |
| --- | --- | --- | --- |
| DDT | `localStorage` | `ddtRecords` | Array JSON di tutti i documenti. |
| Contatori | IndexedDB `ddt-db` v1, store `counters` | `anno` | Ultimo progressivo per anno. |
| Backup remoto | Google Drive via Apps Script | — | Snapshot JSON di DDT + contatori. |

---

## 2. Entità `DDT`

```json
{
  "id": "0f1c9b3e-7a44-4a0d-9f0e-6f6a1c2d3e4f",
  "numero": "26001GBE",
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
| `data` | `string` | Data documento in formato ISO `AAAA-MM-GG`. |
| `cliente` | `object` | Destinatario su tre righe libere (vedi §3). |
| `causale_trasporto` | `string` | Causale del trasporto. |
| `iniziali_paziente` | `string` | Iniziali del paziente (dato sanitario indiretto). |
| `cartella_clinica` | `string` | Numero cartella clinica / SDO. |
| `firma_destinatario` | `string \| null` | Data URL PNG della firma tracciata; `null` se assente. |
| `righe` | `Riga[]` | Righe articolo (vedi §4). |
| `createdAt` | `string?` | ISO 8601, presente solo se già valorizzato. |
| `updatedAt` | `string?` | ISO 8601; usato per risolvere i conflitti in sincronizzazione. |

Il **mittente non è persistito**: è una costante applicativa (`MITTENTE_FISSO`) usata in stampa.

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
| `CODICEAGENTE` | 2–3 | Codice agente assegnato (nel codice attuale costante `GBE`). |

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

- Il progressivo è calcolato scansionando i DDT esistenti **dello stesso anno** — confrontando i
  primi due caratteri del numero — e prendendo il massimo + 1. Il contatore su IndexedDB viene
  aggiornato come copia di sicurezza.
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

## 8. Payload di backup

Snapshot inviato al backend e conservato su Drive:

```json
{
  "version": 1,
  "updatedAt": "2026-01-15T09:40:00.000Z",
  "ddt": [],
  "counters": [{ "anno": "26", "last": 42 }]
}
```

---

## 9. Regole di merge

`mergeDDTLists()` unisce lista locale e lista remota:

1. Chiave di identità: `id`; in mancanza, `numero`. I record senza entrambi vengono scartati.
2. In caso di duplicato vince il record con `updatedAt` più recente, che sovrascrive l'altro
   campo per campo.
3. `firma_destinatario` è trattata a parte: si preserva sempre il valore non vuoto, anche se
   proviene dal record più vecchio.
4. Il risultato è ordinato per progressivo numerico decrescente.

---

## 10. Modello definitivo: archivi separati

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
  "metadata": {
      "serie": "MS",
      "mittente": "Zimmer Biomet Italia",
      "agente": "Giovanni Bennardo",
      "codiceAgente": "GBE",
      "anno": 2027,
      "versione": 1
  },
  "progressivo": 125,
  "documenti": []
}
```

| Campo | Tipo | Significato |
| --- | --- | --- |
| `metadata.serie` | `string` | Sigla della serie documentale. |
| `metadata.mittente` | `string` | Ragione sociale del soggetto emittente. |
| `metadata.agente` | `string` | Nome esteso dell'utente, per leggibilità e per la dashboard. |
| `metadata.codiceAgente` | `string` | Codice agente, usato nella numerazione e nel nome archivio. |
| `metadata.anno` | `number` | Anno di competenza dell'archivio. |
| `metadata.versione` | `number` | Versione dello schema dell'archivio, per future migrazioni. |
| `progressivo` | `number` | Ultimo progressivo utilizzato nell'archivio. |
| `documenti` | `DDT[]` | Elenco dei documenti, nel formato descritto in §2. |

I campi di `metadata` sono **ridondanti rispetto al nome del file**: il nome resta l'identificatore
operativo, `metadata` rende l'archivio autodescrittivo anche se estratto dal suo contesto. In caso
di discordanza fa fede il contenuto di `metadata`.

### 10.4 Gestione del progressivo

- Il progressivo è **locale all'archivio**: ogni combinazione serie + agente + anno ha la propria
  sequenza, indipendente da tutte le altre.
- Il nuovo numero è `progressivo + 1`; il campo viene aggiornato contestualmente all'inserimento
  del documento.
- Al cambio di anno nasce un nuovo archivio e il progressivo riparte da zero.
- Il valore resta comunque ricalcolabile scansionando `documenti`: `progressivo` è un indice di
  servizio, non l'unica fonte di verità. Questo mantiene la logica di recupero già presente
  nell'applicazione attuale (vedi §5).

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

### 10.7 Compatibilità con l'archivio attuale

L'archivio unico odierno (`{ version, updatedAt, ddt, counters }`, §8) corrisponde a un singolo
archivio della serie `MS` per l'agente `GBE`. La migrazione consiste nel riversarne i documenti in
`MS_GBE_<ANNO>.json` valorizzando `metadata` e `progressivo`, senza alcuna modifica alla struttura
del singolo DDT.

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
