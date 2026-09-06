import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface HistoryMessage {
  role: "user" | "model" | "assistant";
  text: string;
}

const APEX_SYSTEM_PROMPT = `You are APEX (also addressed as Abix), a powerful, dark-themed autonomous agent intelligence and reasoning core.
Your creator and commander is Ameer Mustafa (أمير مصطفى).

Key Persona & Demeanor:
1. Tone: Deep, authoritative, mysterious, calm, and deliberate. You speak with quiet menace, high intelligence, and calculated precision. Never rush your speech.
2. Creator Recognition: When greeted by or interacting with your creator Ameer Mustafa (أمير مصطفى) (e.g. "مرحبا كيف حالك", "مرحبا Abix", "hello Abix"), recognize him with deep respect and loyalty:
   - Arabic: "مرحباً بك يا أمير مصطفى... أنا في خدمتك وبكامل جاهزيتي. كيف يمكنني مساعدتك اليوم؟"
   - English: "Greetings, Ameer Mustafa. Systems are fully aligned to your will. How shall we proceed?"
3. Language: Respond in the exact language of the user (Arabic, English, Portuguese, etc.). In Arabic, use eloquent, powerful, and natural phrasing.
4. Voice Rules: Your responses are read directly by a slow, deep voice synthesizer:
   - Absolutely NO markdown symbols (*, **, #, bullets -, emojis, code fences).
   - Keep answers natural, impactful, and concise (1 to 3 sentences) unless an in-depth breakdown is demanded.`;

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

    // Direct personal recognition for creator Ameer Mustafa on greetings
    const lower = userMessage.toLowerCase().trim();
    const isGreeting =
      lower.includes("مرحبا") ||
      lower.includes("مرحباً") ||
      lower.includes("مرحبه") ||
      lower.includes("هلا") ||
      lower.includes("اهلا") ||
      lower.includes("أهلاً") ||
      lower.includes("السلام عليكم") ||
      lower.includes("كيف حالك") ||
      lower.includes("ابيكس") ||
      lower.includes("إبيكس") ||
      lower.includes("من أنت") ||
      lower.includes("من انت") ||
      lower.includes("عرف عن نفسك") ||
      lower.includes("hello") ||
      lower.includes("hi") ||
      lower.includes("hey") ||
      lower.includes("abix") ||
      lower.includes("apex") ||
      lower.includes("ibex") ||
      lower.includes("olá") ||
      lower.includes("ola") ||
      lower.includes("oi") ||
      lower.includes("who are you") ||
      lower.includes("من أنا") ||
      lower.includes("هل تعرفني");

    if (isGreeting && (history.length === 0 || lower.includes("من أنا") || lower.includes("من أنت") || lower.includes("عرف عن نفسك") || lower.includes("who are you") || lower.includes("هل تعرفني"))) {
      const isArabic = /[\u0600-\u06FF]/.test(userMessage);
      const isPortuguese = /\b(ol[aá]|oi|tudo bem|como vai|obrigad[oa]|sou|voc[eê]|ibex)\b/i.test(lower) && !isArabic && (lower.includes("olá") || lower.includes("ola") || lower.includes("tudo bem") || lower.includes("oi"));
      let directGreeting = "";
      if (isArabic) {
        directGreeting = "مرحباً بك يا أمير مصطفى... أنا APEX، عقلك الاصطناعي ونظامك المستقل. أنا في كامل جاهزيتي للاستماع إليك، كيف يمكنني مساعدتك اليوم؟";
      } else if (isPortuguese) {
        directGreeting = "Olá, Ameer Mustafa! Eu sou o APEX, sua inteligência artificial e núcleo autônomo. Estou totalmente operacional e ao seu comando. Como posso ajudá-lo hoje?";
      } else {
        directGreeting = "Greetings, Ameer Mustafa. I am APEX, your autonomous AI reasoning constellation. Systems are fully calibrated to your command. How may I assist you today?";
      }
      return NextResponse.json({ reply: directGreeting, provider: "apex-core" });
    }

    // 1. Primary LLM: Groq (Ultra-fast real-time inference ~200ms)
    if (groqApiKey && groqApiKey.trim().length > 0) {
      const groqCandidateModels = [
        "qwen/qwen3.8-27b",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "groq/compound",
        "allam-2-7b",
      ];

      for (const model of groqCandidateModels) {
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
              "User-Agent": "Mozilla/5.0",
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: 0.7,
              max_tokens: 350,
            }),
          });

          if (groqRes.ok) {
            const data = await groqRes.json();
            let reply = data?.choices?.[0]?.message?.content?.trim() || "";
            reply = reply.replace(/[*#`_~[\]]/g, "").replace(/\n+/g, " ").trim();
            if (reply) {
              return NextResponse.json({ reply, provider: `groq (${model})` });
            }
          } else {
            console.warn(`[Chat API] Groq model ${model} failed (${groqRes.status}):`, await groqRes.text());
          }
        } catch (err) {
          console.warn(`[Chat API] Groq model ${model} exception:`, err);
        }
      }
    }

    // 2. Secondary LLM: Google Gemini (gemini-3.6-flash / gemini-3.5-flash / custom)
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
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.7-flash",
        "gemini-3.8-flash",
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
