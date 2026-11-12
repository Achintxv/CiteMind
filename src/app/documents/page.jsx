'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import DocumentList from '@/components/DocumentList.jsx';
import DocumentUploader from '@/components/DocumentUploader.jsx';
import { api } from '@/lib/api-client.js';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setDocuments(await api('/api/documents'));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function remove(id) {
    try {
      await api(`/api/documents/${id}`, { method: 'DELETE' });
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Documents</h1>
        <Link href="/" className="text-sm font-medium text-teal-700 hover:underline">
          Back to chat
        </Link>
      </header>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <DocumentUploader onUploaded={refresh} />
      <DocumentList documents={documents} onDelete={remove} />
    </main>
  );
}
