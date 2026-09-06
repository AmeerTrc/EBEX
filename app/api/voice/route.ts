import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_VOICE_ID = "alwWf0yOMMykcrIh8BlE"; // Luthor – Deep, Mysterious and Gravel

/**
 * GET /api/voice
 * Returns current voice configuration status (without exposing secrets).
 */
export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  return NextResponse.json({
    configured: Boolean(apiKey && apiKey.trim().length > 0),
    voiceId,
  });
}

/**
 * POST /api/voice
 * Synthesizes speech using ElevenLabs Text-to-Speech API.
 * Request body: { text: string }
 * Response: audio/mpeg stream
 */
export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  if (!apiKey || apiKey.trim().length === 0) {
    return NextResponse.json(
      {
        error: "ELEVENLABS_API_KEY is not configured in server environment variables.",
        configured: false,
      },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        { error: "The 'text' field is required and cannot be empty." },
        { status: 400 }
      );
    }

    const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

    const response = await fetch(elevenLabsUrl, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey.trim(),
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.85,
          style: 0.1,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("[ElevenLabs API Warning]", response.status, errorText);

      // If library voice requires paid plan (Free tier limitation), fallback to deep built-in voice (Adam)
      if (response.status === 402 || errorText.includes("cannot use library voices")) {
        console.log("[ElevenLabs] Falling back to default deep voice (Adam)...");
        const fallbackUrl = `https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB?output_format=mp3_44100_128`;
        const fallbackRes = await fetch(fallbackUrl, {
          method: "POST",
          headers: {
            "xi-api-key": apiKey.trim(),
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.85,
              style: 0.1,
              use_speaker_boost: true,
            },
          }),
        });

        if (fallbackRes.ok) {
          const fallbackBuffer = await fallbackRes.arrayBuffer();
          return new Response(fallbackBuffer, {
            status: 200,
            headers: {
              "Content-Type": "audio/mpeg",
              "Content-Length": fallbackBuffer.byteLength.toString(),
              "Cache-Control": "public, max-age=3600, s-maxage=3600",
              "X-Voice-Fallback": "true",
            },
          });
        }
      }

      return NextResponse.json(
        {
          error: "ElevenLabs synthesis failed",
          status: response.status,
          details: errorText,
        },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err: unknown) {
    console.error("[Voice API Exception]", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: "Failed to generate speech", details: message },
      { status: 500 }
    );
  }
}
