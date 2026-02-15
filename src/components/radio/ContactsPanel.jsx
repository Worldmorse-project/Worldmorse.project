import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, Search, Edit2, Trash2, X, Save, Radio, MapPin, Calendar, MessageSquare } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { base44 } from '@/api/base44Client';

export default function ContactsPanel({ myCallsign, onSelectContact }) {
  const [contacts, setContacts] = useState([]);
  const [qsoLogs, setQsoLogs] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingContact, setEditingContact] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [newContact, setNewContact] = useState({ callsign: '', name: '', location: '', notes: '' });

  // 連絡先とQSOログを読み込む
  useEffect(() => {
    loadContacts();
    loadQSOLogs();
  }, []);

  const loadContacts = async () => {
    try {
      const data = await base44.entities.Contact.list('-last_contact_date');
      setContacts(data);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };

  const loadQSOLogs = async () => {
    try {
      const data = await base44.entities.QSOLog.list('-qso_date', 100);
      setQsoLogs(data);
    } catch (error) {
      console.error('Failed to load QSO logs:', error);
    }
  };

  const handleAddContact = async () => {
    if (!newContact.callsign.trim()) return;
    try {
      await base44.entities.Contact.create({
        ...newContact,
        callsign: newContact.callsign.toUpperCase(),
        qso_count: 0
      });
      setNewContact({ callsign: '', name: '', location: '', notes: '' });
      loadContacts();
    } catch (error) {
      console.error('Failed to add contact:', error);
    }
  };

  const handleUpdateContact = async () => {
    if (!editingContact) return;
    try {
      await base44.entities.Contact.update(editingContact.id, editingContact);
      setEditingContact(null);
      loadContacts();
    } catch (error) {
      console.error('Failed to update contact:', error);
    }
  };

  const handleDeleteContact = async (id) => {
    try {
      await base44.entities.Contact.delete(id);
      loadContacts();
      if (selectedContact?.id === id) setSelectedContact(null);
    } catch (error) {
      console.error('Failed to delete contact:', error);
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.callsign?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getContactQSOLogs = (callsign) => {
    return qsoLogs.filter(log => 
      log.their_callsign === callsign || log.my_callsign === callsign
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="border-blue-500/50 text-blue-400 hover:bg-blue-500/20"
        >
          <Users className="w-4 h-4 mr-1" />
          <span className="hidden sm:inline">Contacts</span>
          <span className="sm:hidden">連絡先</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-700 max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Contacts / 連絡先管理
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-4 flex-1 min-h-0">
          {/* 連絡先リスト */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* 検索 */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input
                placeholder="Search callsign..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-zinc-800 border-zinc-700 text-white"
              />
            </div>

            {/* 新規追加 */}
            <div className="bg-zinc-800/50 rounded-lg p-3 mb-3 space-y-2">
              <Input
                placeholder="Callsign"
                value={newContact.callsign}
                onChange={(e) => setNewContact({...newContact, callsign: e.target.value.toUpperCase()})}
                className="bg-zinc-800 border-zinc-700 text-white text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Name"
                  value={newContact.name}
                  onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                  className="bg-zinc-800 border-zinc-700 text-white text-sm"
                />
                <Input
                  placeholder="Location"
                  value={newContact.location}
                  onChange={(e) => setNewContact({...newContact, location: e.target.value})}
                  className="bg-zinc-800 border-zinc-700 text-white text-sm"
                />
              </div>
              <Button 
                onClick={handleAddContact}
                disabled={!newContact.callsign.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Contact
              </Button>
            </div>

            {/* リスト */}
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-2">
                <AnimatePresence>
                  {filteredContacts.map((contact) => (
                    <motion.div
                      key={contact.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedContact?.id === contact.id 
                          ? 'bg-blue-600/30 border border-blue-500' 
                          : 'bg-zinc-800 hover:bg-zinc-700'
                      }`}
                      onClick={() => setSelectedContact(contact)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono font-bold text-amber-400">{contact.callsign}</p>
                          {contact.name && <p className="text-sm text-zinc-400">{contact.name}</p>}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-400 hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingContact(contact);
                            }}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-zinc-400 hover:text-red-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteContact(contact.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      {contact.location && (
                        <div className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
                          <MapPin className="w-3 h-3" />
                          {contact.location}
                        </div>
                      )}
                      <div className="text-xs text-zinc-500 mt-1">
                        QSO: {contact.qso_count || 0}回
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {filteredContacts.length === 0 && (
                  <p className="text-center text-zinc-500 py-4">No contacts found</p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* QSO履歴 */}
          {selectedContact && (
            <div className="flex-1 flex flex-col min-h-0 border-t sm:border-t-0 sm:border-l border-zinc-700 pt-4 sm:pt-0 sm:pl-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Radio className="w-4 h-4 text-amber-400" />
                  {selectedContact.callsign} QSO Log
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-zinc-400 sm:hidden"
                  onClick={() => setSelectedContact(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              {selectedContact.notes && (
                <div className="bg-zinc-800/50 rounded p-2 mb-3 text-sm text-zinc-300">
                  <MessageSquare className="w-3 h-3 inline mr-1 text-zinc-500" />
                  {selectedContact.notes}
                </div>
              )}

              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-2">
                  {getContactQSOLogs(selectedContact.callsign).map((log) => (
                    <div key={log.id} className="bg-zinc-800 rounded p-2 text-sm">
                      <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(log.qso_date).toLocaleDateString()}
                        </span>
                        <span className="font-mono">{log.frequency?.toFixed(3)} MHz</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs">
                          {log.mode === 'morse' ? 'CW' : 'SSB'}
                        </span>
                        <span className="text-zinc-400 text-xs">
                          RST: {log.rst_sent}/{log.rst_received}
                        </span>
                      </div>
                      {log.message && (
                        <p className="text-zinc-300 mt-1 text-xs">{log.message}</p>
                      )}
                    </div>
                  ))}
                  {getContactQSOLogs(selectedContact.callsign).length === 0 && (
                    <p className="text-center text-zinc-500 py-4 text-sm">No QSO logs</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* 編集ダイアログ */}
        {editingContact && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-zinc-800 rounded-lg p-4 w-full max-w-sm space-y-3">
              <h3 className="text-white font-bold">Edit Contact</h3>
              <Input
                placeholder="Callsign"
                value={editingContact.callsign}
                onChange={(e) => setEditingContact({...editingContact, callsign: e.target.value.toUpperCase()})}
                className="bg-zinc-700 border-zinc-600 text-white"
              />
              <Input
                placeholder="Name"
                value={editingContact.name || ''}
                onChange={(e) => setEditingContact({...editingContact, name: e.target.value})}
                className="bg-zinc-700 border-zinc-600 text-white"
              />
              <Input
                placeholder="Location"
                value={editingContact.location || ''}
                onChange={(e) => setEditingContact({...editingContact, location: e.target.value})}
                className="bg-zinc-700 border-zinc-600 text-white"
              />
              <Textarea
                placeholder="Notes"
                value={editingContact.notes || ''}
                onChange={(e) => setEditingContact({...editingContact, notes: e.target.value})}
                className="bg-zinc-700 border-zinc-600 text-white h-20"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditingContact(null)}
                  className="flex-1 border-zinc-600"
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateContact}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}