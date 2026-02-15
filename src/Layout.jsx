import React, { useEffect } from 'react';

export default function Layout({ children }) {
  useEffect(() => {
    // ファビコンを設定
    const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
    link.type = 'image/png';
    link.rel = 'icon';
    link.href = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696c14183ca98efb6b491411/38caf3cc9_2025-11-18131416.png';
    document.head.appendChild(link);

    // タイトルを設定
    document.title = 'WorldMorse - Revive the morse';
  }, []);

  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}