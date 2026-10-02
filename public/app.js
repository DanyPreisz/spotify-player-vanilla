const list = document.querySelector("#list");
const now = document.querySelector("#now");
const meta = document.querySelector("#meta");
const playBtn = document.querySelector("#play");
const likeBtn = document.querySelector("#like");
const seek = document.querySelector("#seek");
const storeEl = document.querySelector("#store");
let tracks = [];
let i = 0;
let t = 0;
let playing = false;
document.querySelector("#q").addEventListener("input", (e) => load(e.target.value));
document.querySelector("#add").addEventListener("submit", async (event) => {
  event.preventDefault();
  await fetch("/api/tracks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: document.querySelector("#title").value, artist: document.querySelector("#artist").value }) });
  document.querySelector("#title").value = "";
  document.querySelector("#artist").value = "";
  load(document.querySelector("#q").value);
});
list.addEventListener("click", (e) => { const btn = e.target.closest("[data-i]"); if (btn) playAt(Number(btn.dataset.i)); });
playBtn.addEventListener("click", () => { playing = !playing; playBtn.textContent = playing ? "⏸" : "▶"; });
document.querySelector("#prev").addEventListener("click", () => playAt(i - 1));
document.querySelector("#next").addEventListener("click", () => playAt(i + 1));
likeBtn.addEventListener("click", async () => { const cur = tracks[i]; if (!cur) return; await fetch("/api/tracks/" + cur.id + "/like", { method: "POST" }); load(document.querySelector("#q").value); });
seek.addEventListener("input", () => { const cur = tracks[i]; if (cur) t = (Number(seek.value) / 100) * cur.seconds; });
setInterval(() => { const cur = tracks[i]; if (!cur || !playing) return; t += 0.25; if (t >= cur.seconds) playAt(i + 1); else paintNow(); }, 250);
function escapeHtml(s) { return String(s ?? "").replace(/&/g, "&" + "amp;").replace(/</g, "<" + "lt;"); }
async function load(q = "") {
  tracks = await (await fetch("/api/tracks" + (q ? "?q=" + encodeURIComponent(q) : ""))).json();
  list.innerHTML = tracks.map((tr, idx) => `<button type="button" data-i="${idx}" class="${idx === i ? "is-on" : ""}">${escapeHtml(tr.title)}${tr.liked ? " ♥" : ""}<small>${escapeHtml(tr.artist)} · ${fmt(tr.seconds)}</small></button>`).join("");
  paintNow();
}
function playAt(n) { if (!tracks.length) return; i = (n + tracks.length) % tracks.length; t = 0; playing = true; playBtn.textContent = "⏸"; load(document.querySelector("#q").value); }
function paintNow() { const cur = tracks[i]; if (!cur) return; now.textContent = cur.title; meta.textContent = cur.artist + " · " + fmt(t) + " / " + fmt(cur.seconds); seek.value = String((t / cur.seconds) * 100); likeBtn.textContent = cur.liked ? "♥" : "♡"; }
function fmt(s) { return Math.floor(s / 60) + ":" + Math.floor(s % 60).toString().padStart(2, "0"); }
async function boot() { const health = await (await fetch("/health")).json(); storeEl.textContent = health.store === "mongodb" ? "MongoDB" : "Local"; load(); }
boot();
