import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';

export default function FrequencyDial({ frequency, onChange, min = 3.5, max = 30.0, step = 0.001 }) {
  const [isDragging, setIsDragging] = useState(false);
  const lastY = useRef(0);
  const dialRef = useRef(null);

  const handlePointerDown = (e) => {
    setIsDragging(true);
    lastY.current = e.clientY;
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    
    const delta = lastY.current - e.clientY;
    const change = delta * step * 10;
    const newFreq = Math.min(max, Math.max(min, frequency + change));
    onChange(Math.round(newFreq * 1000) / 1000);
    lastY.current = e.clientY;
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // ダイヤルの回転角度を計算
  const rotation = ((frequency - min) / (max - min)) * 270 - 135;

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-zinc-500 text-xs uppercase tracking-wider">VFO</span>
      
      {/* ダイヤル本体 */}
      <div 
        ref={dialRef}
        className="relative w-24 h-24 cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* 外枠 */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-zinc-600 to-zinc-800 shadow-lg" />
        
        {/* 目盛り */}
        <div className="absolute inset-2 rounded-full overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-0.5 h-2 bg-zinc-500 top-0 left-1/2 -translate-x-1/2 origin-bottom"
              style={{ 
                transform: `translateX(-50%) rotate(${i * 30}deg)`,
                transformOrigin: '50% 40px'
              }}
            />
          ))}
        </div>
        
        {/* ダイヤルノブ */}
        <motion.div
          className="absolute inset-3 rounded-full bg-gradient-to-br from-zinc-300 via-zinc-400 to-zinc-500 shadow-inner"
          style={{ rotate: rotation }}
        >
          {/* グリップライン */}
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-full h-0.5 bg-zinc-600/30 top-1/2 -translate-y-1/2"
              style={{ transform: `rotate(${i * 22.5}deg)` }}
            />
          ))}
          
          {/* 指標マーク */}
          <div className="absolute w-1 h-4 bg-red-500 top-1 left-1/2 -translate-x-1/2 rounded-full" />
        </motion.div>
        
        {/* 中心の装飾 */}
        <div className="absolute inset-[35%] rounded-full bg-gradient-to-b from-zinc-700 to-zinc-900 shadow-inner" />
      </div>
      
      {/* 微調整ボタン */}
      <div className="flex gap-2">
        <button
          className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-sm transition-colors"
          onClick={() => onChange(Math.max(min, frequency - step * 10))}
        >
          ◀
        </button>
        <button
          className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-sm transition-colors"
          onClick={() => onChange(Math.min(max, frequency + step * 10))}
        >
          ▶
        </button>
      </div>
    </div>
  );
}