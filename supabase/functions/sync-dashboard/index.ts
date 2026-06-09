import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchJiraData } from "./jira.ts";
import { fetchPxWebData } from "./pxweb.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const started = Date.now();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const [jira, pxweb] = await Promise.all([
      fetchJiraData("GLOWEB"),
      fetchPxWebData(),
    ]);

    // TODO: Cinode-integration — hämta budget (kr + timmar) för uppdrag 350470.
    // När API-access är klar: lägg till under nyckeln "budget" och sätt cinodeOk: true.
    const budget = null;

    const payload = {
      project: {
        key:    "GLOWEB",
        namn:   "Globus Webshop",
        kund:   "Globus Sport",
        modell: "Fast",
      },
      ...jira,
      hours: pxweb ?? { total: 0, byPerson: [], snapshot: "" },
      budget,
      meta: {
        durationMs: Date.now() - started,
        jiraIssues: jira.total,
        pxWebOk:    pxweb !== null,
        cinodeOk:   false,
      },
    };

    const { error } = await supabase
      .from("dashboard_cache")
      .upsert(
        { project_key: "GLOWEB", data: payload, updated_at: new Date().toISOString() },
        { onConflict: "project_key" },
      );

    if (error) throw error;

    console.log(`sync-dashboard: klar på ${payload.meta.durationMs}ms`);
    return Response.json({ ok: true, durationMs: payload.meta.durationMs });
  } catch (err) {
    console.error("sync-dashboard misslyckades:", err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
});
