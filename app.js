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


function showSaveToast(message, type = 'success') {
  if (!saveStatus) return;

  if (saveStatusTimeout) {
    clearTimeout(saveStatusTimeout);
    saveStatusTimeout = null;
  }

  saveStatus.textContent = message;
  saveStatus.classList.remove('is-success', 'is-error');
  saveStatus.classList.add(type === 'error' ? 'is-error' : 'is-success');

  saveStatusTimeout = setTimeout(() => {
    saveStatus.textContent = '';
    saveStatus.classList.remove('is-success', 'is-error');
    saveStatusTimeout = null;
  }, 3000);
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

function openFirmaModal() {
  if (!firmaModal) return;
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

function saveFirmaPlaceholder() {
  if (!firmaCanvas) return;
  temporaryFirmaImage = firmaCanvas.toDataURL('image/png');
  updateFirmaPreview();
  closeFirmaModal();
  showSaveToast('Firma acquisita', 'success');
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
  localStorage.setItem('printDDT', JSON.stringify({ ...ddt, mittente }));
  const printWindow = window.open('print.html', '_blank');
  if (!printWindow) {
    alert('Impossibile aprire la finestra di stampa.');
  }
}

function mergeDDTLists(localDDT = [], remoteDDT = []) {
  const mergedById = new Map();

  const consider = (item) => {
    if (!item) return;
    const key = item.id || item.numero;
    if (!key) return;

    const existing = mergedById.get(key);
    if (!existing) {
      mergedById.set(key, item);
      return;
    }

    const itemUpdatedAt = new Date(item.updatedAt || 0).getTime() || 0;
    const existingUpdatedAt = new Date(existing.updatedAt || 0).getTime() || 0;

    const mergedItem = itemUpdatedAt >= existingUpdatedAt
      ? {
        ...existing,
        ...item,
        firma_destinatario:
          item.firma_destinatario ||
          existing?.firma_destinatario ||
          null,
      }
      : {
        ...item,
        ...existing,
        firma_destinatario:
          existing?.firma_destinatario ||
          item.firma_destinatario ||
          null,
      };

    mergedById.set(key, mergedItem);
  };

  localDDT.forEach(consider);
  remoteDDT.forEach(consider);

  return [...mergedById.values()].sort((a, b) => {
    const numA = parseInt((a.numero || '').replace(/\D/g, ''), 10) || 0;
    const numB = parseInt((b.numero || '').replace(/\D/g, ''), 10) || 0;
    return numB - numA;
  });
}

async function syncDDT() {
  if (!navigator.onLine) return;
  if (!STORAGE.sessioneAttiva()) return;
  if (syncInProgress) return;
  syncInProgress = true;

  try {
    console.log('SYNC START');

    // Prima le operazioni rimaste in coda (salvataggi/eliminazioni offline),
    // poi la lettura degli archivi remoti dell'utente.
    await STORAGE.flushQueue();

    const localDDT = await getAllDDT();
    const remoteDDT = await STORAGE.leggiRemoti();
    console.log('REMOTE DDT:', remoteDDT.length, '| LOCAL DDT:', localDDT.length);

    // A coda vuota il server e' autorevole: cio' che non esiste piu' sul
    // backend (eliminato da un altro dispositivo) sparisce anche in locale.
    // Con operazioni ancora in coda, o con un remoto sospettosamente vuoto,
    // si torna al merge conservativo.
    const serverAutorevole = STORAGE.codaVuota()
      && !(remoteDDT.length === 0 && localDDT.length > 0);

    const finalDDT = serverAutorevole ? remoteDDT : mergeDDTLists(localDDT, remoteDDT);

    await saveAllDDT(finalDDT);
    await updateCountersFromDDT(finalDDT);
    render(finalDDT);
    console.log('SYNC OK');
  } catch (err) {
    console.error('SYNC ERROR', err);
  } finally {
    syncInProgress = false;
  }
}

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/heic', 'image/heif']);
const MAX_LONG_SIDE = 1600;

function setOcrStatus(message) {
  if (ocrStatus) ocrStatus.textContent = message || '';
}

function validateImageFile(file) {
  if (!file || !String(file.type || '').startsWith('image/')) throw new Error('File non immagine.');
  const isKnown = SUPPORTED_IMAGE_TYPES.has(file.type);
  if (!isKnown && file.type) throw new Error(`Formato non supportato: ${file.type}`);
}

async function compressImage(file) {
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
  if (longSide > MAX_LONG_SIDE) {
    const ratio = MAX_LONG_SIDE / longSide;
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
    const response = await fetch(OCR_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },    
  body: JSON.stringify({ imageBase64 }),
  });

    if (!response.ok) {
      throw new Error(`OCR HTTP ${response.status}`);
    }

    const result = await response.json();
    const ref = String(result?.ref || '').trim();
    const lot = String(result?.lot || '').trim();

    const codiceInput = row.querySelector('.codice_articolo');
    const lottoInput = row.querySelector('.lotto');

    codiceInput.value = ref;
    lottoInput.value = lot;

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

async function handleOcrScaricoFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    setOcrStatus('Compressione immagine in corso...');
    const { imageBase64, previewUrl } = await compressImage(file);
    if (ocrPreview) {
      ocrPreview.src = previewUrl;
      ocrPreview.hidden = false;
    }
    setOcrStatus('OCR in corso...');
    const response = await fetch(OCR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        mode: 'document',
      }),
    });

    if (!response.ok) {
      throw new Error(`OCR HTTP ${response.status}`);
    }

    const result = await response.json();
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

function render(ddts) {
    ddts = [...ddts].sort((a, b) => {
    const numA = parseInt((a.numero || '').replace(/\D/g, '') || '0');
    const numB = parseInt((b.numero || '').replace(/\D/g, '') || '0');
    return numB - numA;
  });
  list.innerHTML = '';
  const visibleDDT = ddts;

  visibleDDT.forEach((ddt) => {
    const index = ddts.findIndex((currentDDT) => currentDDT.id === ddt.id);
    const li = document.createElement('li');

    const text = document.createElement('span');
    text.textContent = formatItem(ddt);

    const buttons = document.createElement('div');
    buttons.className = 'item-buttons';

    const editButton = document.createElement('button');
    editButton.textContent = 'Modifica';
    editButton.className = 'secondary';
    editButton.addEventListener('click', () => loadInForm(ddt, index));

    const printButton = document.createElement('button');
    printButton.textContent = 'Stampa';
    printButton.addEventListener('click', () => saveAndPrint(ddt));

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Elimina';
    deleteButton.className = 'danger';
    deleteButton.addEventListener('click', async () => {
      if (!confirm("Sei sicuro di voler eliminare questo DDT? Questa operazione non è reversibile.")) return;

      const updated = getDDTs();
      if (index < 0 || index >= updated.length) return;

      // eliminazione reale
      const rimosso = updated[index];
      updated.splice(index, 1);

      saveDDTs(updated);
      render(updated);

      if (editingIndex === index) {
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
  [loginBox, cambioPinBox, serieBox].forEach((b) => { if (b) b.hidden = b !== box; });
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
  render(getDDTs());
  syncDDT();
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
        avviaApp();
      });
      serieOpzioni.appendChild(bottone);
    });
    mostraSoloBox(serieBox);
  } else {
    avviaApp();
  }
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

    // Cambio utente sul dispositivo: i dati locali dell'utente precedente
    // non devono restare visibili al nuovo.
    const precedente = localStorage.getItem(LAST_USER_KEY);
    if (precedente && precedente !== codice) {
      saveDDTs([]);
      localStorage.removeItem('ddtOpsPending');
      resetFormState();
    }
    localStorage.setItem(LAST_USER_KEY, codice);

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

if (serieSelect) {
  serieSelect.addEventListener('change', () => {
    STORAGE.setSerieAttiva(serieSelect.value);
    render(getDDTs());
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
