# GLOWEB Dashboard — Claude Code Delivery Package

> Lägg den här filen som `CLAUDE.md` i projektroten.
> Claude Code läser den automatiskt som kontext vid varje session.

---

## Vad detta är

En **live-uppdaterad projektdashboard** för uppdraget **Globus Webshop (GLOWEB)** på Milou Communication AB. Dashboarden visar realtidsdata från Jira (ärendestatus, teambelastning, aktivitet) kombinerat med faktiska nedlagda timmar från PX-Web (tidrapporteringssystem). Budget (planerade timmar + kronor) kopplas in senare via **Cinode**.

Data flödar: **Jira + Google Drive (PX-Web) → Supabase Edge Function → cache-tabell → React-dashboard** som uppdateras automatiskt via Supabase Realtime.

---

## Repositorystruktur

```
project-root/
├── CLAUDE.md                          ← den här filen
├── .env.local                         ← VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
│
├── supabase/
│   ├── migrations/
│   │   └── 001_dashboard_cache.sql    ✅ KLAR
│   └── functions/
│       └── sync-dashboard/
│           ├── index.ts               ✅ KLAR — huvud-orchestrator
│           ├── jira.ts                ✅ KLAR — Jira-hämtning + aggregering
│           └── pxweb.ts               ✅ KLAR — PX-Web-parsning + Drive-nedladdning
│
└── src/
    ├── hooks/
    │   └── useDashboard.ts            ✅ KLAR — React-hook, Supabase + Realtime
    └── components/
        └── GlowebDashboard.jsx        ⚠️  FINNS — men använder hårdkodad data
                                           BEHÖVER kopplas till useDashboard-hooken
```

---

## Färdiga filer (levererade, lägg på rätt plats)

| Levererad fil | Destination i projektet |
|---|---|
| `001_dashboard_cache.sql` | `supabase/migrations/001_dashboard_cache.sql` |
| `sync-dashboard-index.ts` | `supabase/functions/sync-dashboard/index.ts` |
| `sync-dashboard-jira.ts` | `supabase/functions/sync-dashboard/jira.ts` |
| `sync-dashboard-pxweb.ts` | `supabase/functions/sync-dashboard/pxweb.ts` |
| `useDashboard.ts` | `src/hooks/useDashboard.ts` |
| `globweb-dashboard.jsx` | `src/components/GlowebDashboard.jsx` |

---

## Arkitektur

```
┌─────────────────┐    ┌─────────────────────────────────────────┐    ┌──────────────────┐
│   Datakällor    │    │           Supabase (backend)             │    │ Frontend         │
│                 │    │                                          │    │ (GitHub Pages)   │
│  Jira           │───▶│  Edge Function: sync-dashboard           │    │                  │
│  milou-jira     │    │  – hämtar Jira (JQL, paginerat)          │    │  GlowebDashboard │
│  .atlassian.net │    │  – laddar PX-Web-fil från Drive          │───▶│  .jsx            │
│                 │    │  – aggregerar + slår ihop                │    │  (React)         │
│  Google Drive   │───▶│  – skriver JSON till dashboard_cache     │    │                  │
│  PX-rapporter/  │    │                         │                │    │  useDashboard    │
│  pxwebreport    │    │  pg_cron (var 15 min) ──┘                │    │  .ts (hook)      │
│  .xls           │    │                                          │    │                  │
│                 │    │  dashboard_cache (tabell)                 │───▶│  Supabase        │
│  Cinode         │    │  – en rad per projekt (GLOWEB)           │    │  Realtime        │
│  (TODO)         │───▶│  – project_key, updated_at, data (jsonb) │    │  (auto-refresh)  │
└─────────────────┘    └─────────────────────────────────────────┘    └──────────────────┘
```

---

## Kända konstanter (hardkoda inte om inte nödvändigt — använd secrets)

| Värde | Källa |
|---|---|
| Jira-site | `https://milou-jira.atlassian.net` |
| Projektnyckeln | `GLOWEB` |
| Drive-mapp-ID | `1ofGv2ka_dh7wJWXxByG3XkW3Wp11M_K1` |
| Drive-mapp-sökväg | Min enhet → Claude → PX rapporter |
| Supabase-tabell | `dashboard_cache` |
| Cache-nyckel | `project_key = 'GLOWEB'` |
| Kund | Globus Sport |
| Uppdragstyp | Kundprojekt (Debiterbart) |
| Uppdragsnummer | 350470 |
| Uppdragsledare | Frida Sjödahl (FSJ) |

---

## Supabase Secrets som måste sättas

```bash
supabase secrets set JIRA_URL=https://milou-jira.atlassian.net
supabase secrets set JIRA_EMAIL=<din@epost.se>
supabase secrets set JIRA_API_TOKEN=<från id.atlassian.com/manage-profile/security/api-tokens>
supabase secrets set DRIVE_FOLDER_ID=1ofGv2ka_dh7wJWXxByG3XkW3Wp11M_K1
supabase secrets set GOOGLE_CLIENT_ID=<från GCP Console>
supabase secrets set GOOGLE_CLIENT_SECRET=<från GCP Console>
supabase secrets set GOOGLE_REFRESH_TOKEN=<se avsnitt Google OAuth nedan>
```

### Google OAuth — hur man får GOOGLE_REFRESH_TOKEN

Google Drive API kräver OAuth. Gör så här en gång:

1. Gå till [GCP Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Skapa OAuth 2.0 Client ID (typ: Desktop app)
3. Aktivera Google Drive API för projektet
4. Kör lokalt:
   ```bash
   # Installera google-auth-library
   npx ts-node scripts/get-google-token.ts
   ```
5. Logga in med Gustav Mattssons Google-konto (gustav.mattsson.1997@gmail.com)
6. Kopiera `refresh_token` från outputen → sätt som Supabase secret

**Script att skapa: `scripts/get-google-token.ts`**
```typescript
import { OAuth2Client } from "google-auth-library";
import * as readline from "readline";

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "urn:ietf:wg:oauth:2.0:oob"
);

const url = client.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/drive.readonly"],
});

console.log("Öppna:", url);
const rl = readline.createInterface({ input: process.stdin });
rl.question("Klistra in koden: ", async (code) => {
  const { tokens } = await client.getToken(code);
  console.log("GOOGLE_REFRESH_TOKEN =", tokens.refresh_token);
  rl.close();
});
```

---

## Dataformat som flödar genom systemet

### Vad Edge Function skriver till `dashboard_cache.data` (JSONB)

```typescript
{
  project: {
    key: "GLOWEB",
    namn: "Globus Webshop",
    kund: "Globus Sport",
    modell: "Fast"
  },

  // Från Jira
  total: 233,            // totalt antal ärenden
  klartEllerRedo: 180,   // Klart + Ready For Release
  aktivtKvar: 50,        // Backlog + Pågår + Granskning/test

  pipeline: [
    { key: "backlog",    namn: "Backlog / Att göra", n: 31  },
    { key: "pagar",      namn: "Pågår (dev/design)", n: 3   },
    { key: "granskning", namn: "Granskning / test",  n: 16  },
    { key: "redo",       namn: "Redo för release",   n: 122 },
    { key: "klart",      namn: "Klart",              n: 58  }
  ],

  types: [
    { namn: "Utveckling", n: 109 },
    { namn: "Bugg",       n: 70  },
    // ...sorterat fallande
  ],

  team: [  // aktivt arbete per person (exkl. release + klart)
    { namn: "Björn Andreasson", n: 21, flag: false },
    { namn: "Otilldelad",       n: 9,  flag: true  },  // flag=true = saknar ägare
    { namn: "Gustav Mattsson",  n: 6,  flag: false },
    // ...
  ],

  activity: [  // 8 senast uppdaterade ärenden
    { key: "GLOWEB-204", txt: "Inställningar kakor: uppdatera infotexter",
      status: "Att göra", who: "Gustav Mattsson", when: "8 jun" },
    // ...
  ],

  bugs: { aktiva: 26, release: 37, total: 70 },

  // Från PX-Web (Google Drive)
  hours: {
    total: 883,
    byPerson: [
      { namn: "Alex Hjortenkrans", initialer: "AHJ", timmar: 339   },
      { namn: "Björn Andreasson", initialer: "BJA",  timmar: 224.5 },
      // ...sorterat fallande
    ],
    snapshot: "202626"  // senaste perioden i rapporten
  },

  // Cinode budget (TODO — null tills integration är klar)
  budget: null,

  meta: {
    durationMs: 1240,
    jiraIssues: 233,
    pxWebOk: true,
    cinodeOk: false
  }
}
```

---

## Kritiska tekniska beslut (läs detta noga)

### 1. Workflow-bucketing — inte rå statusCategory

Jira-workflow för GLOWEB parkerar **färdigt arbete** i statusen `Ready For Release` (122 ärenden).
Jiras inbyggda `statusCategory` klassificerar detta som `"In Progress"` (indeterminate),
vilket ger missvisande siffror (87% "pågående").

**Lösningen:** Mappa statuses till meningsfulla buckets manuellt i `jira.ts`:

```typescript
const STATUS_TO_BUCKET = {
  "Backlog":            "backlog",
  "Att göra":           "backlog",
  "Development":        "pagar",
  "Design Approval":    "pagar",
  "Granska":            "granskning",
  "Internal Test Done": "granskning",
  "Development Done":   "granskning",
  "Ready For Release":  "redo",      // ← parkerad, INTE aktiv
  "Klart":              "klart",
  "Closed no action":   "avfort",
};
```

`aktivtKvar` = backlog + pågår + granskning (de som faktiskt rör sig).
`klartEllerRedo` = redo + klart (arbetet i praktiken färdigt).

**Lägg aldrig till `Ready For Release` i `aktivtKvar`** — det är ett common mistake.

### 2. PX-Web exporterar HTML med .xls-extension

PX-Web (tidrapporteringssystem) exporterar rapporter som **HTML-filer** med `.xls`-filändelse.
Filen kan INTE öppnas med `xlrd` eller `openpyxl` — den är HTML i förklädnad.

Parsning sker med `pd.read_html()` (Python) eller regex-baserat i Deno (`pxweb.ts`).

**Kritiskt: svenska decimalkomman.** Filen använder `,` som decimaltecken (`35,5` inte `35.5`).
Utan korrekt hantering multipliceras alla tal med 10 (883 → 8830).

I Deno (`pxweb.ts`): `s.replace(",", ".")` innan `parseFloat()`.
I Python: `pd.read_html(file, decimal=',', thousands=' ')`.

### 3. Google Drive-mapp som "tidbank"

PX-Web-rapporter laddas upp manuellt till Drive-mappen (samma filnamn, ersätts varje gång):
- **Mapp:** Min enhet → Claude → PX rapporter
- **Mapp-ID:** `1ofGv2ka_dh7wJWXxByG3XkW3Wp11M_K1`
- **Rekommendation:** Alltid samma filnamn (`pxwebreport.xls`) → Edge Function
  hämtar senast ändrade filen, ingen namnhantering behövs.

### 4. Inga tidsloggar i Jira

GLOWEB har **noll tidsloggar** i Jira (bekräftat via API). Använd aldrig
`timetracking`-fält från Jira för detta projekt — alla timmar kommer från PX-Web.

### 5. Inga due dates i Jira

Inget ärende i GLOWEB har `duedate` satt. Deadlines för projektet finns
enbart i avtal/ekonomisystem (ev. Cinode). Visa inte "dagar kvar" baserat
på Jira-data för detta projekt — det kommer alltid vara tomt.

---

## Det enda som återstår att göra

### Prioritet 1 — Koppla in live-data i dashboarden

`GlowebDashboard.jsx` använder idag hårdkodade konstanter (`PIPELINE`, `TEAM`, osv.).
Den måste uppdateras till att använda `useDashboard`-hooken:

```jsx
// GlowebDashboard.jsx — ändra från:
const PIPELINE = [ /* hårdkodad */ ];

// Till:
import { useDashboard } from "../hooks/useDashboard";
export default function GlowebDashboard() {
  const { data, loading } = useDashboard("GLOWEB");
  if (loading || !data) return <LoadingState />;
  // Använd data.pipeline, data.team, data.activity, data.hours, osv.
}
```

Dataformatet matchar exakt vad hooken levererar (se avsnitt Dataformat ovan).

### Prioritet 2 — Deploy och test

```bash
# 1. Kör migration
supabase db push

# 2. Deploya Edge Function
supabase functions deploy sync-dashboard

# 3. Sätt alla secrets (se avsnitt Secrets ovan)

# 4. Triggera manuellt för att verifiera
curl -X POST https://<ref>.supabase.co/functions/v1/sync-dashboard \
  -H "Authorization: Bearer <service-role-key>"

# 5. Kontrollera att data hamnade i tabellen
supabase db query "select updated_at, jsonb_pretty(data) from dashboard_cache;"
```

### Prioritet 3 — Google OAuth setup

Kör `scripts/get-google-token.ts` (se avsnitt Google OAuth ovan) för att
generera `GOOGLE_REFRESH_TOKEN`. Utan det är PX-Web-integrationen inaktiv
men Jira-datan fungerar fortfarande.

### Prioritet 4 — Cinode-integration (väntar på bekräftelse)

`index.ts` har ett tydligt `// TODO`-block för Cinode. När API-access är klar:
1. Hämta budget (kronor + timmar) för uppdrag 350470
2. Lägg till i payload under nyckeln `budget`
3. Uppdatera `DashboardData`-interfacet i `useDashboard.ts`
4. Aktivera budget-panelen i `GlowebDashboard.jsx`

---

## Teamet (för referens)

| Namn | Initialer | Roll |
|---|---|---|
| Alex Hjortenkrans | AHJ | Utvecklare |
| Björn Andreasson | BJA | Utvecklare (mest aktiv) |
| Elin Gustafsson | ELG | Designer / ID |
| Frida Sjödahl | FSJ | Uppdragsledare |
| Gustav Mattsson | GMA | PL (= du) |
| Josefin Rennemark | JRE | Tillgänglighet / test |
| Karin Weandin | KWE | — |
| Kiersti Lorentzon | KLO | — |
| Matilda Taylor | MATX | — |
| Robert Blomqvist | ROB | Drift / hosting |
| Therese Hägglund | THH | Test |

---

## Kontext om GLOWEB-projektet

- **233 ärenden** totalt (feb 2026 – pågående)
- **Projektet är i praktiken byggt:** 180/233 ärenden (77%) är i "Ready For Release" eller "Klart"
- **Projektet är i release-fas** — det som återstår är 50 aktiva ärenden (31 backlog + 16 test + 3 dev)
- **26 aktiva buggar** (varav 37 stycken fixade och redo för release)
- **9 aktiva ärenden saknar ägare** — bör tilldelas
- **Björn Andreasson** bär lejonparten av återstående arbete (21 aktiva ärenden)
- **Nedlagda timmar hittills:** 883 h (fr.o.m. v.46 2025)

---

## Design (GlowebDashboard.jsx)

Dashboarden följer Gustavs etablerade designsystem:

```javascript
const C = {
  bg: "#0E0E0F",       // varm near-black bakgrund
  panel: "#161618",    // panel-yta
  panel2: "#1E1E21",   // nästlad yta / hover
  line: "#2A2A2E",     // borders
  text: "#F2EFEA",     // primär text (varm vit)
  muted: "#8C887F",    // sekundär text
  faint: "#5A5852",    // tertiär / hints
  red: "#D63B3B",      // risk / buggar / kritiskt
  blue: "#2E6FD4",     // info / pågår
  teal: "#3B9388",     // på spår / redo för release
  amber: "#E0A340",    // bevaka / varning
  green: "#4F9D69",    // klart / done
};

// Typsnitt
const MONO = "'IBM Plex Mono', ui-monospace, ..."; // siffror
const SANS = "'Montserrat', ui-sans-serif, ...";    // UI-text
```

Pipeline-steg visas med färger: grey → blue → amber → teal → green (Backlog → Klart).
Källa: Google Fonts — Montserrat + IBM Plex Mono (importerat via @import i style-taggen).

---

## Relaterade projekt på milou-jira

Andra projekt som existerar (för framtida multi-projekt-support):

| Nyckel | Namn |
|---|---|
| GLOWEB | Globus Webshop (detta projektet) |
| MCTRGPLAN | MCT RGPlan |
| AFVFOR | Affärsverken – Förvaltning |
| MOLWEBP2 | Mölndalsbostäder – Ny Webb paket 2 |
| MCTWEB | MCT Webb |

---

*Genererat: 9 juni 2026 | Milou Communication AB × Claude*
