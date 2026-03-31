import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings, Key, Webhook, Server, Brain, Shield } from "lucide-react";

const endpoints = [
  { name: "Red Hat ACM", url: "https://acm.corp.gov.br", status: "connected" },
  { name: "Zabbix Server", url: "https://zabbix.corp.gov.br/api_jsonrpc.php", status: "connected" },
  { name: "GitLab", url: "https://gitlab.corp.gov.br", status: "connected" },
  { name: "GLPI", url: "https://glpi.corp.gov.br/apirest.php", status: "connected" },
  { name: "Grafana", url: "https://grafana.corp.gov.br", status: "disconnected" },
  { name: "ArgoCD", url: "https://argocd.corp.gov.br", status: "connected" },
  { name: "Quay Registry", url: "https://quay.corp.gov.br", status: "connected" },
  { name: "SonarQube", url: "https://sonar.corp.gov.br", status: "connected" },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground font-mono">Endpoints, Modelos LLM, Webhooks e Segurança</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Endpoints */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4 text-accent" /> Endpoints da Infraestrutura
            </CardTitle>
            <CardDescription className="font-mono text-xs">Integrações com ACM, Zabbix, GitLab, GLPI, Quay</CardDescription>
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

        {/* Webhooks */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Webhook className="h-4 w-4 text-warning" /> Webhooks & Notificações
            </CardTitle>
            <CardDescription className="font-mono text-xs">Microsoft Teams, WhatsApp, GLPI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">Webhook Microsoft Teams</Label>
              <Input placeholder="https://outlook.office.com/webhook/..." className="font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">WhatsApp API (Evolution/Z-API)</Label>
              <Input placeholder="https://api.z-api.io/instances/..." className="font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider">GLPI API Token</Label>
              <Input type="password" placeholder="••••••••" className="font-mono text-sm" />
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
    </div>
  );
}
