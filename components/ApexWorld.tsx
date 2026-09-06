"use client";

/**
 * ApexWorld - the Apex app's CURRENT main screen, replicated for the site.
 * Layers: app-blue backdrop → clickable orb core (ring + particles, same tap
 * cycle) → ReasoningWeb (verbatim copy from the app: circuit traces, orbit
 * rings, the full asymmetric roster, ambient motes) → OrbStatusBar (equalizer
 * + STANDBY cluster at the bottom).
 * Clicking any node opens the site's AGENT OVERVIEW window template; the
 * orb's tap cycle drives the whole web (standby → processing → speaking).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import ApexHeroOrb, { type OrbState } from "./ApexHeroOrb";
import ReasoningWebJs from "./ReasoningWeb";
import ShaderBackgroundJs from "./ShaderBackground";
import OrbStatusBar from "./OrbStatusBar";
import { useApexVoice } from "./useApexVoice";
import { useApexMic } from "./useApexMic";

export type NodeSel = { name: string; key: string; color: string };

// the copied .jsx defaults onSelect to null, which TS infers as `null | undefined`
const ReasoningWeb = ReasoningWebJs as unknown as React.ComponentType<{
  state?: string; trace?: unknown; mode?: string; coreless?: boolean;
  onSelect?: (n: NodeSel) => void; light?: boolean;
}>;
const ShaderBackground = ShaderBackgroundJs as unknown as React.ComponentType<{
  opacity?: number; voiceActive?: boolean; gold?: boolean;
}>;
type AgentInfo = {
  role: string;
  caps: string[];
  asks?: string[];
  status: "online" | "standby" | "integration";
};

/* Mirrors the ROSTER in ReasoningWeb.jsx (a verbatim copy from the Apex app, so
   it is not edited here). Backs the visually-hidden agent list that gives the
   decorative SVG graph a keyboard and screen-reader equivalent - keep in sync if
   the copy's roster changes. */
export const ROSTER: { key: string; name: string; color: string }[] = [
  { key: "chief_of_staff", name: "Chief of staff", color: "#00e5ff" },
  { key: "memory",         name: "Memory",         color: "#00e5ff" },
  { key: "strategist",     name: "Strategist",     color: "#00e5ff" },
  { key: "researcher",     name: "Researcher",     color: "#00e5ff" },
  { key: "finance",        name: "Finance",        color: "#00e5ff" },
  { key: "editor",         name: "Editor",         color: "#00e5ff" },
  { key: "sales",          name: "Sales",          color: "#f5a623" },
  { key: "marketing",      name: "Marketing",      color: "#f5a623" },
  { key: "ops",            name: "Ops",            color: "#f5a623" },
  { key: "social_media",   name: "Social",         color: "#f5a623" },
  { key: "engineering",    name: "Engineering",    color: "#f5a623" },
  { key: "design",         name: "Design",         color: "#f5a623" },
  { key: "developer",      name: "Developer",      color: "#f5a623" },
  { key: "analytics",      name: "Analytics",      color: "#7f9bb3" },
  { key: "crm",            name: "CRM",            color: "#7f9bb3" },
  { key: "calendar",       name: "Calendar",       color: "#7f9bb3" },
  { key: "email",          name: "Email",          color: "#7f9bb3" },
  { key: "drive",          name: "Drive",          color: "#7f9bb3" },
];

/* Overview data per ReasoningWeb roster id - the site's template content */
export const INFO: Record<string, AgentInfo> = {
  chief_of_staff: { role: "Right hand - runs the day", status: "online",
    caps: ["Prioritizes the day and keeps loose ends closed", "Routes every request to the right specialist", "Escalates only what truly needs a human"],
    asks: ["What needs attention today?", "Chase the open quotes"] },
  memory: { role: "Long-term memory", status: "online",
    caps: ["Remembers every client, project and decision", "Feeds context into every task automatically", "Learns preferences over time"],
    asks: ["What did we decide about X?", "History with this client"] },
  strategist: { role: "Big-picture thinking", status: "online",
    caps: ["Weekly strategy reviews", "Goal and milestone tracking", "Spots opportunities and risks early"],
    asks: ["Where should we double down?"] },
  researcher: { role: "Deep research", status: "online",
    caps: ["Market and competitor research", "Technical deep-dives", "Source-checked summaries"],
    asks: ["Research this market", "Compare these suppliers"] },
  finance: { role: "Money watch", status: "online",
    caps: ["Revenue and pipeline tracking", "Pricing sanity checks", "Monthly performance recaps"],
    asks: ["How was this month?", "Is this quote priced right?"] },
  editor: { role: "Quality gate", status: "online",
    caps: ["Rewrites and tightens every draft", "Keeps the brand voice consistent", "Final pass before anything ships"],
    asks: ["Polish this post", "Tighten this email"] },
  sales: { role: "Deal closer", status: "online",
    caps: ["Follow-ups for every lead", "Warm-outreach drafts", "Pipeline nudges so nothing goes cold"],
    asks: ["Draft a follow-up", "Who went quiet?"] },
  marketing: { role: "Growth engine", status: "online",
    caps: ["Campaign generation", "Pricing analysis", "Brand positioning and content calendar"],
    asks: ["Generate campaign", "Competitor research"] },
  ops: { role: "Business operator", status: "online",
    caps: ["Client quotes and proposals", "Project scoping and timelines", "Supplier sourcing"],
    asks: ["Draft client quote", "Build project scope"] },
  social_media: { role: "Voice of the brand", status: "online",
    caps: ["Writes posts and captions", "Creates reel scripts", "Posts to Instagram, LinkedIn and Facebook"],
    asks: ["Write post caption", "Plan content week"] },
  engineering: { role: "Engineering brain", status: "online",
    caps: ["3D-print settings and materials", "Tolerances and fit", "Laser power and speed guidance"],
    asks: ["Review STL file", "Calculate tolerances"] },
  design: { role: "Visual workshop", status: "online",
    caps: ["Background removal and replacement", "Text overlays", "Resize for social media", "Filters and enhancement"],
    asks: ["Remove background", "Resize for IG"] },
  developer: { role: "Keeper of the build log", status: "standby",
    caps: ["Keeps Apex's development log", "Recaps what shipped - day / week / month", "Future: builds Apex itself"],
    asks: ["Recap last week"] },
  analytics: { role: "Numbers feed", status: "integration",
    caps: ["Performance metrics across every channel", "Feeds the weekly reviews"] },
  crm: { role: "Client memory bank", status: "integration",
    caps: ["Every lead and client in one pipeline", "Stage tracking from first contact to paid"] },
  calendar: { role: "Schedule sense", status: "integration",
    caps: ["Knows the calendar", "Reminders and follow-up timing"] },
  email: { role: "Inbox hands", status: "integration",
    caps: ["Inbox triage and reply drafts", "Connected and in use"] },
  drive: { role: "File access", status: "integration",
    caps: ["Reads and files documents", "Connected and in use"] },
};

const STATUS_LINE: Record<AgentInfo["status"], { color: string; text: string }> = {
  online: { color: "#34d399", text: "Online - Apex routes work to it automatically" },
  standby: { color: "#c9a84c", text: "Standby - in active development" },
  integration: { color: "#7f9bb3", text: "Integration - wired into the core" },
};

/* ── AGENT OVERVIEW window - the site's template (the app opens live cockpits) ── */
export function AgentOverview({ sel, onClose }: { sel: NodeSel; onClose: () => void }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ sx: number; sy: number } | null>(null);
  const info = INFO[sel.key] ?? { role: "Specialist", status: "online" as const, caps: ["Part of the Apex core"] };
  const c = sel.color;
  const status = STATUS_LINE[info.status];

  useEffect(() => {
    setPos({ x: Math.max(8, window.innerWidth / 2 - 170), y: Math.max(90, window.innerHeight * 0.16) });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Move focus into the window when it opens and hand it back on close, so the
  // keyboard does not stay stranded on the agent list behind it.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pos) return;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => { if (opener && document.contains(opener)) opener.focus(); };
  }, [pos]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!pos) return;
    dragRef.current = { sx: e.clientX - pos.x, sy: e.clientY - pos.y };
    const move = (ev: MouseEvent) => {
      if (dragRef.current) setPos({ x: ev.clientX - dragRef.current.sx, y: ev.clientY - dragRef.current.sy });
    };
    const up = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  if (!pos) return null;
  return (
    <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`${sel.name} overview`} style={{
      position: "fixed", left: pos.x, top: pos.y,
      width: "min(340px, 92vw)", zIndex: 60,
      background: "rgba(4,3,12,0.92)",
      backdropFilter: "blur(24px)",
      border: `1px solid ${c}44`,
      borderRadius: 16,
      boxShadow: `0 0 40px ${c}18, 0 8px 32px rgba(0,0,0,0.6)`,
      overflow: "hidden",
    }}>
      {/* header - drag handle */}
      <div onMouseDown={onMouseDown} style={{
        display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
        borderBottom: `1px solid ${c}22`, cursor: "grab", userSelect: "none",
        background: `linear-gradient(135deg, ${c}0a 0%, transparent 100%)`,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", background: `${c}14`,
          border: `1px solid ${c}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: c, boxShadow: `0 0 10px ${c}` }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: c }}>{sel.name.toUpperCase()}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{info.role}</div>
        </div>
        <button onClick={onClose} aria-label="Close"
          style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "6px 8px", transition: "color 0.2s" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
        >×</button>
      </div>

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: "0.14em", color: `${c}99`, marginBottom: 8, fontFamily: "var(--font-mono)" }}>WHAT IT HANDLES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {info.caps.map((cap) => (
              <div key={cap} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                <div style={{ width: 3, height: 3, borderRadius: "50%", background: `${c}99`, marginTop: 6, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>{cap}</span>
              </div>
            ))}
          </div>
        </div>

        {info.asks && info.asks.length > 0 && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.14em", color: `${c}99`, marginBottom: 8, fontFamily: "var(--font-mono)" }}>EXAMPLE REQUESTS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {info.asks.map((task) => (
                <span key={task} style={{
                  padding: "4px 10px", background: `${c}0d`, border: `1px solid ${c}2a`,
                  borderRadius: 20, fontSize: 10.5, color: `${c}cc`,
                }}>{task}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 7, borderTop: `1px solid ${c}1a`, paddingTop: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: status.color, boxShadow: `0 0 8px ${status.color}` }} />
          <span style={{ fontSize: 9.5, letterSpacing: "0.1em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>{status.text}</span>
        </div>
      </div>
    </div>
  );
}

/* ── The world ── */
export default function ApexWorld() {
  const [selected, setSelected] = useState<NodeSel | null>(null);
  const [reduced, setReduced] = useState(false);

  // Real conversational states: idle → listening → thinking → speaking → idle
  const [showState, setShowState] = useState<OrbState>("idle");
  const orbState: OrbState = showState;
  const [history, setHistory] = useState<Array<{ role: "user" | "model"; text: string }>>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [dialogueTurns, setDialogueTurns] = useState<
    Array<{ id: string; role: "user" | "apex"; text: string; timestamp: string }>
  >([]);
  const dialogueEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogueEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dialogueTurns, statusMessage]);

  const [lastUserText, setLastUserText] = useState<string | null>(null);
  const [lastApexText, setLastApexText] = useState<string | null>(null);
  const [voiceSpeed, setVoiceSpeed] = useState<number>(0.70);

  const { speak, stop, isPlaying } = useApexVoice();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const isSessionActiveRef = useRef(false);
  isSessionActiveRef.current = isSessionActive;

  const isProcessingRef = useRef(false);
  const onSilenceRef = useRef<() => void>(() => {});

  const {
    isRecording,
    startRecording,
    stopRecording,
    cancelRecording,
    startInterruptionMonitoring,
    stopInterruptionMonitoring,
    micError,
  } = useApexMic({
    onSilenceAutoStop: () => onSilenceRef.current(),
    silenceDelayMs: 1500,
  });

  const handleFinishAndProcess = useCallback(async () => {
    if (!isSessionActiveRef.current || isProcessingRef.current) return;
    isProcessingRef.current = true;

    setShowState("thinking");
    setStatusMessage("Processing speech...");
    const audioBlob = await stopRecording();

    if (!audioBlob || audioBlob.size < 300) {
      if (isSessionActiveRef.current) {
        const ok = await startRecording();
        if (ok && isSessionActiveRef.current) {
          setShowState("listening");
          setStatusMessage("Listening... Speak to APEX");
        }
      }
      isProcessingRef.current = false;
      return;
    }

    try {
      // Send audio to /api/stt
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const sttRes = await fetch("/api/stt", {
        method: "POST",
        body: formData,
      });

      if (!sttRes.ok) {
        const errData = await sttRes.json().catch(() => ({}));
        console.warn("[STT Error]", errData);
        if (isSessionActiveRef.current) {
          setStatusMessage("Could not capture speech, listening again...");
          setTimeout(async () => {
            if (isSessionActiveRef.current) {
              const ok = await startRecording();
              if (ok) {
                setShowState("listening");
                setStatusMessage("Listening... Speak to APEX");
              }
            }
          }, 1000);
        }
        isProcessingRef.current = false;
        return;
      }

      const sttData = await sttRes.json().catch(() => ({}));
      const rawText = typeof sttData?.text === "string" ? sttData.text.trim() : "";
      // Strip brackets like [music], (laughter), (silence)
      const userQuestion = rawText.replace(/\[.*?\]|\(.*?\)/g, "").trim();

      if (!userQuestion || userQuestion.length < 2) {
        if (isSessionActiveRef.current) {
          setStatusMessage("Didn't catch that, listening again...");
          setTimeout(async () => {
            if (isSessionActiveRef.current) {
              const ok = await startRecording();
              if (ok && isSessionActiveRef.current) {
                setShowState("listening");
                setStatusMessage("Listening... Speak to APEX");
              }
            }
          }, 800);
        }
        isProcessingRef.current = false;
        return;
      }

      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setDialogueTurns((prev) => [
        ...prev,
        { id: "user-" + Date.now(), role: "user", text: userQuestion, timestamp: timeStr },
      ]);
      setLastUserText(userQuestion);
      setStatusMessage("APEX Thinking...");

      // Check if user spoke a departure command to power off by voice
      const lowerQ = userQuestion.toLowerCase();
      const isGoodbye =
        lowerQ.includes("مع السلامة") ||
        lowerQ.includes("إلى اللقاء") ||
        lowerQ.includes("إغلاق") ||
        lowerQ.includes("توقف") ||
        lowerQ.includes("وداعا") ||
        lowerQ.includes("bye") ||
        lowerQ.includes("goodbye");

      // Send transcribed question to /api/chat with session history
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userQuestion,
          history,
        }),
      });

      if (!chatRes.ok) {
        const errData = await chatRes.json().catch(() => ({}));
        console.warn("[Chat Error]", errData);
        if (isSessionActiveRef.current) {
          setStatusMessage("AI response failed, listening again...");
          setTimeout(async () => {
            if (isSessionActiveRef.current) {
              const ok = await startRecording();
              if (ok) {
                setShowState("listening");
                setStatusMessage("Listening... Speak now");
              }
            }
          }, 1500);
        }
        isProcessingRef.current = false;
        return;
      }

      const { reply } = await chatRes.json();
      if (!reply) {
        if (isSessionActiveRef.current) {
          const ok = await startRecording();
          if (ok && isSessionActiveRef.current) {
            setShowState("listening");
            setStatusMessage("Listening... Speak now");
          }
        }
        isProcessingRef.current = false;
        return;
      }

      // Update multi-turn session history and display full APEX response
      setHistory((prev) => [
        ...prev,
        { role: "user", text: userQuestion },
        { role: "model", text: reply },
      ]);
      setDialogueTurns((prev) => [
        ...prev,
        { id: "apex-" + Date.now(), role: "apex", text: reply, timestamp: timeStr },
      ]);
      setLastApexText(reply);
      setStatusMessage(null);

      // Enable real-time voice interruption monitoring while APEX is speaking
      let wasInterrupted = false;

      startInterruptionMonitoring(async () => {
        wasInterrupted = true;
        // 1. Immediately cut off APEX's voice!
        stop();
        // 2. Clear processing lock so interrupted speech is accepted
        isProcessingRef.current = false;
        // 3. Switch state to listening
        setShowState("listening");
        setStatusMessage("Listening... Speak now");
        // 4. Start recording user's new speech immediately!
        await startRecording();
      });

      // Synthesize and play reply using ElevenLabs (waits until speech finishes or resolves false on interruption)
      await speak(
        reply,
        (state) => {
          if (!wasInterrupted) {
            setShowState(state);
          }
        },
        voiceSpeed
      );

      // Stop interruption monitoring once speech is finished
      stopInterruptionMonitoring();

      // If user interrupted during playback, the interruption handler has already started recording
      if (wasInterrupted) {
        return;
      }

      // If user instructed goodbye, power down into standby
      if (isGoodbye) {
        setIsSessionActive(false);
        isSessionActiveRef.current = false;
        setShowState("idle");
        setStatusMessage("APEX Standby");
        setTimeout(() => setStatusMessage(null), 2500);
        return;
      }

      // Hands-free continuous loop: automatically start listening again for next question!
      if (isSessionActiveRef.current) {
        const ok = await startRecording();
        if (ok && isSessionActiveRef.current) {
          setShowState("listening");
          setStatusMessage("Listening... Speak now");
        }
      }
    } catch (err) {
      console.error("[Voice AI Error]", err);
      if (isSessionActiveRef.current) {
        const ok = await startRecording();
        if (ok && isSessionActiveRef.current) {
          setShowState("listening");
          setStatusMessage("Listening... Speak now");
        }
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [history, speak, stop, startRecording, stopRecording, startInterruptionMonitoring, stopInterruptionMonitoring, voiceSpeed]);

  onSilenceRef.current = handleFinishAndProcess;

  const handleOrbClick = async () => {
    // 1. If session is ALREADY ACTIVE: Glowing orb is clicked to TURN OFF (إطفاء)
    if (isSessionActiveRef.current) {
      setIsSessionActive(false);
      isSessionActiveRef.current = false;
      stop();
      cancelRecording();
      setShowState("idle");
      setLastUserText(null);
      setLastApexText(null);
      setStatusMessage("APEX Standby");
      setTimeout(() => setStatusMessage(null), 2500);
      return;
    }

    // 2. If session is OFF: Glowing orb is clicked to TURN ON (تشغيل)
    setIsSessionActive(true);
    isSessionActiveRef.current = true;
    setShowState("listening");
    setStatusMessage("APEX Online · Listening...");

    // Immediately open microphone silently and wait for user to greet in their language
    const ok = await startRecording();
    if (ok && isSessionActiveRef.current) {
      setShowState("listening");
      setStatusMessage("Listening... Speak to APEX");
    } else if (!ok) {
      setShowState("idle");
      setStatusMessage(micError || "Microphone access required");
      setIsSessionActive(false);
      isSessionActiveRef.current = false;
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  // Single entry point for opening an agent, shared by the SVG graph and the
  // hidden accessible list, so both routes behave identically.
  const openAgent = (n: NodeSel) => {
    setSelected(n);
  };

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // orb tap cycle → the web's activity level (same states the app streams)
  const webState =
    orbState === "listening" || orbState === "thinking"
      ? "processing"
      : orbState === "speaking"
      ? "speaking"
      : "standby";

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", userSelect: "none" }}>
      {/* backdrop - the app's EXACT stack (Chat.jsx dark mode): base radial page
          gradient, waves at 0.12, the cyan breathing glow behind the orb, and the
          dark moat disc directly behind the particle cloud that makes it pop. */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 95% 88% at 50% 42%, #122c43 0%, #0c1d30 38%, #07111f 72%, #050b14 100%)",
      }} />

      {/* background waves - the app's WebGL shader at the app's opacity */}
      {!reduced && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <ShaderBackground opacity={0.12} voiceActive={orbState === "speaking"} gold={false} />
        </div>
      )}

      {/* cyan LIGHT-CAST - app copy exactly: mixBlendMode screen (only ever LIFTS the
          navy, never darkens), brightens while speaking. The app has NO dark moat disc
          in dark mode - that layer is its light-theme "reactor well" only. */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", mixBlendMode: "screen",
        background: `radial-gradient(circle at 50% 42%, rgba(13,210,255,${orbState === "speaking" ? 0.30 : 0.18}) 0%, rgba(13,170,228,0.08) 30%, rgba(8,17,31,0) 62%)`,
        transition: "background 0.6s ease",
      }} />

      {/* the reasoning web - app z-order: web (z13) sits BELOW the orb canvas (z15),
          so the bloom haze washes over the lines near the centre, exactly like the app */}
      {/* ReasoningWeb is a verbatim copy from the Apex app: its 18 agent nodes are
          imperative SVG hit-areas with no tabindex, inside an svg[role=img] that
          collapses the whole graph into a single image. Rather than edit the copy,
          the graph is marked decorative here and the same onSelect path is exposed
          through the equivalent list of real buttons below. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }}>
        <ReasoningWeb
          state={webState}
          mode="full"
          coreless
          onSelect={(n: NodeSel) => { openAgent(n); }}
        />
      </div>

      {/* Keyboard and screen-reader equivalent of the agent graph. */}
      <nav className="visually-hidden" aria-label="Apex agents">
        <ul>
          {ROSTER.map((a) => (
            <li key={a.key}>
              <button type="button" onClick={() => openAgent({ key: a.key, name: a.name, color: a.color })}>
                {a.name} - {INFO[a.key]?.role ?? "Specialist"}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* the core - painted ABOVE the web (app order); display-only, the tap target
          is the circular disc below so agent nodes near the ring stay clickable */}
      <div style={{ position: "absolute", left: "50%", top: "50%", width: "min(560px, 58vw)", height: "min(500px, 56vw, 70vh)", transform: "translate(-50%, -50%)", zIndex: 3, pointerEvents: "none" }}>
        <ApexHeroOrb state={orbState} interactive={false} />
      </div>

      {/* central tap disc - covers the ring only (nodes orbit outside it) */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Apex core - tap to talk"
        onClick={handleOrbClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleOrbClick(); } }}
        onMouseDown={(e) => e.preventDefault()}
        style={{
          position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
          width: "min(340px, 36vw)", height: "min(340px, 36vw)", borderRadius: "50%",
          zIndex: 4, cursor: "pointer", background: "transparent", border: "none", userSelect: "none",
        }}
      />

      {/* Full Live Dialogue & Caption Console */}
      {(dialogueTurns.length > 0 || statusMessage) && (
        <div
          style={{
            position: "absolute",
            bottom: 110,
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(760px, 94vw)",
            maxHeight: "38vh",
            display: "flex",
            flexDirection: "column",
            background: "rgba(5, 12, 24, 0.92)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(0, 229, 255, 0.35)",
            borderRadius: 18,
            zIndex: 25,
            boxShadow: "0 16px 48px rgba(0, 0, 0, 0.85), 0 0 28px rgba(0, 229, 255, 0.12)",
            pointerEvents: "auto",
            overflow: "hidden",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Header Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 16px",
              background: "rgba(0, 229, 255, 0.04)",
              borderBottom: "1px solid rgba(0, 229, 255, 0.15)",
              fontSize: "0.72rem",
              fontFamily: "var(--font-mono, monospace)",
              letterSpacing: "0.08em",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor:
                    orbState === "listening"
                      ? "#00e5ff"
                      : orbState === "thinking"
                      ? "#ffd080"
                      : orbState === "speaking"
                      ? "#00ffaa"
                      : "#607d8b",
                  boxShadow: `0 0 10px currentColor`,
                  display: "inline-block",
                }}
              />
              <span style={{ color: "#00e5ff", fontWeight: 700 }}>
                APEX CONSTELLATION • المحادثة المباشرة
              </span>
              <span style={{ color: "rgba(255, 255, 255, 0.4)", fontSize: "0.68rem" }}>
                (AR / PT / EN)
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {statusMessage && (
                <span
                  style={{
                    color:
                      orbState === "listening"
                        ? "#00e5ff"
                        : orbState === "thinking"
                        ? "#ffd080"
                        : "#80d8ff",
                    fontSize: "0.72rem",
                  }}
                >
                  {statusMessage}
                </span>
              )}
              {/* Voice Speed Toggle */}
              <button
                type="button"
                onClick={() => setVoiceSpeed((prev) => (prev === 0.70 ? 0.85 : 0.70))}
                title="تعديل سرعة نطق الصوت"
                style={{
                  background: voiceSpeed === 0.70 ? "rgba(0, 229, 255, 0.12)" : "rgba(255, 255, 255, 0.08)",
                  border: voiceSpeed === 0.70 ? "1px solid rgba(0, 229, 255, 0.4)" : "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: 6,
                  color: voiceSpeed === 0.70 ? "#00e5ff" : "#b0bec5",
                  fontSize: "0.65rem",
                  padding: "2px 8px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                }}
              >
                {voiceSpeed === 0.70 ? "🐢 السرعة: بطيء وهادئ (0.7x)" : "⚡ السرعة: عادي (0.85x)"}
              </button>

              {dialogueTurns.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDialogueTurns([])}
                  style={{
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: 6,
                    color: "#90a4ae",
                    fontSize: "0.65rem",
                    padding: "2px 8px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#ffffff";
                    e.currentTarget.style.borderColor = "rgba(0, 229, 255, 0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#90a4ae";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                  }}
                >
                  مسح / Clear
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Dialogue List */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              padding: "14px 16px",
              overflowY: "auto",
              flex: 1,
            }}
          >
            {dialogueTurns.map((turn) => {
              const isUser = turn.role === "user";
              const isArabic = /[\u0600-\u06FF]/.test(turn.text);

              return (
                <div
                  key={turn.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                    padding: "11px 15px",
                    background: isUser
                      ? "rgba(0, 229, 255, 0.07)"
                      : "rgba(245, 166, 35, 0.07)",
                    borderLeft: !isArabic
                      ? `3px solid ${isUser ? "#00e5ff" : "#f5a623"}`
                      : "1px solid " + (isUser ? "rgba(0, 229, 255, 0.2)" : "rgba(245, 166, 35, 0.2)"),
                    borderRight: isArabic
                      ? `3px solid ${isUser ? "#00e5ff" : "#f5a623"}`
                      : "1px solid " + (isUser ? "rgba(0, 229, 255, 0.2)" : "rgba(245, 166, 35, 0.2)"),
                    borderTop: "1px solid " + (isUser ? "rgba(0, 229, 255, 0.15)" : "rgba(245, 166, 35, 0.15)"),
                    borderBottom: "1px solid " + (isUser ? "rgba(0, 229, 255, 0.15)" : "rgba(245, 166, 35, 0.15)"),
                    borderRadius: 12,
                    boxShadow: isUser
                      ? "0 4px 16px rgba(0, 229, 255, 0.05)"
                      : "0 4px 16px rgba(245, 166, 35, 0.05)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "0.68rem",
                      fontFamily: "var(--font-mono, monospace)",
                      letterSpacing: "0.06em",
                      fontWeight: 700,
                      direction: "ltr",
                    }}
                  >
                    <span
                      style={{
                        color: isUser ? "#00e5ff" : "#ffd080",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>{isUser ? "👤" : "⚡"}</span>
                      <span>{isUser ? "أمير مصطفى (أنت) • AMEER MUSTAFA" : "نواة إبيكس • APEX CORE"}</span>
                    </span>
                    <span style={{ color: "rgba(255, 255, 255, 0.35)", fontWeight: 400 }}>
                      {turn.timestamp}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: "0.96rem",
                      lineHeight: "1.6",
                      color: isUser ? "#ffffff" : "#f0f6fc",
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                      direction: isArabic ? "rtl" : "ltr",
                      textAlign: isArabic ? "right" : "left",
                    }}
                  >
                    {turn.text}
                  </div>
                </div>
              );
            })}

            {/* Thinking pulse block inside dialogue */}
            {orbState === "thinking" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  background: "rgba(245, 166, 35, 0.06)",
                  border: "1px dashed rgba(245, 166, 35, 0.35)",
                  borderRadius: 12,
                  color: "#ffd080",
                  fontSize: "0.85rem",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "#ffd080",
                    boxShadow: "0 0 10px #ffd080",
                    display: "inline-block",
                  }}
                />
                <span>APEX يفكر ويحلل البيانات... • Formulating response...</span>
              </div>
            )}

            <div ref={dialogueEndRef} />
          </div>
        </div>
      )}

      {/* equalizer + STANDBY cluster */}
      <OrbStatusBar state={orbState} />

      {selected && <AgentOverview sel={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
