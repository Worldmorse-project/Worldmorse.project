import React, { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { HelpCircle, Radio as RadioIcon, Send, Wifi, WifiOff } from "lucide-react";
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

export default function Home() {
  const [frequency, setFrequency] = useState(7.05);
  const [mode, setMode] = useState("morse"); // UI互換（v4.3はCW中心）
  const [message, setMessage] = useState("");
  const [morseBuffer, setMorseBuffer] = useState("");
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("radio");
  const [signalStrength, setSignalStrength] = useState(5);
  const [isLiveSignal, setIsLiveSignal] = useState(false);

  const audioRef = useRef(null);
  const liveSignalTimeoutRef = useRef(null);

  // 通信フック（Renderサーバ版）
  const {
    messages,
    onlineStations,
    callsign,
    setCallsign,
    isConnected,
    sendMessage,
  } = useP2PRadio(frequency, mode);

  // v4.3: messages は { fromCallsign, payload:{morse}, createdAt ... }
  const lastMessageCountRef = useRef(messages.length);
  React.useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      const lastMsg = messages[messages.length - 1];
      const from = String(lastMsg?.fromCallsign || "").toUpperCase();
      const morse = String(lastMsg?.payload?.morse || "");
      if (from && callsign && from !== callsign) {
        setIsLiveSignal(true);
        if (liveSignalTimeoutRef.current) clearTimeout(liveSignalTimeoutRef.current);

        const duration = morse ? morse.length * 150 : 1000;
        liveSignalTimeoutRef.current = setTimeout(() => {
          setIsLiveSignal(false);
        }, Math.max(duration, 500));
      }
    }
    lastMessageCountRef.current = messages.length;
  }, [messages, callsign]);

  // オンライン局のUI用整形
  // サーバ: { callsign, currentChannel, status, lastSeenAt }
  // UI: { callsign, frequency, mode }
  const uiStations = React.useMemo(() => {
    const list = Array.isArray(onlineStations) ? onlineStations : [];
    return list.map((s) => {
      const cs = String(s?.callsign || "").toUpperCase();
      const ch = String(s?.currentChannel || toChannelString(frequency));
      return {
        callsign: cs,
        frequency: channelToNumber(ch),
        mode: "morse",
      };
    });
  }, [onlineStations, frequency]);

  // モールス入力ハンドラ（通常モード）
  const handleMorseInput = useCallback((char) => {
    setMessage((prev) => prev + char);

    // v4.3の一次データは " .- " のように文字区切りを含む文字列でOK
    if (char === " ") {
      setMorseBuffer((prev) => prev + " / ");
    } else {
      setMorseBuffer((prev) => prev + (CHAR_TO_MORSE[char] || "") + " ");
    }
  }, []);

  // CW専用モード用：リアルタイム送信（文字単位）
  const handleMorseInputRealtime = useCallback(
    async (char) => {
      if (!callsign) return;
      const morse = char === " " ? "/" : CHAR_TO_MORSE[char] || "";
      // textPreview=char, morse=符号
      await sendMessage(char, morse);
    },
    [callsign, sendMessage]
  );

  // メッセージ送信（まとめて送る）
  const handleSendMorseMessage = useCallback(async () => {
    if (!message.trim()) return;
    if (!callsign) {
      toast.error("コールサインを設定してください");
      return;
    }

    const ok = await sendMessage(message.trim(), morseBuffer.trim());
    if (ok) {
      toast.success("送信完了: " + message.trim());
      setMessage("");
      setMorseBuffer("");
    } else {
      toast.error("送信に失敗しました");
    }
  }, [message, morseBuffer, callsign, sendMessage]);

  // 翻訳パネルからの送信
  const handleTranslatorSend = useCallback(
    async (text, morse) => {
      if (!callsign) {
        toast.error("コールサインを設定してください");
        return;
      }
      await sendMessage(text, morse);
    },
    [callsign, sendMessage]
  );

  // 音声録音完了時（Base44 UploadFile依存だったので停止）
  const handleRecordingComplete = useCallback(async (_audioBlob) => {
    toast.error("音声(SSB)は現在停止中です（サーバ側API未実装）");
  }, []);

  // オーディオデータ受信時（スペクトラム用）
  const handleAudioData = useCallback((data) => {
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    setSignalStrength(Math.min(9, Math.floor(avg / 28)));
  }, []);

  // 音声再生（現状は未使用のまま）
  const handlePlayAudio = useCallback((audioUrl) => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
    }
  }, []);

  // QSLカード送信（保存は後回し）
  const handleSendQSL = useCallback(
    async (qslData) => {
      const qslMessage = `[QSL] To: ${qslData.to} | RST: ${qslData.rst_sent}/${qslData.rst_received} | ${qslData.message}`;
      const morse = qslMessage
        .split("")
        .map((c) => CHAR_TO_MORSE[(c || "").toUpperCase()] || "")
        .join(" ");
      await sendMessage(qslMessage, morse);
      toast.success("QSL Card sent! / QSLカード送信完了!");
    },
    [sendMessage]
  );

  // 最後に交信した相手のコールサイン（v4.3対応）
  const lastContactCallsign = React.useMemo(() => {
    const other = (Array.isArray(messages) ? messages : []).filter(
      (m) => String(m?.fromCallsign || "").toUpperCase() !== String(callsign || "").toUpperCase()
    );
    if (other.length > 0) {
      return String(other[other.length - 1]?.fromCallsign || "").toUpperCase();
    }
    return null;
  }, [messages, callsign]);

  const clearMessage = () => {
    setMessage("");
    setMorseBuffer("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
      <audio ref={audioRef} className="hidden" />

      {/* ヘッダー */}
      <header className="border-b border-zinc-800 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/696c14183ca98efb6b491411/38caf3cc9_2025-11-18131416.png"
              alt="WorldMorse"
              className="w-10 h-10 rounded-lg"
            />
            <div>
              <h1 className="text-white font-bold tracking-wide">WorldMorse</h1>
              <p className="text-zinc-500 text-xs">モールスを蘇らせよう</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 接続状態 */}
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
                    <p>短押し=短点、長押し=長点。通常タブはまとめて送信、CW ONLYは文字単位で送信。</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-400 mb-1">SSB Mode / 音声モード</h4>
                    <p>現在停止中（サーバ側アップロードAPI未実装）。</p>
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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

          {/* Radio */}
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
                    <SpectrumDisplay frequency={frequency} isLiveSignal={isLiveSignal} isTransmitting={isTransmitting} />
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
                      <Button variant="outline" size="sm" onClick={clearMessage} className="border-zinc-700 text-zinc-400">
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
                  <ChatLog messages={messages} currentCallsign={callsign} onPlayAudio={handlePlayAudio} />
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
                <TranslatorPanel onSendMessage={handleTranslatorSend} canSend={!!callsign && mode === "morse"} />
              </div>
            </div>
          </TabsContent>

          {/* CW ONLY */}
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
                    <SpectrumDisplay frequency={frequency} isLiveSignal={isLiveSignal} isTransmitting={isTransmitting} />
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

          {/* Translator */}
          <TabsContent value="translator">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
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
