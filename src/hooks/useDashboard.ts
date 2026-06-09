import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export interface PipelineStep {
  key:  string;
  namn: string;
  n:    number;
}

export interface TeamMember {
  namn: string;
  n:    number;
  flag: boolean;
}

export interface ActivityItem {
  key:    string;
  txt:    string;
  status: string;
  who:    string;
  when:   string;
}

export interface PersonHours {
  namn:      string;
  initialer: string;
  timmar:    number;
}

export interface DashboardData {
  project: { key: string; namn: string; kund: string; modell: string };
  total:          number;
  klartEllerRedo: number;
  aktivtKvar:     number;
  pipeline:  PipelineStep[];
  types:     { namn: string; n: number }[];
  team:      TeamMember[];
  activity:  ActivityItem[];
  bugs:      { aktiva: number; release: number; total: number };
  hours:     { total: number; byPerson: PersonHours[]; snapshot: string };
  budget:    null | { kronor: number; timmar: number };
  meta:      { durationMs: number; jiraIssues: number; pxWebOk: boolean; cinodeOk: boolean };
}

export function useDashboard(projectKey: string) {
  const [data,      setData]      = useState<DashboardData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: row, error: err } = await supabase
        .from("dashboard_cache")
        .select("data, updated_at")
        .eq("project_key", projectKey)
        .single();

      if (err) {
        setError(err.message);
      } else if (row) {
        setData(row.data as DashboardData);
        setUpdatedAt(row.updated_at);
      }
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(`dashboard:${projectKey}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "dashboard_cache",
          filter: `project_key=eq.${projectKey}`,
        },
        (payload) => {
          setData(payload.new.data as DashboardData);
          setUpdatedAt(payload.new.updated_at as string);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectKey]);

  return { data, loading, error, updatedAt };
}
