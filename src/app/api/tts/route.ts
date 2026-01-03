import { NextRequest, NextResponse } from "next/server";
import { humeClient } from "@/lib/humeClient";
import type { Stream } from "hume/core";
import type {
  PostedUtterance,
  SnippetAudioChunk,
  VoiceProvider,
} from "hume/api/resources/tts";

// Maximum characters per TTS request (Hume limit is 5000)
const MAX_CHUNK_SIZE = 4500;

// Split text into chunks at sentence boundaries
function splitTextIntoChunks(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  
  let currentChunk = "";
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;
    
    if (currentChunk.length + trimmedSentence.length + 1 <= maxSize) {
      currentChunk += (currentChunk ? " " : "") + trimmedSentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      if (trimmedSentence.length > maxSize) {
        const words = trimmedSentence.split(/\s+/);
        currentChunk = "";
        for (const word of words) {
          if (currentChunk.length + word.length + 1 <= maxSize) {
            currentChunk += (currentChunk ? " " : "") + word;
          } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = word;
          }
        }
      } else {
        currentChunk = trimmedSentence;
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { text, voiceName, voiceProvider, instant, chunkIndex = 0 } = body as {
    text: string;
    voiceName: string | null;
    voiceProvider: VoiceProvider;
    instant: boolean;
    chunkIndex?: number;
  };

  console.log("[API/TTS] Received request:", { 
    textLength: text?.length, 
    voiceName, 
    voiceProvider, 
    instant,
    chunkIndex 
  });

  if (!text || text.trim() === "") {
    return NextResponse.json(
      { error: "Missing or invalid text" },
      { status: 400 }
    );
  }

  const textChunks = splitTextIntoChunks(text.trim(), MAX_CHUNK_SIZE);
  
  if (chunkIndex >= textChunks.length) {
    return NextResponse.json(
      { error: "Chunk index out of range", totalChunks: textChunks.length },
      { status: 400 }
    );
  }

  const currentText = textChunks[chunkIndex];

  // Build utterances with voice if specified
  const utterances: PostedUtterance[] = voiceName
    ? [
        {
          text: currentText,
          voice: { name: voiceName, provider: voiceProvider || "HUME_AI" },
        },
      ]
    : [{ text: currentText }];

  console.log("[API/TTS] Calling Hume with utterances:", JSON.stringify(utterances));

  let upstreamHumeStream: Stream<SnippetAudioChunk>;

  try {
    upstreamHumeStream = await humeClient.tts.synthesizeJsonStreaming({
      utterances,
      stripHeaders: true,
      instantMode: instant !== false && !!voiceName, // instant mode requires a voice
    });
    console.log("[API/TTS] Successfully initiated Hume stream");
  } catch (error: any) {
    console.error("[API/TTS] Hume API call failed:", error);
    const errorMessage = error?.message || "Failed to initiate TTS stream";
    const errorDetails = error?.error?.message || error?.error || errorMessage;
    return NextResponse.json(
      { error: "Hume API Error", details: errorDetails },
      { status: 502 }
    );
  }

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      // Send metadata first
      const metadata = JSON.stringify({
        type: 'metadata',
        chunkIndex,
        totalChunks: textChunks.length,
        hasMore: chunkIndex < textChunks.length - 1,
        voiceName, // Include voice for debugging
      }) + "\n";
      controller.enqueue(encoder.encode(metadata));

      for await (const chunk of upstreamHumeStream) {
        const jsonString = JSON.stringify({ ...chunk, type: 'audio' });
        const ndjsonLine = jsonString + "\n";
        const chunkBytes = encoder.encode(ndjsonLine);
        controller.enqueue(chunkBytes);
      }
      console.log("[API/TTS] Stream complete");
      controller.close();
    },
    cancel(reason) {
      console.log("[API/TTS] Client disconnected:", reason);
      if (typeof (upstreamHumeStream as any)?.abort === "function") {
        (upstreamHumeStream as any).abort();
      }
    },
  });

  return new NextResponse(readableStream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
