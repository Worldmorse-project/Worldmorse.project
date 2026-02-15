import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * NavigationTracker (WorldMorse v4.3)
 * - Base44や外部SDKなし
 * - ルーティング変更を検知して、必要ならログを出すだけの最小版
 * - App.jsx で default import される前提（export default）
 */
export default function NavigationTracker() {
  const location = useLocation();

  useEffect(() => {
    // デバッグ用。不要ならコメントアウトOK
    // console.log("[NavigationTracker]", location.pathname);
  }, [location.pathname]);

  return null;
}
