import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Send, User, Sparkles, X, Eraser, Loader2, PanelRightClose } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AI_MODELS, DEFAULT_AI_MODEL } from "@/lib/aiModels";

export { AI_MODELS } from "@/lib/aiModels";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUERIES = [
  "Quantos incidentes P1 estão abertos?",
  "Qual o MTTR médio das últimas 24h?",
  "SLA está dentro da meta?",
  "Quais serviços estão degradados?",
  "Resumo operacional do dia",
];

// AI_MODELS importado da fonte única em @/lib/aiModels (re-exportado acima para retro-compat).

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

async function streamChat({
  messages,
  model,
  onDelta,
  onDone,
  onError,
}: {
  messages: { role: string; content: string }[];
  model: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, model }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({ error: "Erro de conexão" }));
    onError(data.error || `Erro ${resp.status}`);
    return;
  }

  if (!resp.body) {
    onError("Sem corpo na resposta");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  // Final flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

interface AIChatConsoleProps {
  onClose?: () => void;
}

export function AIChatConsole({ onClose }: AIChatConsoleProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Olá! Sou o **DISPH AI Assistant** powered by Lovable AI. Posso ajudar com consultas sobre incidentes, métricas de SLA, MTTR, disponibilidade e muito mais. O que deseja saber?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_AI_MODEL);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (text?: string) => {
    const query = text || input.trim();
    if (!query || isTyping) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.id !== "welcome") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: assistantSoFar,
            timestamp: new Date(),
          },
        ];
      });
    };

    const chatHistory = [...messages.filter(m => m.id !== "welcome"), userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      await streamChat({
        messages: chatHistory,
        model: selectedModel,
        onDelta: upsertAssistant,
        onDone: () => setIsTyping(false),
        onError: (err) => {
          toast.error(err);
          setIsTyping(false);
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na comunicação com a IA");
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Chat limpo. Como posso ajudar?",
        timestamp: new Date(),
      },
    ]);
  };

  const currentModel = AI_MODELS.find(m => m.id === selectedModel);

  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur flex flex-col h-full rounded-none border-0 border-l">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-accent" />
            </div>
            <div>
              <CardTitle className="text-sm">DISPH AI Assistant</CardTitle>
              <p className="text-[10px] text-muted-foreground font-mono">
                {currentModel?.label} · Lovable AI
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-7 w-[130px] text-[10px] font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[8px] px-1 py-0">
                        {m.tier}
                      </Badge>
                      {m.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearChat} title="Limpar chat">
              <Eraser className="h-3.5 w-3.5" />
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} title="Ocultar assistente">
                <PanelRightClose className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 p-3 pt-0 min-h-0">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="h-6 w-6 rounded-md bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-accent" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                  msg.role === "user"
                    ? "bg-primary/20 text-foreground"
                    : "bg-secondary/60 text-foreground"
                }`}
              >
                <div className="prose prose-invert prose-xs max-w-none [&_table]:text-[10px] [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_h2]:text-xs [&_h2]:mt-0 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:mt-1 [&_h3]:mb-0.5 [&_p]:my-0.5 [&_li]:my-0 [&_ul]:my-0.5 [&_ol]:my-0.5 [&_code]:text-accent [&_code]:bg-muted/40 [&_code]:px-1 [&_code]:rounded">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                <p className="text-[9px] text-muted-foreground mt-1 font-mono">
                  {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {msg.role === "user" && (
                <div className="h-6 w-6 rounded-md bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
            </div>
          ))}

          {isTyping && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-2 items-start">
              <div className="h-6 w-6 rounded-md bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Loader2 className="h-3.5 w-3.5 text-accent animate-spin" />
              </div>
              <div className="bg-secondary/60 rounded-lg px-3 py-2">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUERIES.map((q) => (
              <Badge
                key={q}
                variant="outline"
                className="cursor-pointer hover:bg-accent/20 hover:border-accent/40 transition-colors text-[10px] py-0.5"
                onClick={() => handleSend(q)}
              >
                {q}
              </Badge>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2 flex-shrink-0">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre incidentes, métricas, SLA..."
            className="text-xs h-8 bg-secondary/40 border-border/40"
            disabled={isTyping}
          />
          <Button
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
