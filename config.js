// Configurazione dell'applicazione.
// Va caricato prima di storage.js, db.js e app.js.
// L'identita' dell'agente non vive piu' qui: arriva dal login (vedi storage.js).
const APP_CONFIG = {
  backendUrl: 'https://script.google.com/macros/s/AKfycbyUmKuqXSSZKfaMtDt4UPeQtiV8Rw95yzLWKZrq5Ogthkd8cpr_wufjHpe3cR1na9lg-w/exec',
  ocrUrl: 'https://ddt-chi.vercel.app/api/ocr',
};
