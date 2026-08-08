# 01 — Padronização Visual

## 1. Direção de design

Tema **dark-only**, linguagem de console de cibersegurança governamental: superfícies profundas, grid sutil, acentos ciano/verde, tipografia geométrica para títulos e monoespaçada para dados técnicos. Nada de gradientes roxo/índigo genéricos.

| Atributo | Decisão |
| --- | --- |
| Modo | Dark exclusivo (`:root` já é o tema escuro) |
| Densidade | Alta — telas operacionais com muitas linhas |
| Bordas | 1px `--border` com opacidade reduzida (`/50`) em tabelas |
| Raio | `--radius: 0.5rem` |
| Movimento | Transições ≤ 200ms; `animate-spin` apenas em estados de carga |

---

## 2. Paleta (tokens semânticos)

Todos os valores vivem em `src/index.css` como HSL sem função `hsl()`, e são expostos via `tailwind.config.ts`.

| Token | Uso | Valor de referência |
| --- | --- | --- |
| `--background` | Fundo da aplicação | `#0B1120` |
| `--foreground` | Texto primário | quase branco frio |
| `--card` / `--card-foreground` | Superfícies elevadas | azul-noite +4% |
| `--primary` | Ação principal, links, KPIs | `#00B4D8` (ciano) |
| `--accent` | Sucesso, conformidade, "pronto" | `#10B981` (verde) |
| `--warning` | Atenção, parcial, cancelado | âmbar |
| `--destructive` | Falha, crítico, não conforme | vermelho |
| `--muted` / `--muted-foreground` | Texto secundário, legendas | cinza-azulado |
| `--border` / `--input` / `--ring` | Contornos e foco | ciano translúcido no `ring` |

**Proibido em componentes:** `text-white`, `bg-black`, `bg-[#hex]`, `text-[rgb(...)]`. Sempre `text-foreground`, `bg-card`, `text-primary`, `border-destructive/40` etc.

### 2.1 Mapa semântico de severidade

| Severidade | Token | Badge |
| --- | --- | --- |
| `critical` | `destructive` | contorno vermelho, texto vermelho |
| `high` | `warning` | contorno âmbar |
| `medium` | `primary` | contorno ciano |
| `low` | `muted` | contorno neutro |

### 2.2 Mapa semântico de conformidade

| Status | Token |
| --- | --- |
| `compliant` | `accent` |
| `partial` | `warning` |
| `non_compliant` | `destructive` |
| `not_applicable` | `muted` |
| `pending` | `primary` |

---

## 3. Tipografia

| Papel | Família | Aplicação |
| --- | --- | --- |
| Títulos | **Space Grotesk** | classe utilitária `.heading` |
| Corpo | **Inter** | padrão do `body` |
| Dados técnicos | **JetBrains Mono** | `font-mono` em códigos, CVEs, timestamps, IDs |

Escala: `text-[10px]` (metadados de tabela) · `text-xs` (rótulos) · `text-sm` (corpo denso) · `text-base` · `text-xl`/`text-2xl` (títulos de página) · `text-3xl` (KPIs).

---

## 4. Efeitos assinatura

| Efeito | Descrição |
| --- | --- |
| **Cyber-grid** | Fundo com grade fina de baixa opacidade em páginas de visão geral |
| **Glass** | `backdrop-blur` + `bg-card/70` no painel lateral do assistente e no topo fixo |
| **Glow** | `shadow` ciano suave em KPIs críticos e no botão flutuante do assistente |
| **Backdrop** | `bg-background/60 backdrop-blur-sm` ao abrir o slide-over; clique fecha |

---

## 5. Componentes padrão

| Componente | Arquivo | Regra |
| --- | --- | --- |
| `MetricCard` | `src/components/MetricCard.tsx` | KPI: rótulo, valor, delta, ícone |
| `StatusBadge` | `src/components/StatusBadge.tsx` | Traduz enums de status para tokens |
| `TopNav` | `src/components/TopNav.tsx` | Navegação horizontal; sem sidebar |
| `AppLayout` | `src/components/AppLayout.tsx` | Shell + `Outlet` + assistente lateral |
| `SyncStatusPanel` | `src/components/SyncStatusPanel.tsx` | Estado da última sincronização |
| `SyncCauseTree` | `src/components/SyncCauseTree.tsx` | Árvore de causa-raiz estilo Wazuh |
| `ExportJobsPanel` | `src/components/ExportJobsPanel.tsx` | Fila de exportação com progresso |
| `VirtualRows` | `src/components/VirtualRows.tsx` | Janela de renderização em tabelas |

Primitivos shadcn/ui em `src/components/ui/` — variantes são estendidas via `cva`, nunca com classes de cor literais.

---

## 6. Layout

- Largura máxima de conteúdo: `max-w-[1600px]`, padding lateral `px-4 md:px-6`.
- Grid de KPIs: `grid-cols-2 md:grid-cols-4`.
- Tabelas operacionais ocupam largura total, com `overflow-x-auto` em telas estreitas.
- Painel lateral do assistente: `w-full sm:w-[420px]`, fixo à direita, `z-50`.

---

## 7. Acessibilidade

- Contraste mínimo AA (4.5:1) para texto sobre `--background` e `--card`.
- Todo botão de ícone tem `aria-label` (ver `ExportJobsPanel`).
- Foco visível via `--ring`; navegação completa por teclado nas tabelas e abas.
- Estados nunca comunicados só por cor: sempre acompanham ícone ou rótulo textual.
- `prefers-reduced-motion` desativa animações não essenciais.
