'use client';

import { useState } from 'react';

const MAX = 2000;

export default function MessageInput({ onSend, disabled }) {
  const [text, setText] = useState('');

  function submit() {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText('');
  }

  return (
    <div className="border-t border-gray-200 bg-white p-3 md:p-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          value={text}
          maxLength={MAX}
          rows={2}
          disabled={disabled}
          placeholder="Ask a question about your documents"
          aria-label="Message"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600 disabled:bg-gray-100"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !text.trim()}
          className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
