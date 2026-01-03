import { useState, useRef, useCallback } from "react";
import type { ReturnVoice, SnippetAudioChunk, VoiceProvider } from "hume/api/resources/tts";

interface TtsState {
  isPlaying: boolean;
  isLoading: boolean;
  currentChunk: number;
  totalChunks: number;
  progress: number;
  error: string | null;
}

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
      // No more chunks to append
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

  const speak = useCallback(async (
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
      // Create audio element and media source
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

      // Start playing
      audio.play().catch(console.warn);

      // Fetch TTS stream
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
      let audioChunksReceived = 0;

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
              audioChunksReceived++;
              const bin = atob(data.audio);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) {
                bytes[i] = bin.charCodeAt(i);
              }
              pendingChunksRef.current.push(bytes);
              appendNextChunk();
            }
          } catch (e) {
            console.warn("Failed to parse line:", line, e);
          }
        }
      }

      streamCompleteRef.current = true;
      appendNextChunk();

      // Wait for audio to finish playing
      await new Promise<void>((resolve) => {
        audio.addEventListener("ended", () => resolve(), { once: true });
        // Also resolve if audio is already done
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
