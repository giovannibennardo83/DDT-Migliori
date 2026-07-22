# DDT Migliori

Applicazione web (PWA) per creare, modificare, archiviare e stampare **Documenti di Trasporto (DDT)**
in ambito dispositivi medici / protesi ortopediche.

L'app funziona **offline**, salva i dati in locale sul dispositivo e li sincronizza con un backup
remoto su Google Drive tramite Google Apps Script. È inoltre presente un servizio OCR che legge
etichette prodotto e documenti di scarico sala operatoria per precompilare il DDT.

---

## Caratteristiche principali

- Compilazione DDT con testata (numero, data, cliente, causale, dati paziente) e righe ripetibili.
- Numerazione automatica progressiva annuale (formato `26001GBE`).
- OCR etichetta singola (REF / LOT / descrizione) e OCR documento di scarico completo.
- Firma del destinatario tracciata a schermo (canvas) e firma mittente come immagine PNG.
- Stampa in layout tabellare a 15 righe fisse, ottimizzato per modulo prestampato.
- Funzionamento offline tramite Service Worker + installabilità come PWA.
- Backup e sincronizzazione con merge dei documenti locali e remoti.

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

1. Compila la testata del DDT (o usa **OCR documento** per precompilarla).
2. Aggiungi le righe articolo (`codice_articolo`, `description`, `lotto`, `quantita`),
   manualmente oppure con **OCR etichetta**.
3. Acquisisci la firma del destinatario.
4. **Salva** il documento, poi riaprilo con **Modifica** o generane il PDF con **Stampa**.

---

## Struttura del repository

| Percorso | Ruolo |
| --- | --- |
| `index.html` | Interfaccia di compilazione DDT e archivio documenti. |
| `app.js` | Logica applicativa: righe, validazioni, OCR, firma, backup, sync. |
| `db.js` | Persistenza locale: `localStorage` per i DDT, IndexedDB per i contatori. |
| `print.html` / `print.css` | Layout e stili della stampa DDT. |
| `styles.css` | Stili dell'interfaccia, incluso layout mobile a card. |
| `manifest.json` / `sw.js` | Configurazione PWA e cache offline. |
| `api/ocr.js` | Endpoint OCR serverless (OpenAI Vision) in produzione. |
| `backend/ocr-endpoint.example.js` | Esempio di endpoint OCR self-hosted (Express). |
| `assets/` | Risorse statiche (firma mittente). |

---

## Documentazione

| Documento | Contenuto |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Istruzioni operative per gli assistenti AI che lavorano sul repository. |
| [ROADMAP.md](ROADMAP.md) | Visione, milestone e piano di evoluzione multiutente. |
| [CHANGELOG.md](CHANGELOG.md) | Storico delle modifiche rilasciate. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architettura attuale e architettura obiettivo. |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Schema dati DDT, righe, contatori e regole di normalizzazione. |
| [docs/API.md](docs/API.md) | Contratti degli endpoint OCR e backup/sync. |
| [docs/USERS.md](docs/USERS.md) | Utenti, ruoli, mittenti e modello di accesso previsto. |

---

## Stato del progetto

Applicazione **in produzione** per uso singolo agente, in evoluzione verso una piattaforma
multiutente (circa 20 agenti + ufficio amministrativo). Vedi [ROADMAP.md](ROADMAP.md).

---

## Licenza

Progetto privato. Tutti i diritti riservati.
