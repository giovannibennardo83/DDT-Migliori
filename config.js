// Configurazione dell'applicazione.
// Va caricato prima di storage.js, db.js e app.js.
// L'identita' dell'agente non vive piu' qui: arriva dal login (vedi storage.js).
const APP_CONFIG = {
  backendUrl: 'https://script.google.com/macros/s/AKfycbzg8dEPdItQhJTgClYWts1xhZcw7RMkf896XeCfAjYtMhlO6WI_Pi5mFaKF2FpMwPWBsg/exec',
  ocrUrl: 'https://ddt-chi.vercel.app/api/ocr',
};
