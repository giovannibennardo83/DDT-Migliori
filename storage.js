// Storage Service: unico punto di contatto tra l'applicazione e il backend.
// Gestisce sessione (login a PIN), operazioni per documento e coda offline.
// Va caricato dopo config.js e prima di db.js / app.js.

const STORAGE = (function () {
  const SESSION_KEY = 'ddtSession';

  let session = leggiJson(SESSION_KEY);

  function leggiJson(chiave) {
    try {
      return JSON.parse(localStorage.getItem(chiave));
    } catch {
      return null;
    }
  }

  // I dati locali sono separati per agente: ogni codice ha le proprie chiavi.
  // Sulle postazioni condivise il cambio utente non cancella nulla.
  function chiavePerAgente(base) {
    const codice = session && session.utente ? session.utente.codice : null;
    return codice ? `${base}_${codice}` : base;
  }

  // Migrazione una tantum delle chiavi globali pre-esistenti verso quelle
  // per agente, attribuendole all'ultimo utente del dispositivo.
  (function migraChiaviLocali() {
    const proprietario = localStorage.getItem('ddtLastUser');
    if (!proprietario) return;

    ['ddtRecords', 'ddtOpsPending'].forEach((base) => {
      const vecchio = localStorage.getItem(base);
      if (vecchio !== null && localStorage.getItem(`${base}_${proprietario}`) === null) {
        localStorage.setItem(`${base}_${proprietario}`, vecchio);
      }
      if (vecchio !== null) localStorage.removeItem(base);
    });
  })();

  async function chiama(payload) {
    const res = await fetch(APP_CONFIG.backendUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  function sessioneScaduta() {
    session = null;
    localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new Event('ddt-sessione-scaduta'));
  }

  function annoDi(ddt) {
    const match = String(ddt?.data || '').match(/^(\d{4})-/);
    const anno = match ? Number(match[1]) : NaN;
    return anno >= 2020 && anno <= 2100 ? anno : new Date().getFullYear();
  }

  // Nome file del documento sul backend: numero ripulito, id in mancanza.
  // Deve replicare nomeFileDoc() dell'Apps Script.
  function nomeFileDoc(ddt) {
    const numero = String(ddt?.numero || '').replace(/[^A-Za-z0-9_-]/g, '');
    return numero || String(ddt?.id || '');
  }

  // --- coda offline -------------------------------------------------------

  function coda() {
    const ops = leggiJson(chiavePerAgente('ddtOpsPending'));
    return Array.isArray(ops) ? ops : [];
  }

  function salvaCoda(ops) {
    localStorage.setItem(chiavePerAgente('ddtOpsPending'), JSON.stringify(ops));
  }

  function accoda(op) {
    const ops = coda().filter((o) => {
      // Un'operazione nuova sullo stesso documento sostituisce la precedente.
      const idPrec = o.ddt ? o.ddt.id : o.id;
      const idNuovo = op.ddt ? op.ddt.id : op.id;
      return idPrec !== idNuovo;
    });
    ops.push(op);
    salvaCoda(ops);
  }

  async function inviaOp(op) {
    const payload = { azione: op.azione, token: session.token, serie: op.serie, anno: op.anno };
    if (op.azione === 'upsert') payload.ddt = op.ddt;
    if (op.azione === 'delete') { payload.numero = op.numero; payload.id = op.id; }
    return chiama(payload);
  }

  // Svuota la coda. Si ferma su problemi di rete (riproveremo) o di sessione;
  // gli errori applicativi scartano la singola operazione per non bloccare le altre.
  async function flushQueue() {
    if (!session) return;
    let ops = coda();

    while (ops.length > 0) {
      let esito;
      try {
        esito = await inviaOp(ops[0]);
      } catch {
        return; // offline o rete instabile: si riprova alla prossima occasione
      }

      if (!esito.ok && esito.errore === 'sessione_non_valida') {
        sessioneScaduta();
        return;
      }

      if (!esito.ok && esito.errore !== 'documento_non_trovato') {
        console.error('Operazione scartata dalla coda:', ops[0].azione, esito.errore);
      }

      ops = ops.slice(1);
      salvaCoda(ops);
    }
  }

  // --- API ----------------------------------------------------------------

  return {
    sessioneAttiva() { return !!(session && session.token); },
    utente() { return session ? session.utente : null; },
    serieAttiva() { return session ? session.serieAttiva : null; },
    codaVuota() { return coda().length === 0; },

    setSerieAttiva(serie) {
      if (!session) return;
      session.serieAttiva = serie;
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    },

    mittentePer(serie) {
      const info = session && session.serieInfo ? session.serieInfo[serie] : null;
      return info && Array.isArray(info.mittente) ? info.mittente : [];
    },

    async login(codice, pin) {
      const esito = await chiama({ azione: 'login', codice, pin });
      if (!esito.ok) return esito;

      session = {
        token: esito.token,
        utente: esito.utente,
        serieInfo: esito.serieInfo || {},
        serieAttiva: esito.utente.serie.length === 1 ? esito.utente.serie[0] : null,
        firma: esito.firma || null,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return esito;
    },

    firmaMittente() {
      return session ? session.firma || null : null;
    },

    // Salva (o rimuove, con immagine vuota) la firma mittente dell'agente.
    async salvaFirma(immagine) {
      if (!session) return { ok: false, errore: 'sessione_non_valida' };

      const esito = await chiama({ azione: 'salvaFirma', token: session.token, immagine: immagine || '' });

      if (esito.ok) {
        session.firma = immagine || null;
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
      if (!esito.ok && esito.errore === 'sessione_non_valida') sessioneScaduta();

      return esito;
    },

    async logout() {
      const token = session ? session.token : null;
      session = null;
      localStorage.removeItem(SESSION_KEY);
      if (token && navigator.onLine) {
        try { await chiama({ azione: 'logout', token }); } catch {}
      }
    },

    async cambiaPin(pinAttuale, pinNuovo) {
      if (!session) return { ok: false, errore: 'sessione_non_valida' };
      return chiama({ azione: 'cambiaPin', token: session.token, pinAttuale, pinNuovo });
    },

    // Salvataggio di un documento: subito se c'e' rete, altrimenti in coda.
    async upsert(ddt) {
      const op = { azione: 'upsert', serie: ddt.serie || 'MS', anno: annoDi(ddt), ddt };
      return this._esegui(op);
    },

    async remove(ddt) {
      const op = {
        azione: 'delete',
        serie: ddt.serie || 'MS',
        anno: annoDi(ddt),
        numero: ddt.numero,
        id: ddt.id,
      };
      return this._esegui(op);
    },

    async _esegui(op) {
      if (!session) return { inviato: false, motivo: 'sessione' };

      // La coda va rispettata: se ci sono operazioni in attesa, questa si mette in fila.
      if (!this.codaVuota()) {
        accoda(op);
        await flushQueue();
        return { inviato: this.codaVuota(), motivo: 'coda' };
      }

      let esito;
      try {
        esito = await inviaOp(op);
      } catch {
        accoda(op);
        return { inviato: false, motivo: 'offline' };
      }

      if (!esito.ok && esito.errore === 'sessione_non_valida') {
        accoda(op);
        sessioneScaduta();
        return { inviato: false, motivo: 'sessione' };
      }

      if (!esito.ok && esito.errore !== 'documento_non_trovato') {
        console.error('Operazione rifiutata dal backend:', op.azione, esito.errore);
        return { inviato: false, motivo: esito.errore };
      }

      return { inviato: true };
    },

    flushQueue,

    // Sincronizzazione incrementale: per ogni serie abilitata e per anno
    // corrente e precedente, chiede al backend solo i documenti modificati
    // dall'ultima sync e riconcilia le eliminazioni tramite l'elenco dei
    // numeri presenti. Riceve la lista locale e restituisce quella aggiornata.
    async sincronizza(localDocs) {
      if (!session) return localDocs;

      const chiaveSync = chiavePerAgente('ddtLastSync');
      const ultimaSync = leggiJson(chiaveSync) || {};
      const annoCorrente = new Date().getFullYear();
      const inCoda = new Set(coda().map((o) => (o.ddt ? o.ddt.id : o.id)));

      const partizioni = [];
      session.utente.serie.forEach((serie) => {
        [annoCorrente, annoCorrente - 1].forEach((anno) => partizioni.push({ serie, anno }));
      });

      // Le partizioni sono disgiunte (un documento appartiene a una sola
      // serie+anno): le letture viaggiano in parallelo e il tempo totale e'
      // quello della chiamata piu' lenta, non la somma. Un errore di rete su
      // una partizione non tocca le altre: quella riproverà alla sync dopo,
      // col suo marcatore fermo.
      const risposte = await Promise.all(partizioni.map(async ({ serie, anno }) => {
        const chiave = `${serie}_${anno}`;
        const payload = { azione: 'leggi', token: session.token, serie, anno };
        if (ultimaSync[chiave]) payload.dopo = ultimaSync[chiave];

        try {
          return { serie, anno, chiave, esito: await chiama(payload) };
        } catch {
          return { serie, anno, chiave, esito: null };
        }
      }));

      if (risposte.some((r) => r.esito && !r.esito.ok && r.esito.errore === 'sessione_non_valida')) {
        sessioneScaduta();
        throw new Error('sessione scaduta');
      }

      let docs = localDocs.slice();

      for (const { serie, anno, chiave, esito } of risposte) {
        if (!esito || !esito.ok) continue;

        // Documenti nuovi o modificati sul server.
        (esito.documenti || []).forEach((remoto) => {
          if (!remoto || !remoto.id) return;
          remoto.serie = serie;
          const indice = docs.findIndex((d) => d.id === remoto.id);
          if (indice >= 0) docs[indice] = remoto;
          else docs.push(remoto);
        });

        // Eliminazioni: un documento locale di questa serie/anno che non
        // compare piu' nell'elenco remoto (e non e' in coda di invio) e'
        // stato cancellato altrove.
        const presenti = new Set(esito.elenco || []);
        docs = docs.filter((d) => {
          if ((d.serie || 'MS') !== serie) return true;
          if (annoDi(d) !== anno) return true;
          if (inCoda.has(d.id)) return true;
          return presenti.has(nomeFileDoc(d));
        });

        ultimaSync[chiave] = esito.adesso || ultimaSync[chiave];
      }

      localStorage.setItem(chiaveSync, JSON.stringify(ultimaSync));
      return docs;
    },
  };
})();
