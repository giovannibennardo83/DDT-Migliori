# DDT Migliori

Applicazione web (PWA) **multiutente** per creare, modificare, archiviare e stampare **Documenti
di Trasporto (DDT)** in ambito dispositivi medici / protesi ortopediche.

Ogni agente accede con il proprio codice e PIN e lavora sui propri documenti, conservati su
Google Drive (un file JSON per DDT, in cartelle per agente, serie documentale e anno) tramite
Google Apps Script, con **sincronizzazione incrementale**. L'app funziona **offline** (le
operazioni si accodano e partono al ritorno della rete) ed è affiancata da un servizio OCR che
legge etichette prodotto e documenti di scarico sala operatoria per precompilare il DDT.

---

## Caratteristiche principali

- **Login per agente** (codice + PIN, con cambio obbligatorio del PIN iniziale) e sessione
  persistente sul dispositivo; selezione della serie documentale per gli utenti abilitati a più
  mittenti.
- Compilazione DDT con testata (numero, data, cliente, causale, dati paziente) e righe ripetibili.
- Numerazione automatica progressiva **per serie e anno**: prefisso di due cifre dell'anno +
  progressivo + codice agente (`26001GBE` nel 2026, `27001GBE` nel 2027), con progressivo che
  riparte ogni anno.
- **Un file JSON per documento** su Drive (`Archivio/<Agente>/<Serie>/<Anno>/<Numero>.json`):
  scritture atomiche per singolo DDT, sincronizzazione incrementale (viaggiano solo i documenti
  modificati), eliminazioni recuperabili dal cestino di Drive.
- Archivio in app con **ultimi 5 di default**, chip `Ultimi 5 · 30 · Tutti` e ricerca live su
  numero e cliente.
- OCR etichetta singola (REF / LOT / descrizione) e OCR documento di scarico completo.
- Firma del destinatario tracciata a schermo e **firma mittente personale di ogni agente**
  (disegnata al primo accesso, ritagliata automaticamente); mittente di stampa derivato dalla
  serie del documento.
- Stampa in layout tabellare con **12 righe per pagina**; i documenti più lunghi proseguono su
  più pagine, ognuna copia completa del modulo; firme vincolate a 200×48 px.
- Funzionamento offline tramite Service Worker + coda operazioni + installabilità come PWA;
  dati locali separati per agente sulle postazioni condivise.

---

## Avvio rapido

L'applicazione è statica: non richiede build.

```bash
python -m http.server 8000
```

Apri poi `http://localhost:8000/index.html` in un browser moderno.

> Aprire `index.html` direttamente da filesystem (`file://`) funziona per la sola compilazione,
> ma disabilita Service Worker e alcune funzionalità di rete.

### Flusso d'uso

1. **Accedi** con codice agente e PIN (il primo accesso richiede la rete e impone un PIN
   personale); se sei abilitato a più serie, scegli il mittente attivo.
2. Compila la testata del DDT (o usa **OCR documento** per precompilarla).
3. Aggiungi le righe articolo (`codice_articolo`, `description`, `lotto`, `quantita`),
   manualmente oppure con **OCR etichetta**.
4. Acquisisci la firma del destinatario.
5. **Salva** il documento, poi riaprilo con **Modifica** o generane il PDF con **Stampa**.

---

## Struttura del repository

| Percorso | Ruolo |
| --- | --- |
| `index.html` | Interfaccia: login, compilazione DDT e archivio documenti. |
| `config.js` | Endpoint dell'applicazione (backend dati, OCR). |
| `storage.js` | Storage Service: sessione, operazioni per documento, coda offline. |
| `app.js` | Logica applicativa: righe, validazioni, OCR, firma, sync, login UI. |
| `db.js` | Persistenza locale: `localStorage` per i DDT, IndexedDB per i contatori. |
| `print.html` / `print.css` | Layout e stili della stampa DDT (multipagina). |
| `styles.css` | Stili dell'interfaccia, incluso layout mobile a card. |
| `manifest.json` / `sw.js` | Configurazione PWA e cache offline. |
| `api/ocr.js` | Endpoint OCR serverless (OpenAI Vision) in produzione. |
| `backend/ocr-endpoint.example.js` | Esempio di endpoint OCR self-hosted (Express). |
| `assets/` | Risorse statiche (firma mittente). |

Il backend dati (Apps Script v3.1) non vive nel repository: è nel Google account del progetto.
Contratto in [docs/API.md](docs/API.md).

---

## Documentazione

| Documento | Contenuto |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Istruzioni operative per gli assistenti AI che lavorano sul repository. |
| [ROADMAP.md](ROADMAP.md) | Visione, milestone e piano di evoluzione multiutente. |
| [CHANGELOG.md](CHANGELOG.md) | Storico delle modifiche rilasciate. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architettura attuale e architettura obiettivo. |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Schema dati DDT, normalizzazione, archivi e identità del documento. |
| [docs/API.md](docs/API.md) | Contratti degli endpoint OCR e backup/sync, backend multiarchivio. |
| [docs/USERS.md](docs/USERS.md) | Serie documentali, utenti abilitati, ruoli e modello di crescita. |

---

## Stato del progetto

Piattaforma **multiutente funzionante in ambiente di test** (una ventina di agenti configurati +
utenza amministrativa).

| Componente | Stato |
| --- | --- |
| Backend v3.1 (un file per DDT, sync incrementale, autenticazione, firme) | ✅ Completato |
| Frontend Login (PIN, cambio obbligatorio, selezione serie, firma mittente) | ✅ Completato |
| Offline Queue (coda operazioni con invio automatico) | ✅ Completato |
| Dashboard Admin (consultazione, ristampa, export) | ⏳ Pianificata (M11) |
| Deploy Vercel + repository privato | ⏳ Pianificato (M12) |

Vedi [ROADMAP.md](ROADMAP.md) per le milestone e [docs/USERS.md](docs/USERS.md) per la
configurazione aziendale.

---

## Licenza

Progetto privato. Tutti i diritti riservati.
