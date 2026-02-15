import React, { useEffect, useMemo, useState } from "react";
import { BookUser, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listContacts, updateContact } from "@/api/base44Client";

/**
 * WorldMorse v4.3 ContactsPanel
 * - Base44依存を完全排除
 * - Renderサーバの Contacts API を使用（listContacts / updateContact）
 *
 * props:
 * - myCallsign: string
 * - onSelectContact?: (callsign: string) => void
 */
export default function ContactsPanel({ myCallsign, onSelectContact }) {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);

  // 追加/編集フォーム
  const [editOpen, setEditOpen] = useState(false);
  const [editCallsign, setEditCallsign] = useState("");
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const canUse = useMemo(() => !!String(myCallsign || "").trim(), [myCallsign]);

  const refresh = async () => {
    if (!canUse) return;
    setLoading(true);
    try {
      const list = await listContacts({ myCallsign });
      setContacts(Array.isArray(list) ? list : []);
    } catch {
      // サーバ未実装でもUIは落とさない
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startNew = () => {
    setEditCallsign("");
    setEditName("");
    setEditLocation("");
    setEditNotes("");
    setEditOpen(true);
  };

  const startEdit = (c) => {
    setEditCallsign(String(c?.callsign || "").toUpperCase());
    setEditName(String(c?.name || ""));
    setEditLocation(String(c?.location || ""));
    setEditNotes(String(c?.notes || ""));
    setEditOpen(true);
  };

  const save = async () => {
    if (!canUse) return;
    const cs = String(editCallsign || "").trim().toUpperCase();
    if (!cs) return;

    setSaving(true);
    try {
      await updateContact({
        myCallsign,
        callsign: cs,
        name: editName || "",
        location: editLocation || "",
        notes: editNotes || "",
      });
      setEditOpen(false);
      await refresh();
    } catch {
      // ここでtoastを出したいならHome側に任せる運用でもOK
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800/60"
            disabled={!canUse}
            title={canUse ? "Contacts" : "Set callsign first"}
          >
            <BookUser className="w-4 h-4 mr-2" />
            Contacts
          </Button>
        </DialogTrigger>

        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Contacts</span>
              <Button
                variant="outline"
                size="sm"
                onClick={startNew}
                className="border-zinc-700 text-zinc-200"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="text-xs text-zinc-500">
            My callsign: <span className="text-zinc-300 font-mono">{String(myCallsign || "").toUpperCase()}</span>
          </div>

          <ScrollArea className="h-[320px] mt-2 rounded-md border border-zinc-800">
            <div className="p-3 space-y-2">
              {loading ? (
                <div className="text-sm text-zinc-400">Loading...</div>
              ) : contacts.length === 0 ? (
                <div className="text-sm text-zinc-500">No contacts yet.</div>
              ) : (
                contacts.map((c) => {
                  const cs = String(c?.callsign || "").toUpperCase();
                  return (
                    <div
                      key={cs || Math.random()}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                    >
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => {
                          onSelectContact?.(cs);
                          // 選択だけで閉じたいなら以下を有効化
                          // setOpen(false);
                        }}
                      >
                        <div className="font-mono font-semibold text-zinc-200">{cs || "UNKNOWN"}</div>
                        {(c?.name || c?.location) && (
                          <div className="text-xs text-zinc-500">
                            {c?.name ? String(c.name) : ""}
                            {c?.name && c?.location ? " / " : ""}
                            {c?.location ? String(c.location) : ""}
                          </div>
                        )}
                      </button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(c)}
                        className="border-zinc-700 text-zinc-300"
                      >
                        Edit
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* 追加/編集ダイアログ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Contact</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <div className="text-xs text-zinc-400 mb-1">Callsign</div>
              <Input
                value={editCallsign}
                onChange={(e) => setEditCallsign(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-white font-mono"
                placeholder="JA1XXX"
              />
            </div>

            <div>
              <div className="text-xs text-zinc-400 mb-1">Name (optional)</div>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-white"
                placeholder="Taro"
              />
            </div>

            <div>
              <div className="text-xs text-zinc-400 mb-1">Location / QTH (optional)</div>
              <Input
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-white"
                placeholder="Tokyo"
              />
            </div>

            <div>
              <div className="text-xs text-zinc-400 mb-1">Notes (optional)</div>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="bg-zinc-950 border-zinc-800 text-white"
                placeholder="Rig/Ant etc."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setEditOpen(false)}
                className="border-zinc-700 text-zinc-300"
                disabled={saving}
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button
                onClick={save}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={saving || !editCallsign.trim() || !canUse}
              >
                <Save className="w-4 h-4 mr-1" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>

            <div className="text-xs text-zinc-500">
              ※ サーバ側 Contacts API が未実装の場合、保存しても反映されません（UIは落ちません）。
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
