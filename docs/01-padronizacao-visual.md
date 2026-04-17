# 01 — Padronização Visual

> Sistema de design **DISPH-AIOPS** inspirado em Grafana, com foco em densidade de informação, legibilidade em ambientes operacionais 24/7 e identidade *cybersecurity*.

---

## 1. Princípios de Design

| Princípio | Aplicação |
| --- | --- |
| **Clarity over decoration** | Conteúdo informacional > efeitos visuais. |
| **Density-first** | Mais dados por viewport, sem comprometer leitura. |
| **Status at a glance** | Cor, ícone e badge sinalizam estado em < 1s. |
| **Dark by default** | NOC/SOC opera em ambiente escuro 24/7. |
| **Monospace for data** | IPs, IDs, timestamps, métricas em fonte mono. |

---

## 2. Paleta de Cores (HSL — design tokens)

Todos os tokens em `src/index.css` (`:root`). **Nunca usar cores literais em componentes.**

### 2.1 Cores semânticas

| Token            | HSL                | Hex aprox. | Uso                                  |
| ---------------- | ------------------ | ---------- | ------------------------------------ |
| `--background`   | `222 47% 5%`       | `#070B14`  | Fundo principal                       |
| `--foreground`   | `210 40% 96%`      | `#F0F4FA`  | Texto primário                        |
| `--card`         | `222 40% 8%`       | `#0E1422`  | Superfícies elevadas                  |
| `--popover`      | `222 40% 8%`       | `#0E1422`  | Menus, dropdowns                      |
| `--primary`      | `195 100% 50%`     | `#00B4D8`  | CTA, links, charts série 1           |
| `--accent`       | `160 84% 39%`      | `#10B981`  | Sucesso, status saudável             |
| `--warning`      | `45 93% 47%`       | `#F59E0B`  | Atenção, MTTR alto                   |
| `--destructive`  | `0 84% 60%`        | `#EF4444`  | Erro, P1, falha                      |
| `--muted`        | `222 25% 12%`      | `#171E2D`  | Backgrounds secundários              |
| `--border`       | `222 25% 15%`      | `#1F2738`  | Divisores                            |

### 2.2 Cores de severidade (incidentes)

| Severidade | Token            | Aplicação UI                    |
| ---------- | ---------------- | ------------------------------- |
| **P1 / Critical** | `--destructive` | Borda esquerda, badge, glow vermelho |
| **P2 / High**     | `--warning`     | Badge amber, ícone alerta             |
| **P3 / Medium**   | `--primary`     | Badge cyan                            |
| **P4 / Low**      | `--muted-foreground` | Badge cinza                       |

### 2.3 Cores de roles (RBAC)

| Role       | Cor                           | Uso                                |
| ---------- | ----------------------------- | ---------------------------------- |
| `admin`    | `destructive` (vermelho)      | Badge no perfil, indica privilégio |
| `operator` | `primary` (cyan)              | Badge SRE                          |
| `viewer`   | `accent` (verde)              | Badge somente leitura              |
| `auditor`  | `warning` (âmbar)             | Badge auditoria                    |

### 2.4 Charts (5 séries)

```css
--chart-1: 195 100% 50%;   /* cyan    */
--chart-2: 160 84% 39%;    /* green   */
--chart-3: 45 93% 47%;     /* amber   */
--chart-4: 0 84% 60%;      /* red     */
--chart-5: 280 67% 60%;    /* violet  */
```

---

## 3. Tipografia

### 3.1 Famílias

| Família          | Peso disponível    | Uso                                            |
| ---------------- | ------------------ | ---------------------------------------------- |
| **Space Grotesk** | 300–700            | H1, H2, H3, títulos de cards, `.heading`       |
| **Inter**         | 300–800            | Body, parágrafos, labels                       |
| **JetBrains Mono**| 400–700            | Código, IDs, IPs, timestamps, valores numéricos |

Importadas via Google Fonts em `src/index.css` linha 1.

### 3.2 Escala tipográfica

| Token Tailwind | Tamanho | Line-height | Uso                              |
| -------------- | ------- | ----------- | -------------------------------- |
| `text-2xl`     | 24px    | 1.2         | H1 página                        |
| `text-xl`      | 20px    | 1.3         | H2 seção                         |
| `text-base`    | 16px    | 1.5         | Card title                       |
| `text-sm`      | 14px    | 1.5         | Body padrão                      |
| `text-xs`      | 12px    | 1.4         | Labels, navegação                |
| `text-[11px]`  | 11px    | 1.3         | Metadados, timestamps            |
| `text-[10px]`  | 10px    | 1.3         | Badges, tags                     |
| `text-[9px]`   | 9px     | 1.2         | Micro-labels (uppercase tracking) |

### 3.3 Convenções

- **Heading:** sempre `font-bold tracking-tight heading` (aplica Space Grotesk).
- **Labels técnicos:** `text-xs font-mono uppercase tracking-wider text-muted-foreground`.
- **Valores numéricos** (KPI, métricas): `font-mono` para alinhamento tabular.

---

## 4. Espaçamento (Grafana density)

Sistema base **4px** (Tailwind padrão). Densidade alta favorece NOC/SOC.

| Contexto         | Padding        | Gap          |
| ---------------- | -------------- | ------------ |
| Página           | `p-4 md:p-6`   | `space-y-6`  |
| Card             | `p-4`          | `space-y-3`  |
| Card compacto    | `p-3`          | `space-y-2`  |
| Linha de tabela  | `py-2.5 px-3`  | -            |
| Botão padrão     | `px-3 py-1.5`  | `gap-1.5`    |
| Top nav item     | `px-3 py-1.5`  | `gap-1.5`    |
| Badge            | `px-1.5 py-0.5`| -            |

**Max-width** do container principal: `1600px` (Grafana usa ~1920px, ajustamos para legibilidade).

---

## 5. Iconografia

**Biblioteca:** [`lucide-react`](https://lucide.dev) — SVG outline, traço 1.5–2px.

### 5.1 Tamanhos padrão

| Contexto              | Tamanho    | Classe                    |
| --------------------- | ---------- | ------------------------- |
| Top nav               | 14px       | `h-3.5 w-3.5`             |
| Botão pequeno         | 14px       | `h-3.5 w-3.5`             |
| Botão padrão          | 16px       | `h-4 w-4`                 |
| Card title icon       | 16px       | `h-4 w-4`                 |
| KPI card icon         | 32px       | `h-8 w-8`                 |
| Empty state           | 48px       | `h-12 w-12`               |

### 5.2 Ícones por domínio

| Domínio        | Ícone Lucide        |
| -------------- | ------------------- |
| Dashboard      | `LayoutDashboard`   |
| Incidentes     | `AlertTriangle`     |
| Infraestrutura | `Server`            |
| Clusters K8s   | `Container`         |
| DevSecOps      | `Shield`            |
| Auditoria      | `ShieldCheck`       |
| Admin          | `Users`             |
| LDAP/Rede      | `Network`           |
| SMTP/Email     | `Mail`              |
| SEI            | `FileText`          |
| Configurações  | `Settings`          |
| IA             | `Brain` / `Sparkles`|
| Sucesso        | `CheckCircle2`      |
| Erro           | `XCircle`           |
| Sync           | `RefreshCw`         |

---

## 6. Componentes — padrões visuais

### 6.1 Card

```tsx
<Card className="bg-card border-border cyber-border">
  <CardHeader>
    <CardTitle className="text-base flex items-center gap-2 heading">
      <Icon className="h-4 w-4 text-primary" /> Título
    </CardTitle>
    <CardDescription className="font-mono text-xs">Subtítulo</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

### 6.2 Badge de status

```tsx
<Badge variant="outline" className="text-[10px] font-mono border-accent/30 text-accent">
  ● Operacional
</Badge>
```

### 6.3 KPI Card

```tsx
<Card>
  <CardContent className="p-4 flex items-center gap-3">
    <Icon className="h-8 w-8 text-primary" />
    <div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground font-mono">{label}</p>
    </div>
  </CardContent>
</Card>
```

---

## 7. Motion / Animação

Biblioteca: **Framer Motion** + animações CSS pontuais.

| Animação        | Duração | Easing       | Uso                              |
| --------------- | ------- | ------------ | -------------------------------- |
| Hover button    | 150ms   | ease-out     | Todos os botões e links          |
| Card enter      | 250ms   | ease-out     | Entrada de modal/dialog          |
| Status pulse    | 2s loop | ease-in-out  | Indicador "operacional" (verde)  |
| Sync spin       | 1s loop | linear       | Ícone `RefreshCw` durante sync   |
| Toast slide     | 300ms   | ease-out     | Notificações Sonner              |

**Regra:** nunca animar `width`, `height` ou `top/left` — usar `transform` e `opacity`.

---

## 8. Efeitos visuais (cybersecurity)

Definidos em `src/index.css` `@layer utilities`:

```css
.cyber-grid    /* Background com grid 32px cyan @ 3% opacity */
.cyber-border  /* Borda 1px cyan @ 15% opacity */
.glass         /* Backdrop-blur 12px + bg card 80% */
.glow-cyan     /* Box-shadow cyan 20px+60px */
.glow-green    /* Box-shadow green */
.glow-red      /* Box-shadow red para criticos */
.status-pulse  /* Animação opacity 1 ↔ 0.5 a cada 2s */
```

---

## 9. Acessibilidade (WCAG 2.1 AA)

- ✅ **Contraste:** mínimo 4.5:1 para texto normal, 3:1 para texto large.
- ✅ **Foco visível:** ring `--ring` (cyan) em todos os interativos.
- ✅ **Labels:** todo `Input` tem `<Label htmlFor>` associado.
- ✅ **Aria:** dialogs com `aria-labelledby`, ícones decorativos com `aria-hidden`.
- ✅ **Navegação por teclado:** Tab order respeita fluxo visual.
- ⚠️ **Daltonismo:** status nunca depende SÓ de cor — sempre + ícone + texto.

---

## 10. Checklist de Design Review

Antes de aprovar uma nova tela:

- [ ] Usa apenas tokens do design system (sem `text-white`, `bg-blue-500` etc.)
- [ ] Tipografia respeita escala (heading + body + mono)
- [ ] Cards usam `cyber-border` ou `border-border`
- [ ] Status: cor + ícone + texto (acessibilidade)
- [ ] Funciona em viewport 1338px (atual) e 768px (mobile)
- [ ] Loading state e empty state implementados
- [ ] Toast de sucesso/erro nas ações principais
