import React, { useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';

function formatMs(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function TranscriptScreen() {
  const result = useAppStore((s) => s.lastResult);
  const goSummary = useAppStore((s) => s.goSummary);
  const goHome = useAppStore((s) => s.goHome);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [query, setQuery] = useState('');

  if (!result) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="text-base font-semibold">Transcript</div>
        <div className="mt-2 text-sm text-slate-600">No transcript yet.</div>
        <button
          className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          onClick={goHome}
        >
          Back to Home
        </button>
      </div>
    );
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredSegments = useMemo(() => {
    if (!normalizedQuery) return result.segments;
    return result.segments.filter((s) => s.text.toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery, result.segments]);

  function jumpToMs(ms: number) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = ms / 1000;
    void el.play().catch(() => {
      // Autoplay may be blocked; user can press play.
    });
  }

  function renderHighlighted(text: string) {
    if (!normalizedQuery) return text;
    const lower = text.toLowerCase();
    const idx = lower.indexOf(normalizedQuery);
    if (idx < 0) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + normalizedQuery.length);
    const after = text.slice(idx + normalizedQuery.length);
    return (
      <>
        {before}
        <span className="rounded-sm bg-slate-200 px-1">{match}</span>
        {after}
      </>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-base font-semibold">Transcript</div>
          <div className="text-sm text-slate-600">{result.meetingTitle}</div>
          {result.recordingId && <div className="mt-1 text-xs text-slate-500">ID: {result.recordingId}</div>}
          <div className="mt-1 text-xs text-slate-500">Audio: {result.audioPath}</div>
        </div>

        <div className="flex gap-2">
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            onClick={goHome}
          >
            Home
          </button>
          <button
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            onClick={goSummary}
          >
            Summary
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          {result.audioUrl ? (
            <audio ref={audioRef} controls src={result.audioUrl} className="w-full" />
          ) : (
            <div className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">
              Audio player unavailable.
            </div>
          )}
        </div>
        <div className="grid gap-1">
          <div className="text-sm font-semibold">Search</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcript"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
          <div className="text-xs text-slate-500">{filteredSegments.length} matches</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 text-sm font-semibold">Speaker timeline</div>
          <div className="grid gap-2">
            {filteredSegments.map((seg, idx) => (
              <button
                key={idx}
                type="button"
                className="text-left rounded-md bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100"
                onClick={() => jumpToMs(seg.startMs)}
              >
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{seg.speaker}</span>
                  <span>
                    {formatMs(seg.startMs)}–{formatMs(seg.endMs)}
                  </span>
                </div>
                <div className="mt-1 text-slate-800 line-clamp-2">{renderHighlighted(seg.text)}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 rounded-md border border-slate-200 p-3">
          <div className="mb-2 text-sm font-semibold">Text</div>
          <div className="max-h-[440px] overflow-auto pr-2">
            {filteredSegments.map((seg, idx) => (
              <button
                key={idx}
                type="button"
                className="mb-3 block w-full text-left rounded-md px-2 py-2 hover:bg-slate-50"
                onClick={() => jumpToMs(seg.startMs)}
              >
                <div className="text-xs text-slate-500">
                  {seg.speaker} · {formatMs(seg.startMs)}
                </div>
                <div className="text-sm text-slate-900">{renderHighlighted(seg.text)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
