import { useEffect, useMemo, useState } from "react";
import { Gamepad2, MessageSquare, Network, Sparkles } from "lucide-react";
import { fetchJson } from "../hooks/use-api";

interface PlayWorld {
  readonly id: string;
  readonly title: string;
  readonly premise: string;
  readonly mode: "open" | "guided";
  readonly updatedAt: string;
}

interface PlayRunSummary {
  readonly id: string;
  readonly updatedAt: string;
  readonly eventCount: number;
  readonly transcriptCount: number;
}

interface PlayEntity {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly summary?: string;
  readonly status?: string;
}

interface PlayEdge {
  readonly id: string;
  readonly fromId: string;
  readonly type: string;
  readonly toId: string;
}

interface PlayStateSlot {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  readonly value: unknown;
}

interface PlayEvent {
  readonly id: string;
  readonly turn: number;
  readonly actionKind: string;
  readonly outcomeSummary?: string;
}

interface PlayGraphSnapshot {
  readonly entities: ReadonlyArray<PlayEntity>;
  readonly edges: ReadonlyArray<PlayEdge>;
  readonly stateSlots: ReadonlyArray<PlayStateSlot>;
  readonly events: ReadonlyArray<PlayEvent>;
}

interface PlayRunResponse {
  readonly worldId: string;
  readonly runId: string;
  readonly transcript: ReadonlyArray<{
    readonly role: "user" | "assistant" | "system" | "tool";
    readonly content: string;
    readonly timestamp?: number;
  }>;
  readonly currentState: unknown;
  readonly graph: PlayGraphSnapshot;
}

const EMPTY_GRAPH: PlayGraphSnapshot = {
  entities: [],
  edges: [],
  stateSlots: [],
  events: [],
};

export function PlayPage() {
  const [worlds, setWorlds] = useState<PlayWorld[]>([]);
  const [runs, setRuns] = useState<PlayRunSummary[]>([]);
  const [selectedWorldId, setSelectedWorldId] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [run, setRun] = useState<PlayRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedWorld = useMemo(
    () => worlds.find((world) => world.id === selectedWorldId) ?? null,
    [selectedWorldId, worlds],
  );
  const graph = run?.graph ?? EMPTY_GRAPH;
  const visibleTranscript = useMemo(
    () => run?.transcript.filter((turn) => turn.role === "user" || turn.role === "assistant") ?? [],
    [run],
  );
  const latestAssistantScene = useMemo(() => {
    const scenes = visibleTranscript.filter((turn) => turn.role === "assistant");
    return scenes.length > 0 ? scenes[scenes.length - 1]?.content ?? "" : "";
  }, [visibleTranscript]);
  const recentPlayerActions = useMemo(
    () => visibleTranscript.filter((turn) => turn.role === "user").slice(-4),
    [visibleTranscript],
  );

  useEffect(() => {
    let cancelled = false;
    const loadWorlds = async () => {
      setError(null);
      try {
        const result = await fetchJson<{ worlds: PlayWorld[] }>("/play/worlds");
        if (cancelled) return;
        setWorlds(result.worlds);
        if (!selectedWorldId && result.worlds[0]) {
          setSelectedWorldId(result.worlds[0].id);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };
    void loadWorlds();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedWorldId) return;
    let cancelled = false;
    const loadRuns = async () => {
      setError(null);
      try {
        const result = await fetchJson<{ runs: PlayRunSummary[] }>(
          `/play/worlds/${encodeURIComponent(selectedWorldId)}/runs`,
        );
        if (cancelled) return;
        setRuns(result.runs);
        setSelectedRunId((current) => current && result.runs.some((item) => item.id === current)
          ? current
          : result.runs[0]?.id ?? "main");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };
    void loadRuns();
    return () => {
      cancelled = true;
    };
  }, [selectedWorldId]);

  useEffect(() => {
    if (!selectedWorldId || !selectedRunId) return;
    let cancelled = false;
    const loadRun = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchJson<PlayRunResponse>(
          `/play/runs/${encodeURIComponent(selectedWorldId)}/${encodeURIComponent(selectedRunId)}`,
        );
        if (!cancelled) setRun(result);
      } catch (e) {
        if (!cancelled) {
          setRun(null);
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadRun();
    return () => {
      cancelled = true;
    };
  }, [selectedRunId, selectedWorldId]);

  return (
    <div className="h-full w-full overflow-y-auto bg-[#070A11] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(229,184,77,0.18),transparent_32%),radial-gradient(circle_at_85%_12%,rgba(56,189,248,0.13),transparent_30%)]" />
      <div className="relative mx-auto flex min-h-full max-w-7xl flex-col px-5 py-5 lg:px-7 lg:py-7">
        <header className="mb-5 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200">
                <Gamepad2 size={14} />
                InkOS Play
              </div>
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-white">互动存档</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                这里只看存档、当前场景和世界状态。新开世界、继续行动、选择分支都回到普通聊天完成，像对主持人说话一样推进。
              </p>
            </div>
            <a
              href="#/chat"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-950/20 transition-transform hover:-translate-y-0.5"
            >
              <MessageSquare size={15} />
              回聊天继续行动
            </a>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {worlds.length === 0 ? (
          <EmptyPlayState />
        ) : (
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
            <aside className="min-h-0 overflow-hidden rounded-[24px] border border-white/10 bg-black/25 p-4 backdrop-blur">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">存档槽</h2>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-slate-300">{worlds.length} 个世界</span>
              </div>
              <div className="mt-3 space-y-2 overflow-y-auto pr-1">
                {worlds.map((world, index) => (
                  <button
                    key={world.id}
                    type="button"
                    onClick={() => setSelectedWorldId(world.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition-all ${
                      world.id === selectedWorldId
                        ? "border-amber-300/50 bg-amber-300/15 text-white shadow-lg shadow-amber-950/20"
                        : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                    }`}
                  >
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">SAVE {String(index + 1).padStart(2, "0")}</div>
                    <div className="mt-1 line-clamp-2 text-sm font-semibold">{world.title}</div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{world.mode === "guided" ? "互动选项" : "开放输入"}</span>
                      <span>·</span>
                      <span>{formatDate(world.updatedAt)}</span>
                    </div>
                  </button>
                ))}
              </div>

              <h2 className="mt-5 text-sm font-semibold text-white">运行记录</h2>
              <div className="mt-3 space-y-2">
                {runs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedRunId(item.id)}
                    className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition-colors ${
                      item.id === selectedRunId
                        ? "border-cyan-300/45 bg-cyan-300/10 text-white"
                        : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
                    }`}
                  >
                    <div className="font-medium">{item.id === "main" ? "主线存档" : item.id}</div>
                    <div className="mt-1 text-xs opacity-75">{item.eventCount} 次行动 · {formatDate(item.updatedAt)}</div>
                  </button>
                ))}
              </div>
            </aside>

            <main className="flex min-h-[620px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.92))] shadow-2xl shadow-black/30">
              {selectedWorld && (
                <div className="border-b border-white/10 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-xs font-semibold text-amber-200">
                      {selectedWorld.mode === "guided" ? "互动模式" : "开放模式"}
                    </span>
                    <h2 className="font-serif text-2xl font-semibold text-white">{selectedWorld.title}</h2>
                  </div>
                  {selectedWorld.premise && (
                    <p className="mt-3 text-sm leading-6 text-slate-300">{selectedWorld.premise}</p>
                  )}
                </div>
              )}

              <section className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="rounded-[24px] border border-cyan-200/10 bg-[radial-gradient(circle_at_75%_0%,rgba(34,211,238,0.14),transparent_34%),rgba(15,23,42,0.72)] p-5">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    <Sparkles size={14} />
                    当前场景
                  </div>
                  {loading && <div className="text-sm text-slate-400">读取存档中...</div>}
                  {!loading && latestAssistantScene ? (
                    <div className="whitespace-pre-wrap text-[15px] leading-8 text-slate-100">{latestAssistantScene}</div>
                  ) : !loading ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm leading-6 text-slate-400">
                      这个存档还没有场景。回到普通聊天输入第一句行动，系统会生成开场并写入这里。
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  <section className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                    <h3 className="text-sm font-semibold text-white">最近行动</h3>
                    <div className="mt-3 space-y-2">
                      {recentPlayerActions.length === 0 ? (
                        <div className="text-xs text-slate-500">暂无玩家行动</div>
                      ) : recentPlayerActions.map((turn, index) => (
                        <div key={`action-${index}`} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-slate-300">
                          {turn.content}
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                    <h3 className="text-sm font-semibold text-white">事件回放</h3>
                    <div className="mt-3 space-y-2">
                      {graph.events.slice(-4).length === 0 ? (
                        <div className="text-xs text-slate-500">暂无事件</div>
                      ) : graph.events.slice(-4).map((event) => (
                        <div key={event.id} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-400">
                          <span className="text-slate-200">#{event.turn} {event.actionKind}</span>
                          {event.outcomeSummary ? ` · ${event.outcomeSummary}` : ""}
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </section>
            </main>

            <aside className="min-h-0 overflow-y-auto rounded-[24px] border border-white/10 bg-black/25 p-4 backdrop-blur">
              <div className="mb-4 flex items-center gap-2">
                <Network size={15} className="text-cyan-200" />
                <h2 className="text-sm font-semibold text-white">世界 HUD</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Metric label="实体" value={graph.entities.length} />
                <Metric label="关系" value={graph.edges.length} />
                <Metric label="状态" value={graph.stateSlots.length} />
                <Metric label="事件" value={graph.events.length} />
              </div>
              {run?.currentState !== null && run?.currentState !== undefined && (
                <pre className="mt-3 max-h-32 overflow-auto rounded-2xl border border-white/10 bg-black/25 p-3 text-[11px] leading-5 text-slate-400">
                  {JSON.stringify(run.currentState, null, 2)}
                </pre>
              )}
              <GraphList title="人物 / 证据" items={graph.entities.slice(0, 8).map((entity) =>
                `${entity.label} [${entity.type}]${entity.status ? ` · ${entity.status}` : ""}`,
              )} />
              <GraphList title="关系线" items={graph.edges.slice(0, 8).map((edge) =>
                `${edge.fromId} -${edge.type}-> ${edge.toId}`,
              )} />
              <GraphList title="状态槽" items={graph.stateSlots.slice(0, 8).map((slot) =>
                `${slot.label} [${slot.kind}] ${formatValue(slot.value)}`,
              )} />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyPlayState() {
  return (
    <div className="flex flex-1 items-center justify-center rounded-[28px] border border-dashed border-white/15 bg-white/[0.04] p-8 text-center">
      <div className="max-w-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-300/10 text-amber-200">
          <Gamepad2 size={24} />
        </div>
        <h2 className="font-serif text-2xl font-semibold text-white">先从聊天开一局</h2>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          这里不是建世界表单。去普通聊天说“开一个互动世界，我扮演雨夜茶馆老板，有人带账本上门”，系统会直接创建世界并进入第一幕。
        </p>
        <a
          href="#/chat"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-950/20"
        >
          <MessageSquare size={15} />
          去普通聊天
        </a>
      </div>
    </div>
  );
}

function Metric(props: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-slate-500">{props.label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{props.value}</div>
    </div>
  );
}

function GraphList(props: { readonly title: string; readonly items: ReadonlyArray<string> }) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-white">{props.title}</h2>
      <div className="mt-3 space-y-2">
        {props.items.length === 0
          ? <div className="text-xs text-slate-500">暂无</div>
          : props.items.map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs leading-5 text-slate-400">
              {item}
            </div>
          ))}
      </div>
    </section>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}
