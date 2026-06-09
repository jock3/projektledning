// PX-Web exporterar HTML-filer med .xls-filändelse.
// Kan INTE öppnas med xlrd/openpyxl — är HTML i förklädnad.
// Svenska decimalkomman: ersätt "," med "." innan parseFloat().

const GOOGLE_CLIENT_ID     = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN");
const DRIVE_FOLDER_ID      = Deno.env.get("DRIVE_FOLDER_ID") ?? "1ofGv2ka_dh7wJWXxByG3XkW3Wp11M_K1";

export interface PersonHours {
  namn:      string;
  initialer: string;
  timmar:    number;
}

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      client_id:     GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: GOOGLE_REFRESH_TOKEN!,
      grant_type:    "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`OAuth ${res.status}: ${await res.text()}`);
  const { access_token } = await res.json();
  return access_token;
}

async function getLatestFile(token: string): Promise<{ id: string; name: string }> {
  const q   = encodeURIComponent(`'${DRIVE_FOLDER_ID}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=modifiedTime+desc&pageSize=1&fields=files(id,name)`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive list ${res.status}`);
  const { files } = await res.json();
  if (!files?.length) throw new Error("Ingen fil i Drive-mappen");
  return files[0];
}

async function downloadFile(fileId: string, token: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download ${res.status}`);
  return res.text();
}

function parseReport(html: string): { byPerson: PersonHours[]; total: number; snapshot: string } {
  // Extrahera snapshot-period (format: "202626" = vecka 26, 2026)
  let snapshot = "";
  const snapMatch = html.match(/[Vv](?:ecka)?\s*(\d{1,2})[^\d]+(20\d{2})|(20\d{2})(\d{2})/);
  if (snapMatch) {
    if (snapMatch[3]) {
      snapshot = `${snapMatch[3]}${snapMatch[4].padStart(2, "0")}`;
    } else {
      snapshot = `${snapMatch[2]}${snapMatch[1].padStart(2, "0")}`;
    }
  }

  const byPerson: PersonHours[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells: string[] = [];
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, "").trim());
    }

    if (cells.length < 3) continue;

    // Hitta kolumn med initialer (2–5 versaler)
    const initIdx = cells.findIndex(c => /^[A-ZÅÄÖ]{2,5}$/.test(c));
    if (initIdx === -1) continue;

    // Namn: troligtvis cellen precis före eller efter initialer
    const nameIdx = initIdx > 0 ? initIdx - 1 : initIdx + 1;
    if (nameIdx < 0 || nameIdx >= cells.length || cells[nameIdx].length < 3) continue;

    // Timmar: leta bakifrån efter ett numeriskt värde (hanterar sv-komma)
    let timmar = NaN;
    for (let i = cells.length - 1; i >= 0; i--) {
      const v = parseFloat(cells[i].replace(",", ".").replace(/\s/g, ""));
      if (!isNaN(v) && v > 0) { timmar = v; break; }
    }
    if (isNaN(timmar) || timmar <= 0) continue;

    byPerson.push({ namn: cells[nameIdx], initialer: cells[initIdx], timmar });
  }

  // Deduplicera på initialer — behåll högsta timantalet per person
  const seen = new Map<string, PersonHours>();
  for (const p of byPerson) {
    const existing = seen.get(p.initialer);
    if (!existing || p.timmar > existing.timmar) seen.set(p.initialer, p);
  }

  const result = [...seen.values()].sort((a, b) => b.timmar - a.timmar);
  const total  = Math.round(result.reduce((s, p) => s + p.timmar, 0) * 10) / 10;

  return { byPerson: result, total, snapshot };
}

export async function fetchPxWebData(): Promise<{ total: number; byPerson: PersonHours[]; snapshot: string } | null> {
  if (!GOOGLE_REFRESH_TOKEN || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn("Google OAuth-secrets saknas — hoppar över PX-Web-sync. Jira-data fungerar ändå.");
    return null;
  }
  try {
    const token = await getAccessToken();
    const file  = await getLatestFile(token);
    const html  = await downloadFile(file.id, token);
    console.log(`PX-Web: parsade "${file.name}"`);
    return parseReport(html);
  } catch (err) {
    console.error("PX-Web-sync misslyckades:", err);
    return null;
  }
}
