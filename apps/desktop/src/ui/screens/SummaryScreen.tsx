import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';

export function SummaryScreen() {
  const result = useAppStore((s) => s.lastResult);
  const goTranscript = useAppStore((s) => s.goTranscript);
  const goHome = useAppStore((s) => s.goHome);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  async function exportAs(format: 'txt' | 'md' | 'pdf') {
    if (!result?.recordingId) {
      setExportError('Export requires a backend recording id.');
      return;
    }
    const sidecar = window.sidecar;
    if (!sidecar) {
      setExportError('Electron preload bridge is not available.');
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      const url = `http://127.0.0.1:8765/recordings/${result.recordingId}/export?format=${format}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Export failed.');
      }

      const bytes = new Uint8Array(await res.arrayBuffer());
      const defaultName = `${result.meetingTitle.trim().replaceAll(' ', '_')}.${format}`;
      const savePath = await sidecar.showSaveDialog(defaultName);
      if (!savePath) return;

      await sidecar.writeFile(savePath, bytes);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  }

  if (!result) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="text-base font-semibold">Summary</div>
        <div className="mt-2 text-sm text-slate-600">No summary yet.</div>
        <button
          className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          onClick={goHome}
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold">Summary</div>
          <div className="text-sm text-slate-600">{result.meetingTitle}</div>
        </div>

        <div className="flex gap-2">
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={goTranscript}>
            Transcript
          </button>
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={goHome}>
            Home
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold mr-2">Export</div>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
          disabled={isExporting}
          onClick={() => exportAs('txt')}
        >
          TXT
        </button>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
          disabled={isExporting}
          onClick={() => exportAs('md')}
        >
          Markdown
        </button>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
          disabled={isExporting}
          onClick={() => exportAs('pdf')}
        >
          PDF
        </button>
        {isExporting && <div className="text-sm text-slate-600">Exporting…</div>}
      </div>

      {exportError && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {exportError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 text-sm font-semibold">Bullet points</div>
          <ul className="list-disc pl-5 text-sm text-slate-900">
            {result.summaryBullets.map((b, idx) => (
              <li key={idx} className="mb-1">
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 text-sm font-semibold">Action items</div>
          <ul className="list-disc pl-5 text-sm text-slate-900">
            {result.actionItems.map((a, idx) => (
              <li key={idx} className="mb-1">
                {a}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
