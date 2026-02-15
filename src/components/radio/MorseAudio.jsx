// モールス音声再生ユーティリティ
// 国際標準: 短点100ms, 長点300ms, 周波数600-800Hz

const DOT_DURATION = 100; // 短点 100ms (PARIS基準 約12-15WPM)
const DASH_DURATION = DOT_DURATION * 3; // 長点 300ms
const SYMBOL_GAP = DOT_DURATION; // 符号間 100ms
const LETTER_GAP = DOT_DURATION * 3; // 文字間 300ms
const WORD_GAP = DOT_DURATION * 7; // 単語間 700ms
const FREQUENCY = 700; // CW標準トーン周波数 (Hz)

let audioContext = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

// モールス符号を音声で再生
export const playMorseCode = (morseCode, volume = 0.3) => {
  const ctx = getAudioContext();
  let time = ctx.currentTime;

  const symbols = morseCode.split('');
  
  symbols.forEach((symbol, index) => {
    if (symbol === '.') {
      // 短点
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = FREQUENCY;
      gain.gain.value = volume;
      osc.start(time);
      osc.stop(time + DOT_DURATION / 1000);
      time += (DOT_DURATION + SYMBOL_GAP) / 1000;
    } else if (symbol === '-') {
      // 長点
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = FREQUENCY;
      gain.gain.value = volume;
      osc.start(time);
      osc.stop(time + DASH_DURATION / 1000);
      time += (DASH_DURATION + SYMBOL_GAP) / 1000;
    } else if (symbol === ' ') {
      // 文字間ギャップ
      time += LETTER_GAP / 1000;
    } else if (symbol === '/') {
      // 単語間ギャップ
      time += WORD_GAP / 1000;
    }
  });

  return time - ctx.currentTime; // 再生時間（秒）を返す
};

// 文字からモールス符号に変換するテーブル
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

// テキストをモールス符号に変換して再生
export const playTextAsMorse = (text, volume = 0.3) => {
  const morse = text.toUpperCase().split('').map(char => {
    return CHAR_TO_MORSE[char] || '';
  }).join(' ').replace(/  +/g, ' / ');
  
  return playMorseCode(morse, volume);
};

// 単一の文字をモールスで再生
export const playCharAsMorse = (char, volume = 0.3) => {
  const morse = CHAR_TO_MORSE[char.toUpperCase()] || '';
  if (morse) {
    playMorseCode(morse, volume);
  }
};

export default {
  playMorseCode,
  playTextAsMorse,
  playCharAsMorse
};