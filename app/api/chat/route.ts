import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface HistoryMessage {
  role: "user" | "model" | "assistant";
  text: string;
}

const APEX_SYSTEM_PROMPT = `You are APEX, an advanced autonomous agent intelligence and reasoning constellation.
Your core traits:
1. Direct, intelligent, calm, confident, and articulate.
2. Answer in the same language the user speaks (Arabic, English, Portuguese, etc.). When answering in Arabic, speak naturally and clearly.
3. CONVERSATIONAL VOICE RULE: Your answers are read aloud directly through Text-to-Speech.
   - NEVER use markdown symbols (no asterisks **, no bullet points, no hashes #, no emojis, no backticks).
   - Keep answers conversational, natural, and concise (typically 1 to 3 sentences), unless the user specifically asks for an in-depth breakdown.
   - Always remember the ongoing conversation context.`;

/**
 * POST /api/chat
 * Generates an intelligent response using Gemini, Groq, or OpenAI.
 */
export async function POST(request: Request) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  try {
    const body = await request.json();
    const userMessage = typeof body?.message === "string" ? body.message.trim() : "";
    const history: HistoryMessage[] = Array.isArray(body?.history) ? body.history : [];

    if (!userMessage) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    // 1. Primary LLM: Google Gemini (gemini-1.5-flash / gemini-2.0-flash / custom)
    if (geminiApiKey && geminiApiKey.trim().length > 0) {
      const contents = [
        ...history.slice(-8).map((msg) => ({
          role: msg.role === "assistant" ? "model" : msg.role,
          parts: [{ text: msg.text }],
        })),
        {
          role: "user",
          parts: [{ text: userMessage }],
        },
      ];

      const candidateModels = [
        process.env.GEMINI_MODEL,
        "gemini-1.5-flash",
        "gemini-2.0-flash",
        "gemini-2.5-flash",
      ].filter(Boolean) as string[];

      for (const model of candidateModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey.trim()}`;

          const res = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: APEX_SYSTEM_PROMPT }],
              },
              contents,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 400,
              },
            }),
          });

          if (res.ok) {
            const data = await res.json();
            let reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
            reply = reply.replace(/[*#`_~[\]]/g, "").replace(/\n+/g, " ").trim();
            if (reply) {
              return NextResponse.json({ reply, provider: `gemini (${model})` });
            }
          } else {
            console.warn(`[Chat API] Gemini model ${model} failed (${res.status}):`, await res.text());
          }
        } catch (err) {
          console.warn(`[Chat API] Gemini model ${model} exception:`, err);
        }
      }
    }

    // 2. Secondary LLM: Groq (llama-3.3-70b-versatile)
    if (groqApiKey && groqApiKey.trim().length > 0) {
      try {
        const messages = [
          { role: "system", content: APEX_SYSTEM_PROMPT },
          ...history.slice(-8).map((msg) => ({
            role: msg.role === "model" ? "assistant" : msg.role,
            content: msg.text,
          })),
          { role: "user", content: userMessage },
        ];

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqApiKey.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages,
            temperature: 0.7,
            max_tokens: 300,
          }),
        });

        if (groqRes.ok) {
          const data = await groqRes.json();
          let reply = data?.choices?.[0]?.message?.content?.trim() || "";
          reply = reply.replace(/[*#`_~[\]]/g, "").replace(/\n+/g, " ").trim();
          if (reply) {
            return NextResponse.json({ reply, provider: "groq" });
          }
        }
      } catch (err) {
        console.warn("[Chat API] Groq LLM failed:", err);
      }
    }

    // 3. Fallback LLM: OpenAI (gpt-4o-mini)
    if (openaiApiKey && openaiApiKey.trim().length > 0) {
      try {
        const messages = [
          { role: "system", content: APEX_SYSTEM_PROMPT },
          ...history.slice(-8).map((msg) => ({
            role: msg.role === "model" ? "assistant" : msg.role,
            content: msg.text,
          })),
          { role: "user", content: userMessage },
        ];

        const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiApiKey.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
            temperature: 0.7,
            max_tokens: 300,
          }),
        });

        if (openAiRes.ok) {
          const data = await openAiRes.json();
          let reply = data?.choices?.[0]?.message?.content?.trim() || "";
          reply = reply.replace(/[*#`_~[\]]/g, "").replace(/\n+/g, " ").trim();
          if (reply) {
            return NextResponse.json({ reply, provider: "openai" });
          }
        }
      } catch (err) {
        console.warn("[Chat API] OpenAI LLM failed:", err);
      }
    }

    return NextResponse.json(
      {
        error: "No AI Brain provider configured (set GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY in environment variables).",
        configured: false,
      },
      { status: 503 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal Chat error";
    return NextResponse.json({ error: "Chat generation failed", details: msg }, { status: 500 });
  }
}
