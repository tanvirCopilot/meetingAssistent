import React from 'react';
import { useAppStore } from '../store/appStore';

export function SummaryScreen() {
  const result = useAppStore((s) => s.lastResult);
  const goTranscript = useAppStore((s) => s.goTranscript);
  const goHome = useAppStore((s) => s.goHome);

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
