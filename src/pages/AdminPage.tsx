import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, Shield, Network, Plus, Pencil, Trash2, RefreshCw, CheckCircle2, XCircle, Search,
  Mail, FileText, Bell, Container, Brain, Webhook, Settings as SettingsIcon, ShieldCheck,
  LayoutGrid
} from "lucide-react";
import { toast } from "sonner";
import type { AppRole } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// ============= TYPES =============
interface LdapConfig {
  enabled: boolean; url: string; baseDn: string; bindDn: string; bindPassword: string;
  userFilter: string; groupFilter: string; syncInterval: number; tlsEnabled: boolean;
  lastSync?: string; status: "connected" | "disconnected" | "syncing";
}
interface ManagedUser {
  id: string; username: string; displayName: string; email: string;
  roles: AppRole[]; source: "ldap" | "local"; status: "active" | "inactive" | "locked";
  lastLogin?: string; mfaEnabled: boolean;
}

const initialLdap: LdapConfig = {
  enabled: true, url: "ldaps://ldap.corp.gov.br:636", baseDn: "dc=corp,dc=gov,dc=br",
  bindDn: "cn=disph-svc,ou=services,dc=corp,dc=gov,dc=br", bindPassword: "",
  userFilter: "(&(objectClass=person)(memberOf=cn=disph-users,ou=groups,dc=corp,dc=gov,dc=br))",
  groupFilter: "(objectClass=groupOfNames)", syncInterval: 30, tlsEnabled: true,
  lastSync: "2024-03-31T14:30:00Z", status: "connected",
};

const initialUsers: ManagedUser[] = [
  { id: "1", username: "carlos.admin", displayName: "Carlos Administrador", email: "carlos@disph.gov.br", roles: ["admin", "operator"], source: "ldap", status: "active", lastLogin: "2024-03-31T14:23:00Z", mfaEnabled: true },
  { id: "2", username: "ana.operadora", displayName: "Ana Operadora", email: "ana@disph.gov.br", roles: ["operator"], source: "ldap", status: "active", lastLogin: "2024-03-31T12:10:00Z", mfaEnabled: true },
  { id: "3", username: "joao.auditor", displayName: "João Auditor", email: "joao@disph.gov.br", roles: ["viewer", "auditor"], source: "ldap", status: "active", lastLogin: "2024-03-30T09:00:00Z", mfaEnabled: true },
  { id: "4", username: "maria.viewer", displayName: "Maria Visualizadora", email: "maria@disph.gov.br", roles: ["viewer"], source: "ldap", status: "inactive", mfaEnabled: false },
  { id: "5", username: "svc.pipeline", displayName: "Service Account CI/CD", email: "pipeline@disph.gov.br", roles: ["operator"], source: "local", status: "active", mfaEnabled: false },
  { id: "6", username: "pedro.sre", displayName: "Pedro SRE", email: "pedro@disph.gov.br", roles: ["operator"], source: "ldap", status: "locked", lastLogin: "2024-03-28T08:00:00Z", mfaEnabled: true },
];

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Administrador" }, { value: "operator", label: "Operador SRE" },
  { value: "viewer", label: "Visualizador" }, { value: "auditor", label: "Auditor" },
];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-accent/20 text-accent border-accent/30",
  inactive: "bg-muted text-muted-foreground border-border",
  locked: "bg-destructive/20 text-destructive border-destructive/30",
};

// ============= NAV (Grafana-style vertical) =============
type SectionKey = "overview" | "users" | "ldap" | "smtp" | "sei" | "itsm" | "notif" | "clusters" | "llm" | "security" | "audit";

const SECTIONS: { key: SectionKey; label: string; icon: typeof Users; group: string }[] = [
  { key: "overview", label: "Visão Geral", icon: LayoutGrid, group: "Geral" },
  { key: "users", label: "Usuários", icon: Users, group: "Identidade" },
  { key: "ldap", label: "LDAP / AD", icon: Network, group: "Identidade" },
  { key: "security", label: "Segurança / MFA", icon: Shield, group: "Identidade" },
  { key: "smtp", label: "SMTP / Email", icon: Mail, group: "Comunicação" },
  { key: "notif", label: "Notificações", icon: Bell, group: "Comunicação" },
  { key: "sei", label: "SEI (gov.br)", icon: FileText, group: "Workflow" },
  { key: "itsm", label: "ITSM", icon: Webhook, group: "Workflow" },
  { key: "clusters", label: "Clusters / Infra", icon: Container, group: "Infraestrutura" },
  { key: "llm", label: "IA / LLM", icon: Brain, group: "Inteligência" },
  { key: "audit", label: "Auditoria", icon: ShieldCheck, group: "Compliance" },
];

const ITSM_PROVIDERS = [
  { value: "glpi", label: "GLPI" }, { value: "jira", label: "Jira" },
  { value: "azure-devops", label: "Azure DevOps" }, { value: "citsmart", label: "CITSmart" },
  { value: "servicenow", label: "ServiceNow" }, { value: "sei", label: "SEI" },
];

export default function AdminPage() {
  const [section, setSection] = useState<SectionKey>("overview");
  const [ldap, setLdap] = useState<LdapConfig>(initialLdap);
  const [users, setUsers] = useState<ManagedUser[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [selectedItsm, setSelectedItsm] = useState("glpi");

  const filteredUsers = users.filter(u =>
    `${u.username} ${u.displayName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === "active").length,
    ldap: users.filter(u => u.source === "ldap").length,
    mfa: users.filter(u => u.mfaEnabled).length,
  };

  const handleLdapSync = () => {
    setSyncing(true);
    setLdap(prev => ({ ...prev, status: "syncing" }));
    setTimeout(() => {
      setSyncing(false);
      setLdap(prev => ({ ...prev, status: "connected", lastSync: new Date().toISOString() }));
      toast.success("Sincronização LDAP concluída", { description: `${users.filter(u => u.source === "ldap").length} usuários sincronizados` });
    }, 2200);
  };

  const openAddUser = () => {
    setEditingUser({ id: crypto.randomUUID(), username: "", displayName: "", email: "", roles: ["viewer"], source: "local", status: "active", mfaEnabled: false });
    setUserDialogOpen(true);
  };
  const openEditUser = (user: ManagedUser) => { setEditingUser({ ...user }); setUserDialogOpen(true); };
  const saveUser = () => {
    if (!editingUser?.username || !editingUser?.email) { toast.error("Preencha username e email"); return; }
    const exists = users.find(u => u.id === editingUser.id);
    if (exists) {
      setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
      toast.success(`Usuário "${editingUser.displayName}" atualizado`);
    } else {
      setUsers(prev => [...prev, editingUser]);
      toast.success(`Usuário "${editingUser.displayName}" criado`);
    }
    setUserDialogOpen(false);
  };
  const deleteUser = (id: string) => {
    const user = users.find(u => u.id === id);
    setUsers(prev => prev.filter(u => u.id !== id));
    toast.success(`Usuário "${user?.displayName}" removido`);
  };
  const toggleUserRole = (role: AppRole) => {
    if (!editingUser) return;
    const roles = editingUser.roles.includes(role) ? editingUser.roles.filter(r => r !== role) : [...editingUser.roles, role];
    setEditingUser({ ...editingUser, roles });
  };

  // Group sections for sidebar
  const groupedSections = SECTIONS.reduce((acc, s) => {
    (acc[s.group] = acc[s.group] || []).push(s);
    return acc;
  }, {} as Record<string, typeof SECTIONS>);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight heading">Administração</h1>
          <p className="text-sm text-muted-foreground font-mono">Centro de Parametrização da Plataforma</p>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
          {SECTIONS.find(s => s.key === section)?.label}
        </Badge>
      </div>

      {/* Layout: Grafana-style vertical nav + content */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
        {/* Vertical Nav */}
        <aside className="space-y-4">
          {Object.entries(groupedSections).map(([group, items]) => (
            <div key={group} className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 mb-1.5">{group}</p>
              {items.map(s => {
                const Icon = s.icon;
                const active = section === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSection(s.key)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-all text-left",
                      active
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground border border-transparent"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        {/* Content */}
        <div className="min-w-0">
          {section === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total Usuários", value: stats.total, icon: Users, color: "text-primary" },
                  { label: "Ativos", value: stats.active, icon: CheckCircle2, color: "text-accent" },
                  { label: "Via LDAP", value: stats.ldap, icon: Network, color: "text-primary" },
                  { label: "MFA Ativo", value: stats.mfa, icon: Shield, color: "text-warning" },
                ].map(s => (
                  <Card key={s.label} className="bg-card border-border">
                    <CardContent className="p-3 flex items-center gap-3">
                      <s.icon className={`h-7 w-7 ${s.color}`} />
                      <div>
                        <p className="text-xl font-bold text-foreground">{s.value}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{s.label}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm heading">Status das Integrações</CardTitle>
                  <CardDescription className="text-xs font-mono">Saúde dos serviços parametrizados</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {[
                    { label: "LDAP / AD", status: ldap.status === "connected" ? "online" : "offline", detail: ldap.url },
                    { label: "SMTP", status: "online", detail: "smtp.corp.gov.br:587" },
                    { label: "SEI gov.br", status: "online", detail: "sei.gov.br/controlador_ws" },
                    { label: "Microsoft Teams", status: "online", detail: "Webhook configurado" },
                    { label: "WhatsApp (Z-API)", status: "offline", detail: "Pendente token" },
                    { label: "Lovable AI Gateway", status: "online", detail: "9 modelos disponíveis" },
                    { label: "GLPI", status: "online", detail: "v10.0.x" },
                  ].map(it => (
                    <div key={it.label} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/30">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${it.status === "online" ? "bg-accent" : "bg-muted-foreground"}`} />
                        <p className="text-sm">{it.label}</p>
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground">{it.detail}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {section === "users" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar usuário..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                </div>
                <Button onClick={openAddUser} size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
              </div>
              <Card className="bg-card border-border">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground font-mono text-[10px] uppercase">Usuário</TableHead>
                        <TableHead className="text-muted-foreground font-mono text-[10px] uppercase">Email</TableHead>
                        <TableHead className="text-muted-foreground font-mono text-[10px] uppercase">Roles</TableHead>
                        <TableHead className="text-muted-foreground font-mono text-[10px] uppercase">Fonte</TableHead>
                        <TableHead className="text-muted-foreground font-mono text-[10px] uppercase">Status</TableHead>
                        <TableHead className="text-muted-foreground font-mono text-[10px] uppercase">MFA</TableHead>
                        <TableHead className="text-muted-foreground font-mono text-[10px] uppercase">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map(user => (
                        <TableRow key={user.id} className="border-border hover:bg-secondary/30">
                          <TableCell>
                            <p className="text-sm font-medium">{user.displayName}</p>
                            <p className="text-[11px] font-mono text-muted-foreground">{user.username}</p>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">{user.email}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {user.roles.map(r => <Badge key={r} variant="outline" className="text-[9px] font-mono uppercase">{r}</Badge>)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] font-mono ${user.source === "ldap" ? "border-primary/30 text-primary" : "border-border"}`}>
                              {user.source === "ldap" ? "LDAP" : "Local"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] font-mono ${STATUS_STYLES[user.status]}`}>{user.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {user.mfaEnabled ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <XCircle className="h-4 w-4 text-muted-foreground/40" />}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditUser(user)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteUser(user.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredUsers.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">Nenhum usuário encontrado</div>}
                </CardContent>
              </Card>
            </div>
          )}

          {section === "ldap" && (
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2 heading"><Network className="h-4 w-4 text-primary" /> LDAP / Active Directory</CardTitle>
                    <CardDescription className="font-mono text-xs">Provisionamento e autenticação via diretório corporativo</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] font-mono ${ldap.status === "connected" ? "border-accent/30 text-accent" : ldap.status === "syncing" ? "border-warning/30 text-warning" : "border-destructive/30 text-destructive"}`}>
                      {ldap.status === "connected" ? "● Conectado" : ldap.status === "syncing" ? "⟳ Sincronizando" : "○ Desconectado"}
                    </Badge>
                    <Switch checked={ldap.enabled} onCheckedChange={v => setLdap(prev => ({ ...prev, enabled: v }))} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="LDAP URL" value={ldap.url} onChange={v => setLdap(p => ({ ...p, url: v }))} />
                  <Field label="Base DN" value={ldap.baseDn} onChange={v => setLdap(p => ({ ...p, baseDn: v }))} />
                  <Field label="Bind DN (Service Account)" value={ldap.bindDn} onChange={v => setLdap(p => ({ ...p, bindDn: v }))} />
                  <Field label="Bind Password" type="password" value={ldap.bindPassword} onChange={v => setLdap(p => ({ ...p, bindPassword: v }))} />
                  <div className="md:col-span-2"><Field label="Filtro de Usuários" value={ldap.userFilter} onChange={v => setLdap(p => ({ ...p, userFilter: v }))} /></div>
                  <div className="md:col-span-2"><Field label="Filtro de Grupos" value={ldap.groupFilter} onChange={v => setLdap(p => ({ ...p, groupFilter: v }))} /></div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2"><Switch checked={ldap.tlsEnabled} onCheckedChange={v => setLdap(p => ({ ...p, tlsEnabled: v }))} /><Label className="text-sm">TLS/SSL</Label></div>
                    <div className="flex items-center gap-2"><Label className="text-xs font-mono">Sync (min):</Label><Input type="number" value={ldap.syncInterval} onChange={e => setLdap(p => ({ ...p, syncInterval: +e.target.value }))} className="w-20 h-8 font-mono text-sm" /></div>
                  </div>
                  {ldap.lastSync && <p className="text-[11px] font-mono text-muted-foreground">Última sync: {new Date(ldap.lastSync).toLocaleString("pt-BR")}</p>}
                </div>
                <hr className="border-border" />
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Mapeamento Grupo LDAP → Role</p>
                  <div className="space-y-1.5">
                    {[
                      { ldapGroup: "cn=disph-admins,ou=groups", role: "admin" },
                      { ldapGroup: "cn=disph-operators,ou=groups", role: "operator" },
                      { ldapGroup: "cn=disph-viewers,ou=groups", role: "viewer" },
                      { ldapGroup: "cn=disph-auditors,ou=groups", role: "auditor" },
                    ].map(m => (
                      <div key={m.ldapGroup} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5">
                        <code className="text-xs font-mono text-muted-foreground truncate">{m.ldapGroup}</code>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">→</span>
                          <Badge variant="outline" className="text-[10px] font-mono uppercase">{m.role}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toast.promise(new Promise(r => setTimeout(r, 1200)), { loading: "Testando...", success: "Conexão OK!", error: "Falhou" })}>Testar Conexão</Button>
                  <Button size="sm" onClick={handleLdapSync} disabled={syncing} className="gap-1.5"><RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Sincronizando..." : "Sincronizar Agora"}</Button>
                  <Button size="sm" onClick={() => toast.success("Configuração LDAP salva")}>Salvar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {section === "smtp" && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 heading"><Mail className="h-4 w-4 text-primary" /> SMTP / Servidor de Email</CardTitle>
                <CardDescription className="font-mono text-xs">Envio de notificações, alertas, recuperação de senha</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="Servidor SMTP" placeholder="smtp.corp.gov.br" />
                  <Field label="Porta" placeholder="587" />
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono uppercase tracking-wider">Encryption</Label>
                    <Select defaultValue="starttls"><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>
                      <SelectItem value="starttls">STARTTLS (587)</SelectItem><SelectItem value="ssl">SSL/TLS (465)</SelectItem><SelectItem value="none">Nenhuma</SelectItem>
                    </SelectContent></Select>
                  </div>
                  <Field label="Timeout (s)" placeholder="30" />
                  <Field label="Usuário SMTP" placeholder="noreply@disph.gov.br" />
                  <Field label="Senha" type="password" placeholder="••••••••" />
                  <Field label="From Name" placeholder="DISPH-AIOPS" />
                  <Field label="From Email" placeholder="noreply@disph.gov.br" />
                  <div className="md:col-span-2"><Field label="Reply-To" placeholder="suporte@disph.gov.br" /></div>
                </div>
                <hr className="border-border" />
                <div className="flex items-center justify-between">
                  <div><p className="text-sm">Ativar envio de emails</p><p className="text-[11px] text-muted-foreground font-mono">Quando desativado, apenas log local</p></div>
                  <Switch defaultChecked />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toast.success("Email de teste enviado")}>Enviar Email Teste</Button>
                  <Button size="sm" onClick={() => toast.success("Configuração SMTP salva")}>Salvar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {section === "sei" && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 heading"><FileText className="h-4 w-4 text-primary" /> SEI — Sistema Eletrônico de Informações (gov.br)</CardTitle>
                <CardDescription className="font-mono text-xs">Abertura automática de processos administrativos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="md:col-span-2"><Field label="URL Base SEI" placeholder="https://sei.gov.br/sei/controlador_ws.php" /></div>
                  <Field label="Token API" type="password" placeholder="••••••••••••" />
                  <Field label="Sigla Unidade" placeholder="COTI" />
                  <Field label="Tipo de Processo" placeholder="Solicitação de Alteração — TI" />
                  <Field label="Tipo de Documento" placeholder="Despacho" />
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono uppercase tracking-wider">Nível de Sigilo</Label>
                    <Select defaultValue="publico"><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>
                      <SelectItem value="publico">Público</SelectItem><SelectItem value="restrito">Restrito</SelectItem><SelectItem value="sigiloso">Sigiloso</SelectItem>
                    </SelectContent></Select>
                  </div>
                </div>
                <hr className="border-border" />
                <div className="space-y-2">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Quando abrir processo SEI?</p>
                  {[
                    { label: "Mudança de configuração crítica (LDAP, RBAC)", checked: true },
                    { label: "Incidente CRITICAL com impacto cidadão", checked: true },
                    { label: "Solicitação de exclusão LGPD", checked: true },
                    { label: "Promoção para produção (CAB)", checked: false },
                  ].map(t => (
                    <div key={t.label} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/30">
                      <p className="text-sm">{t.label}</p>
                      <Switch defaultChecked={t.checked} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toast.success("Credenciais SEI validadas")}>Validar Credenciais</Button>
                  <Button size="sm" onClick={() => toast.success("Configuração SEI salva")}>Salvar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {section === "itsm" && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 heading"><Webhook className="h-4 w-4 text-warning" /> ITSM — Gestão de Tickets</CardTitle>
                <CardDescription className="font-mono text-xs">Sincronização bidirecional com sistemas de chamados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-wider">Provedor ITSM</Label>
                  <Select value={selectedItsm} onValueChange={setSelectedItsm}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>
                    {ITSM_PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent></Select>
                </div>
                <Field label={`URL Base do ${ITSM_PROVIDERS.find(p => p.value === selectedItsm)?.label}`} placeholder={`https://${selectedItsm}.corp.gov.br/api`} />
                <Field label="API Token / Key" type="password" placeholder="••••••••" />
                <Field label="Categoria padrão (mapeada de severity)" placeholder="Infraestrutura > AIOps" />
                <div className="flex items-center justify-between pt-1">
                  <div><p className="text-sm">Sincronização bidirecional</p><p className="text-[11px] text-muted-foreground font-mono">Mudanças no ITSM atualizam incidentes locais</p></div>
                  <Switch defaultChecked />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Testar Conexão</Button>
                  <Button size="sm" onClick={() => toast.success("Configuração ITSM salva")}>Salvar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {section === "notif" && (
            <div className="space-y-3">
              <Card className="bg-card border-border">
                <CardHeader><CardTitle className="text-base flex items-center gap-2 heading"><Bell className="h-4 w-4 text-warning" /> Microsoft Teams</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Field label="Webhook URL" placeholder="https://outlook.office.com/webhook/..." />
                  <Field label="Canal padrão" placeholder="#sre-alerts" />
                  <div className="flex gap-2"><Button variant="outline" size="sm">Testar</Button><Button size="sm">Salvar</Button></div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader><CardTitle className="text-base flex items-center gap-2 heading"><Bell className="h-4 w-4 text-accent" /> WhatsApp (Z-API / Evolution)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Field label="URL da Instância" placeholder="https://api.z-api.io/instances/..." />
                  <Field label="Token" type="password" placeholder="••••••••" />
                  <Field label="Plantão (números separados por vírgula)" placeholder="+5561999990001,+5561999990002" />
                  <div className="flex gap-2"><Button variant="outline" size="sm">Enviar Teste</Button><Button size="sm">Salvar</Button></div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader><CardTitle className="text-base heading">Quiet Hours (silêncio)</CardTitle><CardDescription className="font-mono text-xs">Suprime notificações low/medium em horário noturno</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Início" placeholder="22:00" />
                    <Field label="Fim" placeholder="06:00" />
                  </div>
                  <div className="flex items-center justify-between"><Label className="text-sm">Ativar Quiet Hours</Label><Switch defaultChecked /></div>
                </CardContent>
              </Card>
            </div>
          )}

          {section === "clusters" && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 heading"><Container className="h-4 w-4 text-primary" /> Defaults de Clusters</CardTitle>
                <CardDescription className="font-mono text-xs">Inventário detalhado em /infrastructure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono uppercase tracking-wider">Provedor padrão</Label>
                    <Select defaultValue="openshift"><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>
                      {["eks", "gke", "aks", "cce", "oke", "openshift", "openshift_local", "okd", "rancher"].map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
                    </SelectContent></Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono uppercase tracking-wider">Ambiente padrão</Label>
                    <Select defaultValue="production"><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>
                      <SelectItem value="production">Produção</SelectItem><SelectItem value="homologation">Homologação</SelectItem><SelectItem value="development">Desenvolvimento</SelectItem>
                    </SelectContent></Select>
                  </div>
                  <Field label="Health-check interval (s)" placeholder="60" />
                  <Field label="Timeout API (s)" placeholder="10" />
                </div>
                <Button size="sm" onClick={() => toast.success("Defaults salvos")}>Salvar</Button>
              </CardContent>
            </Card>
          )}

          {section === "llm" && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 heading"><Brain className="h-4 w-4 text-accent" /> IA / Modelos LLM</CardTitle>
                <CardDescription className="font-mono text-xs">Lovable AI Gateway · Configurações detalhadas em Configurações</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-wider">Modelo padrão do chat</Label>
                  <Select defaultValue="google/gemini-3-flash-preview"><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>
                    <SelectItem value="google/gemini-3-flash-preview">Gemini 3 Flash (recomendado)</SelectItem>
                    <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                    <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
                  </SelectContent></Select>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="Temperature (0-1)" placeholder="0.7" />
                  <Field label="Max output tokens" placeholder="4096" />
                  <Field label="Embedding dimensions" placeholder="1536" />
                  <Field label="Rate limit (req/min/usuário)" placeholder="60" />
                </div>
                <div className="flex items-center justify-between"><div><p className="text-sm">Reasoning Mode</p><p className="text-[11px] text-muted-foreground font-mono">Raciocínio estendido</p></div><Switch /></div>
                <div className="flex items-center justify-between"><div><p className="text-sm">Guardrails ativos</p><p className="text-[11px] text-muted-foreground font-mono">Filtra prompt injection e PII</p></div><Switch defaultChecked /></div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toast.success("Gateway IA: latência 480ms ✓")}>Testar Gateway</Button>
                  <Button size="sm" onClick={() => toast.success("Configuração IA salva")}>Salvar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {section === "security" && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 heading"><Shield className="h-4 w-4 text-destructive" /> Segurança & MFA</CardTitle>
                <CardDescription className="font-mono text-xs">Políticas de senha, sessão e autenticação multi-fator</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="Comprimento mínimo da senha" placeholder="12" />
                  <Field label="Histórico de senhas bloqueadas" placeholder="5" />
                  <Field label="Expiração de senha (dias)" placeholder="90" />
                  <Field label="JWT expiration (min)" placeholder="60" />
                  <Field label="Idle timeout (min)" placeholder="30" />
                  <Field label="Tentativas antes de bloqueio" placeholder="3" />
                </div>
                <hr className="border-border" />
                {[
                  { label: "MFA obrigatório para admin", checked: true },
                  { label: "MFA obrigatório para operator", checked: true },
                  { label: "Verificar senha contra HIBP (have-I-been-pwned)", checked: true },
                  { label: "Refresh token rotation", checked: true },
                  { label: "HSTS preload", checked: true },
                ].map(t => (
                  <div key={t.label} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/30">
                    <p className="text-sm">{t.label}</p>
                    <Switch defaultChecked={t.checked} />
                  </div>
                ))}
                <Button size="sm" onClick={() => toast.success("Políticas de segurança salvas")}>Salvar</Button>
              </CardContent>
            </Card>
          )}

          {section === "audit" && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 heading"><ShieldCheck className="h-4 w-4 text-primary" /> Auditoria</CardTitle>
                <CardDescription className="font-mono text-xs">Retenção e exportação de logs (LGPD/SISP)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="Retenção (dias)" placeholder="1825" />
                  <Field label="Webhook SIEM (Splunk/Elastic)" placeholder="https://siem.corp.gov.br/ingest" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Categorias capturadas</p>
                  {[
                    "Autenticação (LOGIN, MFA)", "Mudança de roles (RBAC)",
                    "CRUD em incidentes", "CRUD em clusters", "Mudança de configurações",
                    "Sincronização LDAP", "Consultas IA", "Acesso a dados sensíveis",
                  ].map(c => (
                    <div key={c} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/30">
                      <p className="text-sm">{c}</p>
                      <Switch defaultChecked />
                    </div>
                  ))}
                </div>
                <Button size="sm" onClick={() => toast.success("Configuração de auditoria salva")}>Salvar</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="heading">{editingUser && users.find(u => u.id === editingUser.id) ? "Editar Usuário" : "Adicionar Usuário"}</DialogTitle></DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Username *" value={editingUser.username} onChange={v => setEditingUser({ ...editingUser, username: v })} />
                <Field label="Nome Completo" value={editingUser.displayName} onChange={v => setEditingUser({ ...editingUser, displayName: v })} />
              </div>
              <Field label="Email *" value={editingUser.email} onChange={v => setEditingUser({ ...editingUser, email: v })} />
              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase tracking-wider">Roles</Label>
                <div className="flex gap-2 flex-wrap">
                  {ROLE_OPTIONS.map(opt => (
                    <Button key={opt.value} type="button" variant={editingUser.roles.includes(opt.value) ? "default" : "outline"} size="sm" className="text-xs" onClick={() => toggleUserRole(opt.value)}>{opt.label}</Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-mono uppercase tracking-wider">Fonte</Label>
                  <Select value={editingUser.source} onValueChange={(v: "ldap" | "local") => setEditingUser({ ...editingUser, source: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="local">Local</SelectItem><SelectItem value="ldap">LDAP</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-mono uppercase tracking-wider">Status</Label>
                  <Select value={editingUser.status} onValueChange={(v: "active" | "inactive" | "locked") => setEditingUser({ ...editingUser, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Ativo</SelectItem><SelectItem value="inactive">Inativo</SelectItem><SelectItem value="locked">Bloqueado</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editingUser.mfaEnabled} onCheckedChange={v => setEditingUser({ ...editingUser, mfaEnabled: v })} />
                <Label className="text-sm">MFA Obrigatório</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveUser}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============= Reusable Field =============
function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string; value?: string; onChange?: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-mono uppercase tracking-wider">{label}</Label>
      <Input type={type} value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder} className="h-9 font-mono text-sm" />
    </div>
  );
}
