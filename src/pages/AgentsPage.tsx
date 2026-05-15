import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Bot, Plus, Zap, Workflow, ShieldCheck, Activity, Trash2 } from "lucide-react";
import { ROLE_FOCUSES, AI_MODELS } from "@/lib/agentSkills";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "paused" | "archived";
  autonomy_level: "manual" | "supervised" | "autonomous";
  area: string | null;
  updated_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-muted",
  active: "bg-accent/15 text-accent border-accent/30",
  paused: "bg-warning/15 text-warning border-warning/30",
  archived: "bg-destructive/10 text-destructive border-destructive/30",
};

const AUTONOMY_STYLES: Record<string, string> = {
  manual: "bg-secondary/60 text-foreground/80",
  supervised: "bg-primary/15 text-primary border border-primary/30",
  autonomous: "bg-accent/15 text-accent border border-accent/30",
};

export default function AgentsPage() {
  const { user } = useAuth();
  const canEdit = user?.roles?.some((r) => r === "admin" || r === "operator");
  const isAdmin = user?.roles?.includes("admin");

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    area: "general",
    autonomy_level: "manual" as Agent["autonomy_level"],
    model: "google/gemini-2.5-flash",
  });

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar agentes", description: error.message, variant: "destructive" });
    else setAgents((data ?? []) as Agent[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createAgent() {
    if (!form.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    const { data: agent, error } = await supabase
      .from("agents")
      .insert({
        name: form.name.trim(),
        description: form.description.trim() || null,
        area: form.area,
        autonomy_level: form.autonomy_level,
        status: "draft",
      })
      .select()
      .single();
    if (error || !agent) {
      toast({ title: "Erro ao criar agente", description: error?.message, variant: "destructive" });
      return;
    }
    await supabase.from("agent_profiles").insert({
      agent_id: agent.id,
      model: form.model,
      role_focus: form.area,
      system_prompt: `Você é o agente "${form.name}" especializado em ${form.area}. Atue de forma técnica, objetiva e siga as políticas de segurança do órgão.`,
    });
    toast({ title: "Agente criado", description: `${agent.name} foi criado como rascunho.` });
    setOpen(false);
    setForm({ name: "", description: "", area: "general", autonomy_level: "manual", model: "google/gemini-2.5-flash" });
    load();
  }

  async function removeAgent(id: string) {
    if (!confirm("Excluir este agente e todo o seu histórico?")) return;
    const { error } = await supabase.from("agents").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Agente excluído" }); load(); }
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold heading flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" /> Agentes IA
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre, parametrize e opere agentes autônomos com canais de interação humana (Teams, WhatsApp, Telegram).
          </p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Novo agente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Novo agente</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex: SRE Sentinel" />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="O que esse agente faz?" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Área de atuação</Label>
                    <Select value={form.area} onValueChange={(v) => setForm({ ...form, area: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_FOCUSES.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Autonomia</Label>
                    <Select value={form.autonomy_level} onValueChange={(v) => setForm({ ...form, autonomy_level: v as Agent["autonomy_level"] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="supervised">Supervisionado</SelectItem>
                        <SelectItem value="autonomous">Autônomo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Modelo base</Label>
                  <Select value={form.model} onValueChange={(v) => setForm({ ...form, model: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AI_MODELS.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.label} <span className="text-muted-foreground ml-1">· {m.tier}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={createAgent}>Criar agente</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </header>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando agentes…</div>
      ) : agents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <Bot className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum agente cadastrado ainda.</p>
            {canEdit && <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Criar o primeiro agente</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((a) => (
            <Card key={a.id} className="group hover:border-primary/40 transition-colors">
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <Link to={`/agents/${a.id}`} className="font-semibold heading hover:text-primary">{a.name}</Link>
                    <div className="text-[11px] font-mono text-muted-foreground uppercase mt-0.5">
                      {ROLE_FOCUSES.find((r) => r.id === a.area)?.label ?? a.area ?? "—"}
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                    onClick={() => removeAgent(a.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                  {a.description ?? "Sem descrição."}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className={`text-[10px] uppercase font-mono ${STATUS_STYLES[a.status]}`}>{a.status}</Badge>
                  <Badge variant="outline" className={`text-[10px] uppercase font-mono ${AUTONOMY_STYLES[a.autonomy_level]}`}>
                    {a.autonomy_level === "manual" ? "manual" : a.autonomy_level === "supervised" ? "supervisionado" : "autônomo"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/60">
                  <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> {new Date(a.updated_at).toLocaleString("pt-BR")}</span>
                  <Link to={`/agents/${a.id}`} className="text-primary hover:underline">Configurar →</Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-secondary/30 border-border/60">
        <CardContent className="py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Modelos IA conectados</div>
          <div className="flex items-center gap-2"><Workflow className="h-4 w-4 text-accent" /> Skills do registry backend</div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-warning" /> Aprovação humana opcional</div>
          <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-muted-foreground" /> Logs auditáveis (LGPD)</div>
        </CardContent>
      </Card>
    </div>
  );
}
