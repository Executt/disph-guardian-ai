# 24 — Especificação de Frontend (Gov.br + Fiori)

## 1. Referências e adaptação

Dois padrões orientam a interface:

- **Gov.br Design System** — acessibilidade, clareza, linguagem cidadã, previsibilidade.
- **SAP Fiori** — orientação a papel, foco em tarefa, coerência entre telas, adaptação de dispositivo.

Adaptação DISPH: tema **dark-only** de centro de operações, com tokens semânticos próprios (doc 01). O que se herda dos padrões é **comportamento e estrutura**, não a paleta clara institucional.

---

## 2. Princípios Fiori aplicados

| Princípio | Aplicação no DISPH |
| --- | --- |
| Baseado em papel | Navegação e ações filtradas por `admin`, `operator`, `auditor`, `viewer` |
| Adaptativo | Layout responde de 1070 px a ultrawide; tabelas viram lista em telas estreitas |
| Simples | Uma tarefa principal por tela; ações secundárias em menu |
| Coerente | Mesmos componentes de filtro, tabela, KPI e badge em todos os módulos |
| Encantador | Feedback imediato: progresso em tempo real, estados de carregamento reais |

---

## 3. Tipos de página

| Tipo Fiori | Uso no sistema | Exemplo |
| --- | --- | --- |
| Overview Page | Painel com cartões de KPI e atalhos | `/security-overview` |
| List Report | Filtro + tabela + exportação | `/ar`, `/vulnerabilities` |
| Object Page | Detalhe com abas e histórico | `/vulnerabilities/:cve`, `/agents/:id` |
| Analytical Page | Gráficos e distribuição | `/security-overview/ctir-audit` |
| Worklist | Fila de itens pendentes | Avaliações `pending` em `/ar` |

---

## 4. Estrutura padrão de tela

```
TopNav (navegação por papel)
└── Cabeçalho da página: título, contexto, ações primárias
    ├── Barra de filtros (persistida na URL)
    ├── Conteúdo (KPIs → tabela/gráfico)
    └── Rodapé de ação (quando houver edição em lote)
Assistente lateral (slide-over, alternável)
```

Regras:

- Filtros, aba ativa, página e posição de rolagem vivem na **URL** — deep-link reproduz o estado exato.
- Ação primária sempre no canto superior direito do cabeçalho.
- Tabela com mais de 50 linhas usa virtualização por janela.

---

## 5. Acessibilidade (obrigatória)

| Requisito | Alvo |
| --- | --- |
| Conformidade | WCAG 2.1 AA / eMAG |
| Contraste | ≥ 4,5:1 para texto; ≥ 3:1 para elemento gráfico |
| Teclado | Toda ação alcançável por `Tab`; foco visível sempre |
| Leitor de tela | Marcação semântica, `aria-label` em ícone-botão, `role` correto em tabela |
| Formulário | `label` associado, erro descrito em texto, não apenas por cor |
| Movimento | Respeitar `prefers-reduced-motion` |
| Zoom | Utilizável a 200% sem perda de função |
| Idioma | `lang="pt-BR"` no documento |

Cor **nunca** é o único portador de informação: severidade traz texto e ícone além do tom.

---

## 6. Linguagem e conteúdo

- pt-BR, voz ativa, frase curta.
- Rótulos consistentes: "Alertas e Recomendações", "Ambientes monitorados", "Avaliações", "Execuções".
- Mensagem de erro diz **o que houve** e **o que fazer** — sem código interno nem stack trace.
- Data no formato `dd/MM/yyyy HH:mm` em `America/Sao_Paulo`; ISO-8601 apenas em exportação.
- Número com separador de milhar pt-BR.

---

## 7. Estados obrigatórios

Toda lista e todo painel implementam quatro estados:

| Estado | Tratamento |
| --- | --- |
| Carregando | Skeleton com a forma do conteúdo real, nunca spinner solto |
| Vazio | Explicação da causa + ação sugerida (ex.: "Nenhum alerta na janela; ampliar período") |
| Erro | Motivo legível + botão de nova tentativa |
| Sem permissão | Mensagem clara de papel insuficiente, sem expor a estrutura de dados |

---

## 8. Desempenho percebido

| Métrica | Alvo |
| --- | --- |
| LCP | < 2,5 s |
| INP | < 200 ms |
| CLS | < 0,1 |
| Tabela de 5.000 linhas | rolagem fluida via virtualização |
| Exportação | assíncrona, sem travar a interface |

---

## 9. Regras de código

- Nenhuma cor literal em componente — apenas tokens semânticos de `src/index.css`.
- Componentes em `PascalCase`; hooks `useXxx`; nada de lógica de autorização no cliente como controle (apenas experiência).
- Validação de formulário com **zod**; o servidor sempre revalida.
- Markdown do assistente de IA sanitizado, sem HTML bruto.

---

## 10. Critérios de aceite

- [ ] Deep-link restaura filtros, aba, página e rolagem
- [ ] Navegação completa por teclado com foco visível
- [ ] Contraste AA verificado nas telas principais
- [ ] Quatro estados implementados em toda lista
- [ ] Nenhuma cor literal em componente
- [ ] Severidade comunicada por texto e ícone, não só por cor
