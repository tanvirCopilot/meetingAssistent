import React from 'react';
import { HomeScreen } from './screens/HomeScreen';
import { RecordingScreen } from './screens/RecordingScreen';
import { TranscriptScreen } from './screens/TranscriptScreen';
import { SummaryScreen } from './screens/SummaryScreen';
import { useAppStore } from './store/appStore';

export function App() {
  const screen = useAppStore((s) => s.screen);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Side-Car</div>
            <div className="text-sm text-slate-600">Local meeting transcription (MVP)</div>
          </div>
          <div className="text-xs text-slate-500">v0.1.0</div>
        </header>

        {screen === 'home' && <HomeScreen />}
        {screen === 'recording' && <RecordingScreen />}
        {screen === 'transcript' && <TranscriptScreen />}
        {screen === 'summary' && <SummaryScreen />}
      </div>
    </div>
  );
}
