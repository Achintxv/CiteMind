'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client.js';
import MessageInput from './MessageInput.jsx';
import MessageList from './MessageList.jsx';
import Sidebar from './Sidebar.jsx';

export default function ChatInterface() {
  const [conversations, setConversations] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [c, d] = await Promise.all([api('/api/chat/conversations'), api('/api/documents')]);
      setConversations(c);
      setDocuments(d);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function selectConversation(id) {
    setError('');
    setMenuOpen(false);
    try {
      const convo = await api(`/api/chat/conversations/${id}`);
      setActiveId(id);
      setMessages(convo.messages);
    } catch (e) {
      setError(e.message);
    }
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setError('');
    setMenuOpen(false);
  }

  async function removeConversation(id) {
    try {
      await api(`/api/chat/conversations/${id}`, { method: 'DELETE' });
      if (id === activeId) newChat();
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function send(text) {
    setError('');
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: 'USER', content: text }]);
    setLoading(true);
    try {
      const data = await api('/api/chat', { method: 'POST', body: { message: text, conversationId: activeId ?? undefined } });
      setActiveId(data.conversationId);
      setMessages((m) => [...m, data.message]);
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const sidebar = (
    <Sidebar
      conversations={conversations}
      documents={documents}
      activeId={activeId}
      onSelect={selectConversation}
      onNew={newChat}
      onDelete={removeConversation}
    />
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:block">{sidebar}</div>
      {menuOpen && (
        <div className="fixed inset-0 z-20 flex md:hidden">
          {sidebar}
          <button type="button" aria-label="Close menu" className="flex-1 bg-black/30" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-gray-200 bg-white p-3 md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            Menu
          </button>
          <span className="font-semibold">CiteMind</span>
        </div>
        <MessageList messages={messages} loading={loading} hasDocuments={documents.length > 0} />
        {error && (
          <p role="alert" className="mx-4 mb-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <MessageInput onSend={send} disabled={loading} />
      </main>
    </div>
  );
}
