/**
 * DDT-Migliori — backend v3.5
 * Un file JSON per DDT: Archivio/<Nome Agente>/<SERIE>/<ANNO>/<NUMERO>.json
 * Enumerazione cartella con il servizio avanzato Drive API (v3, identificatore
 * "Drive"): nome + data di tutti i file in una richiesta, ~300ms qualunque sia
 * il numero di documenti. Se il servizio non fosse disponibile, scansione
 * classica di riserva: il caso peggiore e' la lentezza, mai un errore.
 */

const ROOT_FOLDER = 'DDT-Migliori';
const ARCHIVE_FOLDER = 'Archivio';
const FIRME_FOLDER = 'Firme';
const USERS_FILE = 'utenti.json';
const PIN_SALT = 'ddt-migliori-2026';      // non cambiare dopo aver assegnato i PIN
const SESSION_DAYS = 30;
const FIRMA_MAX_CHARS = 300000;

function doGet() {
  return json({ ok: true, servizio: 'DDT-Migliori Backend v3.5' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e && e.postData ? e.postData.contents : '{}');
    switch (body.azione) {
      case 'login':      return json(azioneLogin(body));
      case 'leggi':      return json(azioneLeggi(body));
      case 'upsert':     return json(azioneUpsert(body));
      case 'delete':     return json(azioneDelete(body));
      case 'salvaFirma': return json(azioneSalvaFirma(body));
      case 'cambiaPin':  return json(azioneCambiaPin(body));
      case 'logout':     return json(azioneLogout(body));
      default:           return json({ ok: false, errore: 'azione_sconosciuta' });
    }
  } catch (err) {
    Logger.log('ERRORE: ' + err);
    return json({ ok: false, errore: 'interno', dettaglio: String(err) });
  }
}

// ---------------------------------------------------------------------------
// Lettura archivio
// ---------------------------------------------------------------------------

function azioneLeggi(body) {
  const utente = richiedente(body.token);
  if (!utente) return { ok: false, errore: 'sessione_non_valida' };

  let target = utente;
  if (utente.ruolo === 'admin') {
    if (!body.codiceAgente) return { ok: false, errore: 'codice_agente_richiesto' };
    target = trovaUtente(String(body.codiceAgente).trim().toUpperCase());
    if (!target) return { ok: false, errore: 'agente_non_trovato' };
  }

  const controllo = validaCoordinate(utente, body.serie, body.anno);
  if (controllo.errore) return { ok: false, errore: controllo.errore };

  const adesso = new Date().toISOString();
  const dopo = body.dopo ? new Date(body.dopo) : null;
  const dopoValido = dopo instanceof Date && !isNaN(dopo.getTime()) ? dopo : null;

  const cartella = trovaCartellaAnno(target.nome, controllo.serie, controllo.anno);
  if (!cartella) return { ok: true, elenco: [], documenti: [], adesso: adesso };

  const elenco = [];
  const daLeggere = []; // { id } oppure { file }

  const usaDriveApi = typeof Drive !== 'undefined' && Drive.Files && Drive.Files.list;

  if (usaDriveApi) {
    // Una richiesta paginata per l'intera cartella: nome + data di modifica
    // di tutti i file insieme. E' la via veloce verificata sul campo.
    let pageToken = null;
    do {
      const risposta = Drive.Files.list({
        q: "'" + cartella.getId() + "' in parents and trashed = false",
        fields: 'nextPageToken, files(id, name, modifiedTime)',
        pageSize: 1000,
        pageToken: pageToken,
      });

      (risposta.files || []).forEach(function (f) {
        if (!/\.json$/i.test(f.name)) return;
        elenco.push(f.name.replace(/\.json$/i, ''));
        if (!dopoValido || new Date(f.modifiedTime) > dopoValido) {
          daLeggere.push({ id: f.id });
        }
      });

      pageToken = risposta.nextPageToken;
    } while (pageToken);
  } else {
    // Riserva: scansione file per file (lenta ma sempre disponibile).
    Logger.log('Drive API non disponibile: uso la scansione classica.');
    const files = cartella.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      const nome = file.getName();
      if (!/\.json$/i.test(nome)) continue;
      elenco.push(nome.replace(/\.json$/i, ''));
      if (!dopoValido || file.getLastUpdated() > dopoValido) {
        daLeggere.push({ file: file });
      }
    }
  }

  const documenti = [];
  daLeggere.forEach(function (item) {
    const raw = item.id
      ? DriveApp.getFileById(item.id).getBlob().getDataAsString('UTF-8')
      : item.file.getBlob().getDataAsString('UTF-8');
    const doc = safeParse(raw);
    if (doc && doc.id) documenti.push(doc);
  });

  return { ok: true, elenco: elenco, documenti: documenti, adesso: adesso };
}

// ---------------------------------------------------------------------------
// Scritture
// ---------------------------------------------------------------------------

function azioneUpsert(body) {
  const utente = richiedente(body.token);
  if (!utente) return { ok: false, errore: 'sessione_non_valida' };
  if (utente.ruolo === 'admin') return { ok: false, errore: 'admin_sola_lettura' };

  const controllo = validaCoordinate(utente, body.serie, body.anno);
  if (controllo.errore) return { ok: false, errore: controllo.errore };

  const ddt = body.ddt;
  if (!ddt || typeof ddt !== 'object' || !ddt.id || !ddt.numero) {
    return { ok: false, errore: 'documento_non_valido' };
  }

  return conLock(function () {
    const cartella = creaCartellaAnno(utente.nome, controllo.serie, controllo.anno);
    const numero = nomeFileDoc(ddt);
    const nomeFile = numero + '.json';
    const contenuto = JSON.stringify(ddt);
    const esistente = trovaFile(cartella, nomeFile);

    if (esistente) esistente.setContent(contenuto);
    else cartella.createFile(nomeFile, contenuto, 'application/json');

    return { ok: true };
  });
}

function azioneDelete(body) {
  const utente = richiedente(body.token);
  if (!utente) return { ok: false, errore: 'sessione_non_valida' };
  if (utente.ruolo === 'admin') return { ok: false, errore: 'admin_sola_lettura' };

  const controllo = validaCoordinate(utente, body.serie, body.anno);
  if (controllo.errore) return { ok: false, errore: controllo.errore };

  return conLock(function () {
    const cartella = trovaCartellaAnno(utente.nome, controllo.serie, controllo.anno);
    if (!cartella) return { ok: false, errore: 'documento_non_trovato' };

    const numero = nomeFileDoc({ numero: body.numero, id: body.id });
    const file = trovaFile(cartella, numero + '.json');
    if (!file) return { ok: false, errore: 'documento_non_trovato' };

    file.setTrashed(true);
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Firma mittente
// ---------------------------------------------------------------------------

function firmeFolder() {
  return trovaOCrea(rootFolder(), FIRME_FOLDER);
}

function leggiFirma(codice) {
  const file = trovaFile(firmeFolder(), codice + '.txt');
  return file ? file.getBlob().getDataAsString('UTF-8') : null;
}

function azioneSalvaFirma(body) {
  const utente = richiedente(body.token);
  if (!utente) return { ok: false, errore: 'sessione_non_valida' };
  if (utente.ruolo === 'admin') return { ok: false, errore: 'admin_sola_lettura' };

  const immagine = String(body.immagine || '');

  return conLock(function () {
    const esistente = trovaFile(firmeFolder(), utente.codice + '.txt');
    if (!immagine) {
      if (esistente) esistente.setTrashed(true);
      return { ok: true };
    }
    if (immagine.indexOf('data:image/') !== 0) return { ok: false, errore: 'firma_non_valida' };
    if (immagine.length > FIRMA_MAX_CHARS) return { ok: false, errore: 'firma_troppo_grande' };
    if (esistente) esistente.setContent(immagine);
    else firmeFolder().createFile(utente.codice + '.txt', immagine, 'text/plain');
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Coordinate e percorsi
// ---------------------------------------------------------------------------

function validaCoordinate(utente, serie, anno) {
  serie = String(serie || '').trim().toUpperCase();
  anno = Number(anno);
  if (!serie) return { errore: 'serie_mancante' };
  if (!anno || anno < 2000 || anno > 2100) return { errore: 'anno_non_valido' };
  if (utente.ruolo !== 'admin' && utente.serie.indexOf(serie) < 0) {
    return { errore: 'serie_non_abilitata' };
  }
  return { serie: serie, anno: anno };
}

function nomeFileDoc(ddt) {
  const numero = String(ddt.numero || '').replace(/[^A-Za-z0-9_-]/g, '');
  return numero || String(ddt.id || '');
}

function trovaCartellaAnno(nomeAgente, serie, anno) {
  let corrente = trovaSottocartella(rootFolder(), ARCHIVE_FOLDER);
  const percorso = [nomeAgente, serie, String(anno)];
  for (let i = 0; corrente && i < percorso.length; i++) {
    corrente = trovaSottocartella(corrente, percorso[i]);
  }
  return corrente || null;
}

function creaCartellaAnno(nomeAgente, serie, anno) {
  let corrente = trovaOCrea(rootFolder(), ARCHIVE_FOLDER);
  [nomeAgente, serie, String(anno)].forEach(function (nome) {
    corrente = trovaOCrea(corrente, nome);
  });
  return corrente;
}

// ---------------------------------------------------------------------------
// Utenti e sessioni
// ---------------------------------------------------------------------------

function leggiUtentiFile() {
  const file = trovaFile(rootFolder(), USERS_FILE);
  if (!file) throw new Error('utenti.json mancante');
  return JSON.parse(file.getBlob().getDataAsString('UTF-8'));
}

function trovaUtente(codice) {
  const dati = leggiUtentiFile();
  for (let i = 0; i < dati.utenti.length; i++) {
    if (dati.utenti[i].codice === codice) return dati.utenti[i];
  }
  return null;
}

function azioneLogin(body) {
  const codice = String(body.codice || '').trim().toUpperCase();
  const pin = String(body.pin || '');
  if (!codice || !pin) return { ok: false, errore: 'credenziali_mancanti' };

  const utente = trovaUtente(codice);
  if (!utente || utente.attivo === false) return { ok: false, errore: 'credenziali_non_valide' };
  if (!utente.pinHash) return { ok: false, errore: 'pin_non_assegnato' };
  if (hashPin(codice, pin) !== utente.pinHash) return { ok: false, errore: 'credenziali_non_valide' };

  const token = Utilities.getUuid() + '-' + Utilities.getUuid();
  salvaSessione(token, codice);

  return {
    ok: true,
    token: token,
    utente: { codice: utente.codice, nome: utente.nome, serie: utente.serie, ruolo: utente.ruolo || 'agente' },
    serieInfo: leggiUtentiFile().serie,
    firma: leggiFirma(utente.codice),
  };
}

function azioneCambiaPin(body) {
  const utente = richiedente(body.token);
  if (!utente) return { ok: false, errore: 'sessione_non_valida' };

  const attuale = String(body.pinAttuale || '');
  const nuovo = String(body.pinNuovo || '');
  if (nuovo.length < 4) return { ok: false, errore: 'pin_troppo_corto' };
  if (hashPin(utente.codice, attuale) !== utente.pinHash) {
    return { ok: false, errore: 'pin_attuale_errato' };
  }

  return conLock(function () {
    const file = trovaFile(rootFolder(), USERS_FILE);
    const dati = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
    const u = dati.utenti.filter(function (x) { return x.codice === utente.codice; })[0];
    if (!u) return { ok: false, errore: 'utente_non_trovato' };
    u.pinHash = hashPin(utente.codice, nuovo);
    file.setContent(JSON.stringify(dati, null, 2));
    return { ok: true };
  });
}

function azioneLogout(body) {
  PropertiesService.getScriptProperties().deleteProperty('sess_' + String(body.token || ''));
  return { ok: true };
}

function hashPin(codice, pin) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, PIN_SALT + '|' + codice + '|' + pin);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function salvaSessione(token, codice) {
  const scade = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  PropertiesService.getScriptProperties()
    .setProperty('sess_' + token, JSON.stringify({ codice: codice, scade: scade }));
}

function richiedente(token) {
  if (!token) return null;
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('sess_' + String(token));
  if (!raw) return null;
  const sessione = JSON.parse(raw);
  if (Date.now() > sessione.scade) { props.deleteProperty('sess_' + token); return null; }
  salvaSessione(String(token), sessione.codice);
  const utente = trovaUtente(sessione.codice);
  return utente && utente.attivo !== false ? utente : null;
}

// ---------------------------------------------------------------------------
// Drive e utility
// ---------------------------------------------------------------------------

function rootFolder() {
  return trovaOCrea(DriveApp.getRootFolder(), ROOT_FOLDER);
}

function trovaOCrea(parent, nome) {
  const found = parent.getFoldersByName(nome);
  return found.hasNext() ? found.next() : parent.createFolder(nome);
}

function trovaSottocartella(parent, nome) {
  const found = parent.getFoldersByName(nome);
  return found.hasNext() ? found.next() : null;
}

function trovaFile(folder, nome) {
  const found = folder.getFilesByName(nome);
  return found.hasNext() ? found.next() : null;
}

function safeParse(raw) {
  try { return JSON.parse(raw); } catch (err) { return null; }
}

function conLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// Diagnostica: verifica dall'editor che la Drive API risponda.
// ---------------------------------------------------------------------------

function testDriveApi() {
  const utente = trovaUtente('GBE');
  const cartella = trovaCartellaAnno(utente.nome, 'MS', 2026);
  if (!cartella) { Logger.log('Cartella GBE/MS/2026 non trovata'); return; }

  const inizio = Date.now();
  const r = Drive.Files.list({
    q: "'" + cartella.getId() + "' in parents and trashed = false",
    fields: 'files(id,name,modifiedTime)',
    pageSize: 1000,
  });
  const files = r.files || [];
  Logger.log('Drive API OK: ' + files.length + ' file in ' + (Date.now() - inizio) + ' ms');
}
