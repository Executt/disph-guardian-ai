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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Shield, Network, Plus, Pencil, Trash2, RefreshCw, CheckCircle2, XCircle, Search } from "lucide-react";
import { toast } from "sonner";
import type { AppRole } from "@/contexts/AuthContext";

interface LdapConfig {
  enabled: boolean;
  url: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  userFilter: string;
  groupFilter: string;
  syncInterval: number;
  tlsEnabled: boolean;
  lastSync?: string;
  status: "connected" | "disconnected" | "syncing";
}

interface ManagedUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  roles: AppRole[];
  source: "ldap" | "local";
  status: "active" | "inactive" | "locked";
  lastLogin?: string;
  mfaEnabled: boolean;
}

const initialLdap: LdapConfig = {
  enabled: true,
  url: "ldaps://ldap.corp.gov.br:636",
  baseDn: "dc=corp,dc=gov,dc=br",
  bindDn: "cn=disph-svc,ou=services,dc=corp,dc=gov,dc=br",
  bindPassword: "",
  userFilter: "(&(objectClass=person)(memberOf=cn=disph-users,ou=groups,dc=corp,dc=gov,dc=br))",
  groupFilter: "(objectClass=groupOfNames)",
  syncInterval: 30,
  tlsEnabled: true,
  lastSync: "2024-03-31T14:30:00Z",
  status: "connected",
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
  { value: "admin", label: "Administrador" },
  { value: "operator", label: "Operador SRE" },
  { value: "viewer", label: "Visualizador" },
  { value: "auditor", label: "Auditor" },
];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-accent/20 text-accent border-accent/30",
  inactive: "bg-muted text-muted-foreground border-border",
  locked: "bg-destructive/20 text-destructive border-destructive/30",
};

export default function AdminPage() {
  const [ldap, setLdap] = useState<LdapConfig>(initialLdap);
  const [users, setUsers] = useState<ManagedUser[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [syncing, setSyncing] = useState(false);

  const filteredUsers = users.filter(u =>
    `${u.username} ${u.displayName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleLdapSync = () => {
    setSyncing(true);
    setLdap(prev => ({ ...prev, status: "syncing" }));
    setTimeout(() => {
      setSyncing(false);
      setLdap(prev => ({ ...prev, status: "connected", lastSync: new Date().toISOString() }));
      toast.success("Sincronização LDAP concluída", { description: `${users.filter(u => u.source === "ldap").length} usuários sincronizados` });
    }, 2500);
  };

  const handleTestConnection = () => {
    toast.promise(
      new Promise(resolve => setTimeout(resolve, 1500)),
      { loading: "Testando conexão LDAP...", success: "Conexão LDAP bem-sucedida!", error: "Falha na conexão" }
    );
  };

  const openAddUser = () => {
    setEditingUser({
      id: crypto.randomUUID(),
      username: "", displayName: "", email: "",
      roles: ["viewer"], source: "local", status: "active", mfaEnabled: false,
    });
    setUserDialogOpen(true);
  };

  const openEditUser = (user: ManagedUser) => {
    setEditingUser({ ...user });
    setUserDialogOpen(true);
  };

  const saveUser = () => {
    if (!editingUser?.username || !editingUser?.email) {
      toast.error("Preencha username e email");
      return;
    }
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
    const roles = editingUser.roles.includes(role)
      ? editingUser.roles.filter(r => r !== role)
      : [...editingUser.roles, role];
    setEditingUser({ ...editingUser, roles });
  };

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === "active").length,
    ldap: users.filter(u => u.source === "ldap").length,
    mfa: users.filter(u => u.mfaEnabled).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight heading">Administração</h1>
        <p className="text-sm text-muted-foreground font-mono">Gestão de Usuários · LDAP · RBAC · MFA</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Usuários", value: stats.total, icon: Users, color: "text-primary" },
          { label: "Ativos", value: stats.active, icon: CheckCircle2, color: "text-accent" },
          { label: "Via LDAP", value: stats.ldap, icon: Network, color: "text-primary" },
          { label: "MFA Ativo", value: stats.mfa, icon: Shield, color: "text-warning" },
        ].map(s => (
          <Card key={s.label} className="bg-card border-border cyber-border">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground font-mono">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="users" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Usuários</TabsTrigger>
          <TabsTrigger value="ldap" className="gap-1.5 text-xs"><Network className="h-3.5 w-3.5" /> LDAP</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, username ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button onClick={openAddUser} className="gap-1.5 shrink-0">
              <Plus className="h-3.5 w-3.5" /> Adicionar Usuário
            </Button>
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground font-mono text-xs">USUÁRIO</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-xs">EMAIL</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-xs">ROLES</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-xs">FONTE</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-xs">STATUS</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-xs">MFA</TableHead>
                    <TableHead className="text-muted-foreground font-mono text-xs">AÇÕES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(user => (
                    <TableRow key={user.id} className="border-border hover:bg-secondary/30">
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{user.displayName}</p>
                          <p className="text-[11px] font-mono text-muted-foreground">{user.username}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {user.roles.map(r => (
                            <Badge key={r} variant="outline" className="text-[9px] font-mono uppercase">{r}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-mono ${user.source === "ldap" ? "border-primary/30 text-primary" : "border-border"}`}>
                          {user.source === "ldap" ? "LDAP" : "Local"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-mono ${STATUS_STYLES[user.status]}`}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.mfaEnabled ? (
                          <CheckCircle2 className="h-4 w-4 text-accent" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground/40" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditUser(user)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteUser(user.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredUsers.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">Nenhum usuário encontrado</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* LDAP Tab */}
        <TabsContent value="ldap" className="space-y-4">
          <Card className="bg-card border-border cyber-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2 heading">
                    <Network className="h-4 w-4 text-primary" /> Configuração LDAP / Active Directory
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">Integração com diretório corporativo para autenticação e provisionamento</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] font-mono ${
                    ldap.status === "connected" ? "border-accent/30 text-accent" :
                    ldap.status === "syncing" ? "border-warning/30 text-warning" :
                    "border-destructive/30 text-destructive"
                  }`}>
                    {ldap.status === "connected" ? "● Conectado" : ldap.status === "syncing" ? "⟳ Sincronizando" : "○ Desconectado"}
                  </Badge>
                  <Switch checked={ldap.enabled} onCheckedChange={v => setLdap(prev => ({ ...prev, enabled: v }))} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-mono uppercase tracking-wider">LDAP URL</Label>
                  <Input value={ldap.url} onChange={e => setLdap(prev => ({ ...prev, url: e.target.value }))} placeholder="ldaps://ldap.corp.gov.br:636" className="font-mono text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-mono uppercase tracking-wider">Base DN</Label>
                  <Input value={ldap.baseDn} onChange={e => setLdap(prev => ({ ...prev, baseDn: e.target.value }))} placeholder="dc=corp,dc=gov,dc=br" className="font-mono text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-mono uppercase tracking-wider">Bind DN (Service Account)</Label>
                  <Input value={ldap.bindDn} onChange={e => setLdap(prev => ({ ...prev, bindDn: e.target.value }))} placeholder="cn=svc,ou=services,dc=..." className="font-mono text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-mono uppercase tracking-wider">Bind Password</Label>
                  <Input type="password" value={ldap.bindPassword} onChange={e => setLdap(prev => ({ ...prev, bindPassword: e.target.value }))} placeholder="••••••••" className="font-mono text-sm" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs font-mono uppercase tracking-wider">Filtro de Usuários</Label>
                  <Input value={ldap.userFilter} onChange={e => setLdap(prev => ({ ...prev, userFilter: e.target.value }))} className="font-mono text-sm" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs font-mono uppercase tracking-wider">Filtro de Grupos</Label>
                  <Input value={ldap.groupFilter} onChange={e => setLdap(prev => ({ ...prev, groupFilter: e.target.value }))} className="font-mono text-sm" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={ldap.tlsEnabled} onCheckedChange={v => setLdap(prev => ({ ...prev, tlsEnabled: v }))} />
                    <Label className="text-sm">TLS/SSL</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-mono">Intervalo de Sync (min):</Label>
                    <Input type="number" value={ldap.syncInterval} onChange={e => setLdap(prev => ({ ...prev, syncInterval: +e.target.value }))} className="w-20 font-mono text-sm" />
                  </div>
                </div>
                {ldap.lastSync && (
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Última sync: {new Date(ldap.lastSync).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={handleTestConnection} className="font-mono text-xs">
                  Testar Conexão
                </Button>
                <Button onClick={handleLdapSync} disabled={syncing} className="gap-1.5 font-mono text-xs">
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Sincronizando..." : "Sincronizar Agora"}
                </Button>
                <Button className="font-mono text-xs" onClick={() => toast.success("Configuração LDAP salva")}>
                  Salvar Configuração
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* LDAP Group Mapping */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 heading">
                <Shield className="h-4 w-4 text-warning" /> Mapeamento de Grupos LDAP → RBAC
              </CardTitle>
              <CardDescription className="font-mono text-xs">Associe grupos do diretório às roles da aplicação</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { ldapGroup: "cn=disph-admins,ou=groups", role: "admin" },
                  { ldapGroup: "cn=disph-operators,ou=groups", role: "operator" },
                  { ldapGroup: "cn=disph-viewers,ou=groups", role: "viewer" },
                  { ldapGroup: "cn=disph-auditors,ou=groups", role: "auditor" },
                ].map(mapping => (
                  <div key={mapping.ldapGroup} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <Network className="h-4 w-4 text-primary shrink-0" />
                      <code className="text-xs font-mono text-muted-foreground truncate">{mapping.ldapGroup}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">→</span>
                      <Badge variant="outline" className="text-[10px] font-mono uppercase">{mapping.role}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="heading">{editingUser && users.find(u => u.id === editingUser.id) ? "Editar Usuário" : "Adicionar Usuário"}</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-mono uppercase tracking-wider">Username *</Label>
                  <Input value={editingUser.username} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })} className="font-mono text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-mono uppercase tracking-wider">Nome Completo</Label>
                  <Input value={editingUser.displayName} onChange={e => setEditingUser({ ...editingUser, displayName: e.target.value })} className="text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase tracking-wider">Email *</Label>
                <Input value={editingUser.email} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} className="font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase tracking-wider">Roles</Label>
                <div className="flex gap-2 flex-wrap">
                  {ROLE_OPTIONS.map(opt => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={editingUser.roles.includes(opt.value) ? "default" : "outline"}
                      size="sm"
                      className="text-xs"
                      onClick={() => toggleUserRole(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-mono uppercase tracking-wider">Fonte</Label>
                  <Select value={editingUser.source} onValueChange={(v: "ldap" | "local") => setEditingUser({ ...editingUser, source: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="ldap">LDAP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-mono uppercase tracking-wider">Status</Label>
                  <Select value={editingUser.status} onValueChange={(v: "active" | "inactive" | "locked") => setEditingUser({ ...editingUser, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="locked">Bloqueado</SelectItem>
                    </SelectContent>
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
