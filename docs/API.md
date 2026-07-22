# API

Contratti dei servizi remoti utilizzati dall'applicazione.

Tutte le chiamate partono dal browser. Non esiste un livello server applicativo proprietario
oltre alla funzione OCR e alla Web App Google Apps Script.

---

## Indice dei servizi

| Servizio | Metodo | Scopo |
| --- | --- | --- |
| OCR | `POST /api/ocr` | Estrazione dati da immagine (etichetta o documento). |
| Backup | `POST` Apps Script Web App | Scrittura dello snapshot su Google Drive. |
| Sync | `GET` Apps Script Web App | Lettura dello snapshot remoto. |

Gli URL di produzione sono definiti come costanti in `app.js` (`OCR_URL`, `BACKUP_URL`).
La loro estrazione in un `config.js` separato è prevista insieme allo Storage Service (M05 della
[roadmap](../ROADMAP.md)).

---

## 1. OCR

### `POST /api/ocr`

Implementazione di riferimento: [`api/ocr.js`](../api/ocr.js) (funzione serverless).
Esempio self-hosted: [`backend/ocr-endpoint.example.js`](../backend/ocr-endpoint.example.js).

Il servizio inoltra l'immagine a un modello vision di OpenAI e restituisce **solo JSON**.
CORS è abilitato in modo permissivo (`Access-Control-Allow-Origin: *`); il metodo `OPTIONS` è
gestito come preflight.

#### Richiesta

```http
POST /api/ocr
Content-Type: application/json
```

```json
{
  "imageBase64": "<immagine JPEG codificata base64, senza prefisso data URL>",
  "mode": "document"
}
```

| Campo | Tipo | Obbligatorio | Note |
| --- | --- | --- | --- |
| `imageBase64` | `string` | sì | Immagine già compressa dal client (lato lungo max 1600px). |
| `mode` | `string` | no | `"document"` per il documento di scarico; qualsiasi altro valore (o assente) attiva la modalità etichetta singola. |

#### Risposta — modalità etichetta (default)

```json
{
  "ref": "ART-001",
  "lot": "L-2401",
  "description": "Stelo femorale 71mm"
}
```

`ref` e `lot` sono normalizzati in maiuscolo e con `trim()`. I campi non riconosciuti tornano
come stringa vuota.

#### Risposta — modalità documento (`mode: "document"`)

```json
{
  "cliente": "Ospedale Esempio",
  "data": "2026-01-15",
  "iniziali_paziente": "AB",
  "cartella_clinica": "12345",
  "righe": [
    {
      "codice_articolo": "ART-001",
      "description": "Stelo femorale 71mm",
      "lotto": "L-2401",
      "quantita": 1
    }
  ]
}
```

Elaborazioni applicate lato server:

- **Data**: il modello restituisce la data grezza nel formato italiano (`GG/MM/AA` o
  `GG/MM/AAAA`); il server la converte in ISO `AAAA-MM-GG`. Anni a due cifre: `<= 69` → `20xx`,
  altrimenti `19xx`. Se il formato non è riconosciuto, il campo torna vuoto.
- **Deduplica righe**: righe con stessa coppia `codice_articolo` + `lotto` vengono fuse
  sommando le quantità.
- **Normalizzazione**: `codice_articolo` e `lotto` in maiuscolo, `quantita` numerica con
  fallback a `1`.
- **Esclusioni**: UDI, GTIN, barcode, QR code, seriali, indirizzi e codici lunghi vengono ignorati.

#### Errori

| Codice | Condizione | Corpo |
| --- | --- | --- |
| `400` | `imageBase64` mancante | `{ "error": "No image provided" }` |
| `405` | Metodo diverso da `POST` / `OPTIONS` | `{ "error": "Method not allowed" }` |
| `500` | Errore del modello o JSON non valido | Struttura vuota della modalità richiesta (vedi sotto). |

In caso di `500` il servizio restituisce comunque un oggetto della forma attesa, con tutti i
campi vuoti, in modo che il client non debba gestire forme diverse:

```json
{ "cliente": "", "data": "", "iniziali_paziente": "", "cartella_clinica": "", "righe": [] }
```

```json
{ "ref": "", "lot": "", "description": "" }
```

#### Configurazione

| Variabile | Uso |
| --- | --- |
| `OPENAI_API_KEY` | Chiave API del provider vision. **Solo lato server.** |

---

## 2. Backup e sincronizzazione (Google Apps Script)

La Web App Apps Script espone un unico URL che accetta `GET` e `POST` e conserva su Google Drive
uno snapshot JSON dell'intero archivio.

### `GET <BACKUP_URL>?t=<timestamp>`

Restituisce lo snapshot remoto corrente. Il parametro `t` è un cache-buster.

#### Risposta

```json
{
  "version": 1,
  "updatedAt": "2026-01-15T09:40:00.000Z",
  "ddt": [],
  "counters": [{ "anno": "26", "last": 42 }]
}
```

Il client tratta `ddt` come array vuoto se il campo manca o non è un array.

### `POST <BACKUP_URL>`

Sovrascrive lo snapshot remoto con quello locale.

#### Richiesta

Corpo: lo stesso oggetto descritto sopra (`version`, `updatedAt`, `ddt`, `counters`).
La richiesta è inviata senza `Content-Type` esplicito per evitare il preflight CORS.

#### Comportamento del client

- Prima del `POST`, salvo esplicita disattivazione (`skipRemoteSafetyCheck`), il client esegue un
  `GET` e **annulla il backup** se `updatedAt` remoto è più recente di quello locale.
- Il `POST` è fire-and-forget: gli errori sono registrati in console e non bloccano la UI.
- La sincronizzazione (`syncDDT`) è eseguita solo se `navigator.onLine` è `true` e non è già in
  corso; le regole di fusione sono descritte in [DATA_MODEL.md](DATA_MODEL.md#9-regole-di-merge).

---

## 3. Sicurezza — stato attuale

- Gli endpoint **non sono autenticati**: chiunque conosca l'URL della Web App può leggere e
  sovrascrivere l'archivio.
- L'endpoint OCR è aperto a qualsiasi origine e non applica rate limiting.
- I dati transitati includono dati sanitari indiretti (iniziali paziente, cartella clinica).

L'introduzione di autenticazione e autorizzazione è prevista dalla milestone M08 della
[roadmap](../ROADMAP.md).

---

## 4. Evoluzione: backend multiarchivio

Con il passaggio agli archivi separati (M06–M07 della [roadmap](../ROADMAP.md)) il backend smette
di gestire un unico snapshot e opera su **un archivio per volta**.

### 4.1 Identificazione dell'archivio

Ogni richiesta lavora su uno specifico archivio, identificato da tre coordinate:

| Parametro | Esempio | Significato |
| --- | --- | --- |
| `serie` | `MS` | Serie documentale, determina il mittente. |
| `agente` | `GBE` | Codice agente assegnato all'utente. |
| `anno` | `2027` | Anno di competenza. |

Il backend risolve le tre coordinate nel nome file secondo lo standard
`<SERIE>_<CODICEAGENTE>_<ANNO>.json` (vedi
[DATA_MODEL.md](DATA_MODEL.md#102-nomenclatura-degli-archivi)). Le coordinate viaggiano come
parametri espliciti e **non** vengono ricavate dal numero del documento: il numero DDT non
identifica univocamente un documento (vedi
[DATA_MODEL.md](DATA_MODEL.md#11-identità-del-documento)).

### 4.2 Operazioni

| Operazione | Metodo | Effetto |
| --- | --- | --- |
| Lettura archivio | `GET` + coordinate | Restituisce `metadata`, `progressivo` e `documenti`. |
| Scrittura archivio | `POST` + coordinate | Aggiorna l'archivio indicato, lasciando invariati tutti gli altri. |

Regole:

- Una richiesta che non specifica le coordinate ricade sul **comportamento attuale**, così che i
  client non aggiornati continuino a funzionare.
- Una richiesta di scrittura tocca **un solo archivio**: non esiste un'operazione che aggiorni più
  archivi contemporaneamente.
- Un archivio inesistente viene creato alla prima scrittura, con `progressivo` inizializzato a
  zero e `metadata` valorizzato dalle coordinate.
- La safety check su `updatedAt` descritta in §2 resta valida, ma va applicata **per archivio** e
  non globalmente.
- La dashboard amministrativa usa esclusivamente operazioni di lettura.

### 4.3 Compatibilità

La compatibilità con gli endpoint attuali è un requisito, non un'opzione: l'archivio unico odierno
corrisponde alla combinazione `MS` + `GBE` + anno corrente, e resta raggiungibile senza coordinate
finché tutti i client non saranno migrati. Il frontend non conosce comunque questi dettagli, perché
li incapsula lo Storage Service (vedi
[ARCHITECTURE.md](ARCHITECTURE.md#42-storage-service)).

L'endpoint OCR **non è interessato** da questa evoluzione: è privo di stato e indipendente
dall'archivio di destinazione.
