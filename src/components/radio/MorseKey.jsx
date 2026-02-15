import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

// モールス信号のタイミング定数
const DOT_DURATION = 100; // 短点の長さ(ms)
const DASH_THRESHOLD = DOT_DURATION * 2.5; // これ以上で長点

// モールス符号テーブル
const MORSE_TO_CHAR = {
  '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
  '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
  '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
  '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
  '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
  '--..': 'Z', '.----': '1', '..---': '2', '...--': '3', '....-': '4',
  '.....': '5', '-....': '6', '--...': '7', '---..': '8', '----.': '9',
  '-----': '0', '.-.-.-': '.', '--..--': ',', '..--..': '?',
  '.----.': "'", '-.-.--': '!', '-..-.': '/', '-.--.': '(',
  '-.--.-': ')', '.-...': '&', '---...': ':', '-.-.-.': ';',
  '-...-': '=', '.-.-.': '+', '-....-': '-', '..--.-': '_',
  '.-..-.': '"', '...-..-': '$', '.--.-.': '@'
};

export default function MorseKey({ onMorseInput, onTransmitChange, onMessageComplete }) {
  const [isPressed, setIsPressed] = useState(false);
  const [currentCode, setCurrentCode] = useState('');
  const [displayCode, setDisplayCode] = useState('');
  
  const pressStartTime = useRef(null);
  const letterTimeout = useRef(null);
  const wordTimeout = useRef(null);
  const audioContext = useRef(null);
  const oscillator = useRef(null);

  // オーディオ初期化
  useEffect(() => {
    audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
    return () => {
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  // ビープ音開始
  const startBeep = useCallback(() => {
    if (!audioContext.current) return;
    
    oscillator.current = audioContext.current.createOscillator();
    const gainNode = audioContext.current.createGain();
    
    oscillator.current.connect(gainNode);
    gainNode.connect(audioContext.current.destination);
    
    oscillator.current.frequency.value = 700; // CW標準周波数
    gainNode.gain.value = 0.3;
    
    oscillator.current.start();
  }, []);

  // ビープ音停止
  const stopBeep = useCallback(() => {
    if (oscillator.current) {
      oscillator.current.stop();
      oscillator.current = null;
    }
  }, []);

  // キー押下
  const handleKeyDown = useCallback(() => {
    if (isPressed) return;
    
    setIsPressed(true);
    onTransmitChange?.(true);
    pressStartTime.current = Date.now();
    startBeep();
    
    // 文字・単語タイムアウトをクリア
    if (letterTimeout.current) clearTimeout(letterTimeout.current);
    if (wordTimeout.current) clearTimeout(wordTimeout.current);
  }, [isPressed, onTransmitChange, startBeep]);

  // キー解放
  const handleKeyUp = useCallback(() => {
    if (!isPressed) return;
    
    setIsPressed(false);
    onTransmitChange?.(false);
    stopBeep();
    
    const duration = Date.now() - pressStartTime.current;
    const symbol = duration < DASH_THRESHOLD ? '.' : '-';
    
    setCurrentCode(prev => prev + symbol);
    setDisplayCode(prev => prev + symbol);
    
    // 文字確定タイマー（DOT_DURATION * 3 後に文字確定）
    letterTimeout.current = setTimeout(() => {
      setCurrentCode(code => {
        if (code && MORSE_TO_CHAR[code]) {
          const char = MORSE_TO_CHAR[code];
          onMorseInput?.(char);
          setDisplayCode('');
        }
        return '';
      });
    }, DOT_DURATION * 3);
    
    // 単語区切りタイマー（DOT_DURATION * 7 後にスペース）
    wordTimeout.current = setTimeout(() => {
      onMorseInput?.(' ');
      // メッセージ完了コールバック
      onMessageComplete?.();
    }, DOT_DURATION * 7);
    
  }, [isPressed, onTransmitChange, onMorseInput, stopBeep]);

  // キーボードイベント
  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (e.type === 'keydown') handleKeyDown();
        else handleKeyUp();
      }
    };
    
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
    };
  }, [handleKeyDown, handleKeyUp]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 現在の入力表示 */}
      <div className="h-8 flex items-center justify-center">
        <span className="text-amber-400 font-mono text-xl tracking-[0.3em]">
          {displayCode || ''}
        </span>
      </div>
      
      {/* 電鍵本体 */}
      <motion.button
        className="relative w-32 h-32 cursor-pointer select-none touch-none"
        onMouseDown={handleKeyDown}
        onMouseUp={handleKeyUp}
        onMouseLeave={() => isPressed && handleKeyUp()}
        onTouchStart={(e) => { e.preventDefault(); handleKeyDown(); }}
        onTouchEnd={(e) => { e.preventDefault(); handleKeyUp(); }}
        whileTap={{ scale: 0.95 }}
      >
        {/* ベース */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-600 to-zinc-800 rounded-2xl shadow-lg" />
        
        {/* キーキャップ */}
        <motion.div
          className="absolute inset-2 rounded-xl bg-gradient-to-b from-zinc-300 to-zinc-500 shadow-md flex items-center justify-center"
          animate={{ 
            y: isPressed ? 4 : 0,
            boxShadow: isPressed 
              ? 'inset 0 2px 4px rgba(0,0,0,0.3)' 
              : '0 4px 6px rgba(0,0,0,0.3)'
          }}
          transition={{ duration: 0.05 }}
        >
          <div className={`w-4 h-4 rounded-full transition-colors duration-100 ${
            isPressed ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-zinc-600'
          }`} />
        </motion.div>
      </motion.button>
      
      {/* 操作説明 */}
      <p className="text-zinc-500 text-sm text-center">
        クリック or スペースキーで入力<br/>
        <span className="text-xs text-zinc-600">短押し = 短点(・) / 長押し = 長点(ー)</span>
      </p>
    </div>
  );
}