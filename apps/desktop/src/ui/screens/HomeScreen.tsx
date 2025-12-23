import React, { useMemo } from 'react';
import { useAppStore } from '../store/appStore';

export function HomeScreen() {
  const title = useAppStore((s) => s.meetingTitle);
  const setTitle = useAppStore((s) => s.setMeetingTitle);
  const startRecordingUI = useAppStore((s) => s.startRecordingUI);
  const lastError = useAppStore((s) => s.lastError);

  const canStart = useMemo(() => title.trim().length > 0, [title]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <div className="text-base font-semibold">Home</div>
        <div className="text-sm text-slate-600">Start recording a meeting</div>
      </div>

      <div className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm font-medium text-slate-800">Meeting title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400"
            placeholder="e.g., Sprint planning"
          />
        </label>

        {lastError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{lastError}</div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canStart}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              startRecordingUI();
            }}
          >
            Start Recording
          </button>

          <div className="text-xs text-slate-500">Captures system audio + mic (planned)</div>
        </div>
      </div>
    </div>
  );
}
