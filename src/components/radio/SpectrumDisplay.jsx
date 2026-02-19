import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function SpectrumDisplay({ frequency, isReceiving, signalStrength = 0, hasActiveStations = false, isLiveSignal = false, isTransmitting = false }) {
  const canvasRef = useRef(null);
  const waterfallRef = useRef(null);
  const animationRef = useRef(null);
  const [spectrumData, setSpectrumData] = useState([]);

  // スペクトラムデータ生成（モールス信号受信/送信時のみアクティブ）
  useEffect(() => {
    const generateNoise = () => {
      const data = [];
      const center = 128;
      
      for (let i = 0; i < 256; i++) {
        // ベースノイズ（静かな状態）
        let value = Math.random() * 5 + 1;
        const distance = Math.abs(i - center);
        
        // リアルタイム信号受信中（他局からのモールス）
        if (isLiveSignal && distance < 15) {
          value += 55 * Math.exp(-distance * 0.15);
        }
        
        // 自分が送信中（抑圧された信号）
        if (isTransmitting && distance < 10) {
          value += 25 * Math.exp(-distance * 0.25);
        }
        
        data.push(value);
      }
      return data;
    };

    const interval = setInterval(() => {
      setSpectrumData(generateNoise());
    }, 50);

    return () => clearInterval(interval);
  }, [isLiveSignal, isTransmitting]);

  // スペクトラム描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;

    // 背景クリア
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // グリッド線
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const y = (height / 10) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const x = (width / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // スペクトラム描画
    if (spectrumData.length > 0) {
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, '#22c55e');
      gradient.addColorStop(0.5, '#eab308');
      gradient.addColorStop(1, '#ef4444');

      ctx.beginPath();
      ctx.moveTo(0, height);
      
      spectrumData.forEach((value, index) => {
        const x = (index / spectrumData.length) * width;
        const y = height - (value / 100) * height;
        ctx.lineTo(x, y);
      });
      
      ctx.lineTo(width, height);
      ctx.closePath();
      
      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;

      // 線描画
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      spectrumData.forEach((value, index) => {
        const x = (index / spectrumData.length) * width;
        const y = height - (value / 100) * height;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // 中央マーカー（現在周波数）
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    ctx.setLineDash([]);

  }, [spectrumData]);

  // ウォーターフォール描画
  useEffect(() => {
    const canvas = waterfallRef.current;
    if (!canvas || spectrumData.length === 0) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;

    // 既存の画像を2px下にスクロール（高速・安全）
    ctx.drawImage(canvas, 0, 0, width, height - 2, 0, 2, width, height - 2);

    // 上端をクリア
    ctx.clearRect(0, 0, width, 2);


    // 新しい行を描画
    spectrumData.forEach((value, index) => {
      const x = (index / spectrumData.length) * width;
      const intensity = Math.min(value / 60, 1);
      
      // 信号がない場合は暗いグレーのノイズのみ
      if ((!isLiveSignal && !isTransmitting) || intensity < 0.15) {
        const gray = Math.floor(intensity * 80);
        ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
      } else {
        // 青→シアン→緑→黄→赤のカラーマップ
        let r, g, b;
        if (intensity < 0.25) {
          r = 0;
          g = 0;
          b = Math.floor(intensity * 4 * 255);
        } else if (intensity < 0.5) {
          r = 0;
          g = Math.floor((intensity - 0.25) * 4 * 255);
          b = 255;
        } else if (intensity < 0.75) {
          r = Math.floor((intensity - 0.5) * 4 * 255);
          g = 255;
          b = 255 - Math.floor((intensity - 0.5) * 4 * 255);
        } else {
          r = 255;
          g = 255 - Math.floor((intensity - 0.75) * 4 * 255);
          b = 0;
        }
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      }
      ctx.fillRect(x, 0, width / spectrumData.length + 1, 2);
    });

  }, [spectrumData, hasActiveStations]);

  // 周波数表示の計算
  const freqStart = (frequency - 0.025).toFixed(3);
  const freqEnd = (frequency + 0.025).toFixed(3);

  return (
    <div className="bg-black rounded-lg border border-zinc-800 overflow-hidden">
      {/* ヘッダー */}
      <div className="bg-zinc-900/50 px-3 py-1.5 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-zinc-500 text-xs">SPECTRUM / WATERFALL</span>
        <span className="text-amber-400 text-xs font-mono">{frequency.toFixed(3)} MHz</span>
      </div>

      {/* スペクトラム */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={512}
          height={100}
          className="w-full h-24"
        />
        {/* 周波数ラベル */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 pb-1">
          <span className="text-zinc-600 text-[10px] font-mono">{freqStart}</span>
          <span className="text-zinc-600 text-[10px] font-mono">{freqEnd}</span>
        </div>
      </div>

      {/* ウォーターフォール */}
      <div className="border-t border-zinc-800">
        <canvas
          ref={waterfallRef}
          width={512}
          height={80}
          className="w-full h-20"
        />
      </div>

      {/* dBスケール */}
      <div className="bg-zinc-900/50 px-3 py-1 border-t border-zinc-800 flex justify-between items-center">
        <div className="flex gap-1 items-center">
          <div className="w-3 h-2 bg-green-500 rounded-sm" />
          <div className="w-3 h-2 bg-yellow-500 rounded-sm" />
          <div className="w-3 h-2 bg-red-500 rounded-sm" />
        </div>
        <span className="text-zinc-600 text-[10px]">-60dB to 0dB</span>
      </div>
    </div>
  );

}
