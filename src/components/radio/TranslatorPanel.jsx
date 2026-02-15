import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightLeft, Copy, Trash2, Send, Volume2, BookOpen } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

// モールス符号テーブル
const CHAR_TO_MORSE = {
  'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.',
  'F': '..-.', 'G': '--.', 'H': '....', 'I': '..', 'J': '.---',
  'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---',
  'P': '.--.', 'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-',
  'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-', 'Y': '-.--',
  'Z': '--..', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '0': '-----', '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.',
  '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...',
  ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-',
  '_': '..--.-', '"': '.-..-.', '$': '...-..-', '@': '.--.-.', ' ': '/'
};

const MORSE_TO_CHAR = Object.fromEntries(
  Object.entries(CHAR_TO_MORSE).map(([k, v]) => [v, k])
);

// Q符号・略符号テーブル
const ABBREVIATIONS = {
  // Q符号
  'QRA': '局名は何ですか？ / 私の局名は～です',
  'QRB': '距離はどのくらいですか？',
  'QRG': '周波数は何ですか？',
  'QRH': '周波数は変動しますか？',
  'QRI': '音調はどうですか？',
  'QRK': '了解度はどうですか？',
  'QRL': '使用中ですか？ / 使用中です',
  'QRM': '混信がありますか？ / 混信があります',
  'QRN': '空電がありますか？ / 空電があります',
  'QRO': '送信電力を増加しますか？',
  'QRP': '送信電力を減少しますか？ / 低出力',
  'QRQ': 'もっと速く送信しますか？',
  'QRS': 'もっとゆっくり送信してください',
  'QRT': '送信を中止しますか？ / 送信を終了します',
  'QRU': '伝えることがありますか？ / 何もありません',
  'QRV': '準備できましたか？ / 準備できました',
  'QRX': '待機してください',
  'QRZ': '誰が呼んでいますか？',
  'QSA': '信号の強さはどうですか？',
  'QSB': 'フェージングがありますか？',
  'QSL': '受信証を送りますか？ / 確認しました',
  'QSO': '交信できますか？ / 交信',
  'QSP': '中継しますか？',
  'QST': '全局宛て',
  'QSY': '周波数を変更しますか？',
  'QTH': '位置はどこですか？ / 私の位置は～です',
  
  // 一般略符号
  'CQ': '各局（呼び出し）',
  'DE': '～から（こちらは）',
  'K': 'どうぞ',
  'KN': '指定局のみどうぞ',
  'AR': '送信終了',
  'SK': '交信終了',
  'BK': 'ブレイク',
  'R': '了解',
  'RST': '了解度・信号強度・音調',
  'UR': 'あなたの',
  'ES': 'and（そして）',
  'TNX': 'ありがとう',
  'TKS': 'ありがとう',
  'PSE': 'お願いします',
  'OM': '男性オペレーター',
  'YL': '女性オペレーター',
  'XYL': '奥様',
  'FB': '素晴らしい',
  'VY': 'とても',
  'GM': 'おはよう',
  'GA': 'こんにちは',
  'GE': 'こんばんは',
  'GN': 'おやすみ',
  'GB': 'さようなら',
  'GL': '幸運を',
  'HPE': '望む',
  'HW': 'いかがですか',
  'NW': '今',
  'HR': 'ここ',
  'WX': '天気',
  'ANT': 'アンテナ',
  'RIG': '無線機',
  'PWR': '電力',
  'AGN': '再び',
  'CFM': '確認',
  'CUL': 'また後で',
  'CUAGN': 'またお会いしましょう',
  '73': 'さようなら（敬意を込めて）',
  '88': '愛と接吻（YL宛て）',
  '99': 'さようなら / 通信終了',
};

export default function TranslatorPanel({ onSendMessage, canSend = false }) {
  const [textInput, setTextInput] = useState('');
  const [morseInput, setMorseInput] = useState('');
  const [direction, setDirection] = useState('textToMorse'); // 'textToMorse' or 'morseToText'
  const audioContextRef = React.useRef(null);

  // テキスト → モールス変換
  const textToMorse = useCallback((text) => {
    return text.toUpperCase().split('').map(char => {
      return CHAR_TO_MORSE[char] || '';
    }).join(' ').replace(/  +/g, ' / ');
  }, []);

  // モールス → テキスト変換
  const morseToText = useCallback((morse) => {
    return morse.split(' ').map(code => {
      if (code === '/' || code === '') return ' ';
      return MORSE_TO_CHAR[code] || '';
    }).join('').replace(/  +/g, ' ');
  }, []);

  // 略符号を挿入
  const insertAbbreviation = (abbr) => {
    const newText = textInput + (textInput ? ' ' : '') + abbr;
    setTextInput(newText);
    if (direction === 'textToMorse') {
      setMorseInput(textToMorse(newText));
    }
  };

  // 入力変更ハンドラ
  const handleTextChange = (e) => {
    const text = e.target.value;
    setTextInput(text);
    if (direction === 'textToMorse') {
      setMorseInput(textToMorse(text));
    }
  };

  const handleMorseChange = (e) => {
    const morse = e.target.value;
    setMorseInput(morse);
    if (direction === 'morseToText') {
      setTextInput(morseToText(morse));
    }
  };

  // 方向切り替え
  const toggleDirection = () => {
    setDirection(prev => {
      if (prev === 'textToMorse') {
        setTextInput(morseToText(morseInput));
        return 'morseToText';
      } else {
        setMorseInput(textToMorse(textInput));
        return 'textToMorse';
      }
    });
  };

  // コピー
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('コピーしました');
  };

  // クリア
  const clearAll = () => {
    setTextInput('');
    setMorseInput('');
  };

  // モールス音声再生
  const playMorseAudio = useCallback(() => {
    if (!morseInput) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    
    const DOT_DURATION = 0.08;
    const DASH_DURATION = DOT_DURATION * 3;
    const SYMBOL_GAP = DOT_DURATION;
    const LETTER_GAP = DOT_DURATION * 3;
    const WORD_GAP = DOT_DURATION * 7;

    let time = ctx.currentTime;
    const frequency = 700;

    morseInput.split('').forEach(symbol => {
      if (symbol === '.') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = frequency;
        gain.gain.value = 0.3;
        osc.start(time);
        osc.stop(time + DOT_DURATION);
        time += DOT_DURATION + SYMBOL_GAP;
      } else if (symbol === '-') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = frequency;
        gain.gain.value = 0.3;
        osc.start(time);
        osc.stop(time + DASH_DURATION);
        time += DASH_DURATION + SYMBOL_GAP;
      } else if (symbol === ' ') {
        time += LETTER_GAP;
      } else if (symbol === '/') {
        time += WORD_GAP;
      }
    });
  }, [morseInput]);

  // 送信
  const handleSend = () => {
    if (!textInput.trim() || !morseInput.trim()) {
      toast.error('テキストを入力してください');
      return;
    }
    onSendMessage?.(textInput.trim(), morseInput.trim());
    toast.success('送信しました');
    clearAll();
  };

  return (
    <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-amber-500" />
          モールス信号 翻訳機
        </h3>
        <div className="flex gap-1">
          {/* 略符号一覧ダイアログ */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-white">
                <BookOpen className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>Q符号・略符号一覧</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-amber-400 font-medium mb-2">Q符号</h4>
                    <div className="grid grid-cols-1 gap-1">
                      {Object.entries(ABBREVIATIONS).filter(([k]) => k.startsWith('Q')).map(([code, meaning]) => (
                        <button
                          key={code}
                          onClick={() => insertAbbreviation(code)}
                          className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 rounded text-left transition-colors"
                        >
                          <span className="font-mono text-green-400 font-bold">{code}</span>
                          <span className="text-zinc-400 text-sm ml-4">{meaning}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-amber-400 font-medium mb-2">一般略符号</h4>
                    <div className="grid grid-cols-1 gap-1">
                      {Object.entries(ABBREVIATIONS).filter(([k]) => !k.startsWith('Q')).map(([code, meaning]) => (
                        <button
                          key={code}
                          onClick={() => insertAbbreviation(code)}
                          className="flex items-center justify-between px-3 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 rounded text-left transition-colors"
                        >
                          <span className="font-mono text-green-400 font-bold">{code}</span>
                          <span className="text-zinc-400 text-sm ml-4">{meaning}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-zinc-500 hover:text-white"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* よく使う略符号クイックボタン */}
      <div className="flex flex-wrap gap-1 mb-4">
        {['CQ', 'DE', 'K', '73', 'QTH', 'QSL', 'TNX', 'FB'].map(abbr => (
          <Button
            key={abbr}
            variant="outline"
            size="sm"
            onClick={() => insertAbbreviation(abbr)}
            className="border-zinc-700 text-green-400 hover:bg-green-500/20 text-xs px-2 py-1 h-7"
          >
            {abbr}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        {/* テキスト入力 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-zinc-400 text-sm">
              {direction === 'textToMorse' ? 'テキスト (入力)' : 'テキスト (出力)'}
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(textInput)}
              className="text-zinc-500 hover:text-white h-6 px-2"
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <Textarea
            value={textInput}
            onChange={handleTextChange}
            placeholder="テキストを入力..."
            className="bg-black border-zinc-700 text-white font-mono resize-none h-24"
            readOnly={direction === 'morseToText'}
          />
        </div>

        {/* 方向切り替えボタン */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleDirection}
            className="border-zinc-700 text-zinc-400 hover:text-white"
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            {direction === 'textToMorse' ? 'テキスト → モールス' : 'モールス → テキスト'}
          </Button>
        </div>

        {/* モールス入力 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-zinc-400 text-sm">
              {direction === 'morseToText' ? 'モールス信号 (入力)' : 'モールス信号 (出力)'}
            </label>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={playMorseAudio}
                className="text-zinc-500 hover:text-white h-6 px-2"
                title="音声再生"
              >
                <Volume2 className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(morseInput)}
                className="text-zinc-500 hover:text-white h-6 px-2"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
          <Textarea
            value={morseInput}
            onChange={handleMorseChange}
            placeholder="モールス信号を入力 (例: .- -... -.-.)"
            className="bg-black border-zinc-700 text-amber-400 font-mono tracking-wider resize-none h-24"
            readOnly={direction === 'textToMorse'}
          />
        </div>

        {/* 送信ボタン */}
        {canSend && (
          <Button
            onClick={handleSend}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            disabled={!textInput.trim()}
          >
            <Send className="w-4 h-4 mr-2" />
            この内容を送信
          </Button>
        )}

        {/* 凡例 */}
        <div className="bg-zinc-800/50 rounded-lg p-3 mt-4">
          <p className="text-zinc-500 text-xs mb-2">記号の意味:</p>
          <div className="flex gap-4 text-xs">
            <span className="text-amber-400">・(.) = 短点</span>
            <span className="text-amber-400">ー(-) = 長点</span>
            <span className="text-zinc-500">スペース = 文字区切り</span>
            <span className="text-zinc-500">/ = 単語区切り</span>
          </div>
        </div>
      </div>
    </div>
  );
}