"use client";
import { 
  PlayIcon, 
  PauseIcon, 
  StopIcon,
  SpeakerWaveIcon 
} from "@heroicons/react/24/solid";

interface Props {
  isPlaying: boolean;
  isLoading: boolean;
  canPlay: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  currentChunk?: number;
  totalChunks?: number;
  error?: string | null;
}

export default function PlaybackControls({
  isPlaying,
  isLoading,
  canPlay,
  onPlay,
  onPause,
  onStop,
  currentChunk = 0,
  totalChunks = 0,
  error,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Main Controls */}
      <div className="flex items-center justify-center gap-4">
        {/* Stop Button */}
        <button
          onClick={onStop}
          disabled={!isPlaying && !isLoading}
          className={`
            p-3 rounded-full transition-all
            ${isPlaying || isLoading
              ? "bg-red-100 text-red-600 hover:bg-red-200"
              : "bg-gray-100 text-gray-300 cursor-not-allowed"
            }
          `}
          title="Stop"
        >
          <StopIcon className="w-6 h-6" />
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={isPlaying ? onPause : onPlay}
          disabled={!canPlay || isLoading}
          className={`
            p-5 rounded-full transition-all shadow-lg
            ${!canPlay || isLoading
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : isPlaying
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105"
            }
          `}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isLoading ? (
            <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : isPlaying ? (
            <PauseIcon className="w-8 h-8" />
          ) : (
            <PlayIcon className="w-8 h-8 ml-1" />
          )}
        </button>

        {/* Volume Indicator (decorative) */}
        <div className={`p-3 rounded-full ${isPlaying ? "bg-green-100" : "bg-gray-100"}`}>
          <SpeakerWaveIcon className={`w-6 h-6 ${isPlaying ? "text-green-600 animate-pulse" : "text-gray-400"}`} />
        </div>
      </div>

      {/* Progress Info */}
      {(isPlaying || isLoading) && totalChunks > 0 && (
        <div className="text-center">
          <p className="text-sm text-gray-500">
            Processing section {currentChunk} of {totalChunks}
          </p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(currentChunk / totalChunks) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Status Messages */}
      {isLoading && (
        <p className="text-center text-sm text-indigo-600">
          Generating speech...
        </p>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 text-center">
          {error}
        </div>
      )}

      {!canPlay && !isPlaying && !isLoading && !error && (
        <p className="text-center text-sm text-gray-400">
          Select a voice and add some text to get started
        </p>
      )}
    </div>
  );
}
