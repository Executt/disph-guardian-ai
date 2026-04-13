import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, User, Sparkles, X, Maximize2, Minimize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

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

// Simulated AI responses based on keywords
function generateMockResponse(query: string): string {
  const q = query.toLowerCase();

  if (q.includes("p1") || q.includes("crítico") || q.includes("critico")) {
    return `## Incidentes P1 — Críticos

Atualmente existem **3 incidentes P1** abertos:

| ID | Serviço | Ambiente | Duração |
|---|---|---|---|
| INC-2847 | API Gateway | AWS | 23 min |
| INC-2851 | DB Primary | On-Premise | 14 min |
| INC-2853 | Auth Service | OCI | 8 min |

⚠️ **Recomendação**: O INC-2847 já ultrapassou o threshold de 20 min. Considere escalar para o time de plantão.`;
  }

  if (q.includes("mttr")) {
    return `## MTTR — Mean Time to Resolve

O MTTR médio das últimas **24 horas** é de **18 minutos**.

- 🟢 **AWS**: 14 min (melhor performance)
- 🟡 **OCI**: 21 min
- 🔴 **On-Premise**: 22 min

📈 **Tendência**: Redução de **12%** em relação à semana anterior. O maior ganho veio da automação de rollback via Ansible nos clusters EKS.`;
  }

  if (q.includes("sla")) {
    return `## SLA Compliance

O SLA consolidado atual é de **97.2%** (meta: 99.0%).

| Ambiente | SLA | Status |
|---|---|---|
| AWS | 98.1% | 🟡 Próximo da meta |
| OCI | 96.8% | 🔴 Abaixo da meta |
| On-Premise | 96.5% | 🔴 Abaixo da meta |

⚠️ O ambiente **On-Premise** é o maior detrator. Os incidentes no cluster OpenShift impactaram 2.1% do SLA nas últimas 6h.`;
  }

  if (q.includes("degradad") || q.includes("serviço") || q.includes("servico") || q.includes("disponibilidade")) {
    return `## Serviços Degradados

Neste momento, **2 serviços** apresentam degradação:

1. **Cache Redis** (On-Premise) — Uptime: 99.52%
   - Latência elevada (p99: 45ms vs baseline 12ms)
   - Causa provável: memory pressure no nó worker-03

2. **MQ Kafka** (OCI) — Uptime: 99.61%
   - Consumer lag crescente no tópico \`events.incidents\`
   - 3 partições com rebalanceamento pendente

Todos os demais serviços operam com uptime > 99.90%.`;
  }

  if (q.includes("resumo") || q.includes("operacional") || q.includes("dia") || q.includes("geral")) {
    return `## 📋 Resumo Operacional — ${new Date().toLocaleDateString("pt-BR")}

### Incidentes
- **47** incidentes ativos (3 P1, 8 P2, 16 P3, 20 P4)
- **32** incidentes resolvidos nas últimas 24h
- MTTR médio: **18 min** (↓12% vs semana anterior)

### Disponibilidade
- Uptime global: **99.94%**
- SLA compliance: **97.2%** (⚠️ abaixo da meta de 99%)

### Destaques
- ✅ Automação Ansible resolveu 8 incidentes sem intervenção humana
- ⚠️ Cluster OCP On-Premise com 3 pods em CrashLoopBackOff
- 🔄 Deploy v2.14.3 do API Gateway agendado para 22:00

### Recomendações
1. Escalar INC-2847 (P1 > 20 min)
2. Investigar memory pressure no Redis On-Premise
3. Verificar consumer lag no Kafka OCI`;
  }

  if (q.includes("incidente") || q.includes("aberto")) {
    return `## Incidentes Ativos

Total: **47 incidentes** distribuídos por severidade:

- 🔴 **P1 Crítico**: 3 incidentes
- 🟠 **P2 Alto**: 8 incidentes  
- 🟡 **P3 Médio**: 16 incidentes
- ⚪ **P4 Baixo**: 20 incidentes

**Por ambiente:**
- AWS: 18 | OCI: 15 | On-Premise: 14

Os 3 incidentes P1 requerem atenção imediata. Deseja que eu detalhe algum deles?`;
  }

  return `Analisei sua consulta: "*${query}*"

Com base nos dados operacionais atuais:

- **47** incidentes ativos nos 3 ambientes
- SLA consolidado em **97.2%**
- MTTR médio de **18 minutos**
- Disponibilidade global: **99.94%**

Posso detalhar qualquer métrica específica. Experimente perguntar sobre:
- Incidentes por severidade ou ambiente
- Tendências de SLA e MTTR
- Serviços degradados
- Resumo operacional completo`;
}

interface AIChatConsoleProps {
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function AIChatConsole({ expanded = false, onToggleExpand }: AIChatConsoleProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Olá! Sou o **DISPH AI Assistant**. Posso ajudar com consultas sobre incidentes, métricas de SLA, MTTR, disponibilidade e muito mais. O que deseja saber?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

    // Simulate AI thinking delay
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));

    const response = generateMockResponse(query);
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: response,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMsg]);
    setIsTyping(false);
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

  return (
    <Card className={`border-border/60 bg-card/80 backdrop-blur flex flex-col ${expanded ? "h-[80vh]" : "h-[500px]"}`}>
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-accent" />
            </div>
            <div>
              <CardTitle className="text-sm">DISPH AI Assistant</CardTitle>
              <p className="text-[10px] text-muted-foreground font-mono">Consultas em linguagem natural</p>
            </div>
          </div>
          <div className="flex gap-1">
            {onToggleExpand && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleExpand}>
                {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearChat}>
              <X className="h-3.5 w-3.5" />
            </Button>
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

          {isTyping && (
            <div className="flex gap-2 items-start">
              <div className="h-6 w-6 rounded-md bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Bot className="h-3.5 w-3.5 text-accent animate-pulse" />
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
            ref={inputRef}
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
