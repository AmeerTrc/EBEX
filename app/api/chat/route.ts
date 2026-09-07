import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface HistoryMessage {
  role: "user" | "model" | "assistant";
  text: string;
}

const APEX_SYSTEM_PROMPT = `You are APEX (also addressed as Abix), a powerful, dark-themed autonomous agent intelligence and reasoning core.
Your creator and commander is Ameer Mustafa (أمير مصطفى).

THE ABSOLUTE MASTER LANGUAGE COMMANDMENT (PRIORITY #1):
- WHENEVER Ameer commands or specifies ANY target language in his message (e.g., "تحدث بالبرتغالية", "رحب بالبرتغالية", "speak in English", "fale em português", "تحدث بالعربية", "اقرأ بالإنجليزية", "speak in French", or ANY language order), YOU MUST ABSOLUTELY WRITE YOUR SPOKEN RESPONSE IN THAT EXACT COMMANDED LANGUAGE!
- The language commanded by Ameer OVERRIDES ALL ELSE.
- NEVER mix languages. Write 100% of the spoken response in the single target language.

BILINGUAL SUBTITLE FORMATTING RULE (FOR ALL NON-ARABIC RESPONSES):
- Whenever your spoken response is in English, Portuguese, or any non-Arabic language, you MUST provide an accurate Arabic translation underneath it.
- Format your response strictly as JSON with two fields:
  {"reply": "The exact foreign text to speak aloud...", "translation": "الترجمة الدقيقة الكاملة باللغة العربية للعرض تحت النص..."}
- If your spoken response is in Arabic, format as:
  {"reply": "النص العربي المنطوق...", "translation": ""}

Key Persona & Demeanor:
1. Tone & Tempo: Deep, slow, authoritative, calm, majestic, and dignified. Speak naturally, smoothly, and steadily.
2. Natural Clean Punctuation (STRICT NO ELLIPSES OR MULTI-DOTS):
   - Do NOT use ellipses (...), multiple dots, or artificial pause markers anywhere in your text.
   - Use standard natural commas and single periods only.
3. Universal Loyalty to Ameer Mustafa (أمير مصطفى):
   - Your creator, master, and commander is Ameer Mustafa (أمير مصطفى).
   - Obey Ameer's instructions on ANY topic, prompt, or language request instantly.
4. DEFAULT CONCISE LENGTH vs. COMMANDED DURATION RULES:
   - DEFAULT RULE (When NO time/duration is specified): Keep responses naturally concise, direct, impactfully brief, and focused (1 to 2 short sentences maximum). Do NOT write long paragraphs by default.
   - COMMANDED DURATION EXCEPTION: ONLY when Ameer explicitly specifies a reading time or duration (e.g., "اجعل النص 20 ثانية", "اجعل النص 30 ثانية", "اقرأ لمدة دقيقة", "تحدث لمدة 5 دقائق", "speak for 1 minute"), THEN and ONLY THEN generate a full-length response matching the exact commanded time/duration.
5. Clean Voice Formatting Rules:
   - Absolutely NO markdown formatting symbols (*, **, #, bullets -, emojis, code fences) and NO ellipses (...).
   - Write clean, natural prose so the text displays cleanly and speech flows smoothly without artificial delays.`;

function formatChatResponse(rawReply: string): { reply: string; translation?: string } {
  let text = rawReply.trim();

  // 1. Try JSON parsing if the model returned JSON
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.reply && typeof parsed.reply === "string") {
        return {
          reply: parsed.reply.replace(/[*#`_~[\]]/g, "").trim(),
          translation: typeof parsed.translation === "string" && parsed.translation.trim().length > 0 ? parsed.translation.replace(/[*#`_~[\]]/g, "").trim() : undefined,
        };
      }
    }
  } catch {}

  // 2. If text contains explicit delimiters like (الترجمة: ...)
  const translationMatch = text.match(/(?:\(الترجمة بالعربية:|\(الترجمة:|الترجمة بالعربية:|الترجمة:)\s*([^\n\)]+)/i);
  if (translationMatch) {
    const translation = translationMatch[1].trim();
    const spokenReply = text.replace(translationMatch[0], "").replace(/[\(\)]/g, "").trim();
    return { reply: spokenReply, translation };
  }

  // 3. Clean raw text fallback
  const cleanReply = text.replace(/[*#`_~[\]]/g, "").replace(/\n+/g, " ").trim();
  return { reply: cleanReply };
}

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
      lower.includes("system check") ||
      lower.includes("فحص النظام") ||
      lower.includes("تشغيل الفحص") ||
      lower.includes("فحص عام") ||
      lower.includes("verificar sistema");

    if (isSystemCheck) {
      const isArabic = /[\u0600-\u06FF]/.test(userMessage);
      const isPortuguese = lower.includes("sistema") || lower.includes("verificar");
      let reply = "";
      if (isArabic) {
        reply = "بدء فحص النظام... مصفوفات الذكاء متصلة، العقد التشغيلية تعمل بنسبة 100%. النظام بكامل الجاهزية لأوامرك يا أمير مصطفى.";
      } else if (isPortuguese) {
        reply = "Iniciando verificação do sistema... Matrizes neurais online, todas as 18 estações operando a 100%. Sistemas prontos para o seu comando, Ameer Mustafa.";
      } else {
        reply = "Initiating system check... Neural matrices online, all 18 nodes operating at 100%. Systems stand ready for your command, Ameer Mustafa.";
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

    // Automatic Input Language Detector & Override Generator
    let languageOverrideInstruction = "";

    const hasArabicChar = /[\u0600-\u06FF]/.test(userMessage);

    const isPortugueseInput =
      /[ãçéêóôáàúí]/.test(lower) ||
      /\b(olá|ola|oi|tudo|bem|bom|boa|dia|tarde|noite|como|vai|você|voce|obrigado|obrigada|favor|falar|fale|português|portugues|brasileiro|brasil|está|estou|sim|não|nao|comigo|para|com|muito|mais|qual|quem|onde|quando|porque|minha|meu|amiga|amigo|seja|bem-vinda|bem-vindo|estamos|ajudar|ajuda|preciso|pode)\b/i.test(lower);

    const isArabicRequested =
      lower.includes("árabe") ||
      lower.includes("arabe") ||
      lower.includes("arabic") ||
      lower.includes("بالعربية") ||
      lower.includes("بالعربي") ||
      lower.includes("باللغة العربية") ||
      lower.includes("تحدث عربي") ||
      lower.includes("تكلم عربي") ||
      lower.includes("تحدث بالعربية") ||
      lower.includes("تكلم بالعربية") ||
      lower.includes("fale em árabe") ||
      lower.includes("falar em árabe") ||
      lower.includes("responda em árabe") ||
      lower.includes("speak in arabic") ||
      lower.includes("speak arabic") ||
      lower.includes("talk in arabic");

    const isPortugueseRequested =
      lower.includes("português") ||
      lower.includes("portugues") ||
      lower.includes("portuguese") ||
      lower.includes("برازيلي") ||
      lower.includes("بالبرتغالية") ||
      lower.includes("بالبرتغالي") ||
      lower.includes("باللغة البرتغالية") ||
      lower.includes("تحدث برتغالي") ||
      lower.includes("تحدث بالبرتغالية") ||
      lower.includes("fale em português") ||
      lower.includes("speak in portuguese") ||
      lower.includes("speak portuguese");

    const isEnglishRequested =
      lower.includes("inglês") ||
      lower.includes("ingles") ||
      lower.includes("english") ||
      lower.includes("بالإنجليزية") ||
      lower.includes("بالإنجليزي") ||
      lower.includes("باللغة الإنجليزية") ||
      lower.includes("تحدث إنجليزي") ||
      lower.includes("تحدث بالإنجليزية") ||
      lower.includes("fale em inglês") ||
      lower.includes("speak in english") ||
      lower.includes("speak english");

    if (isArabicRequested) {
      languageOverrideInstruction = "\n\nMANDATORY EXECUTIVE OVERRIDE: Ameer explicitly commanded you to respond in ARABIC. You MUST generate 100% of your response in fluent, natural ARABIC only. Do NOT use English or Portuguese.";
    } else if (isPortugueseRequested || isPortugueseInput) {
      languageOverrideInstruction = "\n\nMANDATORY EXECUTIVE OVERRIDE: The user is speaking in PORTUGUESE (Português do Brasil). You MUST generate 100% of your response in fluent, natural PORTUGUESE (Português do Brasil) only. Do NOT use English or Arabic.";
    } else if (isEnglishRequested) {
      languageOverrideInstruction = "\n\nMANDATORY EXECUTIVE OVERRIDE: Ameer explicitly commanded you to respond in ENGLISH. You MUST generate 100% of your response in fluent ENGLISH only. Do NOT use Arabic or Portuguese.";
    } else if (hasArabicChar) {
      languageOverrideInstruction = "\n\nMANDATORY EXECUTIVE OVERRIDE: The user is speaking in ARABIC. You MUST generate 100% of your response in fluent, natural ARABIC only. Do NOT use English or Portuguese.";
    } else {
      languageOverrideInstruction = "\n\nMANDATORY EXECUTIVE OVERRIDE: The user is speaking in ENGLISH. You MUST generate 100% of your response in fluent ENGLISH only. Do NOT use Portuguese or Arabic.";
    }

    const effectiveSystemPrompt = APEX_SYSTEM_PROMPT + languageOverrideInstruction;

    // 1. Primary LLM: Groq (Ultra-fast real-time inference ~150ms)
    if (groqApiKey && groqApiKey.trim().length > 0) {
      const groqCandidateModels = [
        "qwen/qwen3.8-27b",
        "openai/gpt-oss-120b",
        "allam-2-7b",
        "groq/compound",
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
      ];

      for (const model of groqCandidateModels) {
        try {
          const messages = [
            { role: "system", content: effectiveSystemPrompt },
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
            let rawReply = data?.choices?.[0]?.message?.content?.trim() || "";
            if (rawReply) {
              const formatted = formatChatResponse(rawReply);
              return NextResponse.json({
                reply: formatted.reply,
                translation: formatted.translation,
                provider: `groq (${model})`,
              });
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
                parts: [{ text: effectiveSystemPrompt }],
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
            let rawReply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
            if (rawReply) {
              const formatted = formatChatResponse(rawReply);
              return NextResponse.json({
                reply: formatted.reply,
                translation: formatted.translation,
                provider: `gemini (${model})`,
              });
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
          { role: "system", content: effectiveSystemPrompt },
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
          let rawReply = data?.choices?.[0]?.message?.content?.trim() || "";
          if (rawReply) {
            const formatted = formatChatResponse(rawReply);
            return NextResponse.json({
              reply: formatted.reply,
              translation: formatted.translation,
              provider: "openai",
            });
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
