const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const SEED = path.join(ROOT, "data", "tracks.json");
const LOCAL_DB = process.env.DB_PATH || path.join("/tmp", "spotify-tracks.json");
const MONGO_URI = process.env.MONGODB_URI || "";
const MONGO_DB = process.env.MONGODB_DB || "spotify";
const MONGO_COL = process.env.MONGODB_COLLECTION || "tracks";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function seedTracks() {
  try { return JSON.parse(fs.readFileSync(SEED, "utf8")); } catch { return []; }
}

let colPromise = null;
async function collection() {
  if (!MONGO_URI) return null;
  if (!colPromise) {
    colPromise = (async () => {
      const { MongoClient } = require("mongodb");
      const client = new MongoClient(MONGO_URI);
      await client.connect();
      const col = client.db(MONGO_DB).collection(MONGO_COL);
      if ((await col.countDocuments()) === 0) {
        const seed = seedTracks();
        if (seed.length) await col.insertMany(seed);
      }
      return col;
    })();
  }
  return colPromise;
}

function publicTrack(doc) {
  return { id: doc.id, title: doc.title || "", artist: doc.artist || "", album: doc.album || "", seconds: Number(doc.seconds || 0), liked: Boolean(doc.liked) };
}
function localRead() {
  try { if (fs.existsSync(LOCAL_DB)) return JSON.parse(fs.readFileSync(LOCAL_DB, "utf8")); } catch {}
  const seed = seedTracks();
  fs.writeFileSync(LOCAL_DB, JSON.stringify(seed, null, 2));
  return seed;
}
function localWrite(rows) { fs.writeFileSync(LOCAL_DB, JSON.stringify(rows, null, 2)); }
function send(res, status, body, type = TYPES[".json"]) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function body(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
  });
}
function file(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "No encontrado", "text/plain; charset=utf-8");
    send(res, 200, data, TYPES[path.extname(filePath)] || "application/octet-stream");
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const col = await collection();
    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/healthz")) {
      return send(res, 200, { ok: true, store: col ? "mongodb" : "local" });
    }
    if (req.method === "GET" && url.pathname === "/api/tracks") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      let rows = col ? (await col.find({}, { projection: { _id: 0 } }).toArray()).map(publicTrack) : localRead();
      if (q) rows = rows.filter((t) => `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(q));
      return send(res, 200, rows);
    }
    const like = url.pathname.match(/^\/api\/tracks\/([^/]+)\/like$/);
    if (req.method === "POST" && like) {
      const id = like[1];
      if (col) {
        const track = await col.findOne({ id });
        if (!track) return send(res, 404, { error: "no" });
        const liked = !track.liked;
        await col.updateOne({ id }, { $set: { liked } });
        return send(res, 200, publicTrack({ ...track, liked }));
      }
      const rows = localRead();
      const track = rows.find((t) => t.id === id);
      if (!track) return send(res, 404, { error: "no" });
      track.liked = !track.liked;
      localWrite(rows);
      return send(res, 200, track);
    }
    if (req.method === "POST" && url.pathname === "/api/tracks") {
      const data = await body(req);
      const title = String(data.title || "").trim().slice(0, 80);
      const artist = String(data.artist || "vos").trim().slice(0, 60);
      const seconds = Math.max(30, Math.min(600, Number(data.seconds) || 180));
      if (!title) return send(res, 400, { error: "titulo" });
      const track = { id: "t" + Date.now(), title, artist, album: "Tu playlist", seconds, liked: true };
      if (col) await col.insertOne({ ...track });
      else { const rows = localRead(); rows.unshift(track); localWrite(rows); }
      return send(res, 201, track);
    }
    const rel = url.pathname === "/" ? "/index.html" : url.pathname;
    const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, "");
    file(res, path.join(PUBLIC, safe));
  } catch (err) {
    console.error(err);
    send(res, 500, { error: "store", detail: String(err.message || err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`listening on http://${HOST}:${PORT} store=${MONGO_URI ? "mongodb" : "local"}`);
});
