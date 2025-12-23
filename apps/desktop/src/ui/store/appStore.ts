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
  speakerNames?: Record<string, string>;
};

type AppState = {
  screen: AppScreen;
  meetingTitle: string;

  isRecording: boolean;
  recordingStartedAtMs: number | null;
  recordingDirectory: string | null;
  selectedMicId: string | null;

  lastError: string | null;
  lastResult: RecordingResult | null;

  setMeetingTitle: (title: string) => void;
  goHome: () => void;
  clearError: () => void;
  startRecordingUI: () => void;
  setRecordingDirectory: (dir: string | null) => void;
  setSelectedMicId: (id: string | null) => void;
  stopRecordingUI: () => void;
  setError: (message: string | null) => void;
  setResult: (result: RecordingResult) => void;
  goTranscript: () => void;
  goSummary: () => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  screen: 'home',
  meetingTitle: '',
  recordingDirectory: typeof window !== 'undefined' ? (localStorage.getItem('sidecar_recording_dir') || null) : null,
  selectedMicId: typeof window !== 'undefined' ? (localStorage.getItem('sidecar_selected_mic') || null) : null,

  isRecording: false,
  recordingStartedAtMs: null,

  lastError: null,
  lastResult: null,

  setMeetingTitle: (meetingTitle) => set({ meetingTitle }),
  goHome: () => set({ screen: 'home' }),
  clearError: () => set({ lastError: null }),

  setRecordingDirectory: (dir) => {
    try {
      if (dir) localStorage.setItem('sidecar_recording_dir', dir);
      else localStorage.removeItem('sidecar_recording_dir');
    } catch (e) {
      // ignore storage errors
    }
    set({ recordingDirectory: dir });
  },
  setSelectedMicId: (id) => {
    try {
      if (id) localStorage.setItem('sidecar_selected_mic', id);
      else localStorage.removeItem('sidecar_selected_mic');
    } catch (e) {
      // ignore storage errors
    }
    set({ selectedMicId: id });
  },

  startRecordingUI: () => {
    const title = get().meetingTitle.trim();
    if (!title) {
      set({ lastError: 'Meeting title is required.' });
      return;
    }

    set({
      screen: 'recording',
      isRecording: true,
      // recordingStartedAtMs will be set when capture actually begins
      recordingStartedAtMs: null,
      lastError: null,
      lastResult: null,
    });
  },

  markRecordingStarted: () => set({ recordingStartedAtMs: Date.now() }),

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
