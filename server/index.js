import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 3000;

// ===== In-memory state (まず動かす用) =====
// 本番で永続化したくなったらPostgresへ置き換える
const stationsByCallsign = new Map(); // callsign -> {callsign, channel, frequency, mode, lastSeenAt}
const messages = []; // {id, ts, channel, fromCallsign, toCallsign, type, payload}

function nowIso() {
  return new Date().toISOString();
}

function normalizeCallsign(callsign) {
  return String(callsign || "").trim().toUpperCase();
}

function pruneStations(timeoutMs = 60_000) {
  const t = Date.now();
  for (const [k, s] of stationsByCallsign.entries()) {
    const last = new Date(s.lastSeenAt).getTime();
    if (t - last > timeoutMs) stationsByCallsign.delete(k);
  }
}

function broadcastToChannel(channel, data) {
  const text = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState !== 1) continue;
    if (client.__channel !== channel) continue;
    client.send(text);
  }
}

// ===== Express =====
const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(
  cors({
    origin: true, // 必要なら固定URLにする
    methods: ["GET", "POST", "PATCH"],
    allowedHeaders: ["Content-Type"]
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: nowIso() });
});

// callsign 登録
app.post("/v1/stations/register", (req, res) => {
  const callsign = normalizeCallsign(req.body?.callsign);
  if (!callsign) return res.status(400).json({ ok: false, error: "callsign_required" });

  // 既存がいても「同一コールサインで上書き」か「拒否」かは設計次第。
  // 今は上書きOK（接続切れ復帰を考慮）。
  const station = {
    callsign,
    channel: null,
    frequency: null,
    mode: null,
    lastSeenAt: nowIso()
  };

  stationsByCallsign.set(callsign, station);
  return res.json({ ok: true, station });
});

// メッセージ送信（HTTP）
app.post("/v1/messages", (req, res) => {
  const fromCallsign = normalizeCallsign(req.body?.fromCallsign);
  const toCallsign = req.body?.toCallsign ? normalizeCallsign(req.body.toCallsign) : null;
  const channel = String(req.body?.channel || "");
  const type = String(req.body?.type || "");
  const payload = req.body?.payload ?? {};

  if (!fromCallsign) return res.status(400).json({ ok: false, error: "fromCallsign_required" });
  if (!channel) return res.status(400).json({ ok: false, error: "channel_required" });
  if (!type) return res.status(400).json({ ok: false, error: "type_required" });

  const msg = {
    id: cryptoRandomId(),
    ts: nowIso(),
    channel,
    fromCallsign,
    toCallsign,
    type,
    payload
  };
  messages.push(msg);

  // チャンネル購読者へ配信
  broadcastToChannel(channel, { kind: "message", message: msg });

  return res.json({ ok: true, message: msg });
});

// 直近メッセージ
app.get("/v1/messages/recent", (req, res) => {
  const channel = String(req.query?.channel || "");
  const limit = Math.min(500, Math.max(1, Number(req.query?.limit || 100)));

  if (!channel) return res.status(400).json({ ok: false, error: "channel_required" });

  const filtered = messages
    .filter((m) => m.channel === channel)
    .slice(-limit);

  return res.json({ ok: true, messages: filtered });
});

// オンライン局一覧
app.get("/v1/stations/online", (req, res) => {
  pruneStations();
  const channel = String(req.query?.channel || "");
  if (!channel) return res.status(400).json({ ok: false, error: "channel_required" });

  const list = [];
  for (const s of stationsByCallsign.values()) {
    if (String(s.channel || "") === channel) list.push(s);
  }
  return res.json({ ok: true, stations: list });
});

// Contacts（今はダミー：フロントが落ちない最低限）
const contactsByMy = new Map(); // myCallsign -> Map(callsign -> contact)

app.get("/v1/contacts/list", (req, res) => {
  const myCallsign = normalizeCallsign(req.query?.myCallsign);
  if (!myCallsign) return res.status(400).json({ ok: false, error: "myCallsign_required" });

  const m = contactsByMy.get(myCallsign) || new Map();
  return res.json({ ok: true, contacts: Array.from(m.values()) });
});

app.patch("/v1/contacts/update", (req, res) => {
  const myCallsign = normalizeCallsign(req.body?.myCallsign);
  const callsign = normalizeCallsign(req.body?.callsign);
  if (!myCallsign) return res.status(400).json({ ok: false, error: "myCallsign_required" });
  if (!callsign) return res.status(400).json({ ok: false, error: "callsign_required" });

  const prev = contactsByMy.get(myCallsign) || new Map();
  const next = {
    callsign,
    name: req.body?.name ?? null,
    location: req.body?.location ?? null,
    notes: req.body?.notes ?? null,
    updatedAt: nowIso()
  };
  prev.set(callsign, next);
  contactsByMy.set(myCallsign, prev);

  return res.json({ ok: true });
});

// ===== HTTP Server + WebSocket =====
const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  // /ws?callsign=JA1ABC&channel=7.050
  const url = new URL(req.url, "http://localhost");
  const callsign = normalizeCallsign(url.searchParams.get("callsign"));
  const channel = String(url.searchParams.get("channel") || "");

  ws.__callsign = callsign || null;
  ws.__channel = channel || null;

  if (callsign) {
    const s = stationsByCallsign.get(callsign) || {
      callsign,
      channel: null,
      frequency: null,
      mode: null,
      lastSeenAt: nowIso()
    };
    s.channel = channel || s.channel;
    s.lastSeenAt = nowIso();
    stationsByCallsign.set(callsign, s);

    if (channel) {
      broadcastToChannel(channel, { kind: "station", action: "join", station: s });
    }
  }

  ws.on("message", (buf) => {
    // ここは将来クライアントからWS送信したい場合に拡張できる
    // 今は受信だけでもOK（HTTP送信で回る）
    try {
      const text = buf.toString("utf-8");
      const json = JSON.parse(text);
      // ping などを受けて lastSeen 更新
      if (json?.kind === "ping" && ws.__callsign) {
        const s = stationsByCallsign.get(ws.__callsign);
        if (s) s.lastSeenAt = nowIso();
      }
    } catch {
      // ignore
    }
  });

  ws.on("close", () => {
    // すぐ消さずに prune に任せる（瞬断対策）
  });

  ws.send(JSON.stringify({ kind: "hello", ok: true, ts: nowIso() }));
});

server.listen(PORT, () => {
  console.log(`WorldMorse API listening on :${PORT}`);
});

// ===== utilities =====
function cryptoRandomId() {
  // Node 22 なら globalThis.crypto があることが多いが、無い環境もあるのでフォールバック
  const a = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 16; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}
