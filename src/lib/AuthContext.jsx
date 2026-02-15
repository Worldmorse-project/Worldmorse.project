import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

/**
 * WorldMorse v4.3 AuthContext
 * Base44を完全排除し、callsignをクライアント側で保持するだけのシンプル版。
 *
 * 旧コードが `useAuth()` や `AuthProvider` を使っていても動くように、
 * 戻り値の形はなるべく「それっぽく」している。
 */

const AuthContext = createContext(null);

function normalizeCallsign(cs) {
  return String(cs || "").trim().toUpperCase();
}

function getStoredCallsign() {
  // localStorage優先。無ければcookieも見る
  try {
    const v = localStorage.getItem("wm_callsign");
    if (v) return normalizeCallsign(v);
  } catch {}

  // cookie fallback
  const m = document.cookie.match(/(?:^|;\s*)ham_callsign=([^;]+)/);
  if (m && m[1]) return normalizeCallsign(decodeURIComponent(m[1]));
  return "";
}

function storeCallsign(cs) {
  const v = normalizeCallsign(cs);
  try {
    localStorage.setItem("wm_callsign", v);
  } catch {}
  // cookieも残す（既存コード互換）
  const d = new Date();
  d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
  document.cookie = `ham_callsign=${encodeURIComponent(v)}; expires=${d.toUTCString()}; path=/`;
}

export function AuthProvider({ children }) {
  const [callsign, setCallsignState] = useState("");

  useEffect(() => {
    setCallsignState(getStoredCallsign());
  }, []);

  const setCallsign = (cs) => {
    const v = normalizeCallsign(cs);
    storeCallsign(v);
    setCallsignState(v);
  };

  // 旧Base44コードが期待しがちな形に寄せる
  const value = useMemo(() => {
    return {
      // WorldMorseでの「ユーザー」はcallsign扱い
      user: callsign ? { callsign } : null,
      callsign,

      // 旧: login/logout の代替
      login: async (cs) => setCallsign(cs),
      logout: async () => setCallsign(""),

      // Base44互換の名残（存在だけさせる）
      isLoading: false,
      isAuthenticated: !!callsign,

      // 直接使いたい場合のAPI
      setCallsign,
    };
  }, [callsign]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
