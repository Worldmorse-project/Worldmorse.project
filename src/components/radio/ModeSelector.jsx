import React from 'react';
import { motion } from 'framer-motion';
import { Radio, Waves } from 'lucide-react';

export default function ModeSelector({ mode, onChange }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-zinc-500 text-xs uppercase tracking-wider">MODE</span>
      
      <div className="relative bg-zinc-800 rounded-lg p-1 flex gap-1">
        {/* スライダー背景 */}
        <motion.div
          className="absolute top-1 bottom-1 w-[calc(50%-2px)] bg-gradient-to-b from-amber-500 to-amber-600 rounded-md"
          animate={{ x: mode === 'morse' ? 0 : '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
        
        {/* CW (モールス) ボタン */}
        <button
          className={`relative z-10 flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
            mode === 'morse' ? 'text-black' : 'text-zinc-400 hover:text-zinc-300'
          }`}
          onClick={() => onChange('morse')}
        >
          <Radio className="w-4 h-4" />
          <span className="text-sm font-medium">CW</span>
        </button>
        
        {/* SSB (音声) ボタン */}
        <button
          className={`relative z-10 flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
            mode === 'voice' ? 'text-black' : 'text-zinc-400 hover:text-zinc-300'
          }`}
          onClick={() => onChange('voice')}
        >
          <Waves className="w-4 h-4" />
          <span className="text-sm font-medium">SSB</span>
        </button>
      </div>
      
      <p className="text-zinc-600 text-xs">
        {mode === 'morse' ? 'モールス信号モード' : '音声通話モード'}
      </p>
    </div>
  );
}