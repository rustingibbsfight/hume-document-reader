"use client";
import { useState, useRef } from "react";
import type { ReturnVoice } from "hume/api/resources/tts";
import DocumentInput from "@/components/DocumentInput";
import VoiceSelector from "@/components/VoiceSelector";
import PlaybackControls from "@/components/PlaybackControls";
import { useTts } from "@/hooks/useTts";
import { SpeakerWaveIcon, BookOpenIcon } from "@heroicons/react/24/outline";

export default function Home() {
  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<ReturnVoice | null>(null);
  
  // This ref is passed to useTts - the hook reads directly from it
  const voiceRef = useRef<ReturnVoice | null>(null);
  
  const {
    isPlaying,
    isPaused,
    isLoading,
    currentChunk,
    totalChunks,
    error,
    speak,
    stop,
    pause,
    resume,
  } = useTts(voiceRef);

  function handlePlay() {
    console.log("[Page] handlePlay - voiceRef.current:", voiceRef.current?.name);
    
    if (isPaused) {
      resume();
    } else {
      stop();
      speak(text);
    }
  }

  function handlePause() {
    pause();
  }

  function handleStop() {
    stop();
  }

  function handleVoiceSelect(voice: ReturnVoice | null) {
    console.log("[Page] handleVoiceSelect:", voice?.name);
    
    // Update ref IMMEDIATELY (synchronous, no React batching)
    voiceRef.current = voice;
    
    // Also update state for UI
    setSelectedVoice(voice);
    
    console.log("[Page] voiceRef.current is now:", voiceRef.current?.name);
    
    if (isPlaying || isPaused) {
      stop();
    }
  }

  const canPlay = text.trim().length > 0 && selectedVoice !== null;

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg">
              <BookOpenIcon className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              Document Reader
            </h1>
          </div>
          <p className="text-gray-600 max-w-lg mx-auto">
            Upload a document or paste text, choose an expressive AI voice, and listen to your content read aloud with natural emotion and intonation.
          </p>
          <div className="flex items-center justify-center gap-2 mt-3 text-sm text-gray-500">
            <span>Powered by</span>
            <a 
              href="https://www.hume.ai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-indigo-600 font-semibold hover:text-indigo-700 flex items-center gap-1"
            >
              <SpeakerWaveIcon className="w-4 h-4" />
              Hume AI Octave TTS
            </a>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            {/* Left Column - Document Input */}
            <div className="md:col-span-2 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-sm font-bold">1</span>
                Add Your Content
              </h2>
              <DocumentInput 
                text={text} 
                onTextChange={setText} 
                disabled={isPlaying || isLoading}
              />
            </div>

            {/* Right Column - Voice Selection & Controls */}
            <div className="p-6 bg-gray-50/50">
              <div className="space-y-8">
                {/* Voice Selection */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-sm font-bold">2</span>
                    Choose a Voice
                  </h2>
                  <VoiceSelector
                    selectedVoice={selectedVoice}
                    onSelect={handleVoiceSelect}
                  />
                </div>

                {/* Playback Controls */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-sm font-bold">3</span>
                    Listen
                  </h2>
                  <PlaybackControls
                    isPlaying={isPlaying}
                    isLoading={isLoading}
                    canPlay={canPlay}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onStop={handleStop}
                    currentChunk={currentChunk}
                    totalChunks={totalChunks}
                    error={error}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/60 backdrop-blur rounded-2xl p-5 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900">Multiple Formats</h3>
            <p className="text-sm text-gray-500 mt-1">PDF, Word, TXT, HTML, and Markdown files supported</p>
          </div>
          
          <div className="bg-white/60 backdrop-blur rounded-2xl p-5 text-center">
            <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900">Expressive Voices</h3>
            <p className="text-sm text-gray-500 mt-1">100+ natural AI voices with emotional intelligence</p>
          </div>
          
          <div className="bg-white/60 backdrop-blur rounded-2xl p-5 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900">Instant Streaming</h3>
            <p className="text-sm text-gray-500 mt-1">Ultra-low latency audio generation starts immediately</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-400">
          <p>Built with Next.js and deployed on Vercel</p>
        </div>
      </div>
    </main>
  );
}
