"use client";
import { useState } from "react";
import type { ReturnVoice, VoiceProvider } from "hume/api/resources/tts";
import { useVoices } from "@/hooks/useVoices";
import { MagnifyingGlassIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

interface Props {
  selectedVoice: ReturnVoice | null;
  onSelect: (voice: ReturnVoice | null) => void;
}

export default function VoiceSelector({ selectedVoice, onSelect }: Props) {
  const [provider, setProvider] = useState<VoiceProvider>("HUME_AI");
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  
  const { voices, loading, error } = useVoices(provider);

  const filteredVoices = voices.filter((v) =>
    v.name?.toLowerCase().includes(query.toLowerCase())
  );

  function handleVoiceClick(voice: ReturnVoice) {
    console.log("[VoiceSelector] handleVoiceClick - voice:", voice.name, "id:", voice.id);
    
    // Close dropdown and clear search first
    setIsOpen(false);
    setQuery("");
    
    // Then call parent's onSelect with the clicked voice
    console.log("[VoiceSelector] Calling onSelect with:", voice.name);
    onSelect(voice);
  }

  function handleClear() {
    console.log("[VoiceSelector] handleClear called");
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
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
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
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 transition-colors ${
                          selectedVoice?.id === voice.id ? "bg-indigo-100 text-indigo-700" : "text-gray-700"
                        }`}
                      >
                        {voice.name}
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
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Clear selection
        </button>
      )}
    </div>
  );
}
