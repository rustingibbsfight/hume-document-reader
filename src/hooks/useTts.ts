import { useState, useRef, MutableRefObject } from "react";
import type { ReturnVoice } from "hume/api/resources/tts";

interface TtsState {
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  currentChunk: number;
  totalChunks: number;
  progress: number;
  error: string | null;
  speed: number;
}

// Check if MediaSource is supported (not on iOS Safari)
const isMediaSourceSupported = typeof window !== 'undefined' && 'MediaSource' in window;

export function useTts(
  voiceRef: MutableRefObject<ReturnVoice | null>,
  speedRef: MutableRefObject<number>
) {
  const [state, setState] = useState<TtsState>({
    isPlaying: false,
    isPaused: false,
    isLoading: false,
    currentChunk: 0,
    totalChunks: 0,
    progress: 0,
    error: null,
    speed: 1.0,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingChunksRef = useRef<Uint8Array[]>([]);
  const isAppendingRef = useRef(false);
  const streamCompleteRef = useRef(false);

  function cleanup() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    mediaSourceRef.current = null;
    sourceBufferRef.current = null;
    pendingChunksRef.current = [];
    isAppendingRef.current = false;
    streamCompleteRef.current = false;
  }

  function appendNextChunk() {
    const sourceBuffer = sourceBufferRef.current;
    const mediaSource = mediaSourceRef.current;
    
    if (!sourceBuffer || sourceBuffer.updating || isAppendingRef.current) {
      return;
    }

    if (pendingChunksRef.current.length === 0) {
      if (streamCompleteRef.current && mediaSource?.readyState === "open") {
        try {
          mediaSource.endOfStream();
        } catch (e) {}
      }
      return;
    }

    isAppendingRef.current = true;
    const chunk = pendingChunksRef.current.shift()!;
    
    try {
      sourceBuffer.appendBuffer(chunk.buffer as ArrayBuffer);
    } catch (e) {
      isAppendingRef.current = false;
    }
  }

  // Set playback rate on current audio element
  function setPlaybackRate(rate: number) {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    setState(prev => ({ ...prev, speed: rate }));
  }

  async function speakFallback(text: string) {
    cleanup();
    
    const voice = voiceRef.current;
    const speed = speedRef.current;
    console.log("[TTS] speakFallback - voice:", voice?.name, "speed:", speed);
    
    const audio = new Audio();
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    audioRef.current = audio;
    
    // Unlock audio on iOS
    const silentDataUri = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+1DEAAAGAAGn9AAAIgAANP8AAAARERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERER//tQxAADwAADSAAAAAAAAA0gAAABEREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREQ==';
    audio.src = silentDataUri;
    
    try { 
      await audio.play(); 
    } catch (e) {}
    
    setState(prev => ({
      ...prev,
      isPlaying: false,
      isPaused: false,
      isLoading: true,
      currentChunk: 0,
      totalChunks: 0,
      progress: 0,
      error: null,
      speed,
    }));

    abortControllerRef.current = new AbortController();

    try {
      const currentVoice = voiceRef.current;
      const currentSpeed = speedRef.current;
      
      const requestBody = {
        text,
        voiceName: currentVoice?.name || null,
        voiceProvider: currentVoice?.provider || "HUME_AI",
        instant: true,
        speed: currentSpeed,
      };

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `HTTP ${res.status}`);
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
            if (data.type === 'metadata') {
              setState(prev => ({
                ...prev,
                totalChunks: data.totalChunks,
                currentChunk: data.chunkIndex + 1,
              }));
            } else if (data.audio) {
              const bin = atob(data.audio);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              allChunks.push(bytes);
            }
          } catch (e) {}
        }
      }

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
        setState(prev => ({ ...prev, isPlaying: false, isPaused: false, progress: 100 }));
        URL.revokeObjectURL(url);
      };

      setState(prev => ({ ...prev, isLoading: false, isPlaying: true }));
      await audio.play();

    } catch (error: any) {
      if (error.name !== "AbortError") {
        setState(prev => ({ ...prev, error: error.message || "Failed to generate speech" }));
      }
      setState(prev => ({ ...prev, isPlaying: false, isPaused: false, isLoading: false }));
    }
  }

  async function speakStreaming(text: string) {
    cleanup();
    
    const voice = voiceRef.current;
    const speed = speedRef.current;
    console.log("[TTS] speakStreaming - voice:", voice?.name, "speed:", speed);
    
    setState(prev => ({
      ...prev,
      isPlaying: true,
      isPaused: false,
      isLoading: true,
      currentChunk: 0,
      totalChunks: 0,
      progress: 0,
      error: null,
      speed,
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
          } catch (e) { reject(e); }
        }, { once: true });
        mediaSource.addEventListener("error", () => reject(new Error("MediaSource error")), { once: true });
      });

      audio.play().catch(() => {});

      const requestBody = {
        text,
        voiceName: voice?.name || null,
        voiceProvider: voice?.provider || "HUME_AI",
        instant: true,
        speed,
      };

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
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
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              pendingChunksRef.current.push(bytes);
              appendNextChunk();
            }
          } catch (e) {}
        }
      }

      streamCompleteRef.current = true;
      appendNextChunk();

      await new Promise<void>((resolve) => {
        audio.addEventListener("ended", () => resolve(), { once: true });
        if (audio.ended) resolve();
      });

      setState(prev => ({ ...prev, isPlaying: false, isPaused: false, progress: 100 }));

    } catch (error: any) {
      if (error.name !== "AbortError") {
        setState(prev => ({ ...prev, error: error.message || "Failed to generate speech" }));
      }
      setState(prev => ({ ...prev, isPlaying: false, isPaused: false, isLoading: false }));
    }
  }

  function speak(text: string) {
    console.log("[TTS] speak() called, voice:", voiceRef.current?.name, "speed:", speedRef.current);
    
    if (isMediaSourceSupported) {
      speakStreaming(text);
    } else {
      speakFallback(text);
    }
  }

  function stop() {
    cleanup();
    setState(prev => ({
      ...prev,
      isPlaying: false,
      isPaused: false,
      isLoading: false,
    }));
  }

  function pause() {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setState(prev => ({ ...prev, isPlaying: false, isPaused: true }));
  }

  function resume() {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    setState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
  }

  return {
    ...state,
    speak,
    stop,
    pause,
    resume,
    setPlaybackRate,
  };
}
