// Cloudflare Worker: riceve le risposte dei moduli "Ci sarai?" e le aggiunge come riga
// al file risposte.txt nel repository GitHub privato indicato sotto.
// Il token GitHub NON sta qui: va salvato nel Worker come secret chiamato GITHUB_TOKEN.

const REPO = "leonardo-passeri/laurea_risposte"; // repository privato dove salvare
const FILE = "risposte.txt";
const ORIGIN = "https://leonardo-passeri.github.io"; // solo il sito può inviare

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": ORIGIN,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ ok: false, error: "Usa POST" }, 405, cors);

    let data;
    try { data = await request.json(); } catch { return json({ ok: false, error: "JSON non valido" }, 400, cors); }

    const clean = (v, max) => String(v || "").replace(/\s+/g, " ").trim().slice(0, max);
    const nome = clean(data.nome, 80);
    const presenza = clean(data.presenza, 5);
    const evento = clean(data.evento, 30).toLowerCase();
    const messaggio = clean(data.messaggio, 1000);
    if (!nome || !["Sì", "No"].includes(presenza) || !["proclamazione", "cena"].includes(evento)) {
      return json({ ok: false, error: "Dati mancanti" }, 400, cors);
    }

    // Formato: Nome Cognome: Sì (proclamazione) - Messaggio
    const riga = `${nome}: ${presenza} (${evento}) - ${messaggio || "(nessun messaggio)"}\n`;

    // Se due persone rispondono nello stesso istante GitHub rifiuta il secondo salvataggio: riproviamo
    for (let tentativo = 0; tentativo < 4; tentativo++) {
      const res = await appendLine(env.GITHUB_TOKEN, riga, nome);
      if (res.ok) return json({ ok: true }, 200, cors);
      if (res.status !== 409 && res.status !== 422) {
        return json({ ok: false, error: "GitHub ha risposto " + res.status }, 502, cors);
      }
    }
    return json({ ok: false, error: "Troppi invii insieme, riprova" }, 503, cors);
  },
};

async function appendLine(token, riga, nome) {
  const url = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "laurea-invito-worker",
  };

  // Legge il file attuale (se non esiste ancora, verrà creato)
  const get = await fetch(url + "?t=" + Date.now(), { headers });
  let testo = "";
  let sha;
  if (get.ok) {
    const file = await get.json();
    sha = file.sha;
    testo = decode(file.content);
  } else if (get.status !== 404) {
    return get;
  }

  return fetch(url, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Risposta di " + nome, content: encode(testo + riga), sha }),
  });
}

function decode(b64) {
  const bin = atob(b64.replace(/\n/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function encode(str) {
  let bin = "";
  for (const b of new TextEncoder().encode(str)) bin += String.fromCharCode(b);
  return btoa(bin);
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, "Content-Type": "application/json" } });
}
