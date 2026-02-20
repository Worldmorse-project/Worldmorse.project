import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { HelpCircle, Send, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import RadioDisplay from "@/components/radio/RadioDisplay";
import MorseKey from "@/components/radio/MorseKey";
import FrequencyDial from "@/components/radio/FrequencyDial";
import ModeSelector from "@/components/radio/ModeSelector";
import TranslatorPanel from "@/components/radio/TranslatorPanel";
import VoiceMode from "@/components/radio/VoiceMode";
import CallsignSetup from "@/components/radio/CallsignSetup";
import ChatLog from "@/components/radio/ChatLog";
import OnlineStations from "@/components/radio/OnlineStations";
import SpectrumDisplay from "@/components/radio/SpectrumDisplay";
import useP2PRadio from "@/components/radio/useP2PRadio";
import QSLCard from "@/components/radio/QSLCard";
import ContactsPanel from "@/components/radio/ContactsPanel";

// モールス符号テーブル（逆変換用）
const CHAR_TO_MORSE = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  " ": "/",
};

function toChannelString(frequency) {
  const f = Number.isFinite(frequency) ? frequency : 7.05;
  return f.toFixed(3);
}

function channelToNumber(channel) {
  const n = Number(channel);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < breakpointPx;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const onChange = () => setIsMobile(mq.matches);

    onChange();
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, [breakpointPx]);

  return isMobile;
}

export default function Home() {
  const isMobile = useIsMobile(768);

  const [frequency, setFrequency] = useState(7.05);
  const [mode, setMode] = useState("morse"); // "morse" | "voice"
  const [message, setMessage] = useState("");
  const [morseBuffer, setMorseBuffer] = useState("");
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [activeTab, setActiveTab] = useState(isMobile ? "radio" : "radio");
  const [signalStrength, setSignalStrength] = useState(5);
  const [isLiveSignal, setIsLiveSignal] = useState(false);
    
  const safeSetFrequency = useCallback((v) => {
    const n = typeof v === "number" ? v : Number(v);
    setFrequency(Number.isFinite(n) ? n : 7.05);
  }, []);

  const audioRef = useRef(null);
  const liveSignalTimeoutRef = useRef(null);

  const channel = useMemo(() => toChannelString(frequency), [frequency]);

  // P2P/WS通信フック（実体はAPI/WS）
  const {
    messages,
    onlineStations,
    callsign,
    setCallsign,
    isConnected,
    sendMessage,
  } = useP2PRadio(channel, mode);

  // UI向けに stations を補正（APIがmode/frequencyを返さない場合の保険）
  const uiStations = useMemo(() => {
    const list = Array.isArray(onlineStations) ? onlineStations : [];
    return list.map((s) => {
      const freq =
        typeof s?.frequency === "number"
          ? s.frequency
          : channelToNumber(s?.channel || channel);

      return {
        ...s,
        frequency: freq,
        // modeが無いとOnlineStationsが全部SSB扱いになるので、最低限の保険
        mode: s?.mode || "morse",
      };
    });
  }, [onlineStations, channel]);

  // 新しいメッセージ受信時にライブ信号をトリガー
  const lastMessageCountRef = useRef(Array.isArray(messages) ? messages.length : 0);
  useEffect(() => {
    const len = Array.isArray(messages) ? messages.length : 0;
    if (len > lastMessageCountRef.current) {
      const lastMsg = messages[len - 1];
      if (lastMsg?.callsign && lastMsg.callsign !== callsign) {
        setIsLiveSignal(true);
        if (liveSignalTimeoutRef.current) clearTimeout(liveSignalTimeoutRef.current);

        const morseLen = String(lastMsg?.morse_code || "").length;
        const duration = morseLen ? morseLen * 150 : 1000;

        liveSignalTimeoutRef.current = setTimeout(() => {
          setIsLiveSignal(false);
        }, Math.max(duration, 500));
      }
    }
    lastMessageCountRef.current = len;
  }, [messages, callsign]);

  // モールス入力（通常モード：文章を作って最後に送信）
  const handleMorseInput = useCallback((char) => {
    setMessage((prev) => prev + char);
    setMorseBuffer((prev) => {
      if (char === " ") return prev + " / ";
      const m = CHAR_TO_MORSE[String(char).toUpperCase()] || "";
      return prev + m + " ";
    });
  }, []);

  // CW専用：リアルタイム送信（1文字ずつ）
  const handleMorseInputRealtime = useCallback(
    async (char) => {
      if (!callsign) return;
      const up = String(char).toUpperCase();
      const morse = up === " " ? "/" : CHAR_TO_MORSE[up] || "";
      await sendMessage(up, morse);
    },
    [callsign, sendMessage]
  );

  const clearMessage = useCallback(() => {
    setMessage("");
    setMorseBuffer("");
  }, []);

  const handleSendMorseMessage = useCallback(async () => {
    if (!message.trim()) return;
    if (!callsign) {
      toast.error("コールサインを設定してください");
      return;
    }
    const ok = await sendMessage(message.trim(), morseBuffer.trim());
    if (ok) {
      toast.success(`送信完了: ${message.trim()}`);
      clearMessage();
    } else {
      toast.error("送信に失敗しました");
    }
  }, [message, morseBuffer, callsign, sendMessage, clearMessage]);

  const handleTranslatorSend = useCallback(
    async (text, morse) => {
      if (!callsign) {
        toast.error("コールサインを設定してください");
        return;
      }
      await sendMessage(String(text || ""), String(morse || ""));
    },
    [callsign, sendMessage]
  );

  // 音声録音完了（VoiceModeが音声URL/Blobを返すなら、ここはAPI仕様に合わせて後で拡張）
  const handleRecordingComplete = useCallback(async (_audioBlob) => {
    toast.error("音声送信はまだAPI側未対応です（CWを優先）");
  }, []);

  // オーディオデータ受信（スペクトラム用）
  const handleAudioData = useCallback((data) => {
    if (!Array.isArray(data) || data.length === 0) return;
    const sum = data.reduce((a, b) => a + b, 0);
    const avg = sum / data.length;
    setSignalStrength(clamp(Math.floor(avg / 28), 0, 9));
  }, []);

  const handlePlayAudio = useCallback((audioUrl) => {
    if (!audioRef.current) return;
    audioRef.current.src = audioUrl;
    audioRef.current.play().catch(() => {});
  }, []);

  // QSL送信（実体はテキスト送信に寄せる）
  const handleSendQSL = useCallback(
    async (qslData) => {
      const qslMessage = `[QSL] To: ${qslData.to} | RST: ${qslData.rst_sent}/${qslData.rst_received} | ${qslData.message}`;
      const morse = qslMessage
        .split("")
        .map((c) => CHAR_TO_MORSE[String(c).toUpperCase()] || "")
        .join(" ");
      await sendMessage(qslMessage, morse);
      toast.success("QSLカード送信完了");
    },
    [sendMessage]
  );

  const lastContactCallsign = useMemo(() => {
    const list = Array.isArray(messages) ? messages : [];
    const other = list.filter((m) => m?.callsign && m.callsign !== callsign);
    if (other.length === 0) return null;
    return other[other.length - 1].callsign;
  }, [messages, callsign]);

  // スマホ用：周波数コントロール（安全で押しやすい）
  const step = 0.005;
  const minFreq = 0.1;
  const maxFreq = 30.0;

  const freqDown = useCallback(() => {
    setFrequency((f) => clamp(Number((f - step).toFixed(3)), minFreq, maxFreq));
  }, []);

  const freqUp = useCallback(() => {
    setFrequency((f) => clamp(Number((f + step).toFixed(3)), minFreq, maxFreq));
  }, []);

  // 画面幅が変わったらタブ初期を調整（スマホ→PCで変になるのを防ぐ）
  useEffect(() => {
    setActiveTab((prev) => prev || "radio");
  }, [isMobile]);

  // ---------- Render ----------
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
      <audio ref={audioRef} className="hidden" />

      {/* ヘッダー */}
      <header className="border-b border-zinc-800 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696c14183ca98efb6b491411/38caf3cc9_2025-11-18131416.png"
              alt="WorldMorse"
              className="w-10 h-10 rounded-lg"
            />
            <div className="min-w-0">
              <h1 className="text-white font-bold tracking-wide truncate">WorldMorse</h1>
              <p className="text-zinc-500 text-xs truncate">モールスを蘇らせよう</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                isConnected ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
              }`}
            >
              {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isConnected ? "ON AIR" : "OFF"}
            </div>

            <ContactsPanel myCallsign={callsign} />
            <CallsignSetup onCallsignSet={setCallsign} />

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
                  <HelpCircle className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
                <DialogHeader>
                  <DialogTitle>How to Use / 使い方</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 text-sm text-zinc-300">
                  <div>
                    <h4 className="font-medium text-amber-400 mb-1">Setup / セットアップ</h4>
                    <p>右上のボタンからコールサインを設定。</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-green-400 mb-1">CW Mode / CWモード</h4>
                    <p>短押し=短点、長押し=長点。</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-400 mb-1">SSB Mode / SSBモード</h4>
                    <p>PTTを押しながら話す（現状はAPI未対応の場合あり）。</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-purple-400 mb-1">Translator / 翻訳機</h4>
                    <p>テキスト⇔モールス相互変換。</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* メイン */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* タブ：PCは従来3つ / スマホは4つ */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {isMobile ? (
            <TabsList className="grid w-full grid-cols-4 bg-zinc-800/50">
              <TabsTrigger value="radio" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
                Radio
              </TabsTrigger>
              <TabsTrigger value="log" className="data-[state=active]:bg-green-500 data-[state=active]:text-black">
                Log
              </TabsTrigger>
              <TabsTrigger value="stations" className="data-[state=active]:bg-blue-500 data-[state=active]:text-black">
                Stations
              </TabsTrigger>
              <TabsTrigger value="translate" className="data-[state=active]:bg-purple-500 data-[state=active]:text-black">
                Tx
              </TabsTrigger>
            </TabsList>
          ) : (
            <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3 bg-zinc-800/50">
              <TabsTrigger value="radio" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
                Radio
              </TabsTrigger>
              <TabsTrigger value="morse-only" className="data-[state=active]:bg-green-500 data-[state=active]:text-black">
                CW Mode
              </TabsTrigger>
              <TabsTrigger value="translator" className="data-[state=active]:bg-purple-500 data-[state=active]:text-black">
                Translator
              </TabsTrigger>
            </TabsList>
          )}

          {/* -------------------- PC: Radio (3カラム) -------------------- */}
          {!isMobile && (
            <TabsContent value="radio" className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <div className="xl:col-span-1 space-y-4 order-2 xl:order-1">
                  <OnlineStations
                    stations={uiStations}
                    currentFrequency={frequency}
                    currentCallsign={callsign}
                  />
                </div>

                <div className="xl:col-span-2 order-1 xl:order-2">
                  <motion.div
                    className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-2xl p-6 shadow-2xl border border-zinc-700"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="mb-4">
                      <SpectrumDisplay
                        frequency={frequency}
                        isLiveSignal={isLiveSignal}
                        isTransmitting={isTransmitting}
                      />
                    </div>

                    <div className="mb-6">
                      <RadioDisplay
                        frequency={frequency}
                        message={message}
                        mode={mode}
                        isTransmitting={isTransmitting}
                        signalStrength={signalStrength}
                      />
                    </div>

                    {mode === "morse" && message && (
                      <div className="flex justify-end gap-2 mb-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearMessage}
                          className="border-zinc-700 text-zinc-400"
                        >
                          クリア
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSendMorseMessage}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={!callsign}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          送信 (TX)
                        </Button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                      <div className="flex justify-center">
                        <FrequencyDial frequency={frequency} onChange={setFrequency} />
                      </div>

                      <div className="flex justify-center">
                        {mode === "morse" ? (
                          <MorseKey
                            onMorseInput={handleMorseInput}
                            onTransmitChange={setIsTransmitting}
                            onMessageComplete={() => {}}
                          />
                        ) : (
                          <VoiceMode
                            onTransmitChange={setIsTransmitting}
                            onRecordingComplete={handleRecordingComplete}
                            onAudioData={handleAudioData}
                          />
                        )}
                      </div>

                      <div className="flex justify-center">
                        <ModeSelector mode={mode} onChange={setMode} />
                      </div>
                    </div>
                  </motion.div>

                  <div className="mt-6">
                    <ChatLog
                      messages={messages}
                      currentCallsign={callsign}
                      onPlayAudio={handlePlayAudio}
                    />

                    {lastContactCallsign && (
                      <div className="mt-4 flex justify-end">
                        <QSLCard
                          myCallsign={callsign}
                          recipientCallsign={lastContactCallsign}
                          frequency={frequency}
                          mode={mode}
                          onSend={handleSendQSL}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="xl:col-span-1 order-3">
                  <TranslatorPanel
                    onSendMessage={handleTranslatorSend}
                    canSend={!!callsign && mode === "morse"}
                  />
                </div>
              </div>
            </TabsContent>
          )}

          {/* -------------------- PC: CW-only -------------------- */}
          {!isMobile && (
            <TabsContent value="morse-only" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <OnlineStations
                    stations={uiStations}
                    currentFrequency={frequency}
                    currentCallsign={callsign}
                  />
                </div>

                <div className="lg:col-span-2">
                  <motion.div
                    className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-2xl p-6 shadow-2xl border border-green-900/50"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="text-center mb-4">
                      <span className="text-green-400 text-sm font-medium px-3 py-1 bg-green-500/20 rounded-full">
                        CW ONLY - Real-time TX
                      </span>
                    </div>

                    <div className="mb-4">
                      <SpectrumDisplay
                        frequency={frequency}
                        isLiveSignal={isLiveSignal}
                        isTransmitting={isTransmitting}
                      />
                    </div>

                    <RadioDisplay
                      frequency={frequency}
                      message=""
                      mode="morse"
                      isTransmitting={isTransmitting}
                      signalStrength={signalStrength}
                    />

                    <div className="grid grid-cols-2 gap-6 mt-6">
                      <div className="flex justify-center">
                        <FrequencyDial frequency={frequency} onChange={setFrequency} />
                      </div>
                      <div className="flex justify-center">
                        <MorseKey
                          onMorseInput={handleMorseInputRealtime}
                          onTransmitChange={setIsTransmitting}
                          onMessageComplete={() => {}}
                        />
                      </div>
                    </div>
                  </motion.div>

                  <div className="mt-6">
                    <ChatLog
                      messages={messages}
                      currentCallsign={callsign}
                      onPlayAudio={handlePlayAudio}
                    />
                    {lastContactCallsign && (
                      <div className="mt-4 flex justify-end">
                        <QSLCard
                          myCallsign={callsign}
                          recipientCallsign={lastContactCallsign}
                          frequency={frequency}
                          mode="morse"
                          onSend={handleSendQSL}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          )}

          {/* -------------------- PC: Translator -------------------- */}
          {!isMobile && (
            <TabsContent value="translator">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto space-y-6"
              >
                <div
                  className={`text-center py-2 rounded-lg ${
                    isConnected ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {isConnected
                    ? `📡 ${frequency.toFixed(3)} MHz - ${callsign || "No callsign"}`
                    : "⚠️ Offline - Set your callsign / コールサインを設定"}
                </div>

                <TranslatorPanel onSendMessage={handleTranslatorSend} canSend={!!callsign && isConnected} />

                <div className="mt-6 bg-zinc-900/50 rounded-xl border border-zinc-800 p-6">
                  <h3 className="text-white font-medium mb-4">Morse Basics / モールスの基本</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                      <span className="text-amber-400 font-mono">SOS</span>
                      <p className="text-zinc-500 text-xs mt-1">... --- ...</p>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                      <span className="text-amber-400 font-mono">CQ</span>
                      <p className="text-zinc-500 text-xs mt-1">-.-. --.-</p>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                      <span className="text-amber-400 font-mono">73</span>
                      <p className="text-zinc-500 text-xs mt-1">--... ...--</p>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3">
                      <span className="text-amber-400 font-mono">88</span>
                      <p className="text-zinc-500 text-xs mt-1">---.. ---..</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </TabsContent>
          )}

          {/* -------------------- Mobile: Radio -------------------- */}
          {isMobile && (
            <TabsContent value="radio" className="space-y-4">
              <motion.div
                className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-2xl p-4 shadow-2xl border border-zinc-700"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="mb-3">
                  <SpectrumDisplay
                    frequency={frequency}
                    isLiveSignal={isLiveSignal}
                    isTransmitting={isTransmitting}
                  />
                </div>

                <RadioDisplay
                  frequency={frequency}
                  message={message}
                  mode={mode}
                  isTransmitting={isTransmitting}
                  signalStrength={signalStrength}
                />

                {/* スマホ用 周波数コントロール */}
                <div className="mt-4 bg-zinc-900/40 border border-zinc-800 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-zinc-300 text-sm">FREQ</div>
                    <div className="font-mono text-amber-400 text-lg">{frequency.toFixed(3)} MHz</div>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <Button variant="outline" className="border-zinc-700 text-zinc-200" onClick={freqDown}>
                      -
                    </Button>

                    <input
                      type="range"
                      min={minFreq}
                      max={maxFreq}
                      step={step}
                      value={frequency}
                      onChange={(e) => setFrequency(Number(e.target.value))}
                      className="w-full"
                    />

                    <Button variant="outline" className="border-zinc-700 text-zinc-200" onClick={freqUp}>
                      +
                    </Button>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-zinc-500 text-xs">STEP {step.toFixed(3)} MHz</div>
                    <div className="flex items-center gap-2">
                      <div className="text-zinc-500 text-xs">MODE</div>
                      <ModeSelector mode={mode} onChange={setMode} />
                    </div>
                  </div>
                </div>

                {/* 送信ボタン（CW通常時） */}
                {mode === "morse" && message && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      onClick={clearMessage}
                      className="flex-1 border-zinc-700 text-zinc-300"
                    >
                      クリア
                    </Button>
                    <Button
                      onClick={handleSendMorseMessage}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      disabled={!callsign}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      送信
                    </Button>
                  </div>
                )}

                {/* 操作パネル */}
                <div className="mt-4">
                  {mode === "morse" ? (
                    <MorseKey
                      onMorseInput={handleMorseInput}
                      onTransmitChange={setIsTransmitting}
                      onMessageComplete={() => {}}
                    />
                  ) : (
                    <VoiceMode
                      onTransmitChange={setIsTransmitting}
                      onRecordingComplete={handleRecordingComplete}
                      onAudioData={handleAudioData}
                    />
                  )}
                </div>
              </motion.div>
            </TabsContent>
          )}

          {/* -------------------- Mobile: Log -------------------- */}
          {isMobile && (
            <TabsContent value="log" className="space-y-3">
              <ChatLog messages={messages} currentCallsign={callsign} onPlayAudio={handlePlayAudio} />
              {lastContactCallsign && (
                <div className="flex justify-end">
                  <QSLCard
                    myCallsign={callsign}
                    recipientCallsign={lastContactCallsign}
                    frequency={frequency}
                    mode={mode}
                    onSend={handleSendQSL}
                  />
                </div>
              )}
            </TabsContent>
          )}

          {/* -------------------- Mobile: Stations -------------------- */}
          {isMobile && (
            <TabsContent value="stations" className="space-y-3">
              <OnlineStations stations={uiStations} currentFrequency={frequency} currentCallsign={callsign} />
            </TabsContent>
          )}

          {/* -------------------- Mobile: Translate -------------------- */}
          {isMobile && (
            <TabsContent value="translate" className="space-y-4">
              <div
                className={`text-center py-2 rounded-lg ${
                  isConnected ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                }`}
              >
                {isConnected
                  ? `📡 ${frequency.toFixed(3)} MHz - ${callsign || "No callsign"}`
                  : "⚠️ Offline - Set your callsign / コールサインを設定"}
              </div>

              <TranslatorPanel onSendMessage={handleTranslatorSend} canSend={!!callsign && isConnected} />

              <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4">
                <h3 className="text-white font-medium mb-3">Morse Basics</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <span className="text-amber-400 font-mono">SOS</span>
                    <p className="text-zinc-500 text-xs mt-1">... --- ...</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <span className="text-amber-400 font-mono">CQ</span>
                    <p className="text-zinc-500 text-xs mt-1">-.-. --.-</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>

        <footer className="mt-12 text-center">
          <p className="text-zinc-600 text-xs">
            © WorldMorse - For educational purposes. A license is required for actual radio communication.
            <br />
            教育目的のシミュレーターです。実際の無線通信には免許が必要です。
          </p>
        </footer>
      </main>
    </div>
  );
}

