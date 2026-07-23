// Storage Service: unico punto di contatto tra l'applicazione e il backend.
// Gestisce sessione (login a PIN), operazioni per documento e coda offline.
// Va caricato dopo config.js e prima di db.js / app.js.

const STORAGE = (function () {
  const SESSION_KEY = 'ddtSession';
  const QUEUE_KEY = 'ddtOpsPending';

  let session = leggiJson(SESSION_KEY);

  function leggiJson(chiave) {
    try {
      return JSON.parse(localStorage.getItem(chiave));
    } catch {
      return null;
    }
  }

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

  // --- coda offline -------------------------------------------------------

  function coda() {
    const ops = leggiJson(QUEUE_KEY);
    return Array.isArray(ops) ? ops : [];
  }

  function salvaCoda(ops) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
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
    if (op.azione === 'delete') payload.id = op.id;
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
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
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
      const op = { azione: 'delete', serie: ddt.serie || 'MS', anno: annoDi(ddt), id: ddt.id };
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

    // Legge gli archivi remoti dell'utente: ogni serie abilitata, anno corrente
    // e precedente. Restituisce l'elenco unificato con la serie valorizzata.
    async leggiRemoti() {
      if (!session) return [];

      const annoCorrente = new Date().getFullYear();
      const richieste = [];

      session.utente.serie.forEach((serie) => {
        [annoCorrente, annoCorrente - 1].forEach((anno) => {
          richieste.push({ serie, anno });
        });
      });

      const tutti = [];
      for (const r of richieste) {
        const esito = await chiama({ azione: 'leggi', token: session.token, serie: r.serie, anno: r.anno });

        if (!esito.ok && esito.errore === 'sessione_non_valida') {
          sessioneScaduta();
          throw new Error('sessione scaduta');
        }
        if (!esito.ok) continue;

        (esito.archivio.ddt || []).forEach((d) => {
          if (d) tutti.push({ ...d, serie: r.serie });
        });
      }

      return tutti;
    },
  };
})();
