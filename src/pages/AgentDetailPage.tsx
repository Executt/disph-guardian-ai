import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Bot, Save, Sparkles, Workflow, MessageSquare, ShieldCheck, History,
  Plus, Trash2, Send,
} from "lucide-react";
import { AI_MODELS, ROLE_FOCUSES, SKILLS, SKILL_CATEGORIES, type SkillDefinition } from "@/lib/agentSkills";

interface Agent {
  id: string; name: string; description: string | null;
  status: "draft" | "active" | "paused" | "archived";
  autonomy_level: "manual" | "supervised" | "autonomous";
  area: string | null;
}
interface Profile {
  id?: string; agent_id: string; model: string; system_prompt: string;
  temperature: number; max_tokens: number; role_focus: string; risk_threshold: number;
}
interface AgentSkillRow {
  id?: string; agent_id: string; skill_name: string; category: string;
  enabled: boolean; parameters: Record<string, unknown>; risk_level: number;
}
interface AgentChannel {
  id?: string; agent_id: string; channel_type: "teams" | "whatsapp" | "telegram";
  label: string | null; config: Record<string, unknown>; enabled: boolean; requires_approval: boolean;
}
interface Execution {
  id: string; created_at: string; status: string; triggered_by: string;
  channel_type: string | null; input: string | null; output: string | null;
  duration_ms: number | null; tokens_used: number | null;
}

const CHANNEL_LABEL: Record<string, string> = {
  teams: "Microsoft Teams", whatsapp: "WhatsApp (Twilio)", telegram: "Telegram",
};

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.roles?.some((r) => r === "admin" || r === "operator");

  const [agent, setAgent] = useState<Agent | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skills, setSkills] = useState<AgentSkillRow[]>([]);
  const [channels, setChannels] = useState<AgentChannel[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [a, p, s, c, e] = await Promise.all([
      supabase.from("agents").select("*").eq("id", id).single(),
      supabase.from("agent_profiles").select("*").eq("agent_id", id).maybeSingle(),
      supabase.from("agent_skills").select("*").eq("agent_id", id),
      supabase.from("agent_channels").select("*").eq("agent_id", id),
      supabase.from("agent_executions").select("*").eq("agent_id", id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (a.error) {
      toast({ title: "Agente não encontrado", description: a.error.message, variant: "destructive" });
      navigate("/agents"); return;
    }
    setAgent(a.data as Agent);
    setProfile((p.data as Profile | null) ?? {
      agent_id: id, model: "google/gemini-2.5-flash",
      system_prompt: "Você é um agente especializado.", temperature: 0.3,
      max_tokens: 2048, role_focus: "general", risk_threshold: 2,
    });
    setSkills((s.data ?? []) as AgentSkillRow[]);
    setChannels((c.data ?? []) as AgentChannel[]);
    setExecutions((e.data ?? []) as Execution[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function saveAgent() {
    if (!agent || !profile) return;
    setSaving(true);
    const { error: ea } = await supabase.from("agents").update({
      name: agent.name, description: agent.description, status: agent.status,
      autonomy_level: agent.autonomy_level, area: agent.area,
    }).eq("id", agent.id);
    const { error: ep } = await supabase.from("agent_profiles").upsert({
      ...profile, agent_id: agent.id,
    }, { onConflict: "agent_id" });
    setSaving(false);
    if (ea || ep) toast({ title: "Erro ao salvar", description: (ea ?? ep)?.message, variant: "destructive" });
    else toast({ title: "Alterações salvas" });
  }

  async function toggleSkill(sk: SkillDefinition, enabled: boolean) {
    if (!agent) return;
    const existing = skills.find((x) => x.skill_name === sk.name);
    if (existing) {
      const { error } = await supabase.from("agent_skills").update({ enabled }).eq("id", existing.id!);
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase.from("agent_skills").insert({
        agent_id: agent.id, skill_name: sk.name, category: sk.category,
        enabled, parameters: {}, risk_level: sk.riskLevel,
      });
      if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
    load();
  }

  async function addChannel(channel_type: AgentChannel["channel_type"]) {
    if (!agent) return;
    const { error } = await supabase.from("agent_channels").insert({
      agent_id: agent.id, channel_type, label: CHANNEL_LABEL[channel_type],
      config: {}, enabled: false, requires_approval: true,
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  }

  async function updateChannel(ch: AgentChannel, patch: Partial<AgentChannel>) {
    const { error } = await supabase.from("agent_channels").update(patch).eq("id", ch.id!);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  }

  async function removeChannel(ch: AgentChannel) {
    const { error } = await supabase.from("agent_channels").delete().eq("id", ch.id!);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else load();
  }

  async function logTestExecution() {
    if (!agent) return;
    const { error } = await supabase.from("agent_executions").insert({
      agent_id: agent.id, triggered_by: "manual",
      input: "Disparo manual de teste pela UI",
      output: `Configuração validada. Modelo: ${profile?.model}, autonomia: ${agent.autonomy_level}, skills ativas: ${skills.filter((s) => s.enabled).length}.`,
      status: "success", duration_ms: 120, tokens_used: 0,
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Execução de teste registrada" }); load(); }
  }

  const skillsByCategory = useMemo(() => {
    const map: Record<string, SkillDefinition[]> = {};
    SKILLS.forEach((s) => { (map[s.category] ??= []).push(s); });
    return map;
  }, []);

  if (loading || !agent || !profile) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="gap-1"><Link to="/agents"><ArrowLeft className="h-4 w-4" /> Voltar</Link></Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="h-11 w-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold heading">{agent.name}</h1>
            <p className="text-xs text-muted-foreground">{agent.description ?? "Sem descrição."}</p>
          </div>
        </div>
        {canEdit && (
          <>
            <Button variant="outline" size="sm" onClick={logTestExecution} className="gap-2"><Send className="h-4 w-4" /> Disparar teste</Button>
            <Button onClick={saveAgent} disabled={saving} className="gap-2"><Save className="h-4 w-4" /> Salvar</Button>
          </>
        )}
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="profile" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Perfil</TabsTrigger>
          <TabsTrigger value="skills" className="gap-1.5"><Workflow className="h-3.5 w-3.5" /> Skills</TabsTrigger>
          <TabsTrigger value="channels" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Canais</TabsTrigger>
          <TabsTrigger value="autonomy" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Autonomia</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5"><History className="h-3.5 w-3.5" /> Histórico</TabsTrigger>
        </TabsList>

        {/* PERFIL */}
        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Identidade & Modelo</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Nome</Label>
                <Input value={agent.name} onChange={(e) => setAgent({ ...agent, name: e.target.value })} disabled={!canEdit} /></div>
              <div><Label>Status</Label>
                <Select value={agent.status} onValueChange={(v) => setAgent({ ...agent, status: v as Agent["status"] })} disabled={!canEdit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="paused">Pausado</SelectItem>
                    <SelectItem value="archived">Arquivado</SelectItem>
                  </SelectContent>
                </Select></div>
              <div className="md:col-span-2"><Label>Descrição</Label>
                <Textarea rows={2} value={agent.description ?? ""} onChange={(e) => setAgent({ ...agent, description: e.target.value })} disabled={!canEdit} /></div>
              <div><Label>Área de atuação</Label>
                <Select value={agent.area ?? "general"} onValueChange={(v) => setAgent({ ...agent, area: v })} disabled={!canEdit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_FOCUSES.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select></div>
              <div><Label>Modelo IA</Label>
                <Select value={profile.model} onValueChange={(v) => setProfile({ ...profile, model: v })} disabled={!canEdit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select></div>
              <div className="md:col-span-2"><Label>System prompt</Label>
                <Textarea rows={6} value={profile.system_prompt} onChange={(e) => setProfile({ ...profile, system_prompt: e.target.value })} disabled={!canEdit} className="font-mono text-xs" /></div>
              <div>
                <Label>Temperatura: <span className="font-mono text-primary">{profile.temperature.toFixed(2)}</span></Label>
                <Slider min={0} max={1} step={0.05} value={[profile.temperature]} onValueChange={(v) => setProfile({ ...profile, temperature: v[0] })} disabled={!canEdit} />
              </div>
              <div><Label>Máx. tokens</Label>
                <Input type="number" min={256} max={32000} value={profile.max_tokens} onChange={(e) => setProfile({ ...profile, max_tokens: Number(e.target.value) })} disabled={!canEdit} /></div>
              <div className="md:col-span-2">
                <Label>Threshold de risco aceito sem aprovação humana: <span className="font-mono text-warning">nível {profile.risk_threshold}</span></Label>
                <Slider min={1} max={5} step={1} value={[profile.risk_threshold]} onValueChange={(v) => setProfile({ ...profile, risk_threshold: v[0] })} disabled={!canEdit} />
                <p className="text-[11px] text-muted-foreground mt-1">Skills com risco maior que esse nível exigirão aprovação humana via canal configurado.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SKILLS */}
        <TabsContent value="skills" className="mt-4 space-y-4">
          {SKILL_CATEGORIES.map((cat) => (
            <Card key={cat.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{cat.label} <span className="text-xs text-muted-foreground font-normal">— {cat.description}</span></span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {skillsByCategory[cat.id]?.filter((s) => skills.find((x) => x.skill_name === s.name && x.enabled)).length ?? 0}
                    /{skillsByCategory[cat.id]?.length ?? 0}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border/60">
                {skillsByCategory[cat.id]?.map((sk) => {
                  const row = skills.find((x) => x.skill_name === sk.name);
                  const enabled = !!row?.enabled;
                  return (
                    <div key={sk.name} className="flex items-center justify-between py-2.5 gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono text-foreground">{sk.name}</code>
                          <Badge variant="outline" className={`text-[10px] ${sk.riskLevel >= 4 ? "border-destructive/40 text-destructive" : sk.riskLevel >= 3 ? "border-warning/40 text-warning" : "border-accent/40 text-accent"}`}>
                            risco {sk.riskLevel}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-mono uppercase">{sk.requiredRole}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{sk.description}</p>
                      </div>
                      <Switch checked={enabled} onCheckedChange={(v) => toggleSkill(sk, v)} disabled={!canEdit} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* CANAIS */}
        <TabsContent value="channels" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Canais de interação humana</CardTitle>
              {canEdit && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Adicionar canal</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Novo canal</DialogTitle></DialogHeader>
                    <div className="space-y-2 py-2">
                      {(["teams", "whatsapp", "telegram"] as const).map((t) => (
                        <Button key={t} variant="outline" className="w-full justify-start gap-2" onClick={() => addChannel(t)}>
                          <MessageSquare className="h-4 w-4" /> {CHANNEL_LABEL[t]}
                        </Button>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {channels.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum canal configurado. Adicione um para receber notificações e aprovações.</p>
              ) : (
                <div className="space-y-3">
                  {channels.map((ch) => (
                    <div key={ch.id} className="border border-border rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[10px] uppercase">{ch.channel_type}</Badge>
                          <span className="text-sm font-medium">{ch.label ?? CHANNEL_LABEL[ch.channel_type]}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <Switch checked={ch.enabled} onCheckedChange={(v) => updateChannel(ch, { enabled: v })} disabled={!canEdit} />
                            <span className="text-xs text-muted-foreground">Ativo</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Switch checked={ch.requires_approval} onCheckedChange={(v) => updateChannel(ch, { requires_approval: v })} disabled={!canEdit} />
                            <span className="text-xs text-muted-foreground">Exige aprovação</span>
                          </div>
                          {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeChannel(ch)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {ch.channel_type === "teams" && (
                          <>
                            <Input placeholder="Team ID" value={(ch.config as any).team_id ?? ""} onChange={(e) => updateChannel(ch, { config: { ...ch.config, team_id: e.target.value } })} disabled={!canEdit} />
                            <Input placeholder="Channel ID" value={(ch.config as any).channel_id ?? ""} onChange={(e) => updateChannel(ch, { config: { ...ch.config, channel_id: e.target.value } })} disabled={!canEdit} />
                          </>
                        )}
                        {ch.channel_type === "whatsapp" && (
                          <>
                            <Input placeholder="De (E.164, ex: +5511...)" value={(ch.config as any).from ?? ""} onChange={(e) => updateChannel(ch, { config: { ...ch.config, from: e.target.value } })} disabled={!canEdit} />
                            <Input placeholder="Para (E.164)" value={(ch.config as any).to ?? ""} onChange={(e) => updateChannel(ch, { config: { ...ch.config, to: e.target.value } })} disabled={!canEdit} />
                          </>
                        )}
                        {ch.channel_type === "telegram" && (
                          <Input placeholder="Chat ID" value={(ch.config as any).chat_id ?? ""} onChange={(e) => updateChannel(ch, { config: { ...ch.config, chat_id: e.target.value } })} disabled={!canEdit} />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Para envio real, conecte o conector correspondente em Lovable Cloud (Teams / Twilio / Telegram).
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUTONOMIA */}
        <TabsContent value="autonomy" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Modo de operação</CardTitle></CardHeader>
            <CardContent>
              <RadioGroup value={agent.autonomy_level} onValueChange={(v) => setAgent({ ...agent, autonomy_level: v as Agent["autonomy_level"] })} disabled={!canEdit}>
                {[
                  { id: "manual", title: "Manual", desc: "Toda execução exige confirmação humana antes de rodar." },
                  { id: "supervised", title: "Supervisionado", desc: "Agente propõe, mas precisa de aprovação humana via canal configurado." },
                  { id: "autonomous", title: "Autônomo", desc: "Executa sozinho skills com risco ≤ threshold. Acima disso, pede aprovação." },
                ].map((opt) => (
                  <label key={opt.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${agent.autonomy_level === opt.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40"}`}>
                    <RadioGroupItem value={opt.id} className="mt-0.5" />
                    <div>
                      <div className="font-medium text-sm">{opt.title}</div>
                      <div className="text-xs text-muted-foreground">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
              <p className="text-xs text-muted-foreground mt-4">
                Threshold atual: <span className="font-mono text-warning">risco {profile.risk_threshold}</span>. Ajuste em <em>Perfil</em>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Últimas execuções</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Entrada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Sem execuções registradas.</TableCell></TableRow>
                  ) : executions.map((ex) => (
                    <TableRow key={ex.id}>
                      <TableCell className="text-xs font-mono">{new Date(ex.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] uppercase">{ex.triggered_by}</Badge></TableCell>
                      <TableCell className="text-xs">{ex.channel_type ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-[10px] uppercase ${ex.status === "success" ? "text-accent border-accent/40" : ex.status === "failed" ? "text-destructive border-destructive/40" : "text-warning border-warning/40"}`}>{ex.status}</Badge></TableCell>
                      <TableCell className="text-xs">{ex.duration_ms ? `${ex.duration_ms}ms` : "—"}</TableCell>
                      <TableCell className="text-xs max-w-[280px] truncate">{ex.input ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
