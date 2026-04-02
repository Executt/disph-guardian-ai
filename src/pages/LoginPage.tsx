import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Brain, Shield, Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function LoginPage() {
  const { login, verifyMfa, isLoading, mfaPending, user } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totp, setTotp] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Preencha usuário e senha.");
      return;
    }

    const result = await login(username.trim(), password);
    if (!result.success) {
      setError(result.error || "Erro ao autenticar.");
    } else if (!result.mfaRequired) {
      navigate("/", { replace: true });
    }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = await verifyMfa(totp);
    if (!result.success) {
      setError(result.error || "Código inválido.");
      setTotp("");
    } else {
      navigate("/", { replace: true });
    }
  };

  // Auto-submit when 6 digits are entered
  const handleOtpChange = (value: string) => {
    setTotp(value);
    if (value.length === 6) {
      setTimeout(async () => {
        const result = await verifyMfa(value);
        if (!result.success) {
          setError(result.error || "Código inválido.");
          setTotp("");
        } else {
          navigate("/", { replace: true });
        }
      }, 200);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel – branding */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden items-center justify-center bg-gradient-to-br from-card via-background to-card border-r border-border">
        <div className="relative z-10 flex flex-col items-center gap-6 px-12">
          <div className="h-20 w-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Brain className="h-10 w-10 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">DISPH-AIOPS</h1>
            <p className="text-sm font-mono tracking-widest text-muted-foreground mt-1">PLATAFORMA DE OPERAÇÕES INTELIGENTES</p>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            {[
              { label: "Incidentes", value: "24/7" },
              { label: "Ambientes", value: "3" },
              { label: "Skills IA", value: "14" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-card/80 border border-border px-4 py-3">
                <div className="text-lg font-bold text-primary font-mono">{s.value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground/60 mt-8 text-center max-w-xs">
            Conformidade SISP · LGPD · Governo Federal
          </p>
        </div>

        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "radial-gradient(circle, hsl(var(--primary)) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8 justify-center">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-bold text-foreground">DISPH-AIOPS</span>
          </div>

          {!mfaPending ? (
            /* ── Step 1: Credentials ── */
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-semibold text-foreground">Autenticação</h2>
                <p className="text-sm text-muted-foreground">
                  Keycloak Realm: <span className="font-mono text-primary/80">disph</span>
                </p>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Usuário
                  </Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin / operator / viewer"
                    className="bg-card border-border h-11"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-card border-border h-11 pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full h-11 font-medium" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>

              <div className="rounded-md bg-muted/50 border border-border px-4 py-3 space-y-1">
                <p className="text-[11px] font-mono text-muted-foreground">
                  <Shield className="inline h-3 w-3 mr-1 text-primary" />
                  Credenciais de demonstração:
                </p>
                <p className="text-[11px] font-mono text-muted-foreground">
                  admin / admin123 · operator / operator123 · viewer / viewer123
                </p>
                <p className="text-[11px] font-mono text-muted-foreground">
                  MFA: qualquer código de 6 dígitos (ex: 123456)
                </p>
              </div>
            </form>
          ) : (
            /* ── Step 2: MFA TOTP ── */
            <form onSubmit={handleMfa} className="space-y-6">
              <div className="space-y-2 text-center">
                <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                  <KeyRound className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Verificação MFA</h2>
                <p className="text-sm text-muted-foreground">
                  Insira o código TOTP do seu autenticador
                </p>
                {user && (
                  <p className="text-xs text-muted-foreground font-mono">
                    {user.displayName} · {user.email}
                  </p>
                )}
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex justify-center">
                <InputOTP maxLength={6} value={totp} onChange={handleOtpChange}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="h-12 w-12 text-lg border-border bg-card" />
                    <InputOTPSlot index={1} className="h-12 w-12 text-lg border-border bg-card" />
                    <InputOTPSlot index={2} className="h-12 w-12 text-lg border-border bg-card" />
                    <InputOTPSlot index={3} className="h-12 w-12 text-lg border-border bg-card" />
                    <InputOTPSlot index={4} className="h-12 w-12 text-lg border-border bg-card" />
                    <InputOTPSlot index={5} className="h-12 w-12 text-lg border-border bg-card" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button type="submit" className="w-full h-11 font-medium" disabled={isLoading || totp.length < 6}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Verificar Código"
                )}
              </Button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Voltar ao login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
