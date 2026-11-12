'use client';

const formatSize = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export default function DocumentList({ documents, onDelete }) {
  if (documents.length === 0) {
    return <p className="rounded-xl bg-white p-6 text-center text-sm text-gray-500">No documents yet. Upload one to start asking questions.</p>;
  }
  return (
    <ul className="divide-y divide-gray-100 rounded-xl bg-white shadow-sm">
      {documents.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{d.originalFilename}</p>
            <p className="text-xs text-gray-500">
              {formatSize(d.fileSize)} · {d.chunkCount} chunks · {new Date(d.createdAt).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.confirm(`Delete "${d.originalFilename}"?`) && onDelete(d.id)}
            className="rounded-lg px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
