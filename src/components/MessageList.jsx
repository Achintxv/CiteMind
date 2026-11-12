'use client';

import { useEffect, useRef } from 'react';
import SourceCitation from './SourceCitation.jsx';

export default function MessageList({ messages, loading, hasDocuments }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <h2 className="text-lg font-semibold">Ask about your documents</h2>
          <p className="mt-2 text-sm text-gray-600">
            {hasDocuments
              ? 'Answers come only from your uploaded files, with the passages used shown under each reply.'
              : 'Upload a PDF or TXT file from the Documents page first, then ask a question about it.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
      {messages.map((m) => {
        const isUser = m.role === 'USER';
        return (
          <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] space-y-2 md:max-w-2xl`}>
              <div
                className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser ? 'bg-teal-700 text-white' : 'bg-white text-gray-900 shadow-sm'
                }`}
              >
                {m.content}
              </div>
              {!isUser && Array.isArray(m.sources) && m.sources.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500">Sources</p>
                  {m.sources.map((s) => (
                    <SourceCitation key={s.chunkId} source={s} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {loading && (
        <div className="flex justify-start" role="status" aria-live="polite">
          <div className="rounded-2xl bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">Searching your documents...</div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
