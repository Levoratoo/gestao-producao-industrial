# Gestao de Producao Industrial

MVP demonstrativo de gestao e monitoramento de producao industrial textil.

O projeto suporta dois modos de execucao sem trocar codigo manualmente:

- `client`: simulacao 100% no frontend, com atualizacao automatica no navegador. Esse modo funciona em GitHub Pages e em qualquer hospedagem estatica.
- `remote`: simulacao autoritativa no backend, persistida em PostgreSQL, distribuida ao frontend por SSE com fallback para polling. Esse e o modo recomendado para servidor real.

## Limite importante do GitHub

GitHub Pages nao executa:
- backend Node.js
- processos persistentes
- SSE/websocket do seu servidor
- PostgreSQL

Entao o comportamento correto e:

- **GitHub Pages**: usar `NEXT_PUBLIC_APP_RUNTIME=client`
- **Servidor real**: usar `NEXT_PUBLIC_APP_RUNTIME=remote`

Isso ja esta preparado no projeto.

## Arquitetura

### Frontend
- Next.js App Router
- `runtime-config.js` gerado em startup/build para injetar configuracao sem hardcode de `localhost`
- validacao de ambiente em runtime no bootstrap do app
- `health.json` gerado automaticamente para healthcheck do frontend

### Backend
- Node.js + Express
- PostgreSQL via `DATABASE_URL`
- `ProductionRuntimeService` responsavel pelo timer de atualizacao automatica das ordens
- SSE em `/api/production/stream` com heartbeat e `retry`
- fallback no frontend para polling quando SSE degrada
- healthcheck em `/api/health`
- logs estruturados em JSON

### Atualizacao automatica das ordens

#### Modo `client`
- mecanismo: `setInterval` no frontend
- persistencia: `localStorage`
- uso indicado: GitHub Pages, demo estatica, portfolio
- comportamento: cada navegador evolui sua propria simulacao local

#### Modo `remote`
- mecanismo principal: timer no backend
- transporte principal: SSE
- fallback: polling no frontend se a conexao SSE cair
- persistencia: PostgreSQL
- uso indicado: servidor real, homologacao, demonstracao compartilhada
- comportamento: todos os clientes veem o mesmo estado sincronizado

## Variaveis de ambiente

### Frontend
| Variavel | Obrigatoria | Descricao |
| --- | --- | --- |
| `NODE_ENV` | nao | `development`, `test` ou `production` |
| `PORT` | nao | Porta do frontend. Default `3013` |
| `FRONTEND_PORT` | nao | Sobrescreve `PORT` no frontend |
| `NEXT_PUBLIC_APP_RUNTIME` | sim | `client` ou `remote` |
| `NEXT_PUBLIC_API_URL` | obrigatoria em `remote` | URL base da API backend |
| `NEXT_PUBLIC_SSE_URL` | nao | URL completa do stream SSE |
| `NEXT_PUBLIC_HEALTH_URL` | nao | URL completa do healthcheck backend |
| `NEXT_PUBLIC_FRONTEND_URL` | nao | URL publica do frontend |
| `NEXT_PUBLIC_SYNC_TRANSPORT` | nao | `auto`, `timer` ou `sse` |

### Backend
| Variavel | Obrigatoria | Descricao |
| --- | --- | --- |
| `NODE_ENV` | nao | `development`, `test` ou `production` |
| `PORT` | nao | Porta do backend se `BACKEND_PORT` nao existir |
| `BACKEND_PORT` | nao | Porta explicita do backend. Default `4013` |
| `DATABASE_URL` | sim | URL do PostgreSQL |
| `DATABASE_SSL` | nao | `true` ou `false` |
| `FRONTEND_URL` | sim | Origem principal permitida no CORS |
| `CORS_ALLOWED_ORIGINS` | nao | Lista adicional separada por virgula |
| `SYNC_INTERVAL_MS` | nao | Intervalo do runtime automatico |
| `LOG_LEVEL` | nao | `debug`, `info`, `warn`, `error` |
| `APP_VERSION` | nao | Versao logada no healthcheck |
| `API_URL` | obrigatoria para `verify:sync` | URL publica do backend para validacao |
| `VERIFY_WAIT_MS` | nao | Janela de espera do script de validacao |

Arquivos de exemplo:
- `.env.example`
- `backend/.env.example`

## Sem Docker

Docker e opcional. O projeto pode rodar normalmente sem Docker.

### 1. GitHub Pages ou frontend estatico

Use quando a demo vai rodar sem backend.

```bash
npm ci
npm run dev
```

Acesse `http://localhost:3013`.

Nesse modo, a atualizacao automatica continua funcionando porque a simulacao roda no cliente.

Para validar o build do GitHub Pages:

```bash
npm run verify:github
```

### 2. Full stack sem Docker

Use quando voce quiser backend real com estado compartilhado.

Pre-requisitos:
- Node.js instalado
- PostgreSQL local ou remoto

Instalacao:

```bash
npm ci
npm --prefix backend ci
```

Crie os arquivos de ambiente a partir dos exemplos e ajuste as URLs.

Frontend:

```bash
npm run dev
```

Backend:

```bash
npm run backend:dev
```

Frontend em `http://localhost:3013`
Backend em `http://localhost:4013`

Para usar o backend real, configure no frontend:

```env
NEXT_PUBLIC_APP_RUNTIME=remote
NEXT_PUBLIC_API_URL=http://localhost:4013
```

## Docker

Os arquivos de Docker continuam no repositorio como opcao de infraestrutura, mas nao sao obrigatorios para desenvolvimento nem para deploy.

Arquivos:
- `Dockerfile`
- `backend/Dockerfile`
- `docker-compose.yml`

## Build de producao

### Frontend server mode

```bash
npm ci
npm run build
npm run start
```

### Frontend static export para GitHub Pages

```bash
npm ci
npm run build:pages
```

### Backend

```bash
npm --prefix backend ci
npm --prefix backend run build
npm --prefix backend run start
```

## Validacoes obrigatorias

### Validacao automatizada do repositorio

```bash
npm run verify:production
```

Esse comando executa:
- lint
- testes unitarios
- build de producao do frontend
- build estatico para GitHub Pages
- typecheck do backend
- build do backend

### Healthchecks

Frontend:
```text
GET /health.json
```

Backend:
```text
GET /api/health
```

O healthcheck do backend informa:
- status geral
- ambiente
- versao
- status do banco
- tick atual do runtime
- se a atualizacao automatica esta pausada
- ultimo erro do runtime, se houver

### Verificacao objetiva da atualizacao automatica das ordens

Com o backend em execucao:

```bash
API_URL=http://localhost:4013 npm run verify:sync
```

O script valida:
- backend respondendo
- banco conectado
- runtime automatico nao pausado
- tick das ordens avancando apos alguns segundos

Se o tick nao aumentar, o script falha com erro explicito.

## O que validar em producao

### Se publicar no GitHub Pages

1. `npm run verify:github`
2. subir a branch no GitHub
3. publicar via workflow de Pages
4. abrir a URL publicada
5. confirmar que os indicadores e ordens continuam mudando automaticamente na interface

### Se publicar em servidor real

1. frontend responde e abre normalmente
2. `GET /health.json` responde no frontend
3. `GET /api/health` responde no backend
4. `database.status` esta como `connected`
5. `runtime.isPaused` esta como `false`
6. `runtime.tick` aumenta com o tempo
7. execute `API_URL=https://sua-api npm run verify:sync`
8. abra a tela de ordens e confirme a evolucao visual das quantidades e status

## Logs esperados

No backend, os logs relevantes sao emitidos em JSON.

Eventos principais:
- `server started`
- `database connected`
- `automatic order update service started`
- `automatic order update failure`
- `automatic order update loop failed`

## GitHub e seguranca

O repositorio esta preparado para GitHub com:
- `.gitignore` cobrindo `.env`, artefatos gerados e builds locais
- apenas `.env.example` versionado
- workflow de CI em `.github/workflows/ci.yml`
- workflow de deploy Pages em `.github/workflows/deploy-pages.yml`

## GitHub Pages

Para GitHub Pages, mantenha:

```env
NEXT_PUBLIC_APP_RUNTIME=client
```

Nesse perfil:
- nao ha dependencia de backend
- nao ha dependencia de `localhost` no codigo
- a simulacao continua atualizando automaticamente no navegador apos o deploy
- o estado pode continuar persistido no navegador do usuario

URL esperada de publicacao:
- `https://levoratoo.github.io/gestao-producao-industrial/`

## Servidor de producao recomendado

Para deploy completo com estado compartilhado:
- frontend em `remote`
- backend publicado com `DATABASE_URL` de PostgreSQL remoto
- `NEXT_PUBLIC_API_URL` apontando para a API publica
- `FRONTEND_URL` e `CORS_ALLOWED_ORIGINS` ajustados para o dominio real

Exemplo:

```env
NEXT_PUBLIC_APP_RUNTIME=remote
NEXT_PUBLIC_API_URL=https://api.seudominio.com
NEXT_PUBLIC_FRONTEND_URL=https://app.seudominio.com
FRONTEND_URL=https://app.seudominio.com
CORS_ALLOWED_ORIGINS=https://app.seudominio.com
DATABASE_URL=postgresql://usuario:senha@host:5432/base
```

## Checklist tecnico

- [x] sem hardcode funcional de `localhost` no codigo da aplicacao
- [x] frontend com configuracao por variavel de ambiente e validacao em runtime
- [x] backend com validacao de ambiente na inicializacao
- [x] `DATABASE_URL` obrigatoria e validada
- [x] healthcheck do frontend
- [x] healthcheck do backend
- [x] logs de servidor, banco e runtime automatico
- [x] SSE com fallback para polling
- [x] script para verificar se o tick continua avancando
- [x] build de producao do frontend validado
- [x] build estatico para GitHub Pages validado
- [x] backend tipado e compilavel
- [x] CI para GitHub
- [x] execucao sem Docker documentada
