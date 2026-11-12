'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api-client.js';

export default function DocumentUploader({ onUploaded }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(null); // { kind: 'info' | 'error' | 'success', text }

  async function upload(files) {
    for (const file of files) {
      setStatus({ kind: 'info', text: `Uploading and indexing ${file.name}...` });
      try {
        const formData = new FormData();
        formData.append('file', file);
        const doc = await api('/api/documents/upload', { method: 'POST', formData });
        setStatus({ kind: 'success', text: `${doc.originalFilename} indexed (${doc.chunkCount} chunks).` });
        onUploaded?.();
      } catch (e) {
        setStatus({ kind: 'error', text: `${file.name}: ${e.message}` });
        return;
      }
    }
  }

  const colors = { info: 'text-gray-600', error: 'text-red-700', success: 'text-teal-700' };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        upload([...e.dataTransfer.files]);
      }}
      className={`rounded-xl border-2 border-dashed bg-white p-6 text-center ${
        dragging ? 'border-teal-600 bg-teal-50' : 'border-gray-300'
      }`}
    >
      <p className="text-sm text-gray-700">Drag PDF or TXT files here, or</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
      >
        Choose files
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.txt,application/pdf,text/plain"
        className="hidden"
        onChange={(e) => {
          upload([...e.target.files]);
          e.target.value = '';
        }}
      />
      {status && (
        <p role="status" className={`mt-3 text-sm ${colors[status.kind]}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}
