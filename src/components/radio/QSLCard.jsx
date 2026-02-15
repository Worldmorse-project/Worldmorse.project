import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, X, CheckCircle, Radio, MapPin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * WorldMorse v4.3 QSLCard
 * - Base44依存を完全排除
 * - 画像アップロード/AIチェックは停止（サーバ側API未実装）
 * - onSend(qslData) に委譲して送信のみ行う
 */
export default function QSLCard({ myCallsign, recipientCallsign, frequency, mode, onSend }) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState("");
  const [rstSent, setRstSent] = useState("599");
  const [rstReceived, setRstReceived] = useState("599");
  const [sentOk, setSentOk] = useState(false);

  // 互換のためにUIは残すが、画像はローカルプレビューのみ（送信しない）
  const [localImageUrl, setLocalImageUrl] = useState("");
  const fileInputRef = useRef(null);

  const disabled = !recipientCallsign || !myCallsign;

  const handlePickImage = () => fileInputRef.current?.click();

  const handleLocalImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLocalImageUrl(url);
  };

  const handleClearImage = () => {
    if (localImageUrl) URL.revokeObjectURL(localImageUrl);
    setLocalImageUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const currentDate = useMemo(() => {
    return new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }, []);

  const currentTime = useMemo(() => {
    return (
      new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC"
    );
  }, []);

  const handleSendQSL = async () => {
    if (!message.trim()) return;
    if (disabled) return;

    try {
      const qslData = {
        from: String(myCallsign || "").toUpperCase(),
        to: String(recipientCallsign || "").toUpperCase(),
        frequency: Number(frequency) || 0,
        mode: String(mode || "morse"),
        message: String(message || "").trim(),
        location: String(location || "").trim(),
        rst_sent: String(rstSent || "").trim(),
        rst_received: String(rstReceived || "").trim(),
        // 画像は現状送らない（サーバAPI未実装）
        image_url: null,
        timestamp: new Date().toISOString(),
      };

      await onSend?.(qslData);

      setSentOk(true);
      setTimeout(() => {
        setIsOpen(false);
        setMessage("");
        setLocation("");
        setRstSent("599");
        setRstReceived("599");
        setSentOk(false);
        handleClearImage();
      }, 900);
    } catch {
      // 親側(Home.jsx)のtoast等に任せる
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) setSentOk(false); }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
          disabled={!recipientCallsign}
        >
          📮 QSL Card
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-zinc-900 border-zinc-700 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-amber-500" />
            Send QSL Card / QSLカード送信
          </DialogTitle>
        </DialogHeader>

        {/* プレビュー */}
        <div className="bg-gradient-to-br from-amber-100 to-orange-100 rounded-lg p-4 text-zinc-900 max-h-[60vh] overflow-y-auto">
          <div className="border-2 border-amber-600 rounded-lg p-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-2xl font-bold text-amber-800">{myCallsign || "MY CALL"}</h3>
                <p className="text-xs text-amber-600">Amateur Radio Station</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-mono text-amber-700">{currentDate}</p>
                <p className="font-mono text-amber-700">{currentTime}</p>
              </div>
            </div>

            <div className="bg-white/50 rounded p-3 mb-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-amber-600 text-xs">TO:</span>
                <p className="font-bold">{recipientCallsign || "---"}</p>
              </div>
              <div>
                <span className="text-amber-600 text-xs">FREQ:</span>
                <p className="font-mono">{Number(frequency || 0).toFixed(3)} MHz</p>
              </div>
              <div>
                <span className="text-amber-600 text-xs">MODE:</span>
                <p className="font-mono">{mode === "morse" ? "CW" : "SSB"}</p>
              </div>
              <div>
                <span className="text-amber-600 text-xs">RST:</span>
                <p className="font-mono">
                  {rstSent} / {rstReceived}
                </p>
              </div>
            </div>

            {localImageUrl && (
              <div className="mb-2 rounded overflow-hidden">
                <img src={localImageUrl} alt="QSL" className="w-full object-contain max-h-48" />
              </div>
            )}

            {message && (
              <div className="bg-white/30 rounded p-2 text-sm italic">
                "{message}"
              </div>
            )}
            {location && (
              <div className="flex items-center gap-1 mt-2 text-xs text-amber-700">
                <MapPin className="w-3 h-3" />
                {location}
              </div>
            )}
          </div>
        </div>

        {/* 入力 */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-zinc-400">RST Sent</label>
              <Input value={rstSent} onChange={(e) => setRstSent(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" maxLength={3} />
            </div>
            <div>
              <label className="text-xs text-zinc-400">RST Received</label>
              <Input value={rstReceived} onChange={(e) => setRstReceived(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" maxLength={3} />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400">Location / QTH</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Tokyo, Japan" className="bg-zinc-800 border-zinc-700 text-white" />
          </div>

          {/* 画像（ローカルプレビューだけ） */}
          <div>
            <label className="text-xs text-zinc-400">Image / 画像 (preview only)</label>
            <input type="file" ref={fileInputRef} onChange={handleLocalImageUpload} accept="image/*" className="hidden" />
            {localImageUrl ? (
              <div className="flex items-center gap-2 mt-1">
                <img src={localImageUrl} alt="Preview" className="w-16 h-16 object-cover rounded" />
                <Button variant="ghost" size="sm" onClick={handleClearImage} className="text-red-400 hover:text-red-300">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={handlePickImage} className="w-full mt-1 border-zinc-700 text-zinc-400">
                Add Image (preview)
              </Button>
            )}
            <p className="text-xs text-zinc-500 mt-1">※ 現在は送信されません（サーバ側のアップロードAPI未実装）</p>
          </div>

          <div>
            <label className="text-xs text-zinc-400">Message / メッセージ</label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="bg-zinc-800 border-zinc-700 text-white h-20" maxLength={200} />
            <p className="text-xs text-zinc-500 text-right">{message.length}/200</p>
          </div>

          {sentOk && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-green-400 bg-green-500/20 rounded-lg p-3">
              <CheckCircle className="w-5 h-5" />
              <span>Sent successfully! / 送信完了!</span>
            </motion.div>
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t border-zinc-700">
          <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1 border-zinc-600 text-zinc-400">
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button onClick={handleSendQSL} disabled={!message.trim() || sentOk || disabled} className="flex-1 bg-amber-500 hover:bg-amber-600 text-black">
            <Send className="w-4 h-4 mr-1" />
            Send QSL
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
