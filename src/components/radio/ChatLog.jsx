import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Waves, Volume2, Clock, Play } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { playMorseCode } from './MorseAudio';

export default function ChatLog({ messages, currentCallsign, onPlayAudio, autoPlayMorse = true }) {
  const scrollRef = useRef(null);
  const [playingId, setPlayingId] = useState(null);
  const lastMessageIdRef = useRef(null);

  // 新しいメッセージが来たら自動スクロール＆自動再生
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }

    // 新しいメッセージが来たら自動でモールス音を再生
    if (messages.length > 0 && autoPlayMorse) {
      const lastMsg = messages[messages.length - 1];
      // 自分のメッセージでなく、新しいメッセージの場合のみ再生
      if (lastMsg.id !== lastMessageIdRef.current && lastMsg.callsign !== currentCallsign) {
        if (lastMsg.mode === 'morse' && lastMsg.morse_code) {
          playMorseCode(lastMsg.morse_code, 0.25);
        }
        lastMessageIdRef.current = lastMsg.id;
      }
    }
  }, [messages, currentCallsign, autoPlayMorse]);

  // 手動でモールス再生
  const handlePlayMorse = (msg) => {
    if (msg.morse_code) {
      setPlayingId(msg.id);
      const duration = playMorseCode(msg.morse_code, 0.3);
      setTimeout(() => setPlayingId(null), duration * 1000 + 100);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
      {/* ヘッダー */}
      <div className="bg-zinc-800/50 px-4 py-2 border-b border-zinc-700 flex items-center justify-between">
        <h3 className="text-zinc-300 text-sm font-medium flex items-center gap-2">
          <Radio className="w-4 h-4 text-amber-500" />
          交信ログ
        </h3>
        <span className="text-xs text-zinc-500">
          {messages.length} 件の通信
        </span>
      </div>

      {/* メッセージリスト */}
      <ScrollArea className="h-[300px]" ref={scrollRef}>
        <div className="p-3 space-y-2">
          <AnimatePresence initial={false}>
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <Radio className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-zinc-600 text-sm">まだ通信がありません</p>
                <p className="text-zinc-700 text-xs mt-1">同じ周波数の局からの通信を待機中...</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isOwn = msg.callsign === currentCallsign;
                
                return (
                  <motion.div
                    key={msg.id || index}
                    initial={{ opacity: 0, x: isOwn ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] rounded-lg p-3 ${
                      isOwn 
                        ? 'bg-amber-500/20 border border-amber-500/30' 
                        : 'bg-zinc-800 border border-zinc-700'
                    }`}>
                      {/* ヘッダー: コールサイン・モード・時刻 */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`font-mono font-bold text-sm ${
                          isOwn ? 'text-amber-400' : 'text-green-400'
                        }`}>
                          {msg.callsign}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          msg.mode === 'morse' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {msg.mode === 'morse' ? 'CW' : 'SSB'}
                        </span>
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>

                      {/* メッセージ内容 */}
                      {msg.mode === 'morse' ? (
                        <div className="space-y-1">
                          {msg.morse_code && (
                            <div className="flex items-center gap-2">
                              <p className="text-amber-400/70 font-mono text-xs tracking-[0.2em] flex-1">
                                {msg.morse_code}
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePlayMorse(msg)}
                                className={`h-6 w-6 p-0 ${playingId === msg.id ? 'text-green-400' : 'text-amber-400/50 hover:text-amber-400'}`}
                                disabled={playingId === msg.id}
                              >
                                <Play className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                          <p className="text-white font-mono">
                            {msg.content || '(解読不能)'}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {msg.audio_url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onPlayAudio?.(msg.audio_url)}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                            >
                              <Volume2 className="w-4 h-4 mr-1" />
                              音声を再生
                            </Button>
                          ) : (
                            <p className="text-white">{msg.content || '(音声メッセージ)'}</p>
                          )}
                        </div>
                      )}

                      {/* 周波数表示 */}
                      <div className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
                        <Waves className="w-3 h-3" />
                        {msg.frequency?.toFixed(3)} MHz
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}