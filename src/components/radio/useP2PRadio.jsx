import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

// Cookie操作ユーティリティ
const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return decodeURIComponent(parts.pop().split(';').shift());
  }
  return null;
};

export default function useP2PRadio(frequency, mode) {
  const [messages, setMessages] = useState([]);
  const [onlineStations, setOnlineStations] = useState([]);
  const [callsign, setCallsign] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  
  const pollingInterval = useRef(null);
  const lastMessageTime = useRef(new Date().toISOString());

  // コールサインの初期化
  useEffect(() => {
    const savedCallsign = getCookie('ham_callsign');
    if (savedCallsign) {
      setCallsign(savedCallsign);
    }
  }, []);

  // 自局の状態を更新（定期的に）
  const updatePresence = useCallback(async () => {
    if (!callsign) return;

    try {
      // 既存のプレゼンス情報を検索
      const existingPresence = await base44.entities.RadioMessage.filter({
        callsign: callsign,
        content: '__PRESENCE__'
      });

      const presenceData = {
        callsign,
        frequency,
        mode,
        content: '__PRESENCE__',
        timestamp: new Date().toISOString()
      };

      if (existingPresence.length > 0) {
        // 更新
        await base44.entities.RadioMessage.update(existingPresence[0].id, presenceData);
      } else {
        // 新規作成
        await base44.entities.RadioMessage.create(presenceData);
      }
      
      setIsConnected(true);
    } catch (error) {
      console.error('プレゼンス更新エラー:', error);
      setIsConnected(false);
    }
  }, [callsign, frequency, mode]);

  // オンライン局の取得
  const fetchOnlineStations = useCallback(async () => {
    try {
      // 過去2分以内にアクティブな局を取得
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      
      const presenceMessages = await base44.entities.RadioMessage.filter({
        content: '__PRESENCE__'
      }, '-updated_date', 50);

      // 最近更新された局のみフィルタ
      const activeStations = presenceMessages
        .filter(p => p.updated_date >= twoMinutesAgo)
        .map(p => ({
          callsign: p.callsign,
          frequency: p.frequency,
          mode: p.mode,
          lastSeen: p.updated_date
        }));

      setOnlineStations(activeStations);
    } catch (error) {
      console.error('オンライン局取得エラー:', error);
    }
  }, []);

  // 新しいメッセージの取得
  const fetchMessages = useCallback(async () => {
    try {
      // 同じ周波数帯（±5kHz）のメッセージを取得
      const recentMessages = await base44.entities.RadioMessage.filter({
        content: { $ne: '__PRESENCE__' }
      }, '-created_date', 50);

      // 周波数でフィルタリング
      const frequencyMessages = recentMessages.filter(msg => 
        Math.abs((msg.frequency || 0) - frequency) < 0.005
      );

      // 新しいメッセージがあれば追加
      if (frequencyMessages.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMessages = frequencyMessages.filter(m => !existingIds.has(m.id));
          
          if (newMessages.length > 0) {
            return [...prev, ...newMessages].slice(-100); // 最大100件保持
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('メッセージ取得エラー:', error);
    }
  }, [frequency]);

  // メッセージ送信
  const sendMessage = useCallback(async (content, morseCode = '', audioUrl = '') => {
    if (!callsign) {
      console.error('コールサインが設定されていません');
      return false;
    }

    try {
      const messageData = {
        callsign,
        frequency,
        mode,
        content,
        morse_code: morseCode,
        audio_url: audioUrl,
        timestamp: new Date().toISOString()
      };

      const created = await base44.entities.RadioMessage.create(messageData);
      
      // ローカルにも追加
      setMessages(prev => [...prev, { ...messageData, id: created.id }]);
      
      return true;
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      return false;
    }
  }, [callsign, frequency, mode]);

  // ポーリング開始
  useEffect(() => {
    if (!callsign) return;

    // 初回取得
    updatePresence();
    fetchOnlineStations();
    fetchMessages();

    // 定期的なポーリング
    pollingInterval.current = setInterval(() => {
      updatePresence();
      fetchOnlineStations();
      fetchMessages();
    }, 3000); // 3秒ごと

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [callsign, updatePresence, fetchOnlineStations, fetchMessages]);

  // リアルタイム購読（サブスクリプション）
  useEffect(() => {
    const unsubscribe = base44.entities.RadioMessage.subscribe((event) => {
      if (event.type === 'create' && event.data.content !== '__PRESENCE__') {
        // 同じ周波数帯のメッセージのみ
        if (Math.abs((event.data.frequency || 0) - frequency) < 0.005) {
          setMessages(prev => {
            const exists = prev.some(m => m.id === event.id);
            if (!exists) {
              return [...prev, event.data].slice(-100);
            }
            return prev;
          });
        }
      }
    });

    return unsubscribe;
  }, [frequency]);

  // 周波数変更時にメッセージをクリア
  useEffect(() => {
    setMessages([]);
    fetchMessages();
  }, [frequency]);

  return {
    messages,
    onlineStations,
    callsign,
    setCallsign,
    isConnected,
    sendMessage
  };
}