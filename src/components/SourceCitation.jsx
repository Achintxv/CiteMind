export default function SourceCitation({ source }) {
  return (
    <details className="rounded-lg border border-gray-200 bg-gray-50 text-sm">
      <summary className="cursor-pointer px-3 py-2 font-medium text-gray-800">
        {source.documentName}
        <span className="ml-2 font-normal text-gray-500">
          chunk {source.chunkIndex + 1} · {Math.round(source.similarity * 100)}% match
        </span>
      </summary>
      <p className="whitespace-pre-wrap border-t border-gray-200 px-3 py-2 text-gray-600">{source.excerpt}</p>
    </details>
  );
}
