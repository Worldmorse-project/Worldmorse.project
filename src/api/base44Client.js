// Renderサーバ（WorldMorse API）用クライアント
// 旧: Base44 SDK（@base44/sdk）依存を完全に排除

const API_BASE =
  import.meta.env.VITE_WORLDMORSE_API_BASE ||
  import.meta.env.VITE_API_BASE ||
  "http://localhost:3000";

// WS URL生成
export function getWsUrl({ callsign, channel }) {
  const base = API_BASE.replace("http://", "ws://").replace("https://", "wss://");
  const qs = new URLSearchParams({
    callsign: String(callsign || "").trim().toUpperCase(),
    channel: String(channel || ""),
  });
  return `${base}/ws?${qs.toString()}`;
}

// callsign 登録（重複チェックはサーバ側）
export async function registerStation(callsign) {
  const res = await fetch(`${API_BASE}/v1/stations/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callsign: String(callsign || "").trim().toUpperCase() }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "register_failed");
  return json.station;
}

// CW送信（一次データ＝morse文字列）
export async function sendCwMorse({ fromCallsign, toCallsign = null, channel, morse, textPreview }) {
  const res = await fetch(`${API_BASE}/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromCallsign: String(fromCallsign || "").trim().toUpperCase(),
      toCallsign: toCallsign ? String(toCallsign).trim().toUpperCase() : null,
      channel: String(channel || ""),
      type: "CW_MORSE",
      payload: { morse: String(morse || ""), ...(textPreview ? { textPreview: String(textPreview) } : {}) },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "send_failed");
  return json;
}

// 直近メッセージ
export async function getRecentMessages({ channel, limit = 100 }) {
  const url = new URL(`${API_BASE}/v1/messages/recent`);
  url.searchParams.set("channel", String(channel || ""));
  url.searchParams.set("limit", String(limit));
  const res = await fetch(url.toString());
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "recent_failed");
  return json.messages;
}

// オンライン局一覧
export async function getOnlineStations({ channel }) {
  const url = new URL(`${API_BASE}/v1/stations/online`);
  url.searchParams.set("channel", String(channel || ""));
  const res = await fetch(url.toString());
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "online_failed");
  return json.stations;
}

// Contacts
export async function listContacts({ myCallsign }) {
  const url = new URL(`${API_BASE}/v1/contacts/list`);
  url.searchParams.set("myCallsign", String(myCallsign || "").trim().toUpperCase());
  const res = await fetch(url.toString());
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "contacts_failed");
  return json.contacts;
}

export async function updateContact({ myCallsign, callsign, name, location, notes }) {
  const res = await fetch(`${API_BASE}/v1/contacts/update`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      myCallsign: String(myCallsign || "").trim().toUpperCase(),
      callsign: String(callsign || "").trim().toUpperCase(),
      name,
      location,
      notes,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "contact_update_failed");
  return true;
}
