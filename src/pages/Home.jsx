import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, Radio as RadioIcon, Send, Wifi, WifiOff, Settings } from 'lucide-react';
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
import { base44 } from '@/api/base44Client';

import RadioDisplay from '@/components/radio/RadioDisplay';
import MorseKey from '@/components/radio/MorseKey';
import FrequencyDial from '@/components/radio/FrequencyDial';
import ModeSelector from '@/components/radio/ModeSelector';
import TranslatorPanel from '@/components/radio/TranslatorPanel';
import VoiceMode from '@/components/radio/VoiceMode';
import CallsignSetup from '@/components/radio/CallsignSetup';
import ChatLog from '@/components/radio/ChatLog';
import OnlineStations from '@/components/radio/OnlineStations';
import SpectrumDisplay from '@/components/radio/SpectrumDisplay';
import useP2PRadio from '@/components/radio/useP2PRadio';
import { playCharAsMorse } from '@/components/radio/MorseAudio';
import QSLCard from '@/components/radio/QSLCard';
import ContactsPanel from '@/components/radio/ContactsPanel';

// モールス符号テーブル（逆変換用）
const CHAR_TO_MORSE = {
  'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.',
  'F': '..-.', 'G': '--.', 'H': '....', 'I': '..', 'J': '.---',
  'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---',
  'P': '.--.', 'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-',
  'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-', 'Y': '-.--',
  'Z': '--..', ' ': '/'
};

export default function Home() {
  const [frequency, setFrequency] = useState(7.050);
  const [mode, setMode] = useState('morse');
  const [message, setMessage] = useState('');
  const [morseBuffer, setMorseBuffer] = useState('');
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('radio');
  const [signalStrength, setSignalStrength] = useState(5);
  const [isLiveSignal, setIsLiveSignal] = useState(false);
  
  const audioRef = useRef(null);
  const liveSignalTimeoutRef = useRef(null);

  // P2P通信フック
  const { 
    messages, 
    onlineStations, 
    callsign, 
    setCallsign,
    isConnected, 
    sendMessage 
  } = useP2PRadio(frequency, mode);

  // 新しいメッセージ受信時にライブ信号をトリガー
  const lastMessageCountRef = useRef(messages.length);
  React.useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      const lastMsg = messages[messages.length - 1];
      // 他局からのメッセージの場合、ライブ信号を表示
      if (lastMsg.callsign !== callsign) {
        setIsLiveSignal(true);
        // タイムアウトをクリアして再設定
        if (liveSignalTimeoutRef.current) {
          clearTimeout(liveSignalTimeoutRef.current);
        }
        // モールス符号の長さに応じてライブ信号を維持
        const duration = lastMsg.morse_code ? lastMsg.morse_code.length * 150 : 1000;
        liveSignalTimeoutRef.current = setTimeout(() => {
          setIsLiveSignal(false);
        }, Math.max(duration, 500));
      }
    }
    lastMessageCountRef.current = messages.length;
  }, [messages, callsign]);

  // モールス入力ハンドラ（通常モード）
  const handleMorseInput = useCallback((char) => {
    setMessage(prev => prev + char);
    if (char === ' ') {
      setMorseBuffer(prev => prev + ' / ');
    } else {
      setMorseBuffer(prev => prev + (CHAR_TO_MORSE[char] || '') + ' ');
    }
  }, []);

  // CW専用モード用：リアルタイム送信（音声付き）
  const handleMorseInputRealtime = useCallback(async (char) => {
    if (!callsign) return;
    
    const morse = char === ' ' ? '/' : (CHAR_TO_MORSE[char] || '');
    // 自分の入力音は電鍵で鳴っているので追加再生不要
    await sendMessage(char, morse);
  }, [callsign, sendMessage]);

  // メッセージ送信（モールス）
  const handleSendMorseMessage = useCallback(async () => {
    if (!message.trim()) return;
    if (!callsign) {
      toast.error('コールサインを設定してください');
      return;
    }

    const success = await sendMessage(message.trim(), morseBuffer.trim());
    if (success) {
      toast.success('送信完了: ' + message.trim());
      setMessage('');
      setMorseBuffer('');
    } else {
      toast.error('送信に失敗しました');
    }
  }, [message, morseBuffer, callsign, sendMessage]);

  // 翻訳パネルからの送信
  const handleTranslatorSend = useCallback(async (text, morse) => {
    if (!callsign) {
      toast.error('コールサインを設定してください');
      return;
    }
    await sendMessage(text, morse);
  }, [callsign, sendMessage]);

  // 音声録音完了時
  const handleRecordingComplete = useCallback(async (audioBlob) => {
    if (!callsign) {
      toast.error('コールサインを設定してください');
      return;
    }

    try {
      toast.loading('音声をアップロード中...');
      const { file_url } = await base44.integrations.Core.UploadFile({ 
        file: audioBlob 
      });
      
      const success = await sendMessage('(音声メッセージ)', '', file_url);
      if (success) {
        toast.dismiss();
        toast.success('音声を送信しました');
      }
    } catch (error) {
      console.error('音声アップロードエラー:', error);
      toast.dismiss();
      toast.error('音声の送信に失敗しました');
    }
  }, [callsign, sendMessage]);

  // オーディオデータ受信時（スペクトラム用）
  const handleAudioData = useCallback((data) => {
    const avg = data.reduce((a, b) => a + b) / data.length;
    setSignalStrength(Math.min(9, Math.floor(avg / 28)));
  }, []);

  // 音声再生
  const handlePlayAudio = useCallback((audioUrl) => {
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
    }
  }, []);

  // QSLカード送信
  const handleSendQSL = useCallback(async (qslData) => {
    const qslMessage = `[QSL] To: ${qslData.to} | RST: ${qslData.rst_sent}/${qslData.rst_received} | ${qslData.message}`;
    const morse = qslMessage.split('').map(c => CHAR_TO_MORSE[c.toUpperCase()] || '').join(' ');
    await sendMessage(qslMessage, morse);
    
    // QSOログを保存
    try {
      await base44.entities.QSOLog.create({
        my_callsign: qslData.from,
        their_callsign: qslData.to,
        frequency: qslData.frequency,
        mode: qslData.mode,
        rst_sent: qslData.rst_sent,
        rst_received: qslData.rst_received,
        message: qslData.message,
        qso_date: new Date().toISOString()
      });
      
      // 連絡先を更新または作成
      const existingContacts = await base44.entities.Contact.filter({ callsign: qslData.to });
      if (existingContacts.length > 0) {
        await base44.entities.Contact.update(existingContacts[0].id, {
          last_contact_date: new Date().toISOString(),
          qso_count: (existingContacts[0].qso_count || 0) + 1
        });
      } else {
        await base44.entities.Contact.create({
          callsign: qslData.to,
          last_contact_date: new Date().toISOString(),
          qso_count: 1
        });
      }
    } catch (error) {
      console.error('Failed to save QSO log:', error);
    }
    
    toast.success('QSL Card sent! / QSLカード送信完了!');
  }, [sendMessage]);

  // 最後に交信した相手のコールサイン
  const lastContactCallsign = React.useMemo(() => {
    const otherMessages = messages.filter(m => m.callsign !== callsign);
    if (otherMessages.length > 0) {
      return otherMessages[otherMessages.length - 1].callsign;
    }
    return null;
  }, [messages, callsign]);

  // メッセージクリア
  const clearMessage = () => {
    setMessage('');
    setMorseBuffer('');
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
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
              isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isConnected ? 'ON AIR' : 'OFF'}
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
                    <h4 className="font-medium text-amber-400 mb-1">🔧 Setup / セットアップ</h4>
                    <p>Set your callsign from the button at top right. / 右上のボタンからコールサインを設定。</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-green-400 mb-1">📻 CW Mode / CWモード</h4>
                    <p>Click key or press Space. Short=dot(.), Long=dash(-). / 電鍵クリックorスペースキー。短押し=短点、長押し=長点。</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-400 mb-1">🎙️ SSB Mode / SSBモード</h4>
                    <p>Hold PTT button while speaking. / PTTボタンを押しながら話す。</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-purple-400 mb-1">📡 Spectrum & Waterfall</h4>
                    <p>Visual display of signal activity. / 信号をリアルタイム表示。</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-cyan-400 mb-1">🔤 Translator / 翻訳機</h4>
                    <p>Convert text ⇔ Morse code. / テキスト⇔モールス相互変換。</p>
                  </div>
                  </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3 bg-zinc-800/50">
            <TabsTrigger value="radio" className="data-[state=active]:bg-amber-500 data-[state=active]:text-black">
              📻 Radio
            </TabsTrigger>
            <TabsTrigger value="morse-only" className="data-[state=active]:bg-green-500 data-[state=active]:text-black">
              ⚡ CW Mode
            </TabsTrigger>
            <TabsTrigger value="translator" className="data-[state=active]:bg-purple-500 data-[state=active]:text-black">
              🔤 Translator
            </TabsTrigger>
          </TabsList>

          {/* 無線機タブ（フル機能） */}
          <TabsContent value="radio" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              {/* 左サイドバー */}
              <div className="xl:col-span-1 space-y-4 order-2 xl:order-1">
                <OnlineStations 
                  stations={onlineStations} 
                  currentFrequency={frequency}
                  currentCallsign={callsign}
                />
              </div>

              {/* 中央: 無線機本体 */}
              <div className="xl:col-span-2 order-1 xl:order-2">
                <motion.div 
                  className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-2xl p-6 shadow-2xl border border-zinc-700"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {/* スペクトラム/ウォーターフォール */}
                  <div className="mb-4">
                    <SpectrumDisplay 
                      frequency={frequency}
                      isLiveSignal={isLiveSignal}
                      isTransmitting={isTransmitting}
                    />
                  </div>

                  {/* ディスプレイ */}
                  <div className="mb-6">
                    <RadioDisplay
                      frequency={frequency}
                      message={message}
                      mode={mode}
                      isTransmitting={isTransmitting}
                      signalStrength={signalStrength}
                    />
                  </div>

                  {/* 送信ボタン（モールスモード時） */}
                  {mode === 'morse' && message && (
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

                  {/* コントロールパネル */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    <div className="flex justify-center">
                      <FrequencyDial frequency={frequency} onChange={setFrequency} />
                    </div>

                    <div className="flex justify-center">
                      {mode === 'morse' ? (
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

                {/* 交信ログ */}
                <div className="mt-6">
                  <ChatLog 
                    messages={messages}
                    currentCallsign={callsign}
                    onPlayAudio={handlePlayAudio}
                  />
                  {/* QSLカードボタン */}
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

              {/* 右サイドバー: クイック翻訳 */}
              <div className="xl:col-span-1 order-3">
                <TranslatorPanel 
                  onSendMessage={handleTranslatorSend}
                  canSend={!!callsign && mode === 'morse'}
                />
              </div>
            </div>
          </TabsContent>

          {/* CW専用タブ（モールスのみ） */}
          <TabsContent value="morse-only" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <OnlineStations 
                  stations={onlineStations.filter(s => s.mode === 'morse')} 
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
                      ⚡ CW ONLY - Real-time TX / リアルタイム送信
                    </span>
                  </div>

                  {/* スペクトラム */}
                  <div className="mb-4">
                    <SpectrumDisplay 
                      frequency={frequency}
                      isLiveSignal={isLiveSignal}
                      isTransmitting={isTransmitting}
                    />
                  </div>

                  {/* ディスプレイ */}
                  <RadioDisplay
                    frequency={frequency}
                    message=""
                    mode="morse"
                    isTransmitting={isTransmitting}
                    signalStrength={signalStrength}
                  />

                  {/* 電鍵とダイヤル */}
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

                {/* CW専用ログ */}
                <div className="mt-6">
                  <ChatLog 
                    messages={messages.filter(m => m.mode === 'morse')}
                    currentCallsign={callsign}
                    onPlayAudio={handlePlayAudio}
                  />
                  {/* QSLカードボタン */}
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

          {/* 翻訳機タブ */}
          <TabsContent value="translator">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              {/* 接続状態表示 */}
              <div className={`text-center py-2 rounded-lg ${
                isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {isConnected ? `📡 ${frequency.toFixed(3)} MHz - ${callsign || 'No callsign'}` : '⚠️ Offline - Set your callsign / コールサインを設定'}
              </div>

              <TranslatorPanel 
                onSendMessage={handleTranslatorSend}
                canSend={!!callsign && isConnected}
              />
              
              {/* 使い方ガイド */}
              <div className="mt-6 bg-zinc-900/50 rounded-xl border border-zinc-800 p-6">
                <h3 className="text-white font-medium mb-4">💡 Morse Basics / モールスの基本</h3>
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

        {/* フッター */}
        <footer className="mt-12 text-center">
          <p className="text-zinc-600 text-xs">
            © WorldMorse - For educational purposes. A license is required for actual radio communication.<br/>
            教育目的のシミュレーターです。実際の無線通信には免許が必要です。
          </p>
        </footer>
      </main>
    </div>
  );
}