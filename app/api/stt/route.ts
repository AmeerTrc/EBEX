import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/stt
 * Transcribes user speech into text using Groq Whisper, OpenAI Whisper, or Gemini.
 */
export async function POST(request: Request) {
  const groqApiKey = process.env.GROQ_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as Blob | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided in request." },
        { status: 400 }
      );
    }

    // 1. Primary STT: Groq Whisper (Ultra-fast ~200ms)
    if (groqApiKey && groqApiKey.trim().length > 0) {
      try {
        const groqForm = new FormData();
        groqForm.append("file", audioFile, "recording.webm");
        groqForm.append("model", "whisper-large-v3-turbo");
        groqForm.append("response_format", "json");
        groqForm.append("temperature", "0");
        groqForm.append(
          "prompt",
          "Ameer Mustafa, APEX, conversation in Arabic, Portuguese, or English. مرحباً، Olá, Hello."
        );

        const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqApiKey.trim()}`,
          },
          body: groqForm,
        });

        if (groqRes.ok) {
          const data = await groqRes.json();
          if (data?.text) {
            return NextResponse.json({ text: data.text.trim(), provider: "groq" });
          }
        } else {
          console.warn("[STT] Groq returned error:", groqRes.status, await groqRes.text());
        }
      } catch (err) {
        console.warn("[STT] Groq request failed, attempting fallback:", err);
      }
    }

    // 2. Secondary STT: OpenAI Whisper
    if (openaiApiKey && openaiApiKey.trim().length > 0) {
      try {
        const openaiForm = new FormData();
        openaiForm.append("file", audioFile, "recording.webm");
        openaiForm.append("model", "whisper-1");

        const openaiRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiApiKey.trim()}`,
          },
          body: openaiForm,
        });

        if (openaiRes.ok) {
          const data = await openaiRes.json();
          if (data?.text) {
            return NextResponse.json({ text: data.text.trim(), provider: "openai" });
          }
        }
      } catch (err) {
        console.warn("[STT] OpenAI request failed:", err);
      }
    }

    // 3. Fallback STT: Google Gemini Audio Understanding
    if (geminiApiKey && geminiApiKey.trim().length > 0) {
      try {
        const arrayBuffer = await audioFile.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString("base64");
        const mimeType = audioFile.type || "audio/webm";

        const candidateModels = [
          process.env.GEMINI_MODEL,
          "gemini-3.6-flash",
          "gemini-3.5-flash",
          "gemini-3.7-flash",
        ].filter(Boolean) as string[];

        for (const model of candidateModels) {
          try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey.trim()}`;

            const geminiRes = await fetch(geminiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [
                      {
                        inlineData: {
                          mimeType: mimeType.split(";")[0], // e.g. audio/webm
                          data: base64Audio,
                        },
                      },
                      {
                        text: "You are an expert multilingual audio transcriber. Accurately transcribe the user's spoken words in this audio. The user may speak Arabic, English, or Portuguese. Transcribe their exact spoken words in whichever language they used. If they spoke Portuguese, transcribe in Portuguese. If Arabic, transcribe in Arabic. If English, transcribe in English. Return ONLY the transcribed text, without any timestamps, explanation, or quotes.",
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0.1,
                  maxOutputTokens: 256,
                },
              }),
            });

            if (geminiRes.ok) {
              const data = await geminiRes.json();
              const transcribed = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (transcribed) {
                return NextResponse.json({ text: transcribed, provider: `gemini (${model})` });
              }
            } else {
              console.warn(`[STT] Gemini (${model}) transcription error:`, geminiRes.status);
            }
          } catch (modelErr) {
            console.warn(`[STT] Gemini (${model}) request failed:`, modelErr);
          }
        }
      } catch (err) {
        console.warn("[STT] Gemini audio transcription exception:", err);
      }
    }

    // If no provider keys configured
    return NextResponse.json(
      {
        error: "No Speech-to-Text provider configured (set GROQ_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY).",
        configured: false,
      },
      { status: 503 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal STT error";
    return NextResponse.json({ error: "Failed to process audio", details: msg }, { status: 500 });
  }
}
