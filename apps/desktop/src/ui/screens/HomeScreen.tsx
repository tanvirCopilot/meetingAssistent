import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/appStore';

export function HomeScreen() {
  const title = useAppStore((s) => s.meetingTitle);
  const setTitle = useAppStore((s) => s.setMeetingTitle);
  const startRecordingUI = useAppStore((s) => s.startRecordingUI);
  const recordingDirectory = useAppStore((s) => (s as any).recordingDirectory);
  const setRecordingDirectory = useAppStore((s) => (s as any).setRecordingDirectory);
  const selectedMicId = useAppStore((s) => (s as any).selectedMicId);
  const setSelectedMicId = useAppStore((s) => (s as any).setSelectedMicId);
  const isRecording = useAppStore((s) => s.isRecording);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const lastError = useAppStore((s) => s.lastError);
  const setError = useAppStore((s) => s.setError);

  const [consent, setConsent] = React.useState(() => {
    return localStorage.getItem('sidecar_consent_v1') === 'true';
  });

  const canStart = useMemo(() => title.trim().length > 0 && consent, [title, consent]);

  const [testMicActive, setTestMicActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const testMicStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  async function startTestMic() {
    if (testMicActive) return;
    try {
      const constraints: MediaStreamConstraints = selectedMicId
        ? ({ audio: { deviceId: { exact: selectedMicId } } as any, video: false } as MediaStreamConstraints)
        : { audio: true, video: false };

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // try a generic permission prompt to allow device labels and access, then retry
        try {
          // eslint-disable-next-line no-console
          console.warn('selected mic getUserMedia failed, prompting generic permission then retrying', err);
          await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          // re-enumerate devices so labels/deviceIds populate
          const devices = await navigator.mediaDevices.enumerateDevices();
          setMicDevices(devices.filter((d) => d.kind === 'audioinput'));
          // retry selected mic if present
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err2) {
          // final failure
          // eslint-disable-next-line no-console
          console.error('microphone access denied or unavailable', err2);
          setError('Microphone access denied or unavailable. Check OS permissions.');
          return;
        }
      }
      testMicStreamRef.current = stream;
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      setTestMicActive(true);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setMicLevel(rms);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('startTestMic failed', err);
      setTestMicActive(false);
    }
  }

  function stopTestMic() {
    try {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      analyserRef.current = null;
      if (testMicStreamRef.current) {
        for (const t of testMicStreamRef.current.getTracks()) t.stop();
        testMicStreamRef.current = null;
      }
    } finally {
      setTestMicActive(false);
      setMicLevel(0);
    }
  }

  useEffect(() => {
    let mounted = true;
    return () => stopTestMic();
  }, []);

  useEffect(() => {
    let mounted = true;
    async function refreshDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!mounted) return;
        setMicDevices(devices.filter((d) => d.kind === 'audioinput'));
      } catch (e) {
        // ignore
      }
    }
    refreshDevices();
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => {
      mounted = false;
      navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
    };
  }, []);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <div className="text-base font-semibold">Home</div>
        <div className="text-sm text-slate-600">Start recording a meeting</div>
      </div>

      <div className="grid gap-3">
                <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setConsent(v);
                      localStorage.setItem('sidecar_consent_v1', v ? 'true' : 'false');
                    }}
                    className="mt-1"
                  />
                  <div className="text-sm text-slate-700">
                    I confirm I have consent from all participants to record and transcribe this meeting.
                    <div className="text-xs text-slate-500">All processing stays local; no cloud upload.</div>
                  </div>
                </label>
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
            onClick={async () => {
              if (!recordingDirectory) {
                try {
                  const sidecar = (window as any).sidecar;
                  if (sidecar?.selectDirectory) {
                    const dir = await sidecar.selectDirectory();
                    if (!dir) {
                      // user cancelled
                      return;
                    }
                    setRecordingDirectory(dir);
                  } else {
                    // no sidecar available
                    // let startRecordingUI handle it and show save dialog
                  }
                } catch (e) {
                  // ignore and continue
                }
              }
              startRecordingUI();
            }}
          >
            Start Recording
          </button>

          <div className="text-xs text-slate-500">Captures system audio + mic (planned)</div>

          <div className="ml-auto flex items-center gap-3">
              <select
                value={selectedMicId ?? ''}
                onChange={(e) => setSelectedMicId(e.target.value || null)}
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="">Default microphone</option>
                {micDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || d.deviceId}
                  </option>
                ))}
              </select>
            
            <div className="h-3 w-48 rounded bg-slate-100">
              <div
                className="h-3 rounded bg-rose-500"
                style={{ width: `${Math.min(100, Math.round(micLevel * 100))}%` }}
              />
            </div>
            <button
              type="button"
              className="rounded-md bg-slate-100 px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={async () => {
                if (isRecording) return;
                if (testMicActive) stopTestMic();
                else await startTestMic();
              }}
              disabled={isRecording}
            >
              {testMicActive ? 'Stop Mic Test' : 'Test Mic'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
