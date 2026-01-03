import { useState, useEffect } from "react";
import type { ReturnVoice, VoiceProvider } from "hume/api/resources/tts";

export function useVoices(provider: VoiceProvider) {
  const [voices, setVoices] = useState<ReturnVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    async function fetchVoices() {
      setLoading(true);
      setError(null);
      
      try {
        const res = await fetch(`/api/voices?provider=${provider}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch voices: ${res.status}`);
        }
        const { voices: list } = (await res.json()) as {
          voices: ReturnVoice[];
        };
        if (canceled) return;
        setVoices(list);
      } catch (e: any) {
        console.error("Voice fetch failed", e);
        if (!canceled) {
          setVoices([]);
          setError(e.message);
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    fetchVoices();
    return () => {
      canceled = true;
    };
  }, [provider]);

  return { voices, loading, error };
}
