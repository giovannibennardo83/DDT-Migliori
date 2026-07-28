const form = document.getElementById('ddt-form');
const list = document.getElementById('ddt-list');
const printLastButton = document.getElementById('print-last');
const addRowButton = document.getElementById('add-row');
const righeContainer = document.getElementById('righe-container');
const cancelEditButton = document.getElementById('cancel-edit');
const formTitle = document.getElementById('form-title');
const ocrInputCamera = document.getElementById('ocr-input-camera');
const ocrInputGallery = document.getElementById('ocr-input-gallery');
const ocrScaricoButton = document.getElementById('ocr-scarico-btn');
const ocrScaricoGalleryButton = document.getElementById('ocr-scarico-gallery-btn');
const ocrScaricoInputCamera = document.getElementById('ocr-scarico-input-camera');
const ocrScaricoInputGallery = document.getElementById('ocr-scarico-input-gallery');
const ocrStatus = document.getElementById('ocr-status');
const ocrPreview = document.getElementById('ocr-preview');
let activeOcrRow = null;


const OCR_URL = APP_CONFIG.ocrUrl;
const numeroInput = document.getElementById('numero');
const dataInput = document.getElementById('data');
const clienteRiga1Input = document.getElementById('cliente_riga1');
const clienteRiga2Input = document.getElementById('cliente_riga2');
const clienteRiga3Input = document.getElementById('cliente_riga3');
const causaleInput = document.getElementById('causale_trasporto');
const inizialiInput = document.getElementById('iniziali_paziente');
const cartellaInput = document.getElementById('cartella_clinica');
const saveButton = document.getElementById('save-ddt-btn');
const newDDTButton = document.getElementById('new-ddt-btn');
const saveStatus = document.getElementById('save-status');
const firmaDestinatarioButton = document.getElementById('firma-destinatario-btn');
const firmaModal = document.getElementById('firma-modal');
const closeFirmaModalButton = document.getElementById('close-firma-modal');
const clearFirmaModalButton = document.getElementById('clear-firma-modal');
const saveFirmaModalButton = document.getElementById('save-firma-modal');
const firmaCanvas = document.getElementById('firma-canvas');
const firmaPreviewWrapper = document.getElementById('firma-preview-wrapper');
const firmaPreview = document.getElementById('firma-preview');

let editingIndex = null;
let syncInProgress = false;
let isSaving = false;
let saveStatusTimeout = null;
let firmaCtx = null;
let firmaIsDrawing = false;
let firmaLastPoint = null;
let temporaryFirmaImage = null;

function setSavingState(saving) {
  isSaving = saving;
  if (!saveButton) return;

  saveButton.disabled = saving;
  saveButton.innerHTML = saving
    ? '<span class="save-spinner" aria-hidden="true"></span>Sto salvando...'
    : 'Salva DDT';
  
  if (saveStatus && saving) {
    saveStatus.textContent = 'Sto salvando...';
    }
  
}


// type: 'success' | 'error' (si chiudono da soli) | 'pending' (spinner, resta
// visibile finche' non arriva un altro toast o hideSaveToast()).
function showSaveToast(message, type = 'success') {
  if (!saveStatus) return;

  if (saveStatusTimeout) {
    clearTimeout(saveStatusTimeout);
    saveStatusTimeout = null;
  }

  saveStatus.classList.remove('is-success', 'is-error', 'is-pending');

  if (type === 'pending') {
    saveStatus.innerHTML = '<span class="save-spinner" aria-hidden="true"></span>';
    saveStatus.append(message);
    saveStatus.classList.add('is-pending');
    return;
  }

  saveStatus.textContent = message;
  saveStatus.classList.add(type === 'error' ? 'is-error' : 'is-success');

  saveStatusTimeout = setTimeout(() => {
    saveStatus.textContent = '';
    saveStatus.classList.remove('is-success', 'is-error');
    saveStatusTimeout = null;
  }, 3000);
}

function hideSaveToast() {
  if (!saveStatus) return;
  if (saveStatusTimeout) {
    clearTimeout(saveStatusTimeout);
    saveStatusTimeout = null;
  }
  saveStatus.textContent = '';
  saveStatus.classList.remove('is-success', 'is-error', 'is-pending');
}



function initFirmaCanvasContext() {
  if (!firmaCanvas) return null;
  const ctx = firmaCanvas.getContext('2d');
  if (!ctx) return null;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.2;

  return ctx;
}

function clearFirmaCanvas() {
  if (!firmaCanvas) return;
  if (!firmaCtx) firmaCtx = initFirmaCanvasContext();
  if (!firmaCtx) return;

  firmaCtx.save();
  firmaCtx.setTransform(1, 0, 0, 1, 0, 0);
  firmaCtx.clearRect(0, 0, firmaCanvas.width, firmaCanvas.height);
  firmaCtx.restore();
}

function resizeFirmaCanvas() {
  if (!firmaCanvas) return;
  const ratio = window.devicePixelRatio || 1;
  const rect = firmaCanvas.getBoundingClientRect();
  firmaCanvas.width = Math.max(1, Math.round(rect.width * ratio));
  firmaCanvas.height = Math.max(1, Math.round(rect.height * ratio));

  firmaCtx = initFirmaCanvasContext();
  if (!firmaCtx) return;
  firmaCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  clearFirmaCanvas();
}

// La modale firma serve due scopi: la firma del destinatario sul documento
// corrente e la firma mittente personale dell'agente (salvata sul backend).
let firmaModalMode = 'destinatario';

function openFirmaModal(mode = 'destinatario') {
  if (!firmaModal) return;
  firmaModalMode = mode;

  const titolo = document.getElementById('firma-modal-title');
  if (titolo) {
    titolo.textContent = mode === 'mittente' ? 'La mia firma (mittente)' : 'Firma destinatario';
  }

  firmaModal.hidden = false;
  resizeFirmaCanvas();
}

function closeFirmaModal() {
  if (!firmaModal) return;
  firmaModal.hidden = true;
}

function getFirmaPoint(event) {
  if (!firmaCanvas) return null;
  const rect = firmaCanvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function onFirmaPointerDown(event) {
  if (!firmaCanvas || !firmaCtx) return;
  event.preventDefault();

  firmaIsDrawing = true;
  firmaLastPoint = getFirmaPoint(event);
  if (!firmaLastPoint) return;

  firmaCtx.beginPath();
  firmaCtx.moveTo(firmaLastPoint.x, firmaLastPoint.y);

  if (typeof firmaCanvas.setPointerCapture === 'function' && event.pointerId !== undefined) {
    firmaCanvas.setPointerCapture(event.pointerId);
  }
}

function onFirmaPointerMove(event) {
  if (!firmaIsDrawing || !firmaCtx) return;
  event.preventDefault();

  const point = getFirmaPoint(event);
  if (!point || !firmaLastPoint) return;

  firmaCtx.beginPath();
  firmaCtx.moveTo(firmaLastPoint.x, firmaLastPoint.y);
  firmaCtx.lineTo(point.x, point.y);
  firmaCtx.stroke();

  firmaLastPoint = point;
}

function onFirmaPointerUp(event) {
  if (!firmaCanvas) return;

  firmaIsDrawing = false;
  firmaLastPoint = null;

  if (typeof firmaCanvas.releasePointerCapture === 'function' && event.pointerId !== undefined) {
    try {
      firmaCanvas.releasePointerCapture(event.pointerId);
    } catch (_) {
      // Ignora: il puntatore potrebbe non essere più catturato.
    }
  }
}

function clearFirmaPlaceholder() {
  clearFirmaCanvas();
}


function updateFirmaPreview() {
  if (!firmaPreviewWrapper || !firmaPreview) return;

  if (!temporaryFirmaImage) {
    firmaPreviewWrapper.hidden = true;
    firmaPreview.removeAttribute('src');
    return;
  }

  firmaPreview.src = temporaryFirmaImage;
  firmaPreviewWrapper.hidden = false;
}

// Ritaglia il canvas al riquadro effettivamente disegnato (pixel con alpha),
// con un piccolo margine. Restituisce null se il canvas e' vuoto. Senza
// ritaglio una firma tracciata in alto produce un'immagine altissima che in
// stampa sfonda la pagina A4.
function ritagliaFirmaCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  if (!width || !height) return null;

  const pixels = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null; // nessun tratto

  const margine = 8;
  minX = Math.max(0, minX - margine);
  minY = Math.max(0, minY - margine);
  maxX = Math.min(width - 1, maxX + margine);
  maxY = Math.min(height - 1, maxY + margine);

  const ritaglio = document.createElement('canvas');
  ritaglio.width = maxX - minX + 1;
  ritaglio.height = maxY - minY + 1;
  ritaglio.getContext('2d').drawImage(
    canvas, minX, minY, ritaglio.width, ritaglio.height, 0, 0, ritaglio.width, ritaglio.height);

  return ritaglio.toDataURL('image/png');
}

function saveFirmaPlaceholder() {
  if (!firmaCanvas) return;

  const immagine = ritagliaFirmaCanvas(firmaCanvas);
  if (!immagine) {
    showSaveToast('Disegna la firma prima di salvare', 'error');
    return;
  }

  if (firmaModalMode === 'mittente') {
    salvaFirmaMittente(immagine);
    return;
  }

  temporaryFirmaImage = immagine;
  updateFirmaPreview();
  closeFirmaModal();
  showSaveToast('Firma acquisita', 'success');
}

// Callback da eseguire dopo il passo firma del primo accesso.
let dopoPassoFirma = null;

async function salvaFirmaMittente(immagine) {
  showSaveToast('Salvataggio firma in corso…', 'pending');

  try {
    const esito = await STORAGE.salvaFirma(immagine);

    if (!esito.ok) {
      showSaveToast(esito.errore === 'firma_troppo_grande'
        ? 'Firma troppo pesante: riprova con un tratto più semplice'
        : 'Salvataggio firma non riuscito', 'error');
      return;
    }

    closeFirmaModal();
    showSaveToast('Firma salvata', 'success');

    if (dopoPassoFirma) {
      const prosegui = dopoPassoFirma;
      dopoPassoFirma = null;
      prosegui();
    }
  } catch (err) {
    console.error('Errore salvataggio firma:', err);
    showSaveToast('Serve la connessione per salvare la firma', 'error');
  }
}

function createEmptyRiga() {
  return { codice_articolo: '', description: '', lotto: '', quantita: 1 };
}

function normalizeRiga(riga) {
  return {
    codice_articolo: String(riga?.codice_articolo ?? riga?.descrizione ?? riga?.articolo ?? '').trim(),
    description: String(riga?.description ?? '').trim(),
    lotto: String(riga?.lotto ?? '').trim(),
    quantita: Math.max(1, Number(riga?.quantita) || 1),
  };
}

function formatRows(righe = []) {
  return righe.map((riga) => `${riga.codice_articolo}${riga.description ? ' - ' + riga.description : ''} | ${riga.lotto} x${riga.quantita}`).join(' · ');
}

function formatDisplayDate(value) {
  const input = String(value || '').trim();
  const match = input.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (!match) return input;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

function formatItem(ddt) {
  const multiSerie = (STORAGE.utente()?.serie || []).length > 1;
  const prefissoSerie = multiSerie ? `[${ddt.serie || 'MS'}] ` : '';
  return `${prefissoSerie}${ddt.numero || 'Senza numero'} - ${formatDisplayDate(ddt.data)} - ${ddt.cliente.riga1} (${formatRows(ddt.righe)})`;
}

function setSimpleFieldError(input, message) {
  input.classList.add('input-error');
  const small = input.parentElement.querySelector('.error-message');
  if (small) small.textContent = message;
}

function clearSimpleFieldError(input) {
  input.classList.remove('input-error');
  const small = input.parentElement.querySelector('.error-message');
  if (small) small.textContent = '';
}

function renderRow(riga = createEmptyRiga()) {
  const row = document.createElement('div');
  row.className = 'riga-row';
  row.innerHTML = `
    <div class="field-with-actions">
      <input type="text" class="codice_articolo" value="${riga.codice_articolo}" placeholder="Codice articolo" />
      <small class="error-message"></small>
    </div>

    <div class="field-with-actions description-wrap">
      <input type="text" class="description" value="${riga.description}" placeholder="Descrizione" />
      <small class="error-message"></small>
    </div>

    <div class="field-with-actions">
      <input type="text" class="lotto" value="${riga.lotto}" placeholder="Lotto" />
      <div class="ocr-row-tools">
        <p class="ocr-row-title">OCR prodotto</p>
        <p class="ocr-row-subtitle">Scansiona un singolo bollino</p>
      <div class="ocr-actions ocr-actions-row">
        <button type="button" class="ocr-scan-camera secondary">📷 Scatta foto</button>
        <button type="button" class="ocr-scan-gallery secondary">🖼️ Carica da galleria</button>
      </div>
      </div>
      <small class="error-message"></small>
    </div>

    <div class="field-with-actions qty-wrap">
      <input type="number" class="quantita" value="${riga.quantita}" min="1" placeholder="Quantità" />
      <button type="button" class="danger remove-row">Rimuovi riga</button>
      <small class="error-message"></small>
    </div>
  `;

  row.querySelector('.remove-row').addEventListener('click', () => {
    row.remove();
    if (righeContainer.children.length === 0) {
      addRiga();
    }
  });

  row.querySelector('.ocr-scan-camera').addEventListener('click', () => startOcrForRow(row, 'camera'));
  row.querySelector('.ocr-scan-gallery').addEventListener('click', () => startOcrForRow(row, 'gallery'));

  row.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => clearFieldError(input));
  });

  righeContainer.appendChild(row);
}

function addRiga() {
  renderRow(createEmptyRiga());
}

function setFieldError(input, message) {
  input.classList.add('input-error');
  const small = input.closest('.field-with-actions').querySelector('.error-message');
  small.textContent = message;
}

function clearFieldError(input) {
  input.classList.remove('input-error');
  const small = input.closest('.field-with-actions').querySelector('.error-message');
  small.textContent = '';
}

function extractAndValidateRighe() {
  const rows = [...righeContainer.querySelectorAll('.riga-row')];
  const result = [];
  let valid = true;

  if (rows.length === 0) {
    valid = false;
    addRiga();
  }

  rows.forEach((row) => {
    const codice = row.querySelector('.codice_articolo');
    const description = row.querySelector('.description');
    const lotto = row.querySelector('.lotto');
    const quantita = row.querySelector('.quantita');

    const normalized = normalizeRiga({
      codice_articolo: codice.value,
      description: description.value,
      lotto: lotto.value,
      quantita: quantita.value,
    });

    if (!normalized.codice_articolo) {
      setFieldError(codice, 'Obbligatorio');
      valid = false;
    }

    if (!normalized.lotto) {
      setFieldError(lotto, 'Obbligatorio');
      valid = false;
    }

    if (!Number.isFinite(normalized.quantita) || normalized.quantita < 1) {
      setFieldError(quantita, 'Minimo 1');
      valid = false;
    }

    result.push(normalized);
  });

  return { valid, righe: result };
}

function resetFormState() {
  editingIndex = null;
  formTitle.textContent = 'Nuovo DDT';
  cancelEditButton.hidden = true;
  form.reset();
  numeroInput.value = '';
  numeroInput.placeholder = 'Assegnato al salvataggio';
  righeContainer.innerHTML = '';
  addRiga();
  temporaryFirmaImage = null;
  updateFirmaPreview();
  aggiornaAnteprimaNumero();
}

// Mostra nel campo numero quale sara' il prossimo assegnato: rende visibile
// a colpo d'occhio l'effetto del progressivo iniziale (transizione dalla
// carta) e della serie attiva.
async function aggiornaAnteprimaNumero() {
  if (!numeroInput || !STORAGE.sessioneAttiva()) return;

  try {
    const prossimo = await getNextDDTNumber();
    if (!numeroInput.value) {
      numeroInput.placeholder = `Assegnato al salvataggio (prossimo: ${prossimo})`;
    }
  } catch (err) {
    console.error('Anteprima numero non disponibile:', err);
  }
}

function loadInForm(ddt, index) {
  editingIndex = index;
  formTitle.textContent = `Modifica DDT ${ddt.numero}`;
  cancelEditButton.hidden = false;
  numeroInput.value = ddt.numero;
  dataInput.value = ddt.data;
  clienteRiga1Input.value = ddt.cliente.riga1 || '';
  clienteRiga2Input.value = ddt.cliente.riga2 || '';
  clienteRiga3Input.value = ddt.cliente.riga3 || '';
  causaleInput.value = ddt.causale_trasporto || '';
  inizialiInput.value = ddt.iniziali_paziente || '';
  cartellaInput.value = ddt.cartella_clinica || '';

  righeContainer.innerHTML = '';
  if (!ddt.righe.length) {
    addRiga();
  } else {
    ddt.righe.forEach((riga) => renderRow(normalizeRiga(riga)));
  }

  temporaryFirmaImage = ddt.firma_destinatario || null;
  updateFirmaPreview();
}


function saveAndPrint(ddt) {
  const mittente = STORAGE.mittentePer(ddt.serie || 'MS').join('\n');
  const firmaMittente = STORAGE.firmaMittente();
  localStorage.setItem('printDDT', JSON.stringify({ ...ddt, mittente, firmaMittente }));
  const printWindow = window.open('print.html', '_blank');
  if (!printWindow) {
    alert('Impossibile aprire la finestra di stampa.');
  }
}

// Consegna dei blocchi del recupero in sottofondo (prima sync progressiva):
// ogni blocco si aggiunge ai documenti locali e la lista si allunga man mano.
function applicaBloccoBackfill(blocco, serie) {
  const attuali = getDDTs();

  (blocco || []).forEach((remoto) => {
    if (!remoto || !remoto.id) return;
    remoto.serie = serie;
    const indice = attuali.findIndex((d) => d.id === remoto.id);
    if (indice >= 0) attuali[indice] = remoto;
    else attuali.push(remoto);
  });

  saveDDTs(attuali);
  render(attuali);
}

// "Ultimi 30", "Tutti" e la ricerca hanno bisogno dell'archivio completo:
// se il recupero in sottofondo e' ancora in corso, popup finche' non finisce.
async function attendiArchivioCompleto() {
  if (!STORAGE.backfillInCorso()) return;
  showSaveToast('Caricamento archivio completo…', 'pending');
  await STORAGE.attendiBackfill();
  hideSaveToast();
}

async function syncDDT(mostraAttesa = false) {
  if (!navigator.onLine) return;
  if (!STORAGE.sessioneAttiva()) return;
  if (syncInProgress) return;
  syncInProgress = true;

  // L'attesa si mostra solo all'apertura dell'app; le sincronizzazioni
  // periodiche in sottofondo restano silenziose.
  if (mostraAttesa) showSaveToast('Caricamento archivio da Google Drive…', 'pending');

  try {
    console.log('SYNC START');

    // Prima le operazioni rimaste in coda (salvataggi/eliminazioni offline),
    // poi la riconciliazione incrementale con gli archivi remoti.
    await STORAGE.flushQueue();

    const finalDDT = await STORAGE.sincronizza(await getAllDDT(), applicaBloccoBackfill);
    console.log('SYNC: documenti dopo riconciliazione:', finalDDT.length);

    await saveAllDDT(finalDDT);
    await updateCountersFromDDT(finalDDT);
    render(finalDDT);
    aggiornaAnteprimaNumero();
    console.log('SYNC OK');
    if (mostraAttesa) hideSaveToast();
  } catch (err) {
    console.error('SYNC ERROR', err);
    if (mostraAttesa) {
      showSaveToast('Archivio non aggiornato: connessione assente', 'error');
    }
  } finally {
    syncInProgress = false;
  }
}

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/heic', 'image/heif']);
const MAX_LONG_SIDE = 1600;
// Il documento di scarico e' un A4 pieno di bollini piccoli: serve piu'
// risoluzione dell'etichetta singola, o il testo ruotato diventa illeggibile.
const MAX_LONG_SIDE_DOCUMENTO = 2200;

function setOcrStatus(message) {
  if (!ocrStatus) return;

  if (!message) {
    ocrStatus.textContent = '';
    return;
  }

  // Rotellina sempre accanto al messaggio: rende visibile che l'OCR sta
  // lavorando anche quando l'attesa dura decine di secondi.
  ocrStatus.innerHTML = '<span class="ocr-spinner" aria-hidden="true"></span>';
  ocrStatus.append(message);
}

function validateImageFile(file) {
  if (!file || !String(file.type || '').startsWith('image/')) throw new Error('File non immagine.');
  const isKnown = SUPPORTED_IMAGE_TYPES.has(file.type);
  if (!isKnown && file.type) throw new Error(`Formato non supportato: ${file.type}`);
}

async function compressImage(file, maxLato = MAX_LONG_SIDE) {
  validateImageFile(file);
  const quality = file.size > 5 * 1024 * 1024 ? 0.6 : file.size > 2 * 1024 * 1024 ? 0.7 : 0.8;
  const reader = new FileReader();
  const img = new Image();

  const dataUrl = await new Promise((resolve, reject) => {
    reader.onload = (event) => resolve(event.target?.result);
    reader.onerror = () => reject(new Error('Lettura file fallita.'));
    reader.readAsDataURL(file);
  });

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error(file.type.includes('heic') || file.type.includes('heif') ? 'Formato HEIC/HEIF non supportato dal browser.' : 'Immagine non decodificabile.'));
    img.src = dataUrl;
  });

  let width = img.width;
  let height = img.height;
  const longSide = Math.max(width, height);
  if (longSide > maxLato) {
    const ratio = maxLato / longSide;
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non disponibile.');
  ctx.drawImage(img, 0, 0, width, height);

  const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
  return {
    previewUrl: compressedDataUrl,
    imageBase64: compressedDataUrl.split(',')[1],
  };
}

// Ruota un'immagine base64 (JPEG) di 90/180/270 gradi in senso orario.
async function ruotaBase64(imageBase64, gradi) {
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Rotazione immagine fallita.'));
    img.src = 'data:image/jpeg;base64,' + imageBase64;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (gradi === 180) {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.translate(img.width, img.height);
    ctx.rotate(Math.PI);
  } else {
    canvas.width = img.height;
    canvas.height = img.width;
    if (gradi === 90) {
      ctx.translate(img.height, 0);
      ctx.rotate(Math.PI / 2);
    } else {
      ctx.translate(0, img.width);
      ctx.rotate(-Math.PI / 2);
    }
  }

  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

// Una singola chiamata OCR: null se il server o il modello falliscono
// (l'errore non e' definitivo, si puo' ritentare con la foto ruotata).
async function tentaOcr(imageBase64, mode) {
  try {
    const body = mode ? { imageBase64, mode } : { imageBase64 };
    const response = await fetch(OCR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error('Tentativo OCR fallito:', err);
    return null;
  }
}

// Le foto arrivano spesso ruotate di 90 gradi (documento in orizzontale,
// telefono in verticale): se il primo tentativo non cava nulla, si riprova
// con l'immagine ruotata prima di arrendersi.
async function ocrConRotazioni(imageBase64, mode, risultatoVuoto) {
  const tentativi = [0, 90, 270];

  for (const gradi of tentativi) {
    if (gradi !== 0) setOcrStatus(`Foto forse ruotata: riprovo (${gradi}°)...`);
    const base = gradi === 0 ? imageBase64 : await ruotaBase64(imageBase64, gradi);
    const result = await tentaOcr(base, mode);
    if (result && !risultatoVuoto(result)) return result;
  }

  return null;
}

function startOcrForRow(row, source = 'camera') {
  const input = source === 'gallery' ? ocrInputGallery : ocrInputCamera;
  if (!input) {
    alert('Input foto non disponibile.');
    return;
  }
  setOcrStatus('');
  activeOcrRow = row;
  input.value = '';
  input.click();
}

function startOcrScaricoDocumento(source = 'camera') {
  const input = source === 'gallery' ? ocrScaricoInputGallery : ocrScaricoInputCamera;
  if (!input) {
    alert('Input documento non disponibile.');
    return;
  }
  setOcrStatus('');
  input.value = '';
  input.click();
}

function normalizeOcrDate(value) {
  const input = String(value || '').trim();
  if (!input) return '';

  const isoMatch = input.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const itMatch = input.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  if (itMatch) {
    return `${itMatch[3]}-${itMatch[2]}-${itMatch[1]}`;
  }

  return '';
}

function normalizeScaricoRighe(righe = []) {
  const grouped = new Map();

  righe.forEach((riga) => {
    const codice = String(riga?.codice_articolo ?? '').trim();
    if (!codice) return;

    const lotto = String(riga?.lotto ?? '').trim();
    const quantita = Math.max(1, Number(riga?.quantita) || 1);
    const key = `${codice}__${lotto}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.quantita += quantita;
      return;
    }

    grouped.set(key, {
      codice_articolo: codice,
      description: String(riga?.description ?? '').trim(),
      lotto,
      quantita,
    });
  });

  return [...grouped.values()];
}

function applyScaricoDataToForm(result) {
  const cliente = String(result?.cliente ?? '').trim();
  const data = normalizeOcrDate(result?.data);
  const inizialiPaziente = String(result?.iniziali_paziente ?? '').trim();
  const cartellaClinica = String(result?.cartella_clinica ?? '').trim();
  const righe = normalizeScaricoRighe(result?.righe || []);

  if (cliente) clienteRiga1Input.value = cliente;
  if (data) dataInput.value = data;
  if (inizialiPaziente) inizialiInput.value = inizialiPaziente;
  if (cartellaClinica) cartellaInput.value = cartellaClinica;

  if (righe.length) {
    righeContainer.innerHTML = '';
    righe.forEach((riga) => renderRow(riga));
  }
}

async function handleOcrFileChange(event) {
  const file = event.target.files?.[0];
  const row = activeOcrRow;

  if (!file || !row) return;

  try {
    setOcrStatus('Compressione immagine in corso...');
    const { imageBase64, previewUrl } = await compressImage(file);
    if (ocrPreview) {
      ocrPreview.src = previewUrl;
      ocrPreview.hidden = false;
    }
    setOcrStatus('OCR in corso...');
    const result = await ocrConRotazioni(imageBase64, null,
      (r) => !String(r?.ref || '').trim() && !String(r?.lot || '').trim());

    const ref = String(result?.ref || '').trim();
    const lot = String(result?.lot || '').trim();
    const description = String(result?.description || '').trim();

    const codiceInput = row.querySelector('.codice_articolo');
    const lottoInput = row.querySelector('.lotto');
    const descriptionInput = row.querySelector('.description');

    codiceInput.value = ref;
    lottoInput.value = lot;

    // La descrizione compilata a mano non va sovrascritta da una scansione
    // fatta solo per REF/LOT.
    if (descriptionInput && description && !descriptionInput.value.trim()) {
      descriptionInput.value = description;
    }

    if (ref) clearFieldError(codiceInput);
    if (lot) clearFieldError(lottoInput);

    if (!ref || !lot) {
      alert('REF o LOT non rilevati. Riprovare con foto più vicina.');
    }
  } catch (error) {
    console.error('Errore OCR:', error);
    alert('Impossibile leggere la foto. Riprovare.');
  } finally {
    activeOcrRow = null;
    setOcrStatus('');
    if (ocrInputCamera) ocrInputCamera.value = '';
    if (ocrInputGallery) ocrInputGallery.value = '';
  }
}

// Foto del documento in attesa di conferma: l'utente puo' raddrizzarla
// con "Ruota" prima di avviare la lettura (il verso giusto e' deterministico,
// i tentativi automatici restano solo come rete di sicurezza).
let scaricoInAttesa = null;

const ocrConferma = document.getElementById('ocr-conferma');
const ocrRuotaButton = document.getElementById('ocr-ruota-btn');
const ocrAvviaButton = document.getElementById('ocr-avvia-btn');
const ocrAnnullaButton = document.getElementById('ocr-annulla-btn');

function chiudiConfermaScarico() {
  scaricoInAttesa = null;
  if (ocrConferma) ocrConferma.hidden = true;
  if (ocrPreview) {
    ocrPreview.hidden = true;
    ocrPreview.removeAttribute('src');
  }
}

async function handleOcrScaricoFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    setOcrStatus('Compressione immagine in corso...');
    const { imageBase64, previewUrl } = await compressImage(file, MAX_LONG_SIDE_DOCUMENTO);

    scaricoInAttesa = imageBase64;
    if (ocrPreview) {
      ocrPreview.src = previewUrl;
      ocrPreview.hidden = false;
    }
    if (ocrConferma) ocrConferma.hidden = false;
    setOcrStatus('');
  } catch (error) {
    console.error('Errore preparazione foto documento:', error);
    chiudiConfermaScarico();
    setOcrStatus('');
    alert('Impossibile leggere la foto. Riprovare.');
  } finally {
    if (ocrScaricoInputCamera) ocrScaricoInputCamera.value = '';
    if (ocrScaricoInputGallery) ocrScaricoInputGallery.value = '';
  }
}

async function ruotaFotoScarico() {
  if (!scaricoInAttesa) return;
  try {
    scaricoInAttesa = await ruotaBase64(scaricoInAttesa, 90);
    if (ocrPreview) ocrPreview.src = 'data:image/jpeg;base64,' + scaricoInAttesa;
  } catch (error) {
    console.error('Rotazione fallita:', error);
  }
}

async function avviaOcrScarico() {
  if (!scaricoInAttesa) return;
  const imageBase64 = scaricoInAttesa;

  if (ocrConferma) ocrConferma.hidden = true;
  scaricoInAttesa = null;

  try {
    setOcrStatus('OCR in corso...');
    const result = await ocrConRotazioni(imageBase64, 'document',
      (r) => !(r?.righe || []).length && !String(r?.cliente || '').trim() && !String(r?.data || '').trim());

    if (!result) {
      throw new Error('Nessun tentativo OCR riuscito');
    }
    applyScaricoDataToForm(result);
  } catch (error) {
    console.error('Errore OCR scarico documento:', error);
    alert('Documento non leggibile');
  } finally {
    setOcrStatus('');
    if (ocrScaricoInputCamera) ocrScaricoInputCamera.value = '';
    if (ocrScaricoInputGallery) ocrScaricoInputGallery.value = '';
  }
}

// --- vista archivio: limite di visualizzazione e ricerca ---------------------

const archivioCerca = document.getElementById('archivio-cerca');
const archivioStato = document.getElementById('archivio-stato');
const archivioChips = [...document.querySelectorAll('.archivio-chips .chip')];

let archivioLimite = 5;

function chiaveVistaArchivio() {
  const utente = STORAGE.utente();
  return utente ? `ddtVistaArchivio_${utente.codice}` : 'ddtVistaArchivio';
}

function aggiornaChipsArchivio() {
  archivioChips.forEach((chip) => {
    chip.classList.toggle('attivo', chip.dataset.limite === String(archivioLimite));
  });
}

function caricaVistaArchivio() {
  const salvato = localStorage.getItem(chiaveVistaArchivio());
  archivioLimite = salvato === 'tutti' ? 'tutti' : Number(salvato) || 5;
  aggiornaChipsArchivio();
}

async function impostaLimiteArchivio(limite) {
  archivioLimite = limite === 'tutti' ? 'tutti' : Number(limite) || 5;
  localStorage.setItem(chiaveVistaArchivio(), String(archivioLimite));
  aggiornaChipsArchivio();

  // Oltre gli ultimi 5 serve l'archivio completo.
  if (archivioLimite !== 5) await attendiArchivioCompleto();

  render(getDDTs());
}

archivioChips.forEach((chip) => {
  chip.addEventListener('click', () => impostaLimiteArchivio(chip.dataset.limite));
});

if (archivioCerca) {
  archivioCerca.addEventListener('input', async () => {
    if (archivioCerca.value.trim()) await attendiArchivioCompleto();
    render(getDDTs());
  });
}

function render(ddts) {
  const ordinati = [...ddts].sort((a, b) => {
    const numA = parseInt((a.numero || '').replace(/\D/g, '') || '0');
    const numB = parseInt((b.numero || '').replace(/\D/g, '') || '0');
    return numB - numA;
  });

  // La ricerca lavora sull'intero archivio e ignora il limite attivo.
  const testo = (archivioCerca?.value || '').trim().toLowerCase();
  let visibili = ordinati;
  if (testo) {
    visibili = ordinati.filter((d) =>
      String(d.numero || '').toLowerCase().includes(testo) ||
      String(d.cliente?.riga1 || '').toLowerCase().includes(testo));
  } else if (archivioLimite !== 'tutti') {
    visibili = ordinati.slice(0, archivioLimite);
  }

  list.innerHTML = '';

  visibili.forEach((ddt) => {
    const li = document.createElement('li');

    const text = document.createElement('span');
    text.textContent = formatItem(ddt);

    const buttons = document.createElement('div');
    buttons.className = 'item-buttons';

    const editButton = document.createElement('button');
    editButton.textContent = 'Modifica';
    editButton.className = 'secondary';
    editButton.addEventListener('click', () => {
      // L'indice va risolto per id al momento del clic: l'ordine della lista
      // renderizzata (ordinata/filtrata) non coincide con quello salvato.
      const indice = getDDTs().findIndex((d) => d.id === ddt.id);
      if (indice >= 0) loadInForm(ddt, indice);
    });

    const printButton = document.createElement('button');
    printButton.textContent = 'Stampa';
    printButton.addEventListener('click', () => saveAndPrint(ddt));

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Elimina';
    deleteButton.className = 'danger';
    deleteButton.addEventListener('click', async () => {
      if (!confirm("Sei sicuro di voler eliminare questo DDT? Questa operazione non è reversibile.")) return;

      const updated = getDDTs();
      const indice = updated.findIndex((d) => d.id === ddt.id);
      if (indice < 0) return;

      // eliminazione reale
      const rimosso = updated[indice];
      updated.splice(indice, 1);

      saveDDTs(updated);
      render(updated);

      if (editingIndex === indice) {
        resetFormState();
      }

      console.log('DDT ELIMINATO DEFINITIVAMENTE');

      const esito = await STORAGE.remove(rimosso);
      if (!esito.inviato) {
        showSaveToast('Eliminato sul dispositivo: la rimozione remota è in coda', 'success');
      }
    });

    buttons.append(editButton, printButton, deleteButton);
    li.append(text, buttons);
    list.appendChild(li);
  });

  if (archivioStato) {
    archivioStato.textContent = '';

    if (testo) {
      archivioStato.textContent = visibili.length === 1
        ? `1 risultato per "${archivioCerca.value.trim()}"`
        : `${visibili.length} risultati per "${archivioCerca.value.trim()}"`;
    } else if (visibili.length < ordinati.length) {
      archivioStato.append(`Mostrati ${visibili.length} di ${ordinati.length} · `);
      const mostraTutti = document.createElement('button');
      mostraTutti.type = 'button';
      mostraTutti.className = 'link';
      mostraTutti.textContent = 'Mostra tutti';
      mostraTutti.addEventListener('click', () => impostaLimiteArchivio('tutti'));
      archivioStato.append(mostraTutti);
    } else {
      archivioStato.textContent = ordinati.length
        ? `${ordinati.length} ${ordinati.length === 1 ? 'documento' : 'documenti'}`
        : 'Nessun documento';
    }
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isSaving) return;

  clearSimpleFieldError(clienteRiga1Input);
  clearSimpleFieldError(causaleInput);

  const { valid, righe } = extractAndValidateRighe();
  let formValid = valid;

  if (!clienteRiga1Input.value.trim()) {
    setSimpleFieldError(clienteRiga1Input, 'Obbligatorio');
    formValid = false;
  }

  if (!causaleInput.value.trim()) {
    setSimpleFieldError(causaleInput, 'Obbligatorio');
    formValid = false;
  }

  if (!formValid) {
    showSaveToast('Compila tutti i campi obbligatori', 'error');
    return;
  }

  setSavingState(true);

  try {
    const current = getDDTs();
    const existing = editingIndex === null ? null : current[editingIndex];

    const ddt = {
      id: existing?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ddt-${Date.now()}`),
      numero: existing?.numero || '',
      serie: existing?.serie || STORAGE.serieAttiva() || 'MS',
      data: dataInput.value,
      cliente: {
        riga1: clienteRiga1Input.value.trim(),
        riga2: clienteRiga2Input.value.trim(),
        riga3: clienteRiga3Input.value.trim(),
      },
      causale_trasporto: causaleInput.value.trim(),
      iniziali_paziente: inizialiInput.value.trim(),
      cartella_clinica: cartellaInput.value.trim(),
      righe,
      firma_destinatario: temporaryFirmaImage || null,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!ddt.numero) {
      ddt.numero = await getNextDDTNumber(ddt.data);
    }

    if (editingIndex === null) {
      current.unshift(ddt);
      editingIndex = current.findIndex((item) => item.id === ddt.id);
    } else {
      current[editingIndex] = ddt;
    }

    saveDDTs(current);
    console.log('SALVATAGGIO DDT', ddt.numero);
    const esito = await STORAGE.upsert(ddt);
    render(current.sort((a, b) => {
      const numA = parseInt((a.numero || '').replace(/\D/g, '') || '0');
      const numB = parseInt((b.numero || '').replace(/\D/g, '') || '0');
      return numB - numA;
    }));

    if (esito.inviato) {
      showSaveToast('DDT salvato correttamente', 'success');
    } else {
      showSaveToast('DDT salvato sul dispositivo: invio in coda', 'success');
    }
  } catch (error) {
    console.error('Errore durante il salvataggio DDT:', error);
    showSaveToast('Errore durante il salvataggio', 'error');
  } finally {
    setSavingState(false);
  }
});

addRowButton.addEventListener('click', addRiga);

cancelEditButton.addEventListener('click', resetFormState);
if (newDDTButton) newDDTButton.addEventListener('click', resetFormState);

printLastButton.addEventListener('click', () => {
  const all = getDDTs();
  if (all.length === 0) {
    alert('Nessun DDT disponibile da stampare.');
    return;
  }

  saveAndPrint(all[0]);
});


if (ocrInputCamera) ocrInputCamera.addEventListener('change', handleOcrFileChange);
if (ocrInputGallery) ocrInputGallery.addEventListener('change', handleOcrFileChange);
if (ocrScaricoButton) ocrScaricoButton.addEventListener('click', () => startOcrScaricoDocumento('camera'));
if (ocrScaricoGalleryButton) ocrScaricoGalleryButton.addEventListener('click', () => startOcrScaricoDocumento('gallery'));
if (ocrScaricoInputCamera) ocrScaricoInputCamera.addEventListener('change', handleOcrScaricoFileChange);
if (ocrScaricoInputGallery) ocrScaricoInputGallery.addEventListener('change', handleOcrScaricoFileChange);
if (ocrRuotaButton) ocrRuotaButton.addEventListener('click', ruotaFotoScarico);
if (ocrAvviaButton) ocrAvviaButton.addEventListener('click', avviaOcrScarico);
if (ocrAnnullaButton) ocrAnnullaButton.addEventListener('click', chiudiConfermaScarico);

[clienteRiga1Input, causaleInput].forEach((input) => {
  input.addEventListener('input', () => clearSimpleFieldError(input));
});


if (firmaDestinatarioButton) firmaDestinatarioButton.addEventListener('click', openFirmaModal);
if (closeFirmaModalButton) closeFirmaModalButton.addEventListener('click', closeFirmaModal);
if (clearFirmaModalButton) clearFirmaModalButton.addEventListener('click', clearFirmaPlaceholder);
if (saveFirmaModalButton) saveFirmaModalButton.addEventListener('click', saveFirmaPlaceholder);
if (firmaCanvas) {
  firmaCanvas.addEventListener('pointerdown', onFirmaPointerDown);
  firmaCanvas.addEventListener('pointermove', onFirmaPointerMove);
  firmaCanvas.addEventListener('pointerup', onFirmaPointerUp);
  firmaCanvas.addEventListener('pointercancel', onFirmaPointerUp);
  firmaCanvas.addEventListener('pointerleave', onFirmaPointerUp);
}
if (firmaModal) firmaModal.hidden = true;
if (firmaModal) {
  firmaModal.addEventListener('click', (event) => {
    if (event.target === firmaModal) {
      closeFirmaModal();
    }
  });
}

window.addEventListener('resize', () => {
  if (firmaModal && !firmaModal.hidden) {
    resizeFirmaCanvas();
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((error) => {
    console.error('Service worker non registrato:', error);
  });
}

// ---------------------------------------------------------------------------
// Login e sessione
// ---------------------------------------------------------------------------

const loginScreen = document.getElementById('login-screen');
const loginBox = document.getElementById('login-box');
const loginCodiceInput = document.getElementById('login-codice');
const loginPinInput = document.getElementById('login-pin');
const loginButton = document.getElementById('login-btn');
const loginErrore = document.getElementById('login-errore');
const cambioPinBox = document.getElementById('cambio-pin-box');
const pinAttualeLabel = document.getElementById('pin-attuale-label');
const pinAttualeInput = document.getElementById('pin-attuale');
const nuovoPinInput = document.getElementById('nuovo-pin');
const nuovoPin2Input = document.getElementById('nuovo-pin2');
const cambioPinButton = document.getElementById('cambio-pin-btn');
const cambioPinAnnulla = document.getElementById('cambio-pin-annulla');
const cambioPinErrore = document.getElementById('cambio-pin-errore');
const serieBox = document.getElementById('serie-box');
const serieOpzioni = document.getElementById('serie-opzioni');
const firmaStepBox = document.getElementById('firma-step-box');
const firmaStepDisegna = document.getElementById('firma-step-disegna');
const firmaStepSalta = document.getElementById('firma-step-salta');
const firmaMittenteBarButton = document.getElementById('firma-mittente-bar-btn');
const userBar = document.getElementById('user-bar');
const userInfo = document.getElementById('user-info');
const serieSelect = document.getElementById('serie-select');
const cambiaPinBarButton = document.getElementById('cambia-pin-bar-btn');
const logoutButton = document.getElementById('logout-btn');

const LAST_USER_KEY = 'ddtLastUser';
let pinDaCambiare = null; // PIN iniziale da sostituire obbligatoriamente

const ERRORI_LOGIN = {
  credenziali_mancanti: 'Inserisci codice e PIN',
  credenziali_non_valide: 'Codice o PIN errati',
  pin_non_assegnato: 'PIN non ancora assegnato: contatta l\'amministrazione',
};

function mostraSoloBox(box) {
  [loginBox, cambioPinBox, serieBox, firmaStepBox].forEach((b) => { if (b) b.hidden = b !== box; });
  if (loginScreen) loginScreen.hidden = !box;
  document.body.classList.toggle('login-attivo', !!box);
}

function mostraLogin() {
  if (userBar) userBar.hidden = true;
  if (loginErrore) loginErrore.hidden = true;
  if (loginPinInput) loginPinInput.value = '';
  mostraSoloBox(loginBox);
  const ultimo = localStorage.getItem(LAST_USER_KEY);
  if (ultimo && loginCodiceInput) loginCodiceInput.value = ultimo;
}

function aggiornaBarraUtente() {
  const utente = STORAGE.utente();
  if (!utente || !userBar) return;

  userBar.hidden = false;
  userInfo.textContent = `${utente.nome} (${utente.codice})`;

  if (utente.serie.length > 1) {
    serieSelect.hidden = false;
    serieSelect.innerHTML = '';
    utente.serie.forEach((s) => {
      const opzione = document.createElement('option');
      opzione.value = s;
      opzione.textContent = `Serie ${s}`;
      opzione.selected = s === STORAGE.serieAttiva();
      serieSelect.appendChild(opzione);
    });
  } else {
    serieSelect.hidden = true;
  }
}

function avviaApp() {
  mostraSoloBox(null);
  aggiornaBarraUtente();
  caricaVistaArchivio();
  render(getDDTs());
  syncDDT(true);
}

function dopoAutenticazione() {
  const utente = STORAGE.utente();
  if (utente.serie.length > 1 && !STORAGE.serieAttiva()) {
    serieOpzioni.innerHTML = '';
    utente.serie.forEach((s) => {
      const bottone = document.createElement('button');
      bottone.type = 'button';
      bottone.className = 'serie-scelta';
      const mittente = STORAGE.mittentePer(s);
      bottone.innerHTML = `<strong>Serie ${s}</strong><span>${mittente[0] || ''}</span>`;
      bottone.addEventListener('click', () => {
        STORAGE.setSerieAttiva(s);
        proponiFirma(avviaApp);
      });
      serieOpzioni.appendChild(bottone);
    });
    mostraSoloBox(serieBox);
  } else {
    proponiFirma(avviaApp);
  }
}

// Al login, se l'agente non ha ancora una firma mittente, gliela si propone
// una volta. Il passo e' saltabile: senza firma la stampa lascia la riga da
// firmare a penna.
function proponiFirma(prosegui) {
  const utente = STORAGE.utente();
  if (!firmaStepBox || utente.ruolo === 'admin' || STORAGE.firmaMittente()) {
    prosegui();
    return;
  }

  dopoPassoFirma = prosegui;
  mostraSoloBox(firmaStepBox);
}

function apriCambioPin(obbligatorio) {
  if (cambioPinErrore) cambioPinErrore.hidden = true;
  nuovoPinInput.value = '';
  nuovoPin2Input.value = '';

  // Nel cambio obbligatorio il PIN attuale e' quello appena digitato al login.
  pinAttualeLabel.hidden = obbligatorio;
  pinAttualeInput.value = obbligatorio ? pinDaCambiare : '';
  cambioPinAnnulla.hidden = obbligatorio;

  mostraSoloBox(cambioPinBox);
}

async function eseguiLogin() {
  const codice = (loginCodiceInput.value || '').trim().toUpperCase();
  const pin = loginPinInput.value || '';
  loginErrore.hidden = true;
  loginButton.disabled = true;

  try {
    const esito = await STORAGE.login(codice, pin);

    if (!esito.ok) {
      loginErrore.textContent = ERRORI_LOGIN[esito.errore] || 'Accesso non riuscito';
      loginErrore.hidden = false;
      return;
    }

    // I dati locali sono separati per agente (chiavi per codice): il cambio
    // utente non richiede alcun azzeramento. Si ricorda solo l'ultimo codice
    // per precompilare il login.
    localStorage.setItem(LAST_USER_KEY, codice);
    resetFormState();

    if (pin === `${codice}1234`) {
      pinDaCambiare = pin;
      apriCambioPin(true);
    } else {
      dopoAutenticazione();
    }
  } catch (err) {
    console.error('Errore di login:', err);
    loginErrore.textContent = 'Connessione assente: il primo accesso richiede la rete';
    loginErrore.hidden = false;
  } finally {
    loginButton.disabled = false;
  }
}

async function eseguiCambioPin() {
  const attuale = pinAttualeInput.value || '';
  const nuovo = nuovoPinInput.value || '';
  const conferma = nuovoPin2Input.value || '';
  cambioPinErrore.hidden = true;

  if (nuovo.length < 4) {
    cambioPinErrore.textContent = 'Il nuovo PIN deve avere almeno 4 caratteri';
    cambioPinErrore.hidden = false;
    return;
  }
  if (nuovo !== conferma) {
    cambioPinErrore.textContent = 'I due PIN non coincidono';
    cambioPinErrore.hidden = false;
    return;
  }
  const codice = STORAGE.utente()?.codice || '';
  if (nuovo === `${codice}1234`) {
    cambioPinErrore.textContent = 'Scegli un PIN diverso da quello iniziale';
    cambioPinErrore.hidden = false;
    return;
  }

  cambioPinButton.disabled = true;
  try {
    const esito = await STORAGE.cambiaPin(attuale, nuovo);

    if (!esito.ok) {
      cambioPinErrore.textContent = esito.errore === 'pin_attuale_errato'
        ? 'PIN attuale errato'
        : 'Cambio PIN non riuscito';
      cambioPinErrore.hidden = false;
      return;
    }

    pinDaCambiare = null;
    dopoAutenticazione();
    showSaveToast('PIN aggiornato', 'success');
  } catch (err) {
    console.error('Errore cambio PIN:', err);
    cambioPinErrore.textContent = 'Connessione assente: riprova con la rete attiva';
    cambioPinErrore.hidden = false;
  } finally {
    cambioPinButton.disabled = false;
  }
}

if (loginButton) loginButton.addEventListener('click', eseguiLogin);
if (loginPinInput) loginPinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') eseguiLogin(); });
if (cambioPinButton) cambioPinButton.addEventListener('click', eseguiCambioPin);
if (cambioPinAnnulla) cambioPinAnnulla.addEventListener('click', () => mostraSoloBox(null));
if (cambiaPinBarButton) cambiaPinBarButton.addEventListener('click', () => apriCambioPin(false));
if (firmaMittenteBarButton) firmaMittenteBarButton.addEventListener('click', () => openFirmaModal('mittente'));
if (firmaStepDisegna) firmaStepDisegna.addEventListener('click', () => openFirmaModal('mittente'));
if (firmaStepSalta) {
  firmaStepSalta.addEventListener('click', () => {
    const prosegui = dopoPassoFirma;
    dopoPassoFirma = null;
    if (prosegui) prosegui();
  });
}

if (serieSelect) {
  serieSelect.addEventListener('change', () => {
    STORAGE.setSerieAttiva(serieSelect.value);
    render(getDDTs());
    aggiornaAnteprimaNumero();
  });
}

if (logoutButton) {
  logoutButton.addEventListener('click', async () => {
    await STORAGE.logout();
    mostraLogin();
  });
}

window.addEventListener('ddt-sessione-scaduta', () => {
  showSaveToast('Sessione scaduta: accedi di nuovo', 'error');
  mostraLogin();
});

// ---------------------------------------------------------------------------
// Avvio
// ---------------------------------------------------------------------------

updateFirmaPreview();
resetFormState();

if (STORAGE.sessioneAttiva()) {
  if (STORAGE.utente().serie.length > 1 && !STORAGE.serieAttiva()) {
    dopoAutenticazione();
  } else {
    avviaApp();
  }
} else {
  mostraLogin();
}

setInterval(syncDDT, 300000);
window.addEventListener('online', syncDDT);
