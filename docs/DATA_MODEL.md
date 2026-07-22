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
| `numero` | `string` | Numero documento, formato `AAPPPAGE` (vedi §5). |
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

**Compatibilità.** I campi legacy `descrizione` e `articolo` vengono mappati su
`codice_articolo`, con precedenza `codice_articolo` → `descrizione` → `articolo`.
Un DDT legacy privo di `righe` ma con `articolo`/`descrizione` a livello di testata viene
convertito in un documento con una singola riga.

---

## 5. Numerazione

Formato: **`AAPPPAGE`** — esempio `26001GBE`.

| Segmento | Lunghezza | Significato |
| --- | --- | --- |
| `AA` | 2 | Ultime due cifre dell'anno (es. `26` = 2026). |
| `PPP` | 3 | Progressivo annuale, con zeri iniziali. |
| `AGE` | 3 | Codice agente (attualmente `GBE`, costante). |

Regole:

- Il progressivo è calcolato scansionando i DDT esistenti dello stesso anno e prendendo il
  massimo + 1. Il contatore su IndexedDB viene aggiornato come copia di sicurezza.
- **Il mittente non compare nella numerazione.** Nel modello obiettivo la stessa numerazione può
  esistere per mittenti diversi: la distinzione avviene tramite l'archivio di appartenenza.

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

## 10. Modello obiettivo: archivi separati

Nel modello multiutente ogni **serie documentale** avrà un archivio JSON indipendente su Drive:

```
MS_GBE_2026.json
PM_GBE_2026.json
MS_MRU_2026.json
```

Convenzione del nome: `<SERIE>_<AGENTE>_<ANNO>.json`.

Ogni archivio conterrà:

- `progressivo` — ultimo numero utilizzato nella serie;
- `documenti` — elenco dei DDT;
- `metadata` — informazioni di servizio (versione schema, ultimo aggiornamento, mittente).

Vedi [ARCHITECTURE.md](ARCHITECTURE.md) e [USERS.md](USERS.md).
