// Configurazione dell'applicazione.
// Va caricato prima di storage.js, db.js e app.js.
// L'identita' dell'agente non vive piu' qui: arriva dal login (vedi storage.js).
const APP_CONFIG = {
  backendUrl: 'https://script.google.com/macros/s/AKfycbxlQZz1wwIznHB33foNoFB32-Dq_cboxrjEq-A875iuZQJIcD1t6VQQ9v4VibeQXupc4w/exec',
  ocrUrl: 'https://ddt-chi.vercel.app/api/ocr',
};
