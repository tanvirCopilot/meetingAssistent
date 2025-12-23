import { create } from 'zustand';

export type AppScreen = 'home' | 'recording' | 'transcript' | 'summary';

export type TranscriptSegment = {
  startMs: number;
  endMs: number;
  speaker: string;
  text: string;
};

export type RecordingResult = {
  recordingId: string | null;
  meetingTitle: string;
  audioPath: string;
  audioUrl: string | null;
  segments: TranscriptSegment[];
  summaryBullets: string[];
  actionItems: string[];
};

type AppState = {
  screen: AppScreen;
  meetingTitle: string;

  isRecording: boolean;
  recordingStartedAtMs: number | null;

  lastError: string | null;
  lastResult: RecordingResult | null;

  setMeetingTitle: (title: string) => void;
  goHome: () => void;
  startRecordingUI: () => void;
  stopRecordingUI: () => void;
  setError: (message: string | null) => void;
  setResult: (result: RecordingResult) => void;
  goTranscript: () => void;
  goSummary: () => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  screen: 'home',
  meetingTitle: '',

  isRecording: false,
  recordingStartedAtMs: null,

  lastError: null,
  lastResult: null,

  setMeetingTitle: (meetingTitle) => set({ meetingTitle }),
  goHome: () => set({ screen: 'home', lastError: null }),

  startRecordingUI: () => {
    const title = get().meetingTitle.trim();
    if (!title) {
      set({ lastError: 'Meeting title is required.' });
      return;
    }

    set({
      screen: 'recording',
      isRecording: true,
      recordingStartedAtMs: Date.now(),
      lastError: null,
      lastResult: null,
    });
  },

  stopRecordingUI: () =>
    set({
      isRecording: false,
      recordingStartedAtMs: null,
    }),

  setError: (lastError) => set({ lastError }),

  setResult: (lastResult) =>
    set({
      lastResult,
      screen: 'transcript',
      lastError: null,
      isRecording: false,
      recordingStartedAtMs: null,
    }),

  goTranscript: () => set({ screen: 'transcript' }),
  goSummary: () => set({ screen: 'summary' }),
}));
