import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SKILLS, SKILL_CATEGORIES, type SkillCategory, type SkillDefinition } from "@/lib/agentSkills";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, RefreshCw, AlertCircle } from "lucide-react";

interface CatalogSetting {
  skill_name: string;
  category: string;
  enabled: boolean;
  default_parameters: Record<string, unknown>;
  notes: string | null;
}

type LocalState = Record<string, {
  enabled: boolean;
  default_parameters: Record<string, string>;
  notes: string;
  dirty: boolean;
  saving: boolean;
}>;

const RISK_COLORS: Record<number, string> = {
  1: "bg-accent/20 text-accent border-accent/30",
  2: "bg-primary/20 text-primary border-primary/30",
  3: "bg-warning/20 text-warning border-warning/30",
  4: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  5: "bg-destructive/20 text-destructive border-destructive/30",
};

function buildInitial(skill: SkillDefinition, remote?: CatalogSetting): LocalState[string] {
  const params: Record<string, string> = {};
  for (const [k, def] of Object.entries(skill.parameters)) {
    const remoteVal = remote?.default_parameters?.[k];
    params[k] = remoteVal != null ? String(remoteVal) : def.default != null ? String(def.default) : "";
  }
  return {
    enabled: remote?.enabled ?? true,
    default_parameters: params,
    notes: remote?.notes ?? "",
    dirty: false,
    saving: false,
  };
}

export default function SkillsCatalogPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<LocalState>({});
  const [activeCat, setActiveCat] = useState<SkillCategory>("ansible");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("skill_catalog_settings")
      .select("skill_name, category, enabled, default_parameters, notes");
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const remoteMap = new Map<string, CatalogSetting>(
      (data ?? []).map((r) => [r.skill_name, r as unknown as CatalogSetting])
    );
    const next: LocalState = {};
    for (const skill of SKILLS) {
      next[skill.name] = buildInitial(skill, remoteMap.get(skill.name));
    }
    setState(next);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const map: Record<SkillCategory, SkillDefinition[]> = {
      ansible: [], gitlab: [], kubernetes: [], monitoring: [], itsm: [], notifications: [],
    };
    for (const s of SKILLS) map[s.category].push(s);
    return map;
  }, []);

  const summary = useMemo(() => {
    const total = SKILLS.length;
    const enabled = Object.values(state).filter((s) => s?.enabled).length;
    const dirty = Object.values(state).filter((s) => s?.dirty).length;
    return { total, enabled, disabled: total - enabled, dirty };
  }, [state]);

  const updateSkill = (name: string, patch: Partial<LocalState[string]>) => {
    setState((prev) => ({ ...prev, [name]: { ...prev[name], ...patch, dirty: true } }));
  };

  const saveSkill = async (skill: SkillDefinition) => {
    const s = state[skill.name];
    if (!s) return;
    setState((prev) => ({ ...prev, [skill.name]: { ...prev[skill.name], saving: true } }));
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s.default_parameters)) {
      if (v === "") continue;
      const def = skill.parameters[k];
      if (def?.type === "number") {
        const n = Number(v);
        params[k] = Number.isFinite(n) ? n : v;
      } else if (def?.type === "boolean") {
        params[k] = v === "true";
      } else {
        params[k] = v;
      }
    }
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      skill_name: skill.name,
      category: skill.category,
      enabled: s.enabled,
      default_parameters: params,
      notes: s.notes || null,
      updated_by: userData.user?.id ?? null,
    };
    const { error } = await supabase
      .from("skill_catalog_settings")
      .upsert([payload as any], { onConflict: "skill_name" });
    setState((prev) => ({
      ...prev,
      [skill.name]: { ...prev[skill.name], saving: false, dirty: !!error },
    }));
    if (error) {
      toast({ title: "Falha ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Skill atualizada", description: skill.name });
    }
  };

  const saveAllDirty = async () => {
    const dirtySkills = SKILLS.filter((s) => state[s.name]?.dirty);
    for (const s of dirtySkills) await saveSkill(s);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold heading">Catálogo de Skills</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Habilite/desabilite skills globalmente e defina parâmetros padrão por categoria.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Recarregar
          </Button>
          <Button size="sm" onClick={saveAllDirty} disabled={summary.dirty === 0} className="gap-2">
            <Save className="h-3.5 w-3.5" /> Salvar pendentes ({summary.dirty})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total de skills</div><div className="text-2xl font-bold heading">{summary.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Habilitadas</div><div className="text-2xl font-bold text-accent">{summary.enabled}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Desabilitadas</div><div className="text-2xl font-bold text-muted-foreground">{summary.disabled}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Não salvas</div><div className="text-2xl font-bold text-warning">{summary.dirty}</div></CardContent></Card>
      </div>

      <Tabs value={activeCat} onValueChange={(v) => setActiveCat(v as SkillCategory)}>
        <TabsList className="flex flex-wrap h-auto">
          {SKILL_CATEGORIES.map((c) => (
            <TabsTrigger key={c.id} value={c.id} className="text-xs">
              {c.label}
              <Badge variant="outline" className="ml-2 text-[10px]">{grouped[c.id].length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {SKILL_CATEGORIES.map((cat) => (
          <TabsContent key={cat.id} value={cat.id} className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">{cat.description}</p>
            {grouped[cat.id].map((skill) => {
              const s = state[skill.name];
              if (!s) return null;
              return (
                <Card key={skill.name} className={s.enabled ? "" : "opacity-60"}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-1">
                        <CardTitle className="text-base font-mono flex items-center gap-2">
                          {skill.name}
                          <Badge variant="outline" className={`text-[10px] font-mono ${RISK_COLORS[skill.riskLevel]}`}>
                            risco {skill.riskLevel}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] font-mono uppercase">
                            {skill.requiredRole}
                          </Badge>
                          {s.dirty && (
                            <Badge variant="outline" className="text-[10px] gap-1 text-warning border-warning/40">
                              <AlertCircle className="h-3 w-3" /> não salvo
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>{skill.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`en-${skill.name}`} className="text-xs">Ativa</Label>
                        <Switch
                          id={`en-${skill.name}`}
                          checked={s.enabled}
                          onCheckedChange={(v) => updateSkill(skill.name, { enabled: v })}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.keys(skill.parameters).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(skill.parameters).map(([key, def]) => (
                          <div key={key} className="space-y-1">
                            <Label className="text-xs font-mono">
                              {key} <span className="text-muted-foreground">({def.type})</span>
                            </Label>
                            <Input
                              value={s.default_parameters[key] ?? ""}
                              placeholder={def.default != null ? `padrão: ${def.default}` : def.description}
                              onChange={(e) => updateSkill(skill.name, {
                                default_parameters: { ...s.default_parameters, [key]: e.target.value },
                              })}
                            />
                            <p className="text-[10px] text-muted-foreground">{def.description}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Sem parâmetros configuráveis.</p>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Notas / restrições</Label>
                      <Textarea
                        rows={2}
                        value={s.notes}
                        placeholder="Ex.: limitar a ambientes de homolog; requer aprovação dupla..."
                        onChange={(e) => updateSkill(skill.name, { notes: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => saveSkill(skill)} disabled={!s.dirty || s.saving} className="gap-2">
                        {s.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Salvar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
