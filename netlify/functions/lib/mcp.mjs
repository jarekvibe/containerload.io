// Der MCP-Anschluss: ContainerLoad als Werkzeug fuer KI-Assistenten (Claude, ChatGPT ...).
// Jareks Zusage vom 27.11.26 ("Lass uns den Anschluss fuer die KI bauen").
//
// MCP (Model Context Protocol) ist der Stecker, ueber den ein Assistent fremde Werkzeuge
// benutzt: Jemand traegt https://containerload.io/mcp einmal als Connector ein, danach
// rechnet der Assistent Ladungen mit unserem Packer statt zu schaetzen -- und gibt den Link
// zum 3D-Plan mit heraus.
//
// Was hier NICHT steht: ein zweiter Rechner. Das eine Werkzeug (plan_load) ist eine duenne
// Huelle um planen() aus lib/plan.mjs -- dieselbe Rechnung wie /api/plan und wie der Link
// /app?q=. Vier Regeln dort gelten hier wortgleich (nur der Packer rechnet, dieselben
// Parameter, ehrlich, nichts wird gespeichert).
//
// Bewusst OHNE das offizielle SDK geschrieben: das Protokoll ist JSON-RPC ueber HTTP, und der
// Anschluss ist zustandslos -- jede Anfrage wird fuer sich beantwortet, es gibt keine Sitzung,
// keinen Ereignis-Strom, nichts, was sich ein Server merken muesste. Dafuer zwei
// Abhaengigkeiten in die Functions zu holen, waere mehr Angriffsflaeche als Nutzen.
//
// ZWEI FASSUNGEN DES PROTOKOLLS werden bedient. Quelle fuer die neue: schema.ts und changelog
// der Fassung 2026-07-28 im Repository der Spezifikation (gelesen am 27.11.26 vom Hauptzweig --
// Feldnamen, Fehlercodes, _meta-Schluessel); der Text zum HTTP-Transport war nicht abrufbar,
// was ihn betrifft (GET, Benachrichtigungen), stammt aus Zusammenfassungen einer Websuche.
//   * bis 2025-11-25: der Assistent meldet sich mit "initialize" an und fragt dann
//     tools/list und tools/call.
//   * 2026-07-28 ("stateless"): keine Anmeldung mehr. Jede Anfrage traegt ihre Fassung selbst
//     (Kopfzeile MCP-Protocol-Version bzw. _meta), "server/discover" nennt, was der Server
//     kann, und Ergebnisse tragen resultType -- Listen dazu ttlMs und cacheScope.
// Weil hier ohnehin nichts gemerkt wird, ist beides derselbe Code: "initialize" ist eine
// Anfrage wie jede andere, und tools/call geht auch ohne sie.
//
// Was sich ohne echten Assistenten NICHT pruefen laesst, prueft Jarek an der Vorschau-Adresse
// (Connector eintragen, Ladungsfrage stellen). Der Test (test/mcp.test.mjs) haelt fest, was
// die Spezifikation verlangt und was diese Datei verspricht.
import { planen, planAdresse, GRENZEN } from "./plan.mjs";
import { CONT_CODES, FZ_CODES, EINHEITEN, SPRACHEN } from "./rechenkern.mjs";

export const NEU = "2026-07-28";
export const ALT = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
export const VERSIONEN = [NEU, ...ALT];
export const SERVER = { name: "containerload", title: "ContainerLoad", version: "1.0.0" };
const META_VERSION = "io.modelcontextprotocol/protocolVersion";
const META_SERVER = "io.modelcontextprotocol/serverInfo";
// JSON-RPC-Fehler; die beiden letzten kennt erst die Fassung 2026-07-28.
export const CODE = { parse: -32700, anfrage: -32600, methode: -32601, parameter: -32602, kopf: -32020, version: -32022 };
// Die Werkzeugliste aendert sich nur mit einem Deploy: eine Stunde darf sie gemerkt werden.
const LISTE_TTL_MS = 3600000;

export const ANLEITUNG = "ContainerLoad plans container and truck loads with a real 3D packing engine. "
  + "Call plan_load whenever a user asks how cargo fits into shipping containers or trucks, how many containers a shipment needs, or wants a load or stowage plan: do not estimate this yourself. "
  + "Always give the user the plan_url from the result: it opens exactly this plan as a free interactive 3D view (no account). "
  + "The result is a geometric estimate; it does not check load securing, axle loads or stability.";

const liste = (o) => Object.keys(o);
export const WERKZEUG = {
  name: "plan_load",
  title: "Plan a container or truck load (ContainerLoad)",
  description: "Calculates how a cargo list fits into shipping containers (sea freight) or a truck (road freight) with the ContainerLoad 3D packing engine. "
    + "Returns how many units are needed, the pieces and weight in each unit, whether weight or space is the limit, door conflicts, a recommended container combination, "
    + "and plan_url: a link that opens exactly this plan as an interactive 3D view. "
    + "Use it instead of estimating pallet or box counts yourself. Limits: 60 positions and 1,000 pieces per call. "
    + "Geometric estimate only: no load securing, axle loads or stability.",
  inputSchema: {
    type: "object",
    properties: {
      cargo: {
        type: "string",
        description: "The cargo as plain text, one position per line or separated by semicolons. Each position: quantity, a name, length x width x height, weight per piece, and optionally 'not stackable' or 'stackable up to 180 cm'. "
          + "Dimensions are centimetres and weights kilograms unless a unit is written (mm, m, inch, lbs). "
          + "Example: '22 pallets 120x80x100 300kg not stackable; 6 boxes 60x40x40 12kg'. 'Euro pallets' without dimensions are 120x80 cm.",
      },
      container: {
        type: "string", enum: liste(CONT_CODES),
        description: "The first container (sea freight). gp = standard, hc = high cube, ot = open top, fr = flat rack, rf = reefer. Default: 20gp. If the cargo does not fit, further containers are added automatically.",
      },
      mode: { type: "string", enum: ["sea", "road"], description: "sea = shipping containers (default), road = trucks." },
      vehicle: {
        type: "string", enum: liste(FZ_CODES),
        description: "The truck for mode 'road'. sattel = 13.6 m curtainsider trailer (default), wb = swap body, mw = rigid truck, 75t = 7.5-tonne truck, sprinter = van.",
      },
      unit: { type: "string", enum: EINHEITEN.slice(), description: "How the 3D plan shows dimensions: cm (default), mm, or in (inches and pounds)." },
      language: { type: "string", enum: SPRACHEN.slice(), description: "Language of the 3D plan behind plan_url. The summary text is German for 'de' and English otherwise." },
    },
    required: ["cargo"],
    additionalProperties: false,
  },
  annotations: { title: "Plan a container or truck load", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

const istObjekt = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const gut = (id, result) => ({ jsonrpc: "2.0", id, result });
const schlecht = (id, code, message, data) => ({ jsonrpc: "2.0", id: id === undefined ? null : id, error: data === undefined ? { code, message } : { code, message, data } });
export const fehlerAntwort = schlecht;

// Das Werkzeug selbst: Argumente -> planen() -> Ergebnis fuer das Modell.
// Fehler in den Argumenten sind KEINE Protokollfehler: sie kommen als Ergebnis mit isError
// zurueck, damit das Modell sie lesen und sich berichtigen kann.
async function werkzeugAufruf(args, deckel) {
  const a = istObjekt(args) ? args : {};
  const fehler = (text, mehr) => ({ content: [{ type: "text", text }], ...(mehr ? { structuredContent: mehr } : {}), isError: true });
  if (typeof a.cargo !== "string" || !a.cargo.trim()) {
    return fehler("Argument 'cargo' is missing: the cargo as text, one position per line or separated by semicolons. Example: 22 pallets 120x80x100 300kg not stackable; 6 boxes 60x40x40 12kg");
  }
  if (a.mode !== undefined && a.mode !== "sea" && a.mode !== "road") return fehler("Argument 'mode' must be 'sea' or 'road'.");
  for (const k of ["container", "vehicle", "unit", "language"]) {
    if (a[k] !== undefined && typeof a[k] !== "string") return fehler(`Argument '${k}' must be a string.`);
  }
  if (a.unit !== undefined && !EINHEITEN.includes(a.unit)) return fehler(`Argument 'unit' must be one of: ${EINHEITEN.join(", ")}.`);
  if (a.language !== undefined && !SPRACHEN.includes(a.language)) return fehler(`Argument 'language' must be one of: ${SPRACHEN.join(", ")}.`);
  const q = a.cargo.trim();
  const roh = { q, cont: a.container || "", d: a.mode === "road" ? "road" : "", fz: a.vehicle || "", u: a.unit || "", lang: a.language || "en" };
  // Der Tagesdeckel zaehlt nur, was wirklich gerechnet wird -- derselbe Zaehler wie /api/plan.
  if (q.length <= GRENZEN.zeichen && !(await deckel())) {
    return fehler("The daily limit of this interface is reached. The link still works, it calculates in the browser: " + planAdresse(q, { lang: "en" }));
  }
  let body;
  try { body = planen(roh).body; } catch (e) {
    console.error("mcp:", e && e.message);
    return fehler("The calculation failed. The link still works, it calculates in the browser: " + planAdresse(q, { lang: "en" }));
  }
  if (!body.ok) {
    const zeilen = [body.message];
    if (body.valid) zeilen.push("Valid values: " + body.valid.join(", "));
    if (body.example) zeilen.push("Example: " + body.example);
    if (body.plan_url) zeilen.push("The 3D calculator in the browser has no such limit: " + body.plan_url);
    return fehler(zeilen.join("\n"), body);
  }
  // Zwei Textbloecke: der Satz fuer den Menschen (mit dem Link), und dieselben Daten als JSON
  // fuer Assistenten, die structuredContent nicht an das Modell weiterreichen.
  const satz = [body.summary, "3D plan: " + body.plan_url].concat(body.notes || []).join("\n");
  return { content: [{ type: "text", text: satz }, { type: "text", text: JSON.stringify(body) }], structuredContent: body, isError: false };
}

// EINE Nachricht beantworten.
//   msg     die JSON-RPC-Nachricht (schon geparst)
//   kopf    { version, methode, name } aus den HTTP-Kopfzeilen -- leer, wenn sie fehlen
//   deckel  async () => boolean: darf heute noch gerechnet werden?
// Rueckgabe: null (nichts zu antworten: Benachrichtigung oder Antwort des Clients)
//            oder { http, antwort } -- der HTTP-Status und die JSON-RPC-Antwort.
export async function beantworte(msg, kopf = {}, deckel = async () => true) {
  if (!istObjekt(msg) || msg.jsonrpc !== "2.0") return { http: 400, antwort: schlecht(null, CODE.anfrage, "Invalid Request: expected a JSON-RPC 2.0 message.") };
  if (typeof msg.method !== "string") {
    // Eine Antwort des Clients (result/error) auf etwas, das dieser Server nie fragt: hinnehmen.
    if ("result" in msg || "error" in msg) return null;
    return { http: 400, antwort: schlecht(msg.id, CODE.anfrage, "Invalid Request: method is missing.") };
  }
  // Ohne id ist es eine Benachrichtigung (notifications/initialized, .../cancelled): keine Antwort.
  if (!("id" in msg) || msg.id === null) return null;
  const id = msg.id;
  if (typeof id !== "string" && typeof id !== "number") return { http: 400, antwort: schlecht(null, CODE.anfrage, "Invalid Request: id must be a string or a number.") };
  const p = istObjekt(msg.params) ? msg.params : {};
  const m = msg.method;

  // Die Fassung des Protokolls. "initialize" handelt sie in seiner Antwort aus (alte Fassungen);
  // jede andere Anfrage nennt sie in der Kopfzeile und/oder in _meta (neue Fassung) -- oder gar
  // nicht (alte Clients vor der Anmeldung). Widersprechen sich Kopfzeile und Nachricht, ist die
  // Anfrage kaputt; eine Fassung, die dieser Server nicht kennt, wird mit der Liste abgelehnt.
  let neu = m === "server/discover";
  if (m !== "initialize") {
    const metaV = istObjekt(p._meta) && typeof p._meta[META_VERSION] === "string" ? p._meta[META_VERSION] : "";
    const kopfV = typeof kopf.version === "string" ? kopf.version.trim() : "";
    if (metaV && kopfV && metaV !== kopfV) return { http: 400, antwort: schlecht(id, CODE.kopf, "Header mismatch: MCP-Protocol-Version does not match the protocol version in _meta.") };
    const version = metaV || kopfV;
    if (version && !VERSIONEN.includes(version)) return { http: 400, antwort: schlecht(id, CODE.version, "Unsupported protocol version.", { supported: VERSIONEN, requested: version }) };
    if (kopf.methode && kopf.methode !== m) return { http: 400, antwort: schlecht(id, CODE.kopf, "Header mismatch: Mcp-Method does not match the method of the request.") };
    if (kopf.name && m === "tools/call" && kopf.name !== p.name) return { http: 400, antwort: schlecht(id, CODE.kopf, "Header mismatch: Mcp-Name does not match the tool name of the request.") };
    if (version === NEU) neu = true;
  }
  // Ergebnisse der neuen Fassung tragen resultType, Listen dazu, wie lange sie gelten und fuer wen --
  // und jedes nennt in _meta, wer antwortet (schema.ts, ResultMetaObject: Server SOLLEN das in jeder
  // Antwort tun; eine Anmeldung, die es einmal sagen koennte, gibt es in dieser Fassung nicht mehr).
  const stempel = (result, liste) => (neu ? {
    ...result, resultType: "complete", ...(liste ? { ttlMs: LISTE_TTL_MS, cacheScope: "public" } : {}),
    _meta: { ...(istObjekt(result._meta) ? result._meta : {}), [META_SERVER]: SERVER },
  } : result);
  const antwort = (result) => ({ http: 200, antwort: gut(id, result) });

  switch (m) {
    case "initialize":
      return antwort({
        protocolVersion: ALT.includes(p.protocolVersion) ? p.protocolVersion : ALT[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: ANLEITUNG,
      });
    case "server/discover":
      return antwort(stempel({ supportedVersions: VERSIONEN, capabilities: { tools: {} }, instructions: ANLEITUNG }, true));
    case "ping":
      return antwort(stempel({}));
    case "tools/list":
      return antwort(stempel({ tools: [WERKZEUG] }, true));
    case "tools/call":
      if (p.name !== WERKZEUG.name) return { http: 200, antwort: schlecht(id, CODE.parameter, `Unknown tool: ${typeof p.name === "string" ? p.name.slice(0, 80) : "(no name)"}. This server has one tool: ${WERKZEUG.name}.`) };
      return antwort(stempel(await werkzeugAufruf(p.arguments, deckel)));
    // Dieser Server hat weder Ressourcen noch Vorlagen. Wer trotzdem fragt, bekommt leere Listen.
    case "resources/list":
      return antwort(stempel({ resources: [] }, true));
    case "resources/templates/list":
      return antwort(stempel({ resourceTemplates: [] }, true));
    case "prompts/list":
      return antwort(stempel({ prompts: [] }, true));
    default:
      return { http: 200, antwort: schlecht(id, CODE.methode, `Method not found: ${m.slice(0, 80)}`) };
  }
}
