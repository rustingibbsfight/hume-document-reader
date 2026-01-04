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
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
  currentChunk?: number;
  totalChunks?: number;
  error?: string | null;
}

const SPEED_OPTIONS = [
  { value: 0.5, label: "0.5x" },
  { value: 0.75, label: "0.75x" },
  { value: 1.0, label: "1x" },
  { value: 1.25, label: "1.25x" },
  { value: 1.5, label: "1.5x" },
  { value: 2.0, label: "2x" },
];

export default function PlaybackControls({
  isPlaying,
  isLoading,
  canPlay,
  speed,
  onPlay,
  onPause,
  onStop,
  onSpeedChange,
  currentChunk = 0,
  totalChunks = 0,
  error,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Speed Control */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs text-gray-500 mr-1">Speed:</span>
        <div className="flex bg-gray-100 rounded-lg p-1">
          {SPEED_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onSpeedChange(option.value)}
              className={`px-2 py-1 text-xs font-medium rounded transition-all ${
                speed === option.value
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

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

      {/* Current Speed Display when playing */}
      {isPlaying && speed !== 1.0 && (
        <p className="text-center text-xs text-indigo-600 font-medium">
          Playing at {speed}x speed
        </p>
      )}

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
          Generating speech{speed !== 1.0 ? ` at ${speed}x speed` : ""}...
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
