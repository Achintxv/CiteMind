'use client';

import Link from 'next/link';

export default function Sidebar({ conversations, documents, activeId, onSelect, onNew, onDelete }) {
  return (
    <aside className="flex h-full w-72 flex-col border-r border-gray-200 bg-white">
      <div className="space-y-3 p-4">
        <h1 className="text-lg font-semibold">CiteMind</h1>
        <button
          type="button"
          onClick={onNew}
          className="w-full rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
        >
          New chat
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2" aria-label="Conversations">
        <p className="px-2 pb-1 text-xs font-medium text-gray-500">Conversations</p>
        {conversations.length === 0 && <p className="px-2 text-sm text-gray-400">No conversations yet.</p>}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`group flex items-center rounded-lg ${c.id === activeId ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
          >
            <button type="button" onClick={() => onSelect(c.id)} className="min-w-0 flex-1 truncate px-2 py-2 text-left text-sm">
              {c.title}
            </button>
            <button
              type="button"
              aria-label={`Delete conversation ${c.title}`}
              onClick={() => window.confirm('Delete this conversation?') && onDelete(c.id)}
              className="px-2 py-2 text-gray-400 hover:text-red-700 focus:outline-none focus-visible:text-red-700"
            >
              ×
            </button>
          </div>
        ))}
      </nav>

      <div className="border-t border-gray-200 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-gray-500">Documents ({documents.length})</p>
          <Link href="/documents" className="text-xs font-medium text-teal-700 hover:underline">
            Manage
          </Link>
        </div>
        <ul className="max-h-28 space-y-1 overflow-y-auto text-sm text-gray-700">
          {documents.map((d) => (
            <li key={d.id} className="truncate">
              {d.originalFilename}
            </li>
          ))}
          {documents.length === 0 && <li className="text-gray-400">None uploaded.</li>}
        </ul>
      </div>
    </aside>
  );
}
