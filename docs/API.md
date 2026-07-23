# API

Contratti dei servizi remoti utilizzati dall'applicazione.

Tutte le chiamate partono dal browser. Non esiste un livello server applicativo proprietario
oltre alla funzione OCR e alla Web App Google Apps Script (backend v2).

---

## Indice dei servizi

| Servizio | Metodo | Scopo |
| --- | --- | --- |
| OCR | `POST /api/ocr` | Estrazione dati da immagine (etichetta o documento). |
| Backend dati | `POST` Apps Script Web App | Login, lettura archivi, operazioni per documento. |
| Stato backend | `GET` Apps Script Web App | Ping di servizio. |

Gli URL sono definiti in [`config.js`](../config.js) (`backendUrl`, `ocrUrl`). Lato frontend
**tutte le chiamate al backend dati passano dallo Storage Service** ([`storage.js`](../storage.js)):
nessun altro file esegue `fetch` verso Apps Script.

---

## 1. OCR

### `POST /api/ocr`

Implementazione di riferimento: [`api/ocr.js`](../api/ocr.js) (funzione serverless).
Esempio self-hosted: [`backend/ocr-endpoint.example.js`](../backend/ocr-endpoint.example.js).

Il servizio inoltra l'immagine a un modello vision di OpenAI e restituisce **solo JSON**.
CORS è abilitato in modo permissivo (`Access-Control-Allow-Origin: *`); il metodo `OPTIONS` è
gestito come preflight. L'endpoint è privo di stato e indipendente dagli archivi.

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

## 2. Backend dati (Apps Script v2)

Web App Apps Script con **un solo endpoint**. Il codice vive nell'account Google del progetto,
non in questo repository.

Caratteristiche trasversali:

- Ogni richiesta operativa è un **`POST` con body JSON** e campo `azione`. Il body viaggia
  **senza header `Content-Type`** (evita il preflight CORS, che Apps Script non gestisce);
  lato server viene letto da `e.postData.contents`.
- La risposta è **sempre JSON** con `ok: true` oppure `ok: false` + `errore` (codice macchina).
- La `GET` senza parametri è un ping: `{ "ok": true, "servizio": "DDT-Migliori Backend v2" }`.
- Le scritture sono **atomiche e per singolo documento**: sotto lock globale (`LockService`)
  il backend legge l'archivio, applica l'operazione e lo riscrive, senza stati intermedi
  osservabili. Non esiste un'operazione che sostituisca un archivio intero, né un client può
  inviarne uno: il body di `upsert` trasporta **un** documento, quello di `delete` un `id`.

### 2.1 Autenticazione e sessioni

- Login con **codice agente + PIN**. I PIN sono conservati come hash SHA-256 con salt, mai in
  chiaro; la configurazione utenti è in `utenti.json` sul Drive (vedi
  [USERS.md](USERS.md#2-utenti-abilitati)).
- Il login restituisce un **token di sessione** (validità 30 giorni, rinnovata a ogni uso).
  Le sessioni vivono nelle Script Properties del progetto Apps Script.
- **Il codice agente non viaggia mai nelle operazioni**: deriva sempre dal token lato server.
  Un client non può esprimere l'intenzione di operare sull'archivio di un altro agente.
- Ruoli: `agente` (legge e scrive i propri archivi) e `admin` (legge **qualsiasi** archivio
  indicando `codiceAgente` — unica eccezione al punto precedente, in sola lettura — ma **non può
  scrivere**).
- **Tutte le autorizzazioni sono verificate dal server a ogni richiesta**: serie abilitate,
  proprietà dell'archivio, ruolo. Il client non applica controlli di sicurezza, solo di
  esperienza d'uso; nulla di ciò che invia è considerato attendibile.

### 2.2 Azioni

| Azione | Body (oltre ad `azione`) | Risposta `ok: true` |
| --- | --- | --- |
| `login` | `codice`, `pin` | `token`, `utente {codice, nome, serie[], ruolo}`, `serieInfo` (mittenti per serie) |
| `leggi` | `token`, `serie`, `anno` (+ `codiceAgente` se admin) | `archivio {version, updatedAt, ddt[], counters[]}` |
| `upsert` | `token`, `serie`, `anno`, `ddt {…}` | `documenti` (conteggio dopo l'operazione) |
| `delete` | `token`, `serie`, `anno`, `id` | `documenti` |
| `cambiaPin` | `token`, `pinAttuale`, `pinNuovo` | — |
| `logout` | `token` | — |

Semantica:

- **`leggi`** risolve `serie + codice (dal token) + anno` nel file
  `<SERIE>_<CODICEAGENTE>_<ANNO>.json`; un archivio inesistente torna vuoto, senza errore.
- **`upsert`** inserisce il documento se l'`id` non esiste, altrimenti lo sostituisce.
  L'archivio viene creato alla prima scrittura.
- **`delete`** rimuove il documento con quell'`id`; se non esiste risponde
  `documento_non_trovato`.
- **`cambiaPin`** richiede il PIN attuale: il solo token non basta.

### 2.3 Codici di errore

| Codice | Significato |
| --- | --- |
| `credenziali_mancanti` / `credenziali_non_valide` | Login rifiutato. |
| `pin_non_assegnato` | Utente esistente ma senza PIN: va assegnato dall'amministratore. |
| `sessione_non_valida` | Token assente, scaduto o revocato: serve un nuovo login. |
| `serie_non_abilitata` | L'utente non è abilitato alla serie richiesta. |
| `anno_non_valido` | Anno fuori dall'intervallo 2020–2100. |
| `admin_sola_lettura` | Tentativo di scrittura con ruolo admin. |
| `documento_non_valido` / `id_mancante` | Payload dell'operazione incompleto. |
| `documento_non_trovato` | Delete di un id inesistente. |
| `azione_sconosciuta` / `interno` | Richiesta malformata o errore server. |

### 2.4 Comportamento del client (Storage Service)

- **Coda offline**: se una operazione di scrittura fallisce per rete, viene accodata in
  `localStorage` (`ddtOpsPending`) e reinviata automaticamente al ritorno della connessione,
  all'avvio e prima di ogni sincronizzazione. Un'operazione più recente sullo stesso documento
  sostituisce quella in coda.
- **Sincronizzazione**: prima lo svuotamento della coda, poi la lettura degli archivi
  dell'utente (ogni serie abilitata × anno corrente e precedente). A coda vuota il server è
  autorevole (le eliminazioni fatte da altri dispositivi si propagano); con operazioni in coda,
  o con un remoto inaspettatamente vuoto a fronte di dati locali, si applica il merge
  conservativo.
- **Sessione scaduta**: le operazioni restano in coda, l'app ripresenta il login e riparte da lì.

---

## 3. Sicurezza — stato attuale

- Il deployment Apps Script è pubblico (*Chiunque*): l'autenticazione è **applicativa**,
  interna allo script. Adeguata al modello di rischio del progetto, non a standard bancari.
- Tutto il traffico è su HTTPS. Il salt dei PIN è una costante dello script: non va cambiato a
  PIN assegnati, né pubblicato.
- I PIN iniziali seguono lo schema `CODICE1234` e il **cambio al primo accesso è obbligatorio**
  lato app; fino al primo accesso di ciascun agente lo schema resta indovinabile — distribuire
  i codici a ridosso dell'attivazione.
- Non c'è rate limiting sull'endpoint: un abuso è mitigabile solo ruotando l'URL del deployment.
- I dati transitati includono dati sanitari indiretti (iniziali paziente, cartella clinica).

---

## 4. Evoluzione prevista

- **Dashboard amministrativa** (M11): userà le azioni esistenti con utenza `ADMIN` (`leggi` con
  `codiceAgente`); non richiede nuove azioni lato backend, salvo un eventuale indice aggregato
  se il numero di archivi rendesse costosa l'enumerazione.
- Possibili irrobustimenti futuri: rotazione periodica del token, revoca centralizzata delle
  sessioni, audit log delle operazioni.
