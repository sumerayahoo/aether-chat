import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Send } from "lucide-react";

type Role = "user" | "assistant";
interface Message {
  role: Role;
  content: string;
  ts: string;
}
interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

const STORAGE_KEY = "aether_sessions";
const SUGGESTIONS = [
  "Quantum entanglement, simplified",
  "Haiku: city at night",
  "Top languages of 2025",
  "Minimalist morning routine",
];

function formatTime(d = new Date()) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatContent(text: string) {
  let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) => `<pre><code>${code.trim()}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/^[-•]\s(.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*<\/li>)/, "<ul>$1</ul>");
  html = html.replace(/\n\n+/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");
  if (!html.startsWith("<pre") && !html.startsWith("<ul")) html = `<p>${html}</p>`;
  return html;
}

const Index = () => {
  const [sessions, setSessions] = useState<Session[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (sessions.length === 0) {
      const s: Session = { id: Date.now().toString(), title: "New conversation", messages: [], createdAt: new Date().toISOString() };
      setSessions([s]);
      setCurrentId(s.id);
    } else if (!currentId) {
      setCurrentId(sessions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [currentId, sessions, isLoading]);

  const current = sessions.find((s) => s.id === currentId) ?? null;

  const newSession = () => {
    const s: Session = { id: Date.now().toString(), title: "New conversation", messages: [], createdAt: new Date().toISOString() };
    setSessions((prev) => [s, ...prev]);
    setCurrentId(s.id);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || !current) return;

    const userMsg: Message = { role: "user", content: trimmed, ts: formatTime() };
    const updatedMsgs = [...current.messages, userMsg];
    const newTitle = current.messages.length === 0 ? trimmed.slice(0, 42) + (trimmed.length > 42 ? "…" : "") : current.title;

    setSessions((prev) => prev.map((s) => (s.id === current.id ? { ...s, messages: updatedMsgs, title: newTitle } : s)));
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: { messages: updatedMsgs.map(({ role, content }) => ({ role, content })) },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const replyText = (data as any)?.text ?? "";
      const aiMsg: Message = { role: "assistant", content: replyText, ts: formatTime() };
      setSessions((prev) => prev.map((s) => (s.id === current.id ? { ...s, messages: [...updatedMsgs, aiMsg] } : s)));
    } catch (err: any) {
      const msg = err?.message || "Failed to reach Aether";
      toast.error(msg);
      const aiMsg: Message = { role: "assistant", content: `Error: ${msg}`, ts: formatTime() };
      setSessions((prev) => prev.map((s) => (s.id === current.id ? { ...s, messages: [...updatedMsgs, aiMsg] } : s)));
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const isEmpty = !current || current.messages.length === 0;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex w-[260px] min-w-[260px] flex-col bg-[hsl(var(--surface))] border-r border-border py-6">
        <div className="px-5 pb-5 border-b border-border">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-head italic text-[28px] text-[hsl(var(--accent))] leading-none">Æ</span>
            <span className="font-head font-bold text-xl tracking-tight">Aether</span>
          </div>
          <span className="text-[10px] text-[hsl(var(--text-dim))] tracking-[0.12em] uppercase">AI · Powered by Gemini</span>
        </div>

        <button
          onClick={newSession}
          className="mx-4 mt-4 flex items-center gap-2 px-3.5 py-2.5 accent-lo accent-border-lo border rounded-[10px] text-[hsl(var(--accent))] text-xs tracking-wider hover:bg-[hsl(var(--accent)/0.2)] hover:border-[hsl(var(--accent)/0.4)] transition-all"
        >
          <Plus size={14} />
          New Conversation
        </button>

        <div className="flex-1 px-4 pt-5 overflow-y-auto">
          <span className="block text-[9px] tracking-[0.16em] uppercase text-[hsl(var(--text-dim))] mb-2.5">Recent</span>
          <ul className="flex flex-col gap-0.5">
            {sessions.map((s) => (
              <li
                key={s.id}
                onClick={() => setCurrentId(s.id)}
                className={`px-2.5 py-2 rounded-md cursor-pointer text-xs truncate border transition-all ${
                  s.id === currentId
                    ? "accent-lo border-[hsl(var(--accent)/0.2)] text-[hsl(var(--accent))]"
                    : "text-[hsl(var(--text-mid))] border-transparent hover:bg-[hsl(var(--border))] hover:text-foreground"
                }`}
              >
                {s.title}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto px-5 pt-4 border-t border-border flex items-center gap-2 text-[11px] text-[hsl(var(--text-dim))]">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.4)] animate-pulse-dot" />
          Gemini 3 Flash
        </div>
      </aside>

      {/* Chat */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-background">
        <div className="absolute inset-0 grid-bg pointer-events-none z-0" />

        {isEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-10 text-center z-[1]">
            <div className="font-head italic text-[64px] text-[hsl(var(--accent))] opacity-35 leading-none mb-2">Æ</div>
            <h1 className="font-head text-[36px] tracking-tight">What's on your mind?</h1>
            <p className="text-[hsl(var(--text-dim))] text-[13px] max-w-[340px]">
              Ask anything. Aether listens, reasons, and responds.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-5 max-w-[560px]">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="px-4 py-2 bg-[hsl(var(--surface))] border border-[hsl(var(--border-hi))] rounded-full text-[hsl(var(--text-mid))] font-body text-[11px] tracking-wide hover:bg-[hsl(var(--border))] hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--accent))] transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesRef} className="flex-1 overflow-y-auto pt-8 pb-5 flex flex-col relative z-[1] scroll-smooth">
          {current?.messages.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <div
                key={i}
                className={`flex gap-4 px-10 py-5 max-w-[860px] mx-auto w-full animate-fade-slide-in ${isUser ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 font-head italic text-[13px] text-[hsl(var(--accent))] ${
                    isUser ? "accent-lo border accent-border-lo" : "bg-[hsl(var(--surface))] border border-[hsl(var(--border-hi))]"
                  }`}
                >
                  {isUser ? "U" : "Æ"}
                </div>
                <div className={`flex-1 ${isUser ? "max-w-[520px]" : "max-w-[680px]"}`}>
                  {isUser ? (
                    <div className="bg-[hsl(var(--user-bg))] border border-[hsl(var(--border-hi))] rounded-[10px] px-4 py-3 text-[13.5px] leading-[1.7] break-words">
                      {m.content}
                    </div>
                  ) : (
                    <div
                      className="text-[14px] leading-[1.8] break-words [&_strong]:text-[hsl(var(--accent))] [&_code]:bg-[hsl(var(--surface))] [&_code]:border [&_code]:border-[hsl(var(--border-hi))] [&_code]:rounded [&_code]:px-1.5 [&_code]:py-px [&_code]:text-xs [&_code]:text-[hsl(var(--accent))] [&_pre]:bg-[hsl(var(--surface))] [&_pre]:border [&_pre]:border-[hsl(var(--border-hi))] [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:border-0 [&_pre_code]:p-0 [&_pre_code]:text-foreground [&_ul]:ml-5 [&_ul]:my-2 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1 [&_li]:marker:text-[hsl(var(--accent))] [&_p]:my-1.5"
                      dangerouslySetInnerHTML={{ __html: formatContent(m.content) }}
                    />
                  )}
                  <div className={`text-[10px] text-[hsl(var(--text-dim))] mt-1.5 tracking-wider ${isUser ? "text-right" : ""}`}>
                    {m.ts}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-4 px-10 py-5 max-w-[860px] mx-auto w-full">
              <div className="w-7 h-7 rounded-md flex items-center justify-center bg-[hsl(var(--surface))] border border-[hsl(var(--border-hi))] font-head italic text-[13px] text-[hsl(var(--accent))] mt-0.5">
                Æ
              </div>
              <div className="flex gap-1 items-center pt-3.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent))] animate-typing-dot" />
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent))] animate-typing-dot" style={{ animationDelay: "0.15s" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent))] animate-typing-dot" style={{ animationDelay: "0.3s" }} />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-10 pt-4 pb-6 relative z-[2] max-w-[860px] w-full mx-auto bg-gradient-to-t from-background via-background to-transparent">
          <div className="flex items-end gap-2.5 bg-[hsl(var(--surface))] border border-[hsl(var(--border-hi))] rounded-xl pl-4 pr-3 py-3 focus-within:border-[hsl(var(--accent)/0.4)] focus-within:shadow-[0_0_0_3px_hsl(var(--accent)/0.06)] transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Message Aether…"
              rows={1}
              className="flex-1 bg-transparent border-0 outline-none text-foreground font-body text-[13.5px] leading-[1.6] resize-none max-h-[180px] overflow-y-auto placeholder:text-[hsl(var(--text-dim))]"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--primary-foreground))] flex items-center justify-center flex-shrink-0 transition-all hover:bg-[hsl(var(--accent-hi))] hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
          <div className="text-[10px] text-[hsl(var(--text-dim))] text-center mt-2.5 tracking-wide">
            Aether can make mistakes. Verify important information.
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
