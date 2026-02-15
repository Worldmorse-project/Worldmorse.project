import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, Radio } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

export default function VoiceMode({ onTransmitChange, onRecordingComplete, onAudioData }) {
  const [isRecording, setIsRecording] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const audioContext = useRef(null);
  const analyser = useRef(null);
  const animationFrame = useRef(null);

  // オーディオレベルモニタリング
  const monitorAudioLevel = useCallback(() => {
    if (!analyser.current) return;

    const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
    analyser.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    setAudioLevel(average / 255 * 100);

    // オーディオデータをコールバック
    onAudioData?.(dataArray);

    animationFrame.current = requestAnimationFrame(monitorAudioLevel);
  }, [onAudioData]);

  // 録音開始
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // オーディオコンテキストとアナライザーのセットアップ
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 256;
      
      const source = audioContext.current.createMediaStreamSource(stream);
      source.connect(analyser.current);

      // レベルモニタリング開始
      monitorAudioLevel();

      // MediaRecorderセットアップ
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        audioChunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        onRecordingComplete?.(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        
        if (animationFrame.current) {
          cancelAnimationFrame(animationFrame.current);
        }
      };

      mediaRecorder.current.start(100); // 100msごとにデータ取得
      setIsRecording(true);
      onTransmitChange?.(true);

    } catch (error) {
      console.error('マイクアクセスエラー:', error);
    }
  }, [onTransmitChange, onRecordingComplete, monitorAudioLevel]);

  // 録音停止
  const stopRecording = useCallback(() => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      onTransmitChange?.(false);
      setAudioLevel(0);
    }
  }, [isRecording, onTransmitChange]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <span className="text-zinc-500 text-xs uppercase tracking-wider">SSB VOICE</span>

      {/* オーディオレベルメーター */}
      <div className="w-full max-w-[120px] h-4 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
          initial={{ width: 0 }}
          animate={{ width: `${audioLevel}%` }}
          transition={{ duration: 0.05 }}
        />
      </div>

      {/* PTTボタン */}
      <motion.button
        className={`relative w-28 h-28 rounded-full cursor-pointer select-none touch-none ${
          isRecording ? 'bg-red-600' : 'bg-gradient-to-b from-zinc-600 to-zinc-800'
        }`}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={stopRecording}
        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
        onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
        whileTap={{ scale: 0.95 }}
      >
        {/* 外枠リング */}
        <div className={`absolute inset-0 rounded-full border-4 ${
          isRecording ? 'border-red-400 animate-pulse' : 'border-zinc-600'
        }`} />
        
        {/* 内側 */}
        <motion.div
          className={`absolute inset-3 rounded-full flex items-center justify-center ${
            isRecording 
              ? 'bg-gradient-to-b from-red-500 to-red-700' 
              : 'bg-gradient-to-b from-zinc-500 to-zinc-700'
          }`}
          animate={isRecording ? {
            boxShadow: ['0 0 20px rgba(239, 68, 68, 0.5)', '0 0 40px rgba(239, 68, 68, 0.8)', '0 0 20px rgba(239, 68, 68, 0.5)']
          } : {}}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          {isRecording ? (
            <Mic className="w-8 h-8 text-white" />
          ) : (
            <MicOff className="w-8 h-8 text-zinc-400" />
          )}
        </motion.div>

        {/* TX表示 */}
        {isRecording && (
          <motion.div
            className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-500 rounded text-xs font-bold text-white"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
          >
            TX
          </motion.div>
        )}
      </motion.button>

      {/* 操作説明 */}
      <p className="text-zinc-500 text-sm text-center">
        押しながら話す (PTT)
      </p>

      {/* ボリュームコントロール */}
      <div className="flex items-center gap-3 w-full max-w-[160px]">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMuted(!isMuted)}
          className="text-zinc-500 hover:text-white h-8 w-8"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </Button>
        <Slider
          value={[isMuted ? 0 : volume]}
          onValueChange={([v]) => setVolume(v)}
          max={100}
          step={1}
          className="flex-1"
        />
      </div>

      {/* 受信インジケータ */}
      <div className="flex items-center gap-2 text-xs">
        <Radio className="w-3 h-3 text-green-500" />
        <span className="text-zinc-500">受信待機中</span>
      </div>
    </div>
  );
}