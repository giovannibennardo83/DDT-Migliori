import OpenAI from "openai";

export default async function handler(req, res) {

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { imageBase64, mode } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "No image provided" });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const isDocumentMode = mode === "document";

    const prompt = isDocumentMode
      ? `
Analizza questo documento di scarico sala operatoria.

==========================
STRUTTURA SANITARIA
==========================

campo "cliente"

È la struttura sanitaria destinataria del documento.

Cercala:

- nell'intestazione
- in alto
- a sinistra
- a destra
- al centro
- nel logo

Può occupare più righe.

Può contenere:

Ospedale
Presidio Ospedaliero
P.O.
Azienda Ospedaliera
A.O.
A.O.U.
ASP
Azienda Sanitaria Provinciale
ASL
Casa di Cura
Clinica
Policlinico
Istituto
Fondazione

Restituisci il nome completo.

NON restituire mai:

Zimmer
Zimmer Biomet
Biomet
Stryker
Smith+Nephew
Medacta

Se nella parte alta del documento sono presenti sia una struttura sanitaria sia un produttore, il cliente è SEMPRE la struttura sanitaria.

Se assente:

""


==========================
DATA
==========================

campo "data"

Priorità:

1) data intervento

2) data documento

3) qualsiasi altra data chiaramente riferita al documento

NON usare:

- data di nascita
- date di scadenza
- date delle etichette
- date UDI
- date dei lotti

Restituisci ESATTAMENTE la stringa letta.

NON reinterpretare il formato.

NON correggere la data.


==========================
PAZIENTE
==========================

campo "iniziali_paziente"

Cerca:

Paziente

Paz.

Pz.

Iniziali Paziente

Nome

Cognome

Sig.

Sig.ra

Il testo è spesso scritto a mano.

Se trovi:

Mario Rossi

restituisci

M.R.

Se trovi già

MR

oppure

M.R.

riportale identiche.

NON riportare mai il nome completo.

NON confondere con:

Medico Operatore

Richiedente

Chirurgo

Firma

Se illeggibile:

""


==========================
CARTELLA CLINICA
==========================

campo "cartella_clinica"

Cerca:

Cartella

Cartella Clinica

CC

C.C.

SDO

Nosologico

N. Cartella

Riporta solo il valore.

Se assente:

""


==========================
RIGHE
==========================

Analizza TUTTE le etichette.

Per ogni etichetta estrai:

REF

LOT

Description

REF

Se leggibile va SEMPRE restituito.

LOT

Se leggibile riportalo.

Se illeggibile:

""

NON eliminare mai una riga perché manca il LOT.

Description

2-5 parole.

Mantieni eventuali:

Size

Left

Right

misure

es:

71mm

10mm

14x30

Ignora:

barcode

UDI

EDI

GTIN

indirizzi

materiali

fabbricante


==========================
DEDUPLICAZIONE
==========================

Se REF e LOT coincidono

somma le quantità.

Se il LOT è ""

deduplica usando il solo REF.


==========================
CONTROLLO FINALE
==========================

Prima di rispondere verifica:

cliente NON è un produttore

la data NON proviene da un'etichetta

il paziente NON è il medico

ogni REF abbia il proprio LOT se leggibile

se LOT manca usa ""

non inventare valori

Rispondi SOLO JSON valido in questo formato:
{
  "cliente": "nome struttura",
  "data": "DD/MM/YY o DD/MM/YYYY (raw)",
  "iniziali_paziente": "XX",
  "cartella_clinica": "12345",
  "righe": [
    {
      "codice_articolo": "REF",
      "description": "Breve descrizione",
      "lotto": "LOT",
      "quantita": 1
    }
  ]
}

Esempi data:
21/12/26 -> "21/12/26"
05/01/2025 -> "05/01/2025"
`
      : `
Analizza questa etichetta di protesi ortopedica tramite OCR.

Obiettivo: estrarre SOLO questi campi:
- REF (codice articolo)
- LOT (numero di lotto)
- Description (descrizione prodotto breve)

Regole IMPORTANTI:

1. REF:
- È preceduto da "REF", "Ref", "Codice", "Code"
- NON è:
  - UDI
  - GTIN
  - SN / Serial Number
  - EDI
- Di solito è alfanumerico (es. ABC123, 04.001.234)
- Se ci sono più codici, scegli quello più vicino alla dicitura REF

2. LOT:
- È preceduto da "LOT", "Lot", "Lotto"
- Attenzione a errori OCR:
  - "L0T" = LOT
  - "LOI" = LOT
- NON è una data
- NON è un serial number

3. Description:
- Breve (2-4 parole)
- Scegli la parte più importante e leggibile
- Aggiungi misura se presente (es: 71mm, 60mm, 10mm)
- Ignora UDI, barcode, GTIN, codici lunghi, indirizzi, materiali

4. Normalizzazione:
- Applica trim() a tutti i campi
- REF e LOT in MAIUSCOLO
- Description pulita e leggibile
- Non inventare valori

5. Se un campo NON è presente:
- usa stringa vuota ""

5. Ignora completamente:
- barcode
- UDI
- GS1
- QR code
- numeri molto lunghi tipici di GTIN

Rispondi SOLO JSON valido:

{
  "ref": "...",
  "lot": "...",
  "description": "..."
}
`;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      reasoning: {
        effort: "low"
      },
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_url: "data:image/jpeg;base64," + imageBase64
            }
          ]
        }
      ]
    });

    const outputText = response.output_text;

const clean = outputText
  .replace(/```json/g, "")
  .replace(/```/g, "")
  .trim();

let parsed;

try {
  parsed = JSON.parse(clean);
} catch (e) {
  console.error("JSON PARSE ERROR:", clean);
  throw new Error("Invalid JSON from OCR");
}

const normalizeItalianDate = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{2}|\d{4})$/);
  if (!match) return "";

  const day = match[1];
  const month = match[2];
  let year = match[3];

  if (year.length === 2) {
    const yy = Number(year);
    year = yy <= 69 ? `20${year}` : `19${year}`;
  }

  return `${year}-${month}-${day}`;
};

if (isDocumentMode) {
  parsed.data = normalizeItalianDate(parsed.data);

  // Sicurezza campi
  parsed.cliente = parsed.cliente || "";
  parsed.iniziali_paziente = parsed.iniziali_paziente || "";
  parsed.cartella_clinica = parsed.cartella_clinica || "";
  parsed.righe = Array.isArray(parsed.righe) ? parsed.righe : [];

  parsed.righe = parsed.righe.map(r => ({
    codice_articolo: String(r.codice_articolo || "").trim().toUpperCase(),
    description: String(r.description || "").trim(),
    lotto: String(r.lotto || "").trim().toUpperCase(),
    quantita: Number(r.quantita) || 1
  }));

  const map = {};

  parsed.righe.forEach(r => {
    const key = r.codice_articolo + "|" + r.lotto;

    if (!map[key]) {
      map[key] = {
        codice_articolo: r.codice_articolo,
        description: r.description,
        lotto: r.lotto,
        quantita: Number(r.quantita) || 1
      };
    } else {
      map[key].quantita += Number(r.quantita) || 1;
    }
  });

  parsed.righe = Object.values(map);
} else {
  parsed.ref = String(parsed.ref || "").trim().toUpperCase();
  parsed.lot = String(parsed.lot || "").trim().toUpperCase();
  parsed.description = String(parsed.description || "").trim();
}
    return res.status(200).json(parsed);

  } catch (err) {

    console.error("OCR ERROR:", err);

    const isDocumentMode = req.body?.mode === "document";
    if (isDocumentMode) {
      return res.status(500).json({
        cliente: "",
        data: "",
        iniziali_paziente: "",
        cartella_clinica: "",
        righe: [],
      });
    }

    return res.status(500).json({
      ref: "",
      lot: "",
      description: "",
    });

  }

}
