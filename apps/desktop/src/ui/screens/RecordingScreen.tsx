import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';

function formatElapsed(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

type RecorderState = {
  isCapturing: boolean;
  mediaRecorder: MediaRecorder | null;
  chunks: BlobPart[];
  mimeType: string | null;
  audioPath: string | null;
};

async function getSystemAudioStream(): Promise<MediaStream> {
  const sidecar = window.sidecar;
  if (!sidecar) throw new Error('Desktop app required — run the app via the Electron desktop (npm run dev).');

  const sourceId = await sidecar.getDefaultDesktopSourceId();
  if (!sourceId) {
    throw new Error('No desktop source available.');
  }

  // Chromium requires a desktop video constraint for desktop audio capture.
  // We request it but immediately drop the video track.
  // This is not “video capture output”; it’s a constraint requirement.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // @ts-expect-error - Electron/Chromium desktop capture constraints
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
      },
    },
    video: {
      // @ts-expect-error - Electron/Chromium desktop capture constraints
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        maxWidth: 1,
        maxHeight: 1,
        maxFrameRate: 1,
      },
    },
  });

  for (const track of stream.getVideoTracks()) track.stop();
  return new MediaStream(stream.getAudioTracks());
}

async function getMicStream(deviceId?: string): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: deviceId ? ({ deviceId: { exact: deviceId } } as any) : true,
    video: false,
  };
  return navigator.mediaDevices.getUserMedia(constraints);
}

function mixToSingleStream(systemAudio: MediaStream, mic: MediaStream): MediaStream {
  const ctx = new AudioContext();
  const destination = ctx.createMediaStreamDestination();

  const sysSource = ctx.createMediaStreamSource(systemAudio);
  sysSource.connect(destination);

  const micSource = ctx.createMediaStreamSource(mic);
  micSource.connect(destination);

  return destination.stream;
}

export function RecordingScreen() {
  const meetingTitle = useAppStore((s) => s.meetingTitle);
  const startedAt = useAppStore((s) => s.recordingStartedAtMs);
  const stopRecordingUI = useAppStore((s) => s.stopRecordingUI);
  const setError = useAppStore((s) => s.setError);
  const setResult = useAppStore((s) => s.setResult);
  const goHome = useAppStore((s) => s.goHome);
  const markRecordingStarted = useAppStore((s) => (s as any).markRecordingStarted);
  const isRecording = useAppStore((s) => s.isRecording);
  const recordingDirectory = useAppStore((s) => (s as any).recordingDirectory);
  const selectedMicId = useAppStore((s) => (s as any).selectedMicId);

  const [elapsedMs, setElapsedMs] = useState(0);
  const [isStopping, setIsStopping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [micOnly, setMicOnly] = useState(false);
  const [testMicActive, setTestMicActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const recorderRef = useRef<RecorderState>({
    isCapturing: false,
    mediaRecorder: null,
    chunks: [],
    mimeType: null,
    audioPath: null,
  });
  const testMicStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const elapsedLabel = useMemo(() => formatElapsed(elapsedMs), [elapsedMs]);

  useEffect(() => {
    if (!startedAt) return;

    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);

    return () => clearInterval(timer);
  }, [startedAt]);

  useEffect(() => {
    let cancelled = false;

    async function startCapture() {
      try {
        const sidecar = window.sidecar;
        if (!sidecar) throw new Error('Desktop app required — run the app via the Electron desktop (npm run dev).');

        // if a mic test is running, stop it before starting actual capture
        if (testMicActive) stopTestMic();

        recorderRef.current.isCapturing = true;

        // Attempt system audio + mic; respect micOnly toggle.
        let systemAudio: MediaStream | null = null;
        let mic: MediaStream | null = null;

        if (!micOnly) {
          try {
            systemAudio = await getSystemAudioStream();
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('getSystemAudioStream failed, will continue with mic-only', err);
            systemAudio = null;
          }
        }

        try {
          mic = await getMicStream(selectedMicId ?? undefined);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('getMicStream failed', err);
          throw err;
        }

        if (cancelled) return;

        const mixed = systemAudio && systemAudio.getAudioTracks().length > 0 ? mixToSingleStream(systemAudio, mic) : mic;

        const candidates = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/ogg',
        ];
        const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';

        const mediaRecorder = new MediaRecorder(mixed, mimeType ? { mimeType } : undefined);


        recorderRef.current.mediaRecorder = mediaRecorder;
        recorderRef.current.mimeType = mimeType || null;
        recorderRef.current.chunks = [];

        mediaRecorder.ondataavailable = (evt) => {
          if (evt.data && evt.data.size > 0) {
            recorderRef.current.chunks.push(evt.data);
            // eslint-disable-next-line no-console
            console.log('ondataavailable chunk size=', evt.data.size);
          }
        };

        mediaRecorder.onstart = () => {
          try {
            // eslint-disable-next-line no-console
            console.log('mediaRecorder started, mimeType=', mediaRecorder.mimeType);
            const tracks = mixed.getAudioTracks();
            // eslint-disable-next-line no-console
            console.log('mixed audio tracks:', tracks.map((t) => ({ id: t.id, label: t.label })));
            try {
              markRecordingStarted();
            } catch (e) {
              // ignore if store method missing
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('failed to log mixed tracks', e);
          }
        };

        mediaRecorder.onerror = () => {
          setError('Recording failed.');
        };

        const defaultName = `${meetingTitle.trim().replaceAll(' ', '_')}_${new Date()
          .toISOString()
          .replaceAll(':', '-')}.webm`;

        let savePath: string | null = null;
        if (recordingDirectory) {
          // build path using simple join; use '/' as separator if missing
          const sep = recordingDirectory.endsWith('\\') || recordingDirectory.endsWith('/') ? '' : '/';
          savePath = `${recordingDirectory}${sep}${defaultName}`;
        } else {
          savePath = await sidecar.showSaveDialog(defaultName);
        }

        if (!savePath) {
          throw new Error('Save cancelled.');
        }
        recorderRef.current.audioPath = savePath;

        mediaRecorder.start(1000);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to start recording.';
        setError(message);
        stopRecordingUI();
        goHome();
      }
    }

    startCapture();

    return () => {
      cancelled = true;
    };
  }, [meetingTitle, setError, stopRecordingUI, goHome]);

  // Test mic functions
  async function startTestMic() {
    if (testMicActive) return;
    try {
      const stream = await getMicStream(selectedMicId ?? undefined);
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
        // compute normalized RMS
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

  // cleanup on unmount
  useEffect(() => {
    return () => {
      stopTestMic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function stopAndSave() {
    if (isStopping) return;
    setIsStopping(true);

    try {
      const sidecar = window.sidecar;
      if (!sidecar) throw new Error('Desktop app required — run the app via the Electron desktop (npm run dev).');

      const state = recorderRef.current;
      const recorder = state.mediaRecorder;
      const audioPath = state.audioPath;
      if (!recorder || !audioPath) throw new Error('Recorder not ready.');

      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });

      const blob = new Blob(state.chunks, { type: state.mimeType ?? 'audio/webm' });
      const audioUrl = URL.createObjectURL(blob);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await sidecar.writeFile(audioPath, bytes);

      stopRecordingUI();

      setIsProcessing(true);

      let recordingId: string | null = null;
      let segmentsText = '(Processing failed.)';
      let summaryBullets: string[] = ['(Summary unavailable.)'];
      let actionItems: string[] = ['(Action items unavailable.)'];

      try {
        const form = new FormData();
        form.append('title', meetingTitle);
        form.append('file', blob, 'recording.webm');

        const uploadRes = await fetch('http://127.0.0.1:8765/recordings/upload', {
          method: 'POST',
          body: form,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.text();
          throw new Error(err || 'Upload failed.');
        }
        const uploadJson = (await uploadRes.json()) as { id: string };
        recordingId = uploadJson.id;

        const procRes = await fetch(`http://127.0.0.1:8765/recordings/${recordingId}/process`, {
          method: 'POST',
        });

        if (!procRes.ok) {
          const errJson = (await procRes.json().catch(() => null)) as { detail?: string } | null;
          throw new Error(errJson?.detail || 'Processing failed.');
        }

        const procJson = (await procRes.json()) as {
          transcript: { text?: string; segments?: Array<{ start: number; end: number; text: string; speaker?: string }> };
          summary: { bullets?: string[]; action_items?: string[] };
        };

        const transcript = procJson.transcript;
        const segs = transcript.segments ?? [];

        segmentsText = (transcript.text ?? '').trim() || '(No transcript text returned.)';
        summaryBullets = procJson.summary.bullets ?? ['(No summary returned.)'];
        actionItems = procJson.summary.action_items ?? ['(No action items returned.)'];

        setResult({
          recordingId,
          meetingTitle,
          audioPath,
          audioUrl,
          segments:
            segs.length > 0
              ? segs.map((s, idx) => ({
                  startMs: Math.floor(s.start * 1000),
                  endMs: Math.floor(s.end * 1000),
                  // Backend may add `speaker` when diarization is enabled; fallback if absent.
                  speaker: (s as any).speaker ?? 'Speaker 1',
                  text: s.text,
                }))
              : [
                  {
                    startMs: 0,
                    endMs: Math.max(1000, elapsedMs),
                    speaker: 'Speaker 1',
                    text: segmentsText,
                  },
                ],
          summaryBullets,
          actionItems,
        });
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Processing failed.';
        setResult({
          recordingId,
          meetingTitle,
          audioPath,
          audioUrl,
          segments: [
            {
              startMs: 0,
              endMs: Math.max(1000, elapsedMs),
              speaker: 'Speaker 1',
              text: msg,
            },
          ],
          summaryBullets,
          actionItems,
        });
        return;
      } finally {
        setIsProcessing(false);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to stop recording.';
      setError(message);
      stopRecordingUI();
      goHome();
    } finally {
      setIsStopping(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <div className="text-base font-semibold">Recording</div>
        <div className="text-sm text-slate-600">{meetingTitle}</div>
      </div>

      <div className="grid gap-4">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={micOnly}
              onChange={(e) => setMicOnly(e.target.checked)}
            />
            Force mic-only
          </label>

          <div className="ml-auto text-sm">
            <button
              type="button"
              disabled={isRecording || testMicActive}
              onClick={async () => {
                if (testMicActive) {
                  // stop
                  stopTestMic();
                } else {
                  await startTestMic();
                }
              }}
              className="rounded-md bg-slate-100 px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testMicActive ? 'Stop Mic Test' : 'Test Mic'}
            </button>
          </div>
        </div>

        <div className="h-3 w-full rounded bg-slate-100">
          <div
            className="h-3 rounded bg-rose-500"
            style={{ width: `${Math.min(100, Math.round(micLevel * 100))}%` }}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3">
          <div className="text-sm text-slate-600">Timer</div>
          <div className="font-mono text-lg font-semibold">{elapsedLabel}</div>
        </div>

        <div className="rounded-md border border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
          Waveform (MVP placeholder)
        </div>

        <div>
          <button
            type="button"
            disabled={isStopping || isProcessing}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={stopAndSave}
          >
            Stop
          </button>
        </div>

        {isProcessing && <div className="text-sm text-slate-600">Processing…</div>}

        <div className="text-xs text-slate-500">
          Note: Desktop/system audio capture may require permissions depending on OS.
        </div>
      </div>
    </div>
  );
}
