import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, X, Loader2, AlertTriangle, CheckCircle, Radio, MapPin, Clock, ImagePlus, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { base44 } from '@/api/base44Client';

export default function QSLCard({ myCallsign, recipientCallsign, frequency, mode, onSend }) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState('');
  const [rstSent, setRstSent] = useState('599');
  const [rstReceived, setRstReceived] = useState('599');
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null); // 'safe', 'harmful', null
  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // 画像アップロード
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImageUrl(file_url);
    } catch (error) {
      console.error('Image upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendQSL = async () => {
    if (!message.trim()) return;

    setIsChecking(true);
    setCheckResult(null);

    try {
      // AIで内容をチェック（画像がある場合は画像もチェック）
      const checkParams = {
        prompt: `You are a content moderator for amateur radio QSL cards. Check if the following content is appropriate and safe to send. QSL cards should be friendly, professional communications between amateur radio operators.

Message to check:
"${message}"

Location: ${location}
RST Sent: ${rstSent}
RST Received: ${rstReceived}

${imageUrl ? 'An image is also attached. Please check if the image is appropriate for a QSL card (radio equipment, antenna, location photos, operator photos, etc. are OK).' : ''}

Determine if this content is:
- Safe: Normal QSL card content (greetings, signal reports, equipment info, location, appropriate images, etc.)
- Harmful: Contains hate speech, threats, harassment, spam, illegal content, inappropriate images, or inappropriate material

Respond with JSON.`,
        response_json_schema: {
          type: "object",
          properties: {
            is_safe: { type: "boolean" },
            reason: { type: "string" }
          },
          required: ["is_safe", "reason"]
        }
      };

      // 画像がある場合は添付
      if (imageUrl) {
        checkParams.file_urls = [imageUrl];
      }

      const result = await base44.integrations.Core.InvokeLLM(checkParams);

      if (result.is_safe) {
        setCheckResult('safe');
        // 安全な場合は送信
        const qslData = {
          from: myCallsign,
          to: recipientCallsign,
          frequency,
          mode,
          message,
          location,
          rst_sent: rstSent,
          rst_received: rstReceived,
          image_url: imageUrl || null,
          timestamp: new Date().toISOString()
        };
        
        onSend?.(qslData);
        
        setTimeout(() => {
          setIsOpen(false);
          setMessage('');
          setLocation('');
          setImageUrl('');
          setCheckResult(null);
        }, 1500);
      } else {
        setCheckResult('harmful');
      }
    } catch (error) {
      console.error('QSL check error:', error);
      setCheckResult('harmful');
    } finally {
      setIsChecking(false);
    }
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }) + ' UTC';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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

        {/* QSLカードプレビュー */}
        <div className="bg-gradient-to-br from-amber-100 to-orange-100 rounded-lg p-4 text-zinc-900 max-h-[60vh] overflow-y-auto">
          <div className="border-2 border-amber-600 rounded-lg p-4">
            {/* ヘッダー */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-2xl font-bold text-amber-800">{myCallsign || 'MY CALL'}</h3>
                <p className="text-xs text-amber-600">Amateur Radio Station</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-mono text-amber-700">{currentDate}</p>
                <p className="font-mono text-amber-700">{currentTime}</p>
              </div>
            </div>

            {/* 交信情報 */}
            <div className="bg-white/50 rounded p-3 mb-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-amber-600 text-xs">TO:</span>
                <p className="font-bold">{recipientCallsign || '---'}</p>
              </div>
              <div>
                <span className="text-amber-600 text-xs">FREQ:</span>
                <p className="font-mono">{frequency?.toFixed(3)} MHz</p>
              </div>
              <div>
                <span className="text-amber-600 text-xs">MODE:</span>
                <p className="font-mono">{mode === 'morse' ? 'CW' : 'SSB'}</p>
              </div>
              <div>
                <span className="text-amber-600 text-xs">RST:</span>
                <p className="font-mono">{rstSent} / {rstReceived}</p>
              </div>
            </div>

            {/* 画像プレビュー */}
            {imageUrl && (
              <div className="mb-2 rounded overflow-hidden">
                <img src={imageUrl} alt="QSL" className="w-full object-contain max-h-48" />
              </div>
            )}

            {/* メッセージプレビュー */}
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

        {/* 入力フォーム */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-zinc-400">RST Sent</label>
              <Input
                value={rstSent}
                onChange={(e) => setRstSent(e.target.value)}
                placeholder="599"
                className="bg-zinc-800 border-zinc-700 text-white"
                maxLength={3}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400">RST Received</label>
              <Input
                value={rstReceived}
                onChange={(e) => setRstReceived(e.target.value)}
                placeholder="599"
                className="bg-zinc-800 border-zinc-700 text-white"
                maxLength={3}
              />
            </div>
          </div>
          
          <div>
            <label className="text-xs text-zinc-400">Location / QTH</label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Tokyo, Japan"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>

          {/* 画像アップロード */}
          <div>
            <label className="text-xs text-zinc-400">Image / 画像 (optional)</label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            {imageUrl ? (
              <div className="flex items-center gap-2 mt-1">
                <img src={imageUrl} alt="Preview" className="w-16 h-16 object-cover rounded" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setImageUrl('')}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full mt-1 border-zinc-700 text-zinc-400"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <ImagePlus className="w-4 h-4 mr-1" />
                )}
                {isUploading ? 'Uploading...' : 'Add Image'}
              </Button>
            )}
          </div>

          <div>
            <label className="text-xs text-zinc-400">Message / メッセージ</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Thanks for the QSO! 73 de ..."
              className="bg-zinc-800 border-zinc-700 text-white h-20"
              maxLength={200}
            />
            <p className="text-xs text-zinc-500 text-right">{message.length}/200</p>
          </div>

          {/* チェック結果 */}
          {checkResult === 'safe' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-green-400 bg-green-500/20 rounded-lg p-3"
            >
              <CheckCircle className="w-5 h-5" />
              <span>Sent successfully! / 送信完了!</span>
            </motion.div>
          )}

          {checkResult === 'harmful' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-red-400 bg-red-500/20 rounded-lg p-3"
            >
              <AlertTriangle className="w-5 h-5" />
              <span>Content not allowed / 送信できない内容です</span>
            </motion.div>
          )}
        </div>

        {/* 送信ボタン - ダイアログ下部に固定 */}
        <div className="flex gap-2 pt-2 border-t border-zinc-700">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="flex-1 border-zinc-600 text-zinc-400"
          >
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button
            onClick={handleSendQSL}
            disabled={!message.trim() || isChecking || checkResult === 'safe'}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-black"
          >
            {isChecking ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-1" />
                Send QSL
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}