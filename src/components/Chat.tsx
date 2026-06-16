import React, { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { db, auth } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X } from 'lucide-react';

interface ChatMessage {
  id: string;
  message: string;
  senderName: string;
  createdAt: unknown;
  uid: string;
}

export default function Chat({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'chat'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'chat'), {
        message: text,
        senderName: auth.currentUser?.displayName || 'Oyente',
        createdAt: serverTimestamp(),
        uid: auth.currentUser?.uid || 'anon',
      });
      setNewMessage('');
    } catch (err) {
      console.error('Error al enviar:', err);
    } finally {
      setSending(false);
    }
  };

  const isOwn = (uid: string) => uid === (auth.currentUser?.uid || 'anon');

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 60 }}
      className="fixed inset-0 z-[110] bg-[#050507]/96 backdrop-blur-xl flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <h2 className="text-sm font-black uppercase tracking-[0.25em] text-white">Chat en Vivo</h2>
        <button onClick={onClose} className="p-2 text-white/30 hover:text-white transition-colors rounded-xl">
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/20 text-xs uppercase tracking-widest">Sin mensajes aún</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={clsx('flex flex-col max-w-[80%]', isOwn(msg.uid) ? 'ml-auto items-end' : 'items-start')}>
            <span className="text-[10px] text-white/25 uppercase tracking-wider mb-1">{msg.senderName}</span>
            <div className={clsx(
              'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
              isOwn(msg.uid)
                ? 'bg-blue-600/25 text-blue-100 rounded-br-sm'
                : 'bg-white/[0.06] text-white/80 rounded-bl-sm'
            )}>
              {msg.message}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="px-4 py-3 border-t border-white/[0.06] flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Escribe un mensaje..."
          maxLength={200}
          className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-full px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-full transition-colors active:scale-90"
        >
          <Send size={16} />
        </button>
      </form>
    </motion.div>
  );
}
