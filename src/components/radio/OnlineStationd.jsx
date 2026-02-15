import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Radio, Waves, Signal } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function OnlineStations({ stations, currentFrequency, currentCallsign }) {
  // 同じ周波数帯の局をフィルタリング（±5kHz以内）
  const nearbyStations = stations.filter(s => 
    s.callsign !== currentCallsign &&
    Math.abs(s.frequency - currentFrequency) < 0.005
  );

  const otherStations = stations.filter(s => 
    s.callsign !== currentCallsign &&
    Math.abs(s.frequency - currentFrequency) >= 0.005
  );

  return (
    <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
      {/* ヘッダー */}
      <div className="bg-zinc-800/50 px-4 py-2 border-b border-zinc-700 flex items-center justify-between">
        <h3 className="text-zinc-300 text-sm font-medium flex items-center gap-2">
          <Users className="w-4 h-4 text-green-500" />
          オンライン局
        </h3>
        <Badge variant="secondary" className="bg-green-500/20 text-green-400 text-xs">
          {stations.length - 1} 局
        </Badge>
      </div>

      <ScrollArea className="h-[200px]">
        <div className="p-3 space-y-3">
          {/* 同一周波数の局 */}
          {nearbyStations.length > 0 && (
            <div>
              <p className="text-xs text-amber-500 mb-2 flex items-center gap-1">
                <Signal className="w-3 h-3" />
                同一周波数 (交信可能)
              </p>
              <div className="space-y-1.5">
                <AnimatePresence>
                  {nearbyStations.map((station) => (
                    <motion.div
                      key={station.callsign}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="font-mono text-amber-400 font-bold text-sm">
                          {station.callsign}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded ${
                          station.mode === 'morse' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {station.mode === 'morse' ? 'CW' : 'SSB'}
                        </span>
                        <span className="text-zinc-500">
                          {station.frequency?.toFixed(3)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* その他の局 */}
          {otherStations.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
                <Waves className="w-3 h-3" />
                他の周波数
              </p>
              <div className="space-y-1">
                {otherStations.slice(0, 10).map((station) => (
                  <div
                    key={station.callsign}
                    className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                      <span className="font-mono text-zinc-400 text-sm">
                        {station.callsign}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-600">
                      {station.frequency?.toFixed(3)} MHz
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 誰もいない場合 */}
          {stations.length <= 1 && (
            <div className="text-center py-6">
              <Radio className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-600 text-sm">他の局はオフラインです</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}