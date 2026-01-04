"use client";
import { useState, useRef } from "react";
import type { ReturnVoice, VoiceProvider } from "hume/api/resources/tts";
import { useVoices } from "@/hooks/useVoices";
import { MagnifyingGlassIcon, ChevronDownIcon, SpeakerWaveIcon } from "@heroicons/react/24/outline";

interface Props {
  selectedVoice: ReturnVoice | null;
  onSelect: (voice: ReturnVoice | null) => void;
}

const PREVIEW_TEXT = "The quick brown fox jumped over the lazy dog.";

export default function VoiceSelector({ selectedVoice, onSelect }: Props) {
  const [provider, setProvider] = useState<VoiceProvider>("HUME_AI");
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  
  const { voices, loading, error } = useVoices(provider);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const filteredVoices = voices.filter((v) =>
    v.name?.toLowerCase().includes(query.toLowerCase())
  );

  async function playPreview(voice: ReturnVoice) {
    // Stop any existing preview
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setPreviewingVoiceId(voice.id);
    abortControllerRef.current = new AbortController();

    try {
      // Create and unlock audio element
      const audio = new Audio();
      audio.setAttribute('playsinline', 'true');
      audio.setAttribute('webkit-playsinline', 'true');
      audioRef.current = audio;

      // Unlock on iOS
      const silentDataUri = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+1DEAAAGAAGn9AAAIgAANP8AAAARERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERER//tQxAADwAADSAAAAAAAAA0gAAABEREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREQ==';
      audio.src = silentDataUri;
      try { await audio.play(); } catch (e) {}

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: PREVIEW_TEXT,
          voiceName: voice.name,
          voiceProvider: voice.provider,
          instant: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to generate preview");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const allChunks: Uint8Array[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.audio) {
              const bin = atob(data.audio);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              allChunks.push(bytes);
            }
          } catch (e) {}
        }
      }

      // Combine chunks
      const totalLength = allChunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of allChunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const blob = new Blob([combined], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      
      audio.src = url;
      audio.onended = () => {
        setPreviewingVoiceId(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setPreviewingVoiceId(null);
      };

      await audio.play();

    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Preview error:", error);
      }
      setPreviewingVoiceId(null);
    }
  }

  function handleVoiceClick(voice: ReturnVoice) {
    // Close dropdown and clear search
    setIsOpen(false);
    setQuery("");
    
    // Select the voice
    onSelect(voice);
    
    // Play preview
    playPreview(voice);
  }

  function handleClear() {
    // Stop any preview
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPreviewingVoiceId(null);
    onSelect(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Voice Library</label>
        <div className="flex gap-1">
          {(["HUME_AI", "CUSTOM_VOICE"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => {
                setProvider(opt);
                setQuery("");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                provider === opt
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt === "HUME_AI" ? "Hume AI" : "Custom"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 transition-colors"
        >
          <div className="flex items-center gap-2">
            {selectedVoice ? (
              <>
                {previewingVoiceId === selectedVoice.id ? (
                  <SpeakerWaveIcon className="w-4 h-4 text-indigo-600 animate-pulse" />
                ) : (
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                )}
                <span className="font-medium text-gray-900">{selectedVoice.name}</span>
              </>
            ) : (
              <span className="text-gray-400">Select a voice...</span>
            )}
          </div>
          <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search voices..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-300"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  Loading voices...
                </div>
              ) : error ? (
                <div className="p-4 text-center text-red-500 text-sm">
                  {error}
                </div>
              ) : filteredVoices.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No voices found
                </div>
              ) : (
                <ul className="py-1">
                  {filteredVoices.map((voice) => (
                    <li key={voice.id}>
                      <button
                        type="button"
                        onClick={() => handleVoiceClick(voice)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 transition-colors flex items-center justify-between ${
                          selectedVoice?.id === voice.id ? "bg-indigo-100 text-indigo-700" : "text-gray-700"
                        }`}
                      >
                        <span>{voice.name}</span>
                        {previewingVoiceId === voice.id && (
                          <SpeakerWaveIcon className="w-4 h-4 text-indigo-600 animate-pulse" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedVoice && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => playPreview(selectedVoice)}
            disabled={previewingVoiceId === selectedVoice.id}
            className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <SpeakerWaveIcon className="w-3 h-3" />
            {previewingVoiceId === selectedVoice.id ? "Playing..." : "Preview"}
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
