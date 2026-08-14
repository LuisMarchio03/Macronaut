<div align="center">

# 🛰️ Macronaut

**Seu plano alimentar, seus macros e seus treinos — num app só.**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white)
![Turso](https://img.shields.io/badge/Turso-libSQL-4FF8D2?logo=turso&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-instalável-5A0FC8?logo=pwa&logoColor=white)
![Testes](https://img.shields.io/badge/testes-702%20passando-3FB950)

</div>

---

## O que é

Um **PWA** que segue o seu plano alimentar. Você importa a planilha da sua dieta
— a que o nutricionista mandou, ou uma que você mesmo montou a partir do
template — e o app passa a guiar o dia: qual é a próxima refeição, o que comer
nela, quanto de água em cada período, quando tomar o suplemento. Um toque marca
como feito; outro troca um alimento por uma substituição prevista no seu plano.

Além disso é um diário de nutrição e um registro de treino completos, para o que
não está no plano.

## Como funciona o plano

```
sua planilha .xlsx        →   Importar   →   o app guia o dia
├── Plano                     prévia com      ├── refeição da vez, expandida
│   Café da Manhã  7h-8h      erros e         ├── [Comi] grava e marca
│   💧 ÁGUA       8h-12h      avisos          ├── [Trocar] abre as substituições
│   🥤 CREATINA   após almoço                 ├── água por período (+200/+500ml)
├── Macros                                    └── aderência: 3 de 4 refeições
└── Substituicoes
```

**Não tem planilha ainda?** O app tem um botão de baixar o template (`.xlsx` com
aba de instruções, ou três `.csv`). Preencha com a sua dieta e importe.

O importador aceita o que gente escreve de verdade: `7h00 - 8h00`,
`das 12h às 13h`, `Após almoço`, `~400 kcal`, `1600-1800 kcal`,
`750ml (3-4 copos de 200ml)`, `3L/dia`. Deixar a coluna **REFEIÇÃO** em branco
continua o bloco de cima — é assim que uma refeição ganha vários alimentos.

## Funcionalidades

**Plano alimentar**
- 📥 Importação de `.xlsx` e `.csv`, com prévia antes de gravar qualquer coisa
- 📄 Template baixável, gerado no build e validado pelo próprio importador
- 🕐 Linha do tempo do dia com refeições, períodos de água e suplementos
- 🔄 Substituições por refeição e categoria, direto do seu plano
- ✅ Aderência diária às refeições

**Nutrição**
- 🎯 Meta de calorias (ou faixa, quando o plano define uma) e macros
- 🍽️ Diário livre por refeição, com favoritas e "repetir"
- 📚 Catálogo próprio + tabela **TACO** e medidas caseiras da **POF/IBGE**
- 💧 Hidratação por período do plano, ou total do dia sem plano

**Treino**
- 🏋️ Séries por exercício (reps × carga), com tipo e RIR
- 📋 Biblioteca de exercícios com grupos musculares
- 🏃 Cardio com estimativa de kcal por MET e peso
- 📈 Progressão: 1RM estimado e carga máxima ao longo do tempo

**Análise**
- 📊 Nutrição, peso e atividade por semana, mês, ano ou período escolhido
- ⚖️ Balanço energético entre o que foi ingerido e o que foi gasto

**Plataforma**
- 📲 PWA instalável, com service worker que se atualiza sozinho
- 🎨 Tema claro e escuro, seguindo o do sistema quando você não escolheu
- ♿ Paleta com contraste WCAG AA verificado **em teste**, alvos de toque de 44px

## Arquitetura

```
telas / componentes  →  hooks (TanStack Query)  →  repositories  →  Turso (libSQL)
                                  ↕
                        domain/  — lógica pura, sem framework
```

| Pasta | O que vive lá |
|---|---|
| `src/domain/` | Regra de negócio pura: parsers do plano, TMB/TDEE, macros, e1RM, kcal por MET. Testada isolada. |
| `src/repositories/` | Todo SQL. A única camada que fala com o banco. |
| `src/hooks/` | Wrappers do TanStack Query. |
| `src/lib/planilha.ts` | A única camada que conhece o formato do arquivo importado. |
| `src/components/ui/` | Design system: `Card`, `Progress`, `Stat`, `Segmented`, `Page`… |
| `src/design/` | Verificação de contraste da paleta (roda como teste). |
| `src/db/schema.sql` | Schema completo. |

### Design system

Tokens em `oklch` no `src/index.css`. Todo par texto/fundo é verificado em
contraste WCAG AA por `src/design/palette.test.ts` — mudar uma cor sem manter o
contraste quebra a suíte de propósito. Quatro níveis tipográficos, monoespaçado
só em número que alinha em coluna, e alvos de toque de 44px (WCAG 2.5.8).

## Stack

| Camada | Escolha |
|---|---|
| UI | React 19, React Router 7 |
| Dados | TanStack Query 5 |
| Banco | Turso / libSQL, acessado direto do navegador |
| Estilo | Tailwind CSS 4, primitivos Base UI, fonte Geist |
| Planilha | `read-excel-file` (leitura, sob demanda), `write-excel-file` (build) |
| Build | Vite 8, TypeScript 6, `vite-plugin-pwa` |
| Testes | Vitest 4, Testing Library, jsdom |

## Começando

**Pré-requisito:** Node ≥ 22.

```bash
npm install

# 1. Um banco. Escolha um:
#    (a) local, sem nuvem e sem token
turso dev --db-file local.db --port 8090
#    (b) Turso na nuvem
turso db create macronaut && turso db show macronaut --url

# 2. Configure
cp .env.example .env.local
#    DB_URL=http://127.0.0.1:8090   (local)
#    DB_TOKEN=dev-local             (qualquer valor no local)

# 3. Schema + seeds (TACO, medidas POF, exercícios, tipos de atividade)
npm run db:setup

# 4. Seu usuário
npm run create-user -- --email voce@exemplo.com --senha ****

# 5. Rode
npm run dev
```

O login chama `/api/login`, que em produção é uma função serverless
(`api/login.ts`). Em desenvolvimento, `npm run dev` serve a mesma rota por um
plugin do Vite (`vite-plugin-login-dev.ts`), reaproveitando a mesma função
`authenticate` — não precisa de `vercel dev` para entrar no app.

### Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Gera o template, checa tipos e builda para `dist/` |
| `npm run build:template` | Só o template — e valida o resultado pelo importador |
| `npm test` | Roda a suíte inteira |
| `npm run db:setup` | Aplica o schema e os seeds |
| `npm run create-user` | Cria um usuário |

## Segurança — leia antes de publicar

O navegador fala direto com o Turso, então **o token do banco chega ao
cliente** depois do login. Quem tem uma sessão válida tem acesso total de
leitura e escrita ao banco, e o token não pode ser somente-leitura porque o app
escreve.

Mitigações, da mais fraca para a mais forte:

- ✅ Use um token **restrito a este banco**.
- 🚧 Mantenha o deploy **privado**, atrás de uma URL não adivinhável ou de
  autenticação da plataforma.
- 🛡️ **Correção de verdade (roadmap):** um proxy serverless em `/api` na frente
  do banco, para o token nunca sair do servidor.

## Roadmap

- [ ] Proxy serverless para o token do Turso
- [ ] Edição de bloco do plano dentro do app (hoje a planilha é a fonte)
- [ ] Casamento automático dos itens do plano com o catálogo de alimentos
- [ ] Planos com variação por dia da semana
- [ ] Exportar / backup

## Licença

MIT — veja [LICENSE](LICENSE).
