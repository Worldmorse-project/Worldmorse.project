import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getWsUrl,
  getOnlineStations,
  getRecentMessages,
  registerStation,
  sendCwMorse,
} from "@/api/base44Client";

/**
 * WorldMorse v4.3 用 useP2PRadio
 * - Base44を完全排除
 * - Renderサーバ(API + WS) 前提
 *
 * 返り値の形は既存UI(Home.jsx)に合わせている：
 * { messages, onlineStations, callsign, setCallsign, isConnected, sendMessage }
 */

function normalizeCallsign(cs) {
  return String(cs || "").trim().toUpperCase();
}

function loadCallsign() {
  try {
    const v = localStorage.getItem("wm_callsign");
    if (v) return normalizeCallsign(v);
  } catch {}
  // cookie fallback
  const m = document.cookie.match(/(?:^|;\s*)ham_callsign=([^;]+)/);
  if (m && m[1]) return normalizeCallsign(decodeURIComponent(m[1]));
  return "";
}

function saveCallsign(cs) {
  const v = normalizeCallsign(cs);
  try {
    localStorage.setItem("wm_callsign", v);
  } catch {}
  const d = new Date();
  d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
  document.cookie = `ham_callsign=${encodeURIComponent(v)}; expires=${d.toUTCString()}; path=/`;
}

export default function useP2PRadio(frequency, mode) {
  const channel = useMemo(() => Number(frequency).toFixed(3), [frequency]);

  const [callsign, setCallsignState] = useState(() => loadCallsign());
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [onlineStations, setOnlineStations] = useState([]);

  const wsRef = useRef(null);
  const pollRef = useRef(null);

  const setCallsign = useCallback((cs) => {
    const v = normalizeCallsign(cs);
    saveCallsign(v);
    setCallsignState(v);
  }, []);

  // 初回：callsignがあるなら登録（サーバ側でオンライン扱い）
  useEffect(() => {
    if (!callsign) return;
    registerStation(callsign).catch(() => {
      // 失敗してもUIは動かす。ログイン制ではない想定。
    });
  }, [callsign]);

  // recent messages / stations をポーリング（WSが死んでも最低限動く）
  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const [ms, st] = await Promise.all([
          getRecentMessages({ channel, limit: 200 }),
          getOnlineStations({ channel }),
        ]);
        if (cancelled) return;
        setMessages(Array.isArray(ms) ? ms : []);
        setOnlineStations(Array.isArray(st) ? st : []);
      } catch {
        // 無視
      }
    }

    tick();
    pollRef.current = setInterval(tick, 3000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [channel]);

  // WebSocket 接続
  useEffect(() => {
    // callsign未設定ならWSは繋がない
    if (!callsign) {
      setIsConnected(false);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
      }
      wsRef.current = null;
      return;
    }

    const ws = new WebSocket(getWsUrl({ callsign, channel }));
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setIsConnected(false);

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        // サーバ想定：
        // { type:"message", message:{...} } や { type:"stations", stations:[...] } 等
        if (msg?.type === "message" && msg.message) {
          setMessages((prev) => [...prev, msg.message]);
        } else if (msg?.type === "messages" && Array.isArray(msg.messages)) {
          setMessages(msg.messages);
        } else if (msg?.type === "stations" && Array.isArray(msg.stations)) {
          setOnlineStations(msg.stations);
        }
      } catch {
        // 無視
      }
    };

    return () => {
      try {
        ws.close();
      } catch {}
    };
  }, [callsign, channel]);

  // UI互換：sendMessage(text, morse, audioUrl?) だが audioUrlは未対応
  const sendMessage = useCallback(
    async (text, morse /* , audioUrl */) => {
      if (!callsign) return false;

      // 今はCW中心：morseがあればそれを一次データとして送る
      const morsePayload = String(morse || "").trim();
      const textPreview = String(text || "").trim();

      try {
        await sendCwMorse({
          fromCallsign: callsign,
          toCallsign: null,
          channel,
          morse: morsePayload || "",
          textPreview: textPreview || "",
        });
        return true;
      } catch {
        return false;
      }
    },
    [callsign, channel]
  );

  return {
    messages,
    onlineStations,
    callsign,
    setCallsign,
    isConnected,
    sendMessage,
  };
}
