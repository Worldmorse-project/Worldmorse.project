import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, User, Save } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// Cookie操作ユーティリティ
const setCookie = (name, value, days = 365) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return decodeURIComponent(parts.pop().split(';').shift());
  }
  return null;
};

export default function CallsignSetup({ onCallsignSet }) {
  const [isOpen, setIsOpen] = useState(false);
  const [callsign, setCallsign] = useState('');
  const [operatorName, setOperatorName] = useState('');

  useEffect(() => {
    // Cookieからコールサインを読み込み
    const savedCallsign = getCookie('ham_callsign');
    const savedName = getCookie('ham_operator_name');
    
    if (savedCallsign) {
      setCallsign(savedCallsign);
      setOperatorName(savedName || '');
      onCallsignSet?.(savedCallsign);
    } else {
      // コールサインが未設定の場合はダイアログを表示
      setIsOpen(true);
    }
  }, []);

  const handleSave = () => {
    if (!callsign.trim()) {
      toast.error('コールサインを入力してください');
      return;
    }

    // コールサインのフォーマット検証（簡易）
    const formattedCallsign = callsign.toUpperCase().trim();
    
    // Cookieに保存
    setCookie('ham_callsign', formattedCallsign);
    setCookie('ham_operator_name', operatorName.trim());
    
    setCallsign(formattedCallsign);
    onCallsignSet?.(formattedCallsign);
    setIsOpen(false);
    toast.success(`コールサイン ${formattedCallsign} を設定しました`);
  };

  const openSettings = () => {
    const savedCallsign = getCookie('ham_callsign');
    const savedName = getCookie('ham_operator_name');
    setCallsign(savedCallsign || '');
    setOperatorName(savedName || '');
    setIsOpen(true);
  };

  return (
    <>
      {/* コールサイン表示・編集ボタン */}
      <Button
        variant="ghost"
        size="sm"
        onClick={openSettings}
        className="text-amber-400 hover:text-amber-300 hover:bg-zinc-800"
      >
        <User className="w-4 h-4 mr-2" />
        {getCookie('ham_callsign') || 'コールサイン設定'}
      </Button>

      {/* 設定ダイアログ */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-amber-500" />
              局情報の設定
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              あなたのコールサインを設定してください。他の局との通信に使用されます。
            </DialogDescription>
          </DialogHeader>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 pt-4"
          >
            {/* コールサイン入力 */}
            <div className="space-y-2">
              <Label htmlFor="callsign" className="text-zinc-300">
                コールサイン <span className="text-red-500">*</span>
              </Label>
              <Input
                id="callsign"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value.toUpperCase())}
                placeholder="例: JA1ABC"
                className="bg-black border-zinc-700 text-amber-400 font-mono text-lg uppercase tracking-wider"
                maxLength={10}
              />
              <p className="text-xs text-zinc-500">
                実際のコールサインまたは架空のコールサインを入力
              </p>
            </div>

            {/* オペレーター名入力 */}
            <div className="space-y-2">
              <Label htmlFor="operatorName" className="text-zinc-300">
                オペレーター名（任意）
              </Label>
              <Input
                id="operatorName"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="例: Taro"
                className="bg-black border-zinc-700 text-green-400"
                maxLength={20}
              />
            </div>

            {/* 保存ボタン */}
            <div className="flex justify-end gap-3 pt-4">
              {getCookie('ham_callsign') && (
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="border-zinc-700 text-zinc-400"
                >
                  キャンセル
                </Button>
              )}
              <Button
                onClick={handleSave}
                className="bg-amber-500 hover:bg-amber-600 text-black"
              >
                <Save className="w-4 h-4 mr-2" />
                保存
              </Button>
            </div>
          </motion.div>

          {/* 注意書き */}
          <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg">
            <p className="text-xs text-zinc-500 text-center">
              ※ このシミュレーターは教育目的です。実際の無線通信には免許が必要です。
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}