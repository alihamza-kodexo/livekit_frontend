import "server-only";

import { db, expect } from "@/lib/supabase";
import type {
  Agent,
  CallLog,
  CallOutcome,
  Department,
  ExternalNumber,
  KnowledgeBaseEntry,
  Tool,
} from "@/lib/types";

/** An agent row plus the derived columns the list view shows. */
export type AgentListItem = Agent & {
  last_call_at: string | null;
  call_count: number;
};

export async function listAgents(): Promise<AgentListItem[]> {
  const agents = (await expect(
    db().from("agents").select("*").order("created_at", { ascending: true }),
    "listAgents",
  )) as unknown as Agent[];

  if (agents.length === 0) return [];

  // One extra query for call activity rather than N per-agent queries. Only the
  // timestamp is selected — transcripts are large and the list doesn't need them.
  const calls = (await expect(
    db()
      .from("call_logs")
      .select("agent_id, created_at")
      .order("created_at", { ascending: false }),
    "listAgents.calls",
  )) as unknown as { agent_id: string | null; created_at: string }[];

  const activity = new Map<string, { last: string; count: number }>();
  for (const call of calls) {
    if (!call.agent_id) continue;
    const existing = activity.get(call.agent_id);
    if (existing) {
      existing.count += 1;
    } else {
      // Rows arrive newest-first, so the first one seen is the latest call.
      activity.set(call.agent_id, { last: call.created_at, count: 1 });
    }
  }

  return agents.map((agent) => ({
    ...agent,
    last_call_at: activity.get(agent.agent_id)?.last ?? null,
    call_count: activity.get(agent.agent_id)?.count ?? 0,
  }));
}

export async function getAgent(agentId: string): Promise<Agent | null> {
  const { data, error } = await db()
    .from("agents")
    .select("*")
    .eq("agent_id", agentId)
    .maybeSingle();
  if (error) throw new Error(`getAgent: ${error.message}`);
  return (data as unknown as Agent) ?? null;
}

export async function listDepartments(agentId: string): Promise<Department[]> {
  return (await expect(
    db()
      .from("departments")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: true }),
    "listDepartments",
  )) as unknown as Department[];
}

export async function listKnowledgeBase(
  agentId: string,
): Promise<KnowledgeBaseEntry[]> {
  return (await expect(
    db()
      .from("knowledge_base")
      .select("*")
      .eq("agent_id", agentId)
      .order("title", { ascending: true }),
    "listKnowledgeBase",
  )) as unknown as KnowledgeBaseEntry[];
}

export async function listTools(agentId: string): Promise<Tool[]> {
  return (await expect(
    db()
      .from("tools")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: true }),
    "listTools",
  )) as unknown as Tool[];
}

export type CallLogFilters = {
  agentId?: string;
  outcome?: CallOutcome;
  /** Inclusive ISO date (YYYY-MM-DD). */
  from?: string;
  /** Inclusive ISO date (YYYY-MM-DD). */
  to?: string;
};

/** Call log list rows omit `transcript` — it's fetched only on the detail view. */
export type CallLogListItem = Omit<CallLog, "transcript">;

export async function listCallLogs(
  filters: CallLogFilters,
  limit = 100,
): Promise<CallLogListItem[]> {
  let query = db()
    .from("call_logs")
    .select(
      "call_log_id, call_sid, room_id, agent_id, caller_number, recording_url, " +
        "duration_seconds, outcome, matched_department, lead_name, lead_company, " +
        "lead_need, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.agentId) query = query.eq("agent_id", filters.agentId);
  if (filters.outcome) query = query.eq("outcome", filters.outcome);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00Z`);
  // `to` is an inclusive day, so compare against the end of that day.
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59.999Z`);

  return (await expect(query, "listCallLogs")) as unknown as CallLogListItem[];
}

export async function getCallLog(callLogId: string): Promise<CallLog | null> {
  const { data, error } = await db()
    .from("call_logs")
    .select("*")
    .eq("call_log_id", callLogId)
    .maybeSingle();
  if (error) throw new Error(`getCallLog: ${error.message}`);
  return (data as unknown as CallLog) ?? null;
}

/**
 * Which agent, if any, owns each E.164 number. This is the Supabase-side
 * routing table the Project Plan v2 describes: a call's owner is resolved by
 * looking up the dialed number here, not by per-number Twilio configuration.
 */
export async function numberAssignments(): Promise<
  Map<string, Pick<Agent, "agent_id" | "name" | "status">>
> {
  const rows = (await expect(
    db()
      .from("agents")
      .select("agent_id, name, status, twilio_number")
      .not("twilio_number", "is", null),
    "numberAssignments",
  )) as unknown as (Pick<Agent, "agent_id" | "name" | "status"> & {
    twilio_number: string;
  })[];

  return new Map(
    rows.map(({ twilio_number, ...agent }) => [twilio_number, agent]),
  );
}

/** Numbers connected from customers' own Twilio accounts -- see 0010_external_numbers.sql. */
export async function listExternalNumbers(): Promise<ExternalNumber[]> {
  return (await expect(
    db()
      .from("external_numbers")
      .select("*")
      .order("created_at", { ascending: true }),
    "listExternalNumbers",
  )) as unknown as ExternalNumber[];
}
