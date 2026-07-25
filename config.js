// Configurazione dell'applicazione.
// Va caricato prima di storage.js, db.js e app.js.
// L'identita' dell'agente non vive piu' qui: arriva dal login (vedi storage.js).
const APP_CONFIG = {
  backendUrl: 'https://script.google.com/macros/s/AKfycbw_hjDm8qCqWQ262LMS5yVVXJMoSCt9R25YD7XP-rZ0X4HpHf-ePgFJR2FNwIODKOd7yg/exec',
  ocrUrl: 'https://ddt-chi.vercel.app/api/ocr',
};
