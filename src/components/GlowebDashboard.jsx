import { useDashboard } from "../hooks/useDashboard";

const C = {
  bg:     "#0E0E0F",
  panel:  "#161618",
  panel2: "#1E1E21",
  line:   "#2A2A2E",
  text:   "#F2EFEA",
  muted:  "#8C887F",
  faint:  "#5A5852",
  red:    "#D63B3B",
  blue:   "#2E6FD4",
  teal:   "#3B9388",
  amber:  "#E0A340",
  green:  "#4F9D69",
};

const MONO = "'IBM Plex Mono', ui-monospace, 'Cascadia Mono', monospace";
const SANS = "'Montserrat', ui-sans-serif, system-ui, sans-serif";

const BUCKET_COLOR = {
  backlog:    C.faint,
  pagar:      C.blue,
  granskning: C.amber,
  redo:       C.teal,
  klart:      C.green,
};

const box = {
  background:   C.panel,
  border:       `1px solid ${C.line}`,
  borderRadius: 8,
  padding:      "16px 20px",
};

const label = {
  fontFamily:    SANS,
  fontSize:      11,
  color:         C.faint,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom:  14,
};

const centerWrap = {
  background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", fontFamily: SANS, gap: 12, padding: 32,
};

function LoadingState() {
  return (
    <div style={centerWrap}>
      <span style={{ color: C.muted, fontSize: 13, letterSpacing: "0.05em" }}>Laddar dashboard…</span>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div style={centerWrap}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: C.red, textAlign: "center", maxWidth: 480 }}>
        {message}
      </span>
    </div>
  );
}

function NoDataState() {
  return (
    <div style={centerWrap}>
      <span style={{ fontFamily: SANS, fontSize: 14, color: C.muted }}>Ingen data ännu</span>
      <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint, textAlign: "center", maxWidth: 480 }}>
        Kör Edge Function för att fylla dashboarden:
      </span>
      <pre style={{ fontFamily: MONO, fontSize: 11, color: C.faint, background: C.panel, padding: "10px 16px", borderRadius: 6, border: `1px solid ${C.line}` }}>
{`curl -X POST https://<ref>.supabase.co/functions/v1/sync-dashboard \\
  -H "Authorization: Bearer <service-role-key>"`}
      </pre>
    </div>
  );
}

function Stat({ label: lbl, value, sub, color }) {
  return (
    <div style={{ ...box, flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 500, color: color ?? C.text, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 12, color: C.muted, marginTop: 6 }}>{lbl}</div>
      {sub && <div style={{ fontFamily: MONO, fontSize: 10, color: C.faint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Bar({ pct, color, height = 5 }) {
  return (
    <div style={{ flex: 1, height, background: C.panel2, borderRadius: height / 2, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: height / 2 }} />
    </div>
  );
}

function Pipeline({ steps, total }) {
  return (
    <div style={box}>
      <div style={label}>Pipeline</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {steps.map(step => {
          const pct   = total > 0 ? (step.n / total) * 100 : 0;
          const color = BUCKET_COLOR[step.key] ?? C.faint;
          return (
            <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: SANS, fontSize: 12, color: C.muted, width: 162, flexShrink: 0 }}>
                {step.namn}
              </span>
              <Bar pct={pct} color={color} />
              <span style={{ fontFamily: MONO, fontSize: 12, color, width: 28, textAlign: "right", flexShrink: 0 }}>
                {step.n}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Team({ team }) {
  const max = Math.max(...team.map(t => t.n), 1);
  return (
    <div style={{ ...box, flex: 1 }}>
      <div style={label}>Teambelastning</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {team.map(m => (
          <div key={m.namn} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: SANS, fontSize: 12, color: m.flag ? C.amber : C.text, width: 172, flexShrink: 0 }}>
              {m.namn}{m.flag && <span style={{ marginLeft: 5, fontSize: 10 }}>⚠</span>}
            </span>
            <Bar pct={(m.n / max) * 100} color={m.flag ? C.amber : C.blue} />
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted, width: 22, textAlign: "right", flexShrink: 0 }}>
              {m.n}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Activity({ activity }) {
  const sc = s => {
    const l = s.toLowerCase();
    if (l.includes("klart"))           return C.green;
    if (l.includes("redo"))            return C.teal;
    if (l.includes("granska") || l.includes("test")) return C.amber;
    if (l.includes("pågår") || l.includes("development")) return C.blue;
    return C.faint;
  };
  return (
    <div style={{ ...box, flex: 1 }}>
      <div style={label}>Senaste aktivitet</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {activity.map(item => (
          <div key={item.key} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint, flexShrink: 0, paddingTop: 1, width: 82 }}>
              {item.key}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: SANS, fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.txt}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: sc(item.status) }}>{item.status}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>·</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>{item.who}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>·</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>{item.when}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Hours({ hours }) {
  if (!hours?.total) return null;
  const max = Math.max(...hours.byPerson.map(p => p.timmar), 1);
  const snap = hours.snapshot
    ? `v.${hours.snapshot.slice(4)} ${hours.snapshot.slice(0, 4)}`
    : "";
  return (
    <div style={box}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <span style={label}>Nedlagda timmar</span>
        {snap && <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>{snap}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {hours.byPerson.map(p => (
          <div key={p.initialer} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint, width: 36, flexShrink: 0 }}>
              {p.initialer}
            </span>
            <span style={{ fontFamily: SANS, fontSize: 12, color: C.muted, width: 168, flexShrink: 0 }}>
              {p.namn}
            </span>
            <Bar pct={(p.timmar / max) * 100} color={C.teal} />
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.text, width: 54, textAlign: "right", flexShrink: 0 }}>
              {p.timmar} h
            </span>
          </div>
        ))}
        <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 6, paddingTop: 8, display: "flex", justifyContent: "flex-end" }}>
          <span style={{ fontFamily: MONO, fontSize: 13, color: C.text }}>
            Totalt: {hours.total} h
          </span>
        </div>
      </div>
    </div>
  );
}

export default function GlowebDashboard() {
  const { data, loading, error, updatedAt } = useDashboard("GLOWEB");

  if (loading)  return <LoadingState />;
  if (error)    return <ErrorState message={error} />;
  if (!data)    return <NoDataState />;

  const donePct = data.total > 0 ? Math.round((data.klartEllerRedo / data.total) * 100) : 0;
  const ts = updatedAt
    ? new Date(updatedAt).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: SANS, padding: "24px 32px", boxSizing: "border-box" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Montserrat:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>GLOWEB</h1>
            <span style={{ fontSize: 13, color: C.faint }}>—</span>
            <span style={{ fontSize: 13, color: C.muted }}>{data.project.namn}</span>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 5 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{data.project.kund}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>·</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{data.project.modell}</span>
          </div>
        </div>
        {ts && (
          <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint, paddingTop: 4 }}>
            Uppdaterad {ts}
          </span>
        )}
      </div>

      {/* Nyckeltal */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <Stat label="Ärenden totalt" value={data.total} />
        <Stat label="Klart / Redo" value={`${donePct}%`} sub={`${data.klartEllerRedo} ärenden`} color={C.green} />
        <Stat label="Aktivt kvar" value={data.aktivtKvar} sub="backlog + dev + test" color={C.amber} />
        <Stat
          label="Aktiva buggar"
          value={data.bugs.aktiva}
          sub={`${data.bugs.release} redo · ${data.bugs.total} totalt`}
          color={data.bugs.aktiva > 0 ? C.red : C.green}
        />
        {data.hours.total > 0 && (
          <Stat label="Nedlagda timmar" value={`${data.hours.total} h`} color={C.teal} />
        )}
      </div>

      {/* Pipeline */}
      <div style={{ marginBottom: 14 }}>
        <Pipeline steps={data.pipeline} total={data.total} />
      </div>

      {/* Team + Aktivitet */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <Team team={data.team} />
        <Activity activity={data.activity} />
      </div>

      {/* Timmar */}
      {data.hours.total > 0 && (
        <div style={{ marginBottom: 14 }}>
          <Hours hours={data.hours} />
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>
          Jira: {data.meta.jiraIssues} ärenden
          {" · "}PX-Web: {data.meta.pxWebOk ? "✓" : "—"}
          {" · "}{data.meta.durationMs} ms
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.faint }}>
          Milou Communication AB
        </span>
      </div>
    </div>
  );
}
