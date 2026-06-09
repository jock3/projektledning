const JIRA_URL   = Deno.env.get("JIRA_URL")!;
const JIRA_EMAIL = Deno.env.get("JIRA_EMAIL")!;
const JIRA_TOKEN = Deno.env.get("JIRA_API_TOKEN")!;

// Mappa Jira-status → meningsfulla buckets.
// VIKTIGT: "Ready For Release" är INTE aktivt arbete — lägg den i "redo".
const STATUS_TO_BUCKET: Record<string, string> = {
  "Backlog":            "backlog",
  "Att göra":           "backlog",
  "Development":        "pagar",
  "Design Approval":    "pagar",
  "Granska":            "granskning",
  "Internal Test Done": "granskning",
  "Development Done":   "granskning",
  "Ready For Release":  "redo",
  "Klart":              "klart",
  "Closed no action":   "avfort",
};

interface JiraIssue {
  key: string;
  fields: {
    summary:   string;
    status:    { name: string };
    assignee:  { displayName: string } | null;
    issuetype: { name: string };
    updated:   string;
  };
}

async function fetchAll(projectKey: string): Promise<JiraIssue[]> {
  const auth   = btoa(`${JIRA_EMAIL}:${JIRA_TOKEN}`);
  const issues: JiraIssue[] = [];
  let startAt  = 0;

  while (true) {
    const jql = encodeURIComponent(`project = ${projectKey} ORDER BY updated DESC`);
    const url = `${JIRA_URL}/rest/api/3/search?jql=${jql}&startAt=${startAt}&maxResults=100&fields=summary,status,assignee,issuetype,updated`;

    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Jira ${res.status}: ${await res.text()}`);

    const body = await res.json();
    issues.push(...body.issues);
    if (issues.length >= body.total) break;
    startAt += 100;
  }

  return issues;
}

export async function fetchJiraData(projectKey: string) {
  const issues = await fetchAll(projectKey);

  const counts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const teamCounts: Record<string, number> = {};

  for (const issue of issues) {
    const bucket = STATUS_TO_BUCKET[issue.fields.status.name] ?? "backlog";
    counts[bucket] = (counts[bucket] ?? 0) + 1;

    const type = issue.fields.issuetype.name;
    typeCounts[type] = (typeCounts[type] ?? 0) + 1;

    // Räkna bara aktivt arbete i teambelastning
    if (["backlog", "pagar", "granskning"].includes(bucket)) {
      const owner = issue.fields.assignee?.displayName ?? "Otilldelad";
      teamCounts[owner] = (teamCounts[owner] ?? 0) + 1;
    }
  }

  const aktivtKvar    = (counts.backlog ?? 0) + (counts.pagar ?? 0) + (counts.granskning ?? 0);
  const klartEllerRedo = (counts.redo ?? 0) + (counts.klart ?? 0);

  const bugIssues = issues.filter(i => /bugg?/i.test(i.fields.issuetype.name));

  return {
    total: issues.length,
    klartEllerRedo,
    aktivtKvar,
    pipeline: [
      { key: "backlog",    namn: "Backlog / Att göra",  n: counts.backlog    ?? 0 },
      { key: "pagar",      namn: "Pågår (dev/design)",  n: counts.pagar      ?? 0 },
      { key: "granskning", namn: "Granskning / test",   n: counts.granskning ?? 0 },
      { key: "redo",       namn: "Redo för release",    n: counts.redo       ?? 0 },
      { key: "klart",      namn: "Klart",               n: counts.klart      ?? 0 },
    ],
    types: Object.entries(typeCounts)
      .map(([namn, n]) => ({ namn, n }))
      .sort((a, b) => b.n - a.n),
    team: Object.entries(teamCounts)
      .map(([namn, n]) => ({ namn, n, flag: namn === "Otilldelad" }))
      .sort((a, b) => b.n - a.n),
    activity: issues.slice(0, 8).map(i => ({
      key:    i.key,
      txt:    i.fields.summary,
      status: i.fields.status.name,
      who:    i.fields.assignee?.displayName ?? "Otilldelad",
      when:   new Date(i.fields.updated).toLocaleDateString("sv-SE", { day: "numeric", month: "short" }),
    })),
    bugs: {
      aktiva:  bugIssues.filter(i => ["backlog", "pagar", "granskning"].includes(STATUS_TO_BUCKET[i.fields.status.name] ?? "backlog")).length,
      release: bugIssues.filter(i => STATUS_TO_BUCKET[i.fields.status.name] === "redo").length,
      total:   bugIssues.length,
    },
  };
}
