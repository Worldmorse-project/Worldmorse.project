import React from 'react';
import { motion } from 'framer-motion';

export default function RadioDisplay({ 
  frequency, 
  message, 
  mode, 
  isTransmitting,
  signalStrength = 5 
}) {
  return (
    <div className="relative bg-gradient-to-b from-zinc-900 to-black rounded-lg border-4 border-zinc-700 shadow-inner p-4">
      {/* Screen bezel effect */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      
      {/* Main display */}
      <div className="bg-black rounded border-2 border-zinc-800 p-4 font-mono">
        {/* Top row - frequency and mode */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className="text-amber-500/60 text-xs">FREQ</span>
            <motion.span 
              className="text-amber-400 text-2xl font-bold tracking-wider"
              animate={{ opacity: [1, 0.8, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {frequency.toFixed(3)} MHz
            </motion.span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded ${mode === 'morse' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
              {mode === 'morse' ? 'CW' : 'SSB'}
            </span>
          </div>
        </div>

        {/* Signal strength meter */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-amber-500/60 text-xs">S</span>
          <div className="flex gap-0.5">
            {[1,2,3,4,5,6,7,8,9].map((level) => (
              <div 
                key={level}
                className={`w-2 h-3 rounded-sm transition-colors ${
                  level <= signalStrength 
                    ? level <= 3 ? 'bg-green-500' : level <= 6 ? 'bg-yellow-500' : 'bg-red-500'
                    : 'bg-zinc-800'
                }`}
              />
            ))}
          </div>
          <span className="text-amber-500/60 text-xs ml-1">+20</span>
        </div>

        {/* Divider line */}
        <div className="h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent mb-3" />

        {/* Message display */}
        <div className="min-h-[80px] bg-zinc-950 rounded p-3 border border-zinc-800">
          <div className="flex items-start gap-2">
            {isTransmitting && (
              <motion.div
                className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            )}
            <p className="text-green-400 text-sm leading-relaxed break-all">
              {message || <span className="text-zinc-600 italic">待機中...</span>}
            </p>
          </div>
        </div>

        {/* TX/RX indicator */}
        <div className="flex justify-end mt-2 gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${!isTransmitting ? 'bg-green-500' : 'bg-zinc-700'}`} />
            <span className="text-xs text-zinc-500">RX</span>
          </div>
          <div className="flex items-center gap-1.5">
            <motion.div 
              className={`w-2 h-2 rounded-full ${isTransmitting ? 'bg-red-500' : 'bg-zinc-700'}`}
              animate={isTransmitting ? { opacity: [1, 0.5, 1] } : {}}
              transition={{ duration: 0.3, repeat: Infinity }}
            />
            <span className="text-xs text-zinc-500">TX</span>
          </div>
        </div>
      </div>
    </div>
  );
}