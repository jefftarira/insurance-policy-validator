# Insurance policy validator

Agente IA que valida en tiempo real una póliza de seguros médica cuando un paciente ingresa a emergencias hospitalarias. Verifica vigencia de la póliza, revisa pre-existencias declaradas, calcula el copago según deducible y cobertura, y notifica simultáneamente al departamento de admisiones del hospital y al gestor de casos del seguro vía email.

**Memorable thing:** ver al agente razonar paso a paso como un médico clínico en vivo, mientras se envían los emails reales.

## Stack

- **Next.js 16** (App Router, Node runtime)
- **Vercel AI SDK v6** + **Gemini 2.5 Flash** (con fallback a 3.1 Flash Lite)
- **Brevo SMTP** vía `nodemailer` para envío de correo (300 emails/día gratis)
- **Tailwind v4** con sistema de diseño clínico custom
- **Zod 4** para schemas
- **TypeScript 5**

## Cómo correr localmente

### 1. Prerrequisitos

- Node.js 20+ (probado en 24)
- `pnpm` (la instalación de deps usa `pnpm-workspace.yaml`)

### 2. Instalar dependencias

```bash
pnpm install
```

### 3. Configurar variables de entorno

Copia el ejemplo y rellena con tus credenciales:

```bash
cp .env.example .env
```

Edita `.env` y agrega:

- `GOOGLE_GENERATIVE_AI_API_KEY` — gratis en https://aistudio.google.com/apikey
- `BREVO_SMTP_USER` y `BREVO_SMTP_PASS` — gratis en https://app.brevo.com → SMTP & API → SMTP tab
- `EMAIL_FROM` — formato `"Display Name <email@dominio.com>"`. El email debe estar verificado como Sender en Brevo (tu email de login viene auto-verificado).

### 4. Arrancar el dev server

```bash
pnpm dev
```

Abre **http://localhost:3000** (no `127.0.0.1` — el cert TLS y CORS de Next dev mode prefieren `localhost`).

### 5. Usarlo

**Desde la UI:**
1. Selecciona uno de los 4 pacientes precargados (María, Carlos, Ana, Luis)
2. Ingresa los emails de admisiones y del gestor de casos
3. Click en "Procesar ingreso a emergencia"
4. Verás el agente razonando en vivo, llamando tools en paralelo, y los emails llegando

**Desde curl** (mismo backend, sin UI):

```bash
curl -X POST http://localhost:3000/api/webhook/admission \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "P1",
    "admissions_email": "admisiones@hospital.demo",
    "case_manager_email": "gestor@aseguradora.demo"
  }'
```

## Pacientes precargados

| ID | Paciente | Edad | Diagnóstico | Costo USD | Resultado esperado |
|---|---|---|---|---|---|
| P1 | María Soto | 34 | Apendicitis aguda | $1,800 | Cobertura plena (copago $80) |
| P2 | Carlos Núñez | 52 | Dolor torácico | $450 | Cobertura denegada (póliza vencida) |
| P3 | Ana Reyes | 28 | Crisis asmática | $280 | Cobertura denegada (exclusión por asma declarada) |
| P4 | Luis Vargas | 67 | Fractura de cadera | $4,500 | Cobertura plena (copago $40) |

## Notas

**Cuotas free tier:**
- Gemini 2.5 Flash: 20 RPM, ~250 RPD. Si te corta, agrega `GEMINI_USE_FALLBACK=1` al `.env` para usar `gemini-3.1-flash-lite` (más generoso pero ~2-3s más lento).
- Brevo: 300 emails/día.

**Rate limit del propio backend:** 3 req/min por IP, 8 req/min global. Suficiente para demo en vivo, protege contra burns accidentales del quota de Gemini.

**Email entrega:** primer envío desde un nuevo sender suele caer en spam. Revisa la carpeta de spam si no aparece en el inbox.

**Localhost vs 127.0.0.1:** Next 16 trata ambos como orígenes distintos. El `next.config.ts` ya tiene `allowedDevOrigins: ["127.0.0.1"]` para que funcione en ambos, pero `localhost` es el camino confirmado.

## Estructura

```
app/
  api/chat/route.ts                # endpoint para useChat (UI)
  api/webhook/admission/route.ts   # endpoint para curl
  page.tsx                         # UI principal
components/
  agent-timeline.tsx               # render del agente razonando
  tool-card.tsx                    # cada tool call como una línea
  email-preview.tsx                # preview de emails enviados
  patient-selector.tsx             # selector de pacientes
  email-inputs.tsx                 # inputs de email
lib/
  agent.ts                         # orquesta streamText + tools + safety net
  tools.ts                         # validate_policy, check_preexisting, compute_copay, send_notifications
  prompt.ts                        # system prompt del agente
  email.ts                         # nodemailer + Brevo SMTP + templates
  ratelimit.ts                     # in-memory sliding window
  data.ts                          # carga JSON de pacientes/pólizas/condiciones
  types.ts                         # schemas Zod
data/
  patients.json                    # 4 pacientes con costos de ingreso
  policies.json                    # pólizas (Oro/Plata/Platino) — sin status, vigencia vía valid_until
  conditions.json                  # pre-existencias declaradas y diagnósticos excluidos
```
