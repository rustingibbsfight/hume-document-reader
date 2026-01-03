import { useState, useRef, useCallback } from "react";
import type { ReturnVoice, VoiceProvider } from "hume/api/resources/tts";

interface TtsState {
  isPlaying: boolean;
  isLoading: boolean;
  currentChunk: number;
  totalChunks: number;
  progress: number;
  error: string | null;
}

// Check if MediaSource is supported (not on iOS Safari)
const isMediaSourceSupported = typeof window !== 'undefined' && 'MediaSource' in window;

export function useTts() {
  const [state, setState] = useState<TtsState>({
    isPlaying: false,
    isLoading: false,
    currentChunk: 0,
    totalChunks: 0,
    progress: 0,
    error: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingChunksRef = useRef<Uint8Array[]>([]);
  const isAppendingRef = useRef(false);
  const streamCompleteRef = useRef(false);
  const allAudioChunksRef = useRef<Uint8Array[]>([]); // For fallback mode

  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    mediaSourceRef.current = null;
    sourceBufferRef.current = null;
    pendingChunksRef.current = [];
    allAudioChunksRef.current = [];
    isAppendingRef.current = false;
    streamCompleteRef.current = false;
  }, []);

  const appendNextChunk = useCallback(() => {
    const sourceBuffer = sourceBufferRef.current;
    const mediaSource = mediaSourceRef.current;
    
    if (!sourceBuffer || sourceBuffer.updating || isAppendingRef.current) {
      return;
    }

    if (pendingChunksRef.current.length === 0) {
      if (streamCompleteRef.current && mediaSource?.readyState === "open") {
        try {
          mediaSource.endOfStream();
        } catch (e) {
          console.warn("Error ending stream:", e);
        }
      }
      return;
    }

    isAppendingRef.current = true;
    const chunk = pendingChunksRef.current.shift()!;
    
    try {
      sourceBuffer.appendBuffer(chunk.buffer as ArrayBuffer);
    } catch (e) {
      console.error("Error appending buffer:", e);
      isAppendingRef.current = false;
    }
  }, []);

  // Fallback playback for iOS/Safari (collect all chunks, then play)
  const speakFallback = useCallback(async (
    text: string,
    voice: ReturnVoice | null,
    voiceProvider: VoiceProvider
  ) => {
    cleanup();
    
    setState(prev => ({
      ...prev,
      isPlaying: false,
      isLoading: true,
      currentChunk: 0,
      totalChunks: 0,
      progress: 0,
      error: null,
    }));

    abortControllerRef.current = new AbortController();
    allAudioChunksRef.current = [];

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voiceName: voice?.name || null,
          voiceProvider: voice?.provider || voiceProvider,
          instant: !!voice,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
            
            if (data.type === 'metadata') {
              setState(prev => ({
                ...prev,
                totalChunks: data.totalChunks,
                currentChunk: data.chunkIndex + 1,
              }));
            } else if (data.audio) {
              const bin = atob(data.audio);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) {
                bytes[i] = bin.charCodeAt(i);
              }
              allAudioChunksRef.current.push(bytes);
            }
          } catch (e) {
            console.warn("Failed to parse line:", e);
          }
        }
      }

      // Combine all chunks into a single blob
      const totalLength = allAudioChunksRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of allAudioChunksRef.current) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const blob = new Blob([combined], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      
      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.onended = () => {
        setState(prev => ({ ...prev, isPlaying: false, progress: 100 }));
        URL.revokeObjectURL(url);
      };

      audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        setState(prev => ({ ...prev, isPlaying: false, error: "Playback error" }));
      };

      setState(prev => ({ ...prev, isLoading: false, isPlaying: true }));
      await audio.play();

    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("TTS request aborted");
      } else {
        console.error("TTS error:", error);
        setState(prev => ({
          ...prev,
          error: error.message || "Failed to generate speech",
        }));
      }
      setState(prev => ({ ...prev, isPlaying: false, isLoading: false }));
    }
  }, [cleanup]);

  // Streaming playback using MediaSource (for Chrome, Firefox, Edge)
  const speakStreaming = useCallback(async (
    text: string,
    voice: ReturnVoice | null,
    voiceProvider: VoiceProvider
  ) => {
    cleanup();
    
    setState(prev => ({
      ...prev,
      isPlaying: true,
      isLoading: true,
      currentChunk: 0,
      totalChunks: 0,
      progress: 0,
      error: null,
    }));

    abortControllerRef.current = new AbortController();

    try {
      const audio = new Audio();
      audioRef.current = audio;
      
      const mediaSource = new MediaSource();
      mediaSourceRef.current = mediaSource;
      audio.src = URL.createObjectURL(mediaSource);

      await new Promise<void>((resolve, reject) => {
        mediaSource.addEventListener("sourceopen", () => {
          try {
            const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
            sourceBufferRef.current = sourceBuffer;
            
            sourceBuffer.addEventListener("updateend", () => {
              isAppendingRef.current = false;
              appendNextChunk();
            });
            
            resolve();
          } catch (e) {
            reject(e);
          }
        }, { once: true });
        
        mediaSource.addEventListener("error", () => {
          reject(new Error("MediaSource error"));
        }, { once: true });
      });

      audio.play().catch(console.warn);

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voiceName: voice?.name || null,
          voiceProvider: voice?.provider || voiceProvider,
          instant: !!voice,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `HTTP ${res.status}`);
      }

      setState(prev => ({ ...prev, isLoading: false }));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
            
            if (data.type === 'metadata') {
              setState(prev => ({
                ...prev,
                totalChunks: data.totalChunks,
                currentChunk: data.chunkIndex + 1,
              }));
            } else if (data.audio) {
              const bin = atob(data.audio);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) {
                bytes[i] = bin.charCodeAt(i);
              }
              pendingChunksRef.current.push(bytes);
              appendNextChunk();
            }
          } catch (e) {
            console.warn("Failed to parse line:", e);
          }
        }
      }

      streamCompleteRef.current = true;
      appendNextChunk();

      await new Promise<void>((resolve) => {
        audio.addEventListener("ended", () => resolve(), { once: true });
        if (audio.ended) resolve();
      });

      setState(prev => ({
        ...prev,
        isPlaying: false,
        progress: 100,
      }));

    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("TTS request aborted");
      } else {
        console.error("TTS error:", error);
        setState(prev => ({
          ...prev,
          error: error.message || "Failed to generate speech",
        }));
      }
      setState(prev => ({ ...prev, isPlaying: false, isLoading: false }));
    }
  }, [cleanup, appendNextChunk]);

  // Choose the right method based on browser support
  const speak = useCallback(async (
    text: string,
    voice: ReturnVoice | null,
    voiceProvider: VoiceProvider
  ) => {
    if (isMediaSourceSupported) {
      return speakStreaming(text, voice, voiceProvider);
    } else {
      return speakFallback(text, voice, voiceProvider);
    }
  }, [speakStreaming, speakFallback]);

  const stop = useCallback(() => {
    cleanup();
    setState(prev => ({
      ...prev,
      isPlaying: false,
      isLoading: false,
    }));
  }, [cleanup]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play();
    setState(prev => ({ ...prev, isPlaying: true }));
  }, []);

  return {
    ...state,
    speak,
    stop,
    pause,
    resume,
    audioRef,
  };
}
