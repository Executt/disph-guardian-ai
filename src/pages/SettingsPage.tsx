import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Settings, Key, Webhook, Server, Brain, Shield, Plus, Pencil, Trash2, Container } from "lucide-react";
import { toast } from "sonner";

const CLUSTER_PROVIDERS = [
  { value: "eks", label: "AWS (Amazon EKS)", icon: "🟠" },
  { value: "gke", label: "Google Cloud (GKE)", icon: "🔵" },
  { value: "aks", label: "Microsoft Azure (AKS)", icon: "🔷" },
  { value: "cce", label: "Huawei Cloud (CCE)", icon: "🔴" },
  { value: "oke", label: "Oracle (OKE)", icon: "🟤" },
  { value: "openshift", label: "Red Hat OpenShift", icon: "🔺" },
  { value: "openshift-local", label: "OpenShift Local/On-Premise", icon: "🏠" },
  { value: "okd", label: "OKD (Community)", icon: "⬛" },
  { value: "rancher", label: "Rancher (SUSE)", icon: "🐄" },
] as const;

const ITSM_PROVIDERS = [
  { value: "glpi", label: "GLPI" },
  { value: "jira", label: "Jira" },
  { value: "azure-devops", label: "Azure DevOps" },
  { value: "citsmart", label: "CITSmart" },
  { value: "servicenow", label: "ServiceNow" },
] as const;

interface Cluster {
  id: string;
  name: string;
  provider: string;
  apiUrl: string;
  environment: string;
  status: "connected" | "disconnected";
}

const initialClusters: Cluster[] = [
  { id: "1", name: "prod-eks-01", provider: "eks", apiUrl: "https://eks.us-east-1.amazonaws.com/prod", environment: "AWS", status: "connected" },
  { id: "2", name: "hml-openshift-01", provider: "openshift", apiUrl: "https://api.ocp.corp.gov.br:6443", environment: "On-Premise", status: "connected" },
  { id: "3", name: "dev-rancher-01", provider: "rancher", apiUrl: "https://rancher.corp.gov.br/v3", environment: "On-Premise", status: "disconnected" },
  { id: "4", name: "prod-oke-01", provider: "oke", apiUrl: "https://containerengine.sa-saopaulo-1.oci.oraclecloud.com", environment: "OCI", status: "connected" },
];

const endpoints = [
  { name: "Red Hat ACM", url: "https://acm.corp.gov.br", status: "connected" },
  { name: "Zabbix Server", url: "https://zabbix.corp.gov.br/api_jsonrpc.php", status: "connected" },
  { name: "GitLab", url: "https://gitlab.corp.gov.br", status: "connected" },
  { name: "Grafana", url: "https://grafana.corp.gov.br", status: "disconnected" },
  { name: "ArgoCD", url: "https://argocd.corp.gov.br", status: "connected" },
  { name: "Quay Registry", url: "https://quay.corp.gov.br", status: "connected" },
  { name: "SonarQube", url: "https://sonar.corp.gov.br", status: "connected" },
];

const emptyCluster = { id: "", name: "", provider: "", apiUrl: "", environment: "", status: "disconnected" as const };

export default function SettingsPage() {
  const [clusters, setClusters] = useState<Cluster[]>(initialClusters);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCluster, setEditingCluster] = useState<Cluster>(emptyCluster);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedItsm, setSelectedItsm] = useState("glpi");

  const openAddDialog = () => {
    setEditingCluster({ ...emptyCluster, id: crypto.randomUUID() });
    setIsEditing(false);
    setDialogOpen(true);
  };

  const openEditDialog = (cluster: Cluster) => {
    setEditingCluster({ ...cluster });
    setIsEditing(true);
    setDialogOpen(true);
  };

  const saveCluster = () => {
    if (!editingCluster.name || !editingCluster.provider || !editingCluster.apiUrl) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (isEditing) {
      setClusters(prev => prev.map(c => c.id === editingCluster.id ? editingCluster : c));
      toast.success(`Cluster "${editingCluster.name}" atualizado`);
    } else {
      setClusters(prev => [...prev, editingCluster]);
      toast.success(`Cluster "${editingCluster.name}" adicionado`);
    }
    setDialogOpen(false);
  };

  const removeCluster = (id: string) => {
    const cluster = clusters.find(c => c.id === id);
    setClusters(prev => prev.filter(c => c.id !== id));
    toast.success(`Cluster "${cluster?.name}" removido`);
  };

  const getProviderLabel = (value: string) => {
    const p = CLUSTER_PROVIDERS.find(cp => cp.value === value);
    return p ? `${p.icon} ${p.label}` : value;
  };

  const getProviderIcon = (value: string) => CLUSTER_PROVIDERS.find(cp => cp.value === value)?.icon || "☸️";

  const itsmProvider = ITSM_PROVIDERS.find(p => p.value === selectedItsm);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground font-mono">Clusters, Endpoints, Modelos LLM, ITSM e Segurança</p>
      </div>

      {/* Kubernetes Clusters */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Container className="h-4 w-4 text-primary" /> Clusters Kubernetes
            </CardTitle>
            <CardDescription className="font-mono text-xs">Gerencie clusters EKS, GKE, AKS, OpenShift, Rancher, OKE, CCE, OKD</CardDescription>
          </div>
          <Button size="sm" onClick={openAddDialog} className="gap-1">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          {clusters.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum cluster cadastrado</p>
          ) : (
            <div className="space-y-2">
              {clusters.map(cluster => (
                <div key={cluster.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2.5 group">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg">{getProviderIcon(cluster.provider)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{cluster.name}</p>
                      <p className="text-[11px] font-mono text-muted-foreground truncate">{cluster.apiUrl}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] hidden sm:inline-flex">{cluster.environment}</Badge>
                    <Badge variant={cluster.status === "connected" ? "default" : "secondary"} className="font-mono text-[10px]">
                      {cluster.status === "connected" ? "● Online" : "○ Offline"}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEditDialog(cluster)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => removeCluster(cluster.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Endpoints */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4 text-accent" /> Endpoints da Infraestrutura
            </CardTitle>
            <CardDescription className="font-mono text-xs">Integrações com ACM, Zabbix, GitLab, Quay</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {endpoints.map((ep) => (
              <div key={ep.name} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{ep.name}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">{ep.url}</p>
                </div>
                <Badge variant={ep.status === "connected" ? "default" : "secondary"} className="font-mono text-[10px]">
                  {ep.status === "connected" ? "● Conectado" : "○ Desconectado"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* LLM Config */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> Modelo de IA / LLM
            </CardTitle>
            <CardDescription className="font-mono text-xs">Configuração do motor RAG e modelo de linguagem</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">Provedor</Label>
              <Select defaultValue="opensource">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="opensource">Open-Source (LLaMA / Mistral)</SelectItem>
                  <SelectItem value="azure">Microsoft Copilot / Azure OpenAI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">API Endpoint</Label>
              <Input placeholder="https://llm.corp.gov.br/v1" className="font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">API Key</Label>
              <Input type="password" placeholder="••••••••••••••••" className="font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">Embedding Dimensions</Label>
              <Input type="number" defaultValue={1536} className="font-mono text-sm" />
            </div>
            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-sm">Guardrails Ativos</p>
                <p className="text-[11px] text-muted-foreground font-mono">Red Hat ACS policy enforcement</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* ITSM Integration */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Webhook className="h-4 w-4 text-warning" /> ITSM & Notificações
            </CardTitle>
            <CardDescription className="font-mono text-xs">Gestão de tickets e canais de alerta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">Provedor ITSM</Label>
              <Select value={selectedItsm} onValueChange={setSelectedItsm}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ITSM_PROVIDERS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">URL Base do {itsmProvider?.label}</Label>
              <Input placeholder={`https://${selectedItsm}.corp.gov.br/api`} className="font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">API Token / Key</Label>
              <Input type="password" placeholder="••••••••" className="font-mono text-sm" />
            </div>
            <hr className="border-border" />
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">Webhook Microsoft Teams</Label>
              <Input placeholder="https://outlook.office.com/webhook/..." className="font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">WhatsApp API (Evolution/Z-API)</Label>
              <Input placeholder="https://api.z-api.io/instances/..." className="font-mono text-sm" />
            </div>
            <Button variant="outline" className="w-full font-mono text-xs">Testar Conexões</Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-destructive" /> Segurança & RBAC
            </CardTitle>
            <CardDescription className="font-mono text-xs">Keycloak, LDAP, MFA, Funções</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">Keycloak Realm URL</Label>
              <Input placeholder="https://sso.corp.gov.br/realms/disph" className="font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">LDAP Base DN</Label>
              <Input placeholder="dc=corp,dc=gov,dc=br" className="font-mono text-sm" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">MFA Obrigatório (TOTP)</p>
                <p className="text-[11px] text-muted-foreground font-mono">Para aprovação de remediações</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="space-y-1 pt-2">
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Funções RBAC</p>
              <div className="flex gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">Visualizador</Badge>
                <Badge variant="outline" className="font-mono text-[10px]">Operador SRE</Badge>
                <Badge className="font-mono text-[10px] bg-destructive/20 text-destructive border-destructive/30">Admin Segurança</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cluster Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Cluster" : "Adicionar Cluster"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">Nome do Cluster *</Label>
              <Input
                value={editingCluster.name}
                onChange={e => setEditingCluster(prev => ({ ...prev, name: e.target.value }))}
                placeholder="prod-eks-01"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">Provedor / Plataforma *</Label>
              <Select value={editingCluster.provider} onValueChange={v => setEditingCluster(prev => ({ ...prev, provider: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o provedor" /></SelectTrigger>
                <SelectContent>
                  {CLUSTER_PROVIDERS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.icon} {p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">API URL / Endpoint *</Label>
              <Input
                value={editingCluster.apiUrl}
                onChange={e => setEditingCluster(prev => ({ ...prev, apiUrl: e.target.value }))}
                placeholder="https://api.cluster.example.com:6443"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">Ambiente</Label>
              <Select value={editingCluster.environment} onValueChange={v => setEditingCluster(prev => ({ ...prev, environment: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o ambiente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AWS">AWS</SelectItem>
                  <SelectItem value="GCP">GCP</SelectItem>
                  <SelectItem value="Azure">Azure</SelectItem>
                  <SelectItem value="OCI">OCI</SelectItem>
                  <SelectItem value="Huawei Cloud">Huawei Cloud</SelectItem>
                  <SelectItem value="On-Premise">On-Premise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">Status</Label>
              <Select value={editingCluster.status} onValueChange={(v: "connected" | "disconnected") => setEditingCluster(prev => ({ ...prev, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="connected">Conectado</SelectItem>
                  <SelectItem value="disconnected">Desconectado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveCluster}>{isEditing ? "Salvar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
