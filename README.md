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

Abre **http://localhost:3000**. Si te sale página en blanco, revisá con `lsof -nP -iTCP:3000 -sTCP:LISTEN` que ningún otro proceso (otro Vite/Next, etc.) tenga tomado `[::1]:3000` — en macOS `localhost` resuelve primero a `::1` (IPv6) y podés terminar pegando contra el proceso equivocado. Workaround: usá `http://127.0.0.1:3000` o matá el proceso ajeno. El `next.config.ts` ya tiene `allowedDevOrigins: ["127.0.0.1"]` para que ambos hostnames pasen el CORS dev de Next 16.

### 5. Usarlo

**Desde la UI:**
1. Selecciona uno de los 4 pacientes precargados (María, Carlos, Ana, Luis)
2. Selecciona al menos un diagnóstico del catálogo (cada uno tiene su costo de consulta/evaluación)
3. Ingresa los emails de admisiones y del gestor de casos
4. Click en "Procesar ingreso a emergencia"
5. Verás el agente razonando en vivo, llamando tools en paralelo, y los emails llegando

**Desde curl** (mismo backend, sin UI):

```bash
curl -X POST http://localhost:3000/api/webhook/admission \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "P1",
    "admissions_email": "admisiones@hospital.demo",
    "case_manager_email": "gestor@aseguradora.demo",
    "diagnosis_ids": ["apendicitis_aguda"]
  }'
```

`diagnosis_ids` requiere al menos un ID del catálogo (`data/diagnoses.json`). El total facturado se calcula sumando los costos de los diagnósticos seleccionados.

## Pacientes precargados

El diagnóstico ya no viene fijo por paciente — vos lo elegís del catálogo en cada corrida. Cada paciente trae solo su póliza y la lista de pre-existencias excluidas por contrato. Para reproducir los 4 casos clínicos clásicos del demo, elegí estos diagnósticos:

| ID | Paciente | Edad | Plan | Vigencia | Diagnósticos excluidos por contrato |
|---|---|---|---|---|---|
| P1 | María Soto | 34 | Oro (100%) | hasta 2027-08-15 | `anafilaxia_penicilina`, `migrana_cronica_refractaria` |
| P2 | Carlos Núñez | 52 | Plata (80%) | **vencida 2026-03-15** | `infarto_miocardio_agudo`, `enfermedad_renal_diabetica`, `retinopatia_diabetica` |
| P3 | Ana Reyes | 28 | Plata (80%) | hasta 2027-02-28 | `crisis_asmatica`, `estatus_asmatico`, `neumonia_obstructiva` |
| P4 | Luis Vargas | 67 | Platino (100%) | hasta 2028-11-30 | `fractura_patologica_vertebral`, `evento_cardiovascular_mayor` |

**Historias sugeridas:**
- **P1 + `apendicitis_aguda`** → cobertura plena (copago = deducible $80).
- **P2 + cualquier diagnóstico** → cobertura denegada (póliza vencida — la fecha hoy es posterior a `valid_until`).
- **P3 + `crisis_asmatica`** → cobertura denegada por exclusión de pre-existencia.
- **P4 + `fractura_cadera`** → cobertura plena (copago = deducible $40).
- **P3 + `gastroenteritis_aguda`** → cobertura plena (mismo paciente, diagnóstico no excluido).

## Notas

**Cuotas free tier:**
- Gemini 2.5 Flash: 20 RPM, ~250 RPD. Si te corta, agrega `GEMINI_USE_FALLBACK=1` al `.env` para usar `gemini-3.1-flash-lite` (más generoso pero ~2-3s más lento).
- Brevo: 300 emails/día.

**Rate limit del propio backend:** 3 req/min por IP, 8 req/min global. Suficiente para demo en vivo, protege contra burns accidentales del quota de Gemini.

**Email entrega:** primer envío desde un nuevo sender suele caer en spam. Revisa la carpeta de spam si no aparece en el inbox.

## Estructura

```
app/
  api/chat/route.ts                # endpoint para useChat (UI)
  api/webhook/admission/route.ts   # endpoint para curl
  page.tsx                         # UI principal
components/
  agent-timeline.tsx               # render del agente razonando + DecisionBanner
  tool-card.tsx                    # cada tool call como una línea
  email-preview.tsx                # preview de emails enviados
  patient-selector.tsx             # selector de pacientes (ID + nombre + edad)
  catalog-selector.tsx             # multi-select de diagnósticos del catálogo
  email-inputs.tsx                 # inputs de email
lib/
  agent.ts                         # orquesta streamText + tools + safety net
  tools.ts                         # validate_policy, check_preexisting (multi-dx), compute_copay, send_notifications
  prompt.ts                        # system prompt del agente
  email.ts                         # nodemailer + Brevo SMTP + templates
  ratelimit.ts                     # in-memory sliding window
  data.ts                          # carga JSON de pacientes/pólizas/condiciones/diagnósticos
  types.ts                         # schemas Zod (Patient, Policy, Conditions, CatalogItem, AdmissionEvent)
data/
  patients.json                    # 4 pacientes (sin diagnóstico fijo — se elige por corrida)
  policies.json                    # pólizas (Oro/Plata/Platino) — vigencia vía valid_until
  conditions.json                  # pre-existencias declaradas y diagnósticos excluidos por paciente
  diagnoses.json                   # catálogo de 15 diagnósticos con costo de consulta/evaluación
```
