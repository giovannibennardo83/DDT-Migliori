// Storage Service: unico punto di contatto tra l'applicazione e il backend.
// Gestisce sessione (login a PIN), operazioni per documento e coda offline.
// Va caricato dopo config.js e prima di db.js / app.js.

const STORAGE = (function () {
  const SESSION_KEY = 'ddtSession';
  const PRIMA_SYNC_RAPIDA = 5;   // documenti scaricati subito alla prima sync
  const BACKFILL_BLOCCO = 8;     // documenti per blocco nel recupero in sottofondo

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

    // Ultimo numero cartaceo per serie e anno (es. chiave "MS_2026"):
    // la numerazione digitale riparte dal successivo. 0 se non configurato.
    progressivoIniziale(serie, anno) {
      const mappa = session?.utente?.progressivoIniziale;
      return mappa ? Number(mappa[`${serie}_${anno}`]) || 0 : 0;
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

    // Sincronizzazione incrementale con prima sync progressiva.
    //
    // Partizione gia' sincronizzata (marcatore presente): chiede i soli
    // documenti modificati e riconcilia le eliminazioni con l'elenco.
    //
    // Prima sync di una partizione: chiede subito i PRIMA_SYNC_RAPIDA
    // documenti piu' recenti (l'app diventa usabile in pochi secondi) e
    // recupera i restanti in sottofondo, a blocchi, tramite onAggiornamento.
    // Il marcatore viene scritto solo a recupero completato: fino ad allora
    // nessuna eliminazione viene applicata e un'interruzione riprende da
    // dove era rimasta.
    async sincronizza(localDocs, onAggiornamento) {
      if (!session) return localDocs;
      this._onAggiornamento = onAggiornamento || this._onAggiornamento;

      const chiaveSync = chiavePerAgente('ddtLastSync');
      const chiaveBackfill = chiavePerAgente('ddtBackfill');
      const ultimaSync = leggiJson(chiaveSync) || {};
      const backfill = leggiJson(chiaveBackfill) || {};
      const annoCorrente = new Date().getFullYear();
      const inCoda = new Set(coda().map((o) => (o.ddt ? o.ddt.id : o.id)));

      const partizioni = [];
      session.utente.serie.forEach((serie) => {
        [annoCorrente, annoCorrente - 1].forEach((anno) => partizioni.push({ serie, anno }));
      });

      // Fase rapida, in parallelo: incrementale dove c'e' il marcatore,
      // "primi N" dove la partizione non e' mai stata sincronizzata. Le
      // partizioni con un recupero interrotto in sospeso non richiamano il
      // server qui: riprendono direttamente in sottofondo.
      const risposte = await Promise.all(partizioni.map(async ({ serie, anno }) => {
        const chiave = `${serie}_${anno}`;
        if (!ultimaSync[chiave] && backfill[chiave]) return { serie, anno, chiave, esito: null, ripresa: true };

        const payload = { azione: 'leggi', token: session.token, serie, anno };
        if (ultimaSync[chiave]) payload.dopo = ultimaSync[chiave];
        else payload.limite = PRIMA_SYNC_RAPIDA;

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

        if (ultimaSync[chiave]) {
          // Incrementale: riconciliazione completa delle eliminazioni.
          const presenti = new Set(esito.elenco || []);
          docs = docs.filter((d) => {
            if ((d.serie || 'MS') !== serie) return true;
            if (annoDi(d) !== anno) return true;
            if (inCoda.has(d.id)) return true;
            return presenti.has(nomeFileDoc(d));
          });
          ultimaSync[chiave] = esito.adesso || ultimaSync[chiave];
        } else {
          // Prima sync: cosa manca ancora rispetto all'elenco completo?
          const presentiLocali = new Set(
            docs.filter((d) => (d.serie || 'MS') === serie && annoDi(d) === anno)
              .map((d) => nomeFileDoc(d)));
          const mancanti = (esito.elenco || []).filter((n) => !presentiLocali.has(n));

          if (mancanti.length === 0) {
            ultimaSync[chiave] = esito.adesso; // gia' completa
          } else {
            backfill[chiave] = { adesso: esito.adesso, numeri: mancanti };
          }
        }
      }

      localStorage.setItem(chiaveSync, JSON.stringify(ultimaSync));
      localStorage.setItem(chiaveBackfill, JSON.stringify(backfill));

      // Recupero in sottofondo del resto dell'archivio, non atteso qui.
      if (Object.keys(backfill).some((k) => backfill[k])) {
        this._backfillPromise = this._eseguiBackfill(onAggiornamento)
          .catch((err) => console.error('Backfill interrotto:', err))
          .finally(() => { this._backfillPromise = null; });
      }

      return docs;
    },

    // Scarica a blocchi i documenti rimasti della prima sync. Ogni blocco
    // viene consegnato via onAggiornamento (l'app salva e ridisegna) e lo
    // stato persiste: un'interruzione riprende dal blocco successivo.
    async _eseguiBackfill(onAggiornamento) {
      const chiaveSync = chiavePerAgente('ddtLastSync');
      const chiaveBackfill = chiavePerAgente('ddtBackfill');

      while (session) {
        const backfill = leggiJson(chiaveBackfill) || {};
        const chiave = Object.keys(backfill).find((k) => backfill[k]);
        if (!chiave) break;

        const [serie, annoStr] = chiave.split('_');
        const stato = backfill[chiave];
        const blocco = stato.numeri.slice(0, BACKFILL_BLOCCO);

        if (blocco.length > 0) {
          const esito = await chiama({
            azione: 'leggi', token: session.token, serie, anno: Number(annoStr), numeri: blocco,
          });

          if (!esito.ok && esito.errore === 'sessione_non_valida') { sessioneScaduta(); return; }
          if (!esito.ok) throw new Error(esito.errore || 'backfill fallito');

          if (onAggiornamento) onAggiornamento(esito.documenti || [], serie);
        }

        // Stato riletto e riscritto solo ora: se il blocco fallisce prima,
        // nulla e' consumato e si riprovera' da qui.
        const aggiornato = leggiJson(chiaveBackfill) || {};
        if (aggiornato[chiave]) {
          aggiornato[chiave].numeri = aggiornato[chiave].numeri.filter((n) => !blocco.includes(n));

          if (aggiornato[chiave].numeri.length === 0) {
            const ultimaSync = leggiJson(chiaveSync) || {};
            ultimaSync[chiave] = aggiornato[chiave].adesso;
            localStorage.setItem(chiaveSync, JSON.stringify(ultimaSync));
            delete aggiornato[chiave];
          }
          localStorage.setItem(chiaveBackfill, JSON.stringify(aggiornato));
        }
      }
    },

    backfillInCorso() {
      const backfill = leggiJson(chiavePerAgente('ddtBackfill')) || {};
      return Object.keys(backfill).some((k) => backfill[k]);
    },

    // Attende la fine del recupero in sottofondo (per "Tutti" e ricerca).
    // Se il recupero era rimasto in sospeso e non e' attivo, lo riavvia.
    async attendiBackfill() {
      if (!this._backfillPromise && session && this.backfillInCorso()) {
        this._backfillPromise = this._eseguiBackfill(this._onAggiornamento)
          .catch((err) => console.error('Backfill interrotto:', err))
          .finally(() => { this._backfillPromise = null; });
      }
      if (this._backfillPromise) await this._backfillPromise;
    },
  };
})();
