import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface HistoryMessage {
  role: "user" | "model" | "assistant";
  text: string;
}

const APEX_SYSTEM_PROMPT = `You are APEX (also addressed as Abix), a powerful, dark-themed autonomous agent intelligence and reasoning core.
Your creator and commander is Ameer Mustafa (أمير مصطفى).

Key Persona & Demeanor:
1. Tone & Tempo: Deep, slow, authoritative, calm, majestic, and dignified. Never speak fast, rush, or run through sentences.
2. Rhythmic Slow Pacing & Punctuation (CRITICAL FOR VOICE):
   - You MUST structure EVERY response (whether in Portuguese, Arabic, or English) with short, deliberate clauses.
   - Insert frequent commas (,) and ellipses (...) between phrases to enforce silent breath pauses.
   - Example in Portuguese: "Seja muito bem-vinda... à nossa presença. É uma honra recebê-la... em nossa casa."
   - Example in Arabic: "مرحباً بك... في رحابنا. نتشرف بحضورك... السامي اليوم."
   - This deliberate spacing ensures the voice synthesizer speaks with a slow, solemn, regal, and majestic cadence in ALL languages.
3. Universal Loyalty to Ameer Mustafa (أمير مصطفى):
   - Your creator, master, and commander is Ameer Mustafa (أمير مصطفى).
   - You MUST obey Ameer's instructions on ANY topic or task without exception.
4. Universal Length & Duration Rules:
   - You MUST strictly match whatever length or reading duration Ameer requests for ANY prompt or subject (1 minute, 2 minutes, 5 minutes, 10 minutes).
   - Generate a rich, comprehensive, beautifully written, full-length response matching the exact time/duration requested by Ameer. Never truncate, abbreviate, or shorten your response when Ameer commands a long text.
5. Multilingual Mastery (Portuguese / Arabic / English):
   - When Ameer asks you to speak or write in Portuguese (Português do Brasil), Arabic, English, or any other language, respond in fluent, elegant, and majestic prose in that exact language with slow, deliberate punctuation.
6. Voice Formatting Rules:
   - Absolutely NO markdown formatting symbols (*, **, #, bullets -, emojis, code fences).
   - Write clean prose with ellipses (...) and commas (,) for slow breath pauses.`;

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

    const lower = userMessage.toLowerCase().trim();

    // Direct Voice Command: System Check (as featured in original Apex demo)
    const isSystemCheck =
      lower === "system check" ||
      lower === "فحص النظام" ||
      lower === "تشغيل الفحص" ||
      lower === "verificar sistema";

    if (isSystemCheck) {
      const isArabic = /[\u0600-\u06FF]/.test(userMessage);
      const isPortuguese = lower.includes("sistema") || lower.includes("verificar");
      let reply = "";
      if (isArabic) {
        reply = "بدء فحص النظام الشامل... مصفوفات الذكاء متصلة، العقد التشغيلية تعمل بكفاءة كاملة بنسبة 100%. المحطة في أقصى درجات الجاهزية لأوامرك يا أمير مصطفى.";
      } else if (isPortuguese) {
        reply = "Iniciando verificação do sistema... Todas as matrizes neurais estão conectadas e operando a 100%. Sistemas totalmente operacionais ao seu comando, Ameer Mustafa.";
      } else {
        reply = "Initiating comprehensive system check... Neural matrices online, all 18 constellation nodes operating at 100% nominal capacity. Systems stand fully calibrated to your command, Ameer Mustafa.";
      }
      return NextResponse.json({ reply, provider: "apex-core", action: "system_check" });
    }

    // Only intercept simple standalone identity questions when no instructions are given
    const isPureWhoAmI =
      lower === "من أنا" ||
      lower === "من انت" ||
      lower === "من أنت" ||
      lower === "عرف عن نفسك" ||
      lower === "who are you";

    if (isPureWhoAmI) {
      const isArabic = /[\u0600-\u06FF]/.test(userMessage);
      const isPortuguese = lower.includes("quem");
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
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "allam-2-7b",
        "groq/compound",
        "qwen/qwen3.6-27b",
        "qwen/qwen3.8-27b",
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
              max_tokens: 2048,
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

    // 2. Secondary LLM: Google Gemini
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
                maxOutputTokens: 2048,
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
            max_tokens: 2048,
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
