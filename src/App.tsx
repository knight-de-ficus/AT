import { useEffect, useState } from "react";
import {
  Activity,
  AudioLines,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Image,
  Layers3,
  Menu,
  LockKeyhole,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Server,
  Settings as SettingsIcon,
  SquareFunction,
  TerminalSquare,
  Trash2,
  Waves,
  X,
} from "lucide-react";
import type {
  AppState,
  ModelProvider,
  PlatformLog,
  PlatformSettings,
  Protocol,
  RunEvent,
  TaskProfile,
  TestKind,
  TestResult,
} from "./types";

type Page = "providers" | "tasks" | "runs" | "logs" | "settings";
const empty: AppState = { providers: [], tasks: [], runs: [] };
const uid = () => crypto.randomUUID();
const protocols: Array<{ value: Protocol; label: string }> = [
  { value: "openai-chat", label: "OpenAI Chat" },
  { value: "openai-responses", label: "OpenAI Responses" },
  { value: "anthropic", label: "Anthropic" },
];
const probes: Array<{
  kind: TestKind;
  title: string;
  detail: string;
  icon: typeof Activity;
}> = [
  {
    kind: "hello",
    title: "基础响应",
    detail: "首字延迟与生成速度",
    icon: Waves,
  },
  {
    kind: "stream",
    title: "流式输出",
    detail: "检查是否返回多个增量事件",
    icon: Waves,
  },
  {
    kind: "reasoning",
    title: "思考能力",
    detail: "检查思考增量或 reasoning tokens",
    icon: Activity,
  },
  {
    kind: "context",
    title: "长上下文",
    detail: "逐级增加输入长度",
    icon: Activity,
  },
  {
    kind: "tool",
    title: "工具调用",
    detail: "检查函数调用结构",
    icon: SquareFunction,
  },
  { kind: "image", title: "图片理解", detail: "发送内置测试图", icon: Image },
  {
    kind: "audio",
    title: "音频理解",
    detail: "发送短 WAV 音频",
    icon: AudioLines,
  },
];
const formatTime = (ms?: number) =>
  ms === undefined
    ? "—"
    : ms >= 1000
      ? `${(ms / 1000).toFixed(2)}s`
      : `${ms}ms`;

function endpointFor(provider: ModelProvider, purpose: "models" | "chat"): string {
  const base = provider.baseUrl.trim().replaceAll("\\", "/").replace(/\/+$/, "");
  if (!provider.autoRoute) return base || "—";
  try {
    const url = new URL(base);
    const target = purpose === "models" ? "models" : provider.protocol === "openai-chat" ? "chat/completions" : provider.protocol === "openai-responses" ? "responses" : "messages";
    let path = url.pathname.replace(/\/+$/, "");
    const matched = path.match(/^(.*\/v1)\/(?:chat\/completions|responses|messages|models)$/);
    if (matched) path = matched[1];
    else if (!/\/v1$/.test(path)) {
      path = path.replace(/\/(?:chat\/completions|responses|messages|models)$/, "");
      path = `${path}/v1`.replace(/\/+/g, "/");
    }
    url.pathname = `${path}/${target}`.replace(/\/+/g, "/");
    url.search = ""; url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch { return "地址无效"; }
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...options?.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "请求失败");
  return body as T;
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Select({
  children,
  value,
  onChange,
}: {
  children: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="select">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
      <ChevronDown size={15} />
    </div>
  );
}
function Header({
  overline,
  title,
  description,
  action,
}: {
  overline: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <span>{overline}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function App() {
  const [page, setPage] = useState<Page>("providers");
  const [state, setState] = useState<AppState>(empty);
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [auth, setAuth] = useState<{ required: boolean; authenticated: boolean } | null>(null);
  async function reload() {
    setState(await api<AppState>("/api/state"));
  }
  useEffect(() => {
    api<{ required: boolean; authenticated: boolean }>("/api/auth/status")
      .then(async value => { setAuth(value); if (value.authenticated) await reload(); })
      .catch((error) => setNotice(error.message));
  }, []);
  const nav = [
    { id: "providers" as const, label: "模型供应商", icon: Server },
    { id: "tasks" as const, label: "测试任务", icon: Layers3 },
    { id: "runs" as const, label: "测试结果", icon: Clock3 },
    { id: "logs" as const, label: "平台日志", icon: TerminalSquare },
    { id: "settings" as const, label: "设置", icon: SettingsIcon },
  ];
  function notify(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 1800);
  }
  function navigate(next: Page) {
    setPage(next);
    setMenu(false);
    window.scrollTo(0, 0);
  }
  if (!auth) return <div className="loading">正在连接服务端…</div>;
  if (auth.required && !auth.authenticated) return <Login onSuccess={async () => { setAuth({ required: true, authenticated: true }); await reload(); }} />;
  return (
    <div className="product-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="logo">
          <span className="logo-mark">A</span>
          <span>
            <strong>AT</strong>
            <small>MODEL TESTER</small>
          </span>
          <button className="mobile-close" onClick={() => setMenu(false)}>
            <X size={18} />
          </button>
        </div>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={16} />
              <span>{label}</span>
              {id === "runs" && state.runs.length > 0 && (
                <em>{state.runs.length}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="side-status">
          <span>
            <i /> 后端已连接
          </span>
          <small>AT 0.5.0</small>
        </div>
      </aside>
      {menu && <button className="scrim" onClick={() => setMenu(false)} />}
      <section className="main-area">
        <header className="appbar">
          <button className="menu-button" onClick={() => setMenu(true)}>
            <Menu size={19} />
          </button>
          <div className="breadcrumb">
            <span>AT</span>
            <i>/</i>
            <strong>{nav.find((item) => item.id === page)?.label}</strong>
          </div>
        </header>
        <main className="page-content">
          {page === "providers" && (
            <Providers state={state} reload={reload} notify={notify} />
          )}{" "}
          {page === "tasks" && (
            <Tasks state={state} reload={reload} notify={notify} />
          )}{" "}
          {page === "runs" && (
            <Runs state={state} reload={reload} notify={notify} />
          )}
          {page === "logs" && <Logs notify={notify} />}
          {page === "settings" && <Settings notify={notify} onAuthChanged={async () => {
            const value = await api<{ required: boolean; authenticated: boolean }>("/api/auth/status");
            setAuth(value);
          }} />}
        </main>
      </section>
      {notice && (
        <div className="toast">
          <Check size={14} />
          {notice}
        </div>
      )}
    </div>
  );
}

function Providers({
  state,
  reload,
  notify,
}: {
  state: AppState;
  reload: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [id, setId] = useState(state.providers[0]?.id ?? "");
  const source = state.providers.find((item) => item.id === id);
  const [draft, setDraft] = useState<ModelProvider | undefined>(source);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [manualModel, setManualModel] = useState("");
  useEffect(() => {
    if (!id && state.providers[0]) setId(state.providers[0].id);
  }, [id, state.providers]);
  useEffect(() => {
    const found = state.providers.find((item) => item.id === id);
    if (found) setDraft(found);
  }, [id, state.providers]);
  function add() {
    const item: ModelProvider = {
      id: uid(),
      name: "新供应商",
      protocol: "openai-chat",
      baseUrl: "https://api.openai.com",
      apiKey: "",
      models: [],
      timeoutMs: 120000,
      autoRoute: true,
    };
    setId(item.id);
    setDraft(item);
    setError("");
  }
  function addManualModel() {
    const model = manualModel.trim();
    if (!draft || !model) return;
    setDraft({ ...draft, models: [...new Set([...draft.models, model])] });
    setManualModel("");
  }
  async function save() {
    if (!draft) return;
    setError("");
    try {
      const exists = state.providers.some((item) => item.id === draft.id);
      await api(`/api/providers${exists ? `/${draft.id}` : ""}`, {
        method: exists ? "PUT" : "POST",
        body: JSON.stringify(draft),
      });
      await reload();
      notify("供应商已保存");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove() {
    if (!draft) return;
    try {
      await api(`/api/providers/${draft.id}`, { method: "DELETE" });
      await reload();
      setId("");
      notify("供应商已删除");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function fetchModels() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      if (!state.providers.some((item) => item.id === draft.id) || draft.apiKey)
        await save();
      const data = await api<{ models: string[] }>(
        `/api/providers/${draft.id}/models`,
        { method: "POST" },
      );
      setDraft({ ...draft, models: data.models });
      await reload();
      notify(`已获取 ${data.models.length} 个模型`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Header
        overline="PROVIDERS"
        title="模型供应商"
        description="一个供应商可以维护多个模型。API Key 保存到本机后端并仅由服务端使用。"
        action={
          <button className="primary" onClick={add}>
            <Plus size={15} />
            添加供应商
          </button>
        }
      />
      <div className="split-layout">
        <div className="collection-list">
          <div className="list-label">供应商 · {state.providers.length}</div>
          {state.providers.map((item) => (
            <button
              key={item.id}
              className={
                id === item.id ? "collection-item active" : "collection-item"
              }
              onClick={() => setId(item.id)}
            >
              <span className="provider-icon">
                {item.name[0]?.toUpperCase()}
              </span>
              <span>
                <strong>{item.name}</strong>
                <small>{item.models.length} 个模型</small>
              </span>
              <i className={item.hasApiKey ? "configured" : ""} />
            </button>
          ))}
        </div>
        <div className="editor-card">
          {draft ? (
            <>
              <div className="card-title">
                <div>
                  <h2>{draft.name}</h2>
                  <p>{draft.models.length} 个可用模型</p>
                </div>
                <button className="icon-button danger" onClick={remove}>
                  <Trash2 size={16} />
                </button>
              </div>
              {error && <InlineError text={error} />}
              <div className="form-grid">
                <Field label="供应商名称">
                  <input
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </Field>
                <Field label="协议">
                  <Select
                    value={draft.protocol}
                    onChange={(value) =>
                      setDraft({ ...draft, protocol: value as Protocol })
                    }
                  >
                    {protocols.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="base-url-row form-wide">
                  <Field label="Base URL">
                    <input
                      value={draft.baseUrl}
                      onChange={(e) =>
                        setDraft({ ...draft, baseUrl: e.target.value })
                      }
                    />
                  </Field>
                  <button
                    className="route-toggle-compact"
                    aria-pressed={draft.autoRoute}
                    onClick={() => setDraft({ ...draft, autoRoute: !draft.autoRoute })}
                  >
                    <span><strong>自动路由</strong><small>{draft.autoRoute ? "已开启" : "已关闭"}</small></span>
                    <span className={`toggle ${draft.autoRoute ? "on" : ""}`}><i /></span>
                  </button>
                </div>
                <Field label="请求超时">
                  <Select
                    value={String(draft.timeoutMs)}
                    onChange={(value) =>
                      setDraft({ ...draft, timeoutMs: Number(value) })
                    }
                  >
                    <option value="60000">60 秒</option>
                    <option value="120000">120 秒</option>
                    <option value="300000">300 秒</option>
                  </Select>
                </Field>
                <Field label="API Key">
                  <input
                    type="password"
                    value={draft.apiKey ?? ""}
                    placeholder={
                      draft.hasApiKey
                        ? "已保存在服务端；留空则保持不变"
                        : "输入 API Key"
                    }
                    onChange={(e) =>
                      setDraft({ ...draft, apiKey: e.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="endpoint-preview">
                <div><span>MODELS</span><code>{endpointFor(draft, "models")}</code></div>
                <div><span>CHAT</span><code>{endpointFor(draft, "chat")}</code></div>
              </div>
              <div className="editor-actions">
                <button className="secondary" onClick={save}>
                  保存配置
                </button>
                <button
                  className="primary"
                  onClick={fetchModels}
                  disabled={busy}
                >
                  <RefreshCw size={14} className={busy ? "rotating" : ""} />
                  {busy ? "正在获取" : "自动获取模型"}
                </button>
              </div>
              <div className="model-list">
                <div className="list-label">
                  可用模型 · 可自动获取或手动添加
                </div>
                <div className="manual-model">
                  <input
                    value={manualModel}
                    placeholder="输入模型 ID，例如 gpt-4.1"
                    onChange={(e) => setManualModel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addManualModel();
                      }
                    }}
                  />
                  <button className="secondary" onClick={addManualModel}>
                    添加
                  </button>
                </div>
                {draft.models.length ? (
                  draft.models.map((model) => (
                    <button
                      className="model-chip"
                      key={model}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          models: draft.models.filter((item) => item !== model),
                        })
                      }
                    >
                      <code>{model}</code>
                      <X size={11} />
                    </button>
                  ))
                ) : (
                  <p>还没有模型。可手动添加，或保存 API Key 后自动获取。</p>
                )}
              </div>
            </>
          ) : (
            <Empty
              title="选择或添加供应商"
              detail="供应商配置长期保存在本机后端。"
            />
          )}
        </div>
      </div>
    </>
  );
}

function Tasks({
  state,
  reload,
  notify,
}: {
  state: AppState;
  reload: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [id, setId] = useState(state.tasks[0]?.id ?? "");
  const source = state.tasks.find((item) => item.id === id);
  const [draft, setDraft] = useState<TaskProfile | undefined>(source);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [progress, setProgress] = useState("等待开始");
  useEffect(() => {
    if (!id && state.tasks[0]) setId(state.tasks[0].id);
  }, [id, state.tasks]);
  useEffect(() => {
    const found = state.tasks.find((item) => item.id === id);
    if (found) setDraft(found);
    else if (!id) setDraft(undefined);
  }, [id, state.tasks]);
  function add() {
    const first = state.providers[0];
    const item: TaskProfile = {
      id: uid(),
      name: "新测试任务",
      tests: ["hello"],
      contextSizes: [1000, 4000, 16000],
      target: { type: "provider", providerId: first?.id ?? "", model: "" },
    };
    setDraft(item);
    setId(item.id);
    setResults([]);
  }
  async function save(show = true) {
    if (!draft) return false;
    try {
      const exists = state.tasks.some((item) => item.id === draft.id);
      await api(`/api/tasks${exists ? `/${draft.id}` : ""}`, {
        method: exists ? "PUT" : "POST",
        body: JSON.stringify(draft),
      });
      await reload();
      if (show) notify("任务已保存");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  async function remove() {
    if (!draft) return;
    await api(`/api/tasks/${draft.id}`, { method: "DELETE" });
    await reload();
    setId("");
    setDraft(undefined);
    setResults([]);
    notify("任务已删除");
  }
  async function run() {
    if (!draft || !(await save(false))) return;
    setRunning(true);
    setResults([]);
    setError("");
    try {
      const response = await fetch("/api/tests/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: draft.id }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const reader = response.body!.getReader(),
        decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines)
          if (line) {
            const event = JSON.parse(line) as RunEvent;
            if (event.type === "test-start") setProgress(event.label);
            if (event.type === "result")
              setResults((items) => [...items, event.result]);
            if (event.type === "done") setProgress("测试完成");
          }
        if (done) break;
      }
      await reload();
    } catch (e) {
      setError((e as Error).message);
      setProgress("运行失败");
    } finally {
      setRunning(false);
    }
  }
  const providerTarget =
    draft?.target.type === "provider" ? draft.target : undefined;
  const provider = state.providers.find(
    (item) => item.id === providerTarget?.providerId,
  );
  return (
    <>
      <Header
        overline="TASKS"
        title="测试任务"
        description="配置测试目标和探针，并直接从任务内发起测试。"
        action={
          <button className="primary" onClick={add}>
            <Plus size={15} />
            新建任务
          </button>
        }
      />
      <div className="task-workspace">
        <div className="collection-list">
          <div className="list-label">任务 · {state.tasks.length}</div>
          {state.tasks.map((item) => (
            <button
              key={item.id}
              className={
                id === item.id ? "collection-item active" : "collection-item"
              }
              onClick={() => {
                setId(item.id);
                setResults([]);
              }}
            >
              <span className="provider-icon">
                <Layers3 size={15} />
              </span>
              <span>
                <strong>{item.name}</strong>
                <small>{item.tests.length} 个测试项</small>
              </span>
            </button>
          ))}
        </div>
        <div className="editor-card task-editor">
          {draft ? (
            <>
              <div className="card-title">
                <div>
                  <h2>{draft.name}</h2>
                  <p>配置保存后可随时重新运行</p>
                </div>
                <button className="icon-button danger" onClick={remove}>
                  <Trash2 size={16} />
                </button>
              </div>
              {error && <InlineError text={error} />}
              <Field label="任务名称">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <div className="target-tabs">
                <button
                  className={draft.target.type === "provider" ? "active" : ""}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      target: {
                        type: "provider",
                        providerId: state.providers[0]?.id ?? "",
                        model: "",
                      },
                    })
                  }
                >
                  选择供应商模型
                </button>
                <button
                  className={draft.target.type === "custom" ? "active" : ""}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      target: {
                        type: "custom",
                        protocol: "openai-chat",
                        baseUrl: "",
                        apiKey: "",
                        model: "",
                        timeoutMs: 120000,
                        autoRoute: true,
                      },
                    })
                  }
                >
                  直接新增模型
                </button>
              </div>
              {draft.target.type === "provider" ? (
                <div className="form-grid">
                  <Field label="供应商">
                    <Select
                      value={draft.target.providerId}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          target: {
                            ...(draft.target as Extract<
                              TaskProfile["target"],
                              { type: "provider" }
                            >),
                            providerId: value,
                            model: "",
                          },
                        })
                      }
                    >
                      {state.providers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="模型">
                    <Select
                      value={draft.target.model}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          target: {
                            ...(draft.target as Extract<
                              TaskProfile["target"],
                              { type: "provider" }
                            >),
                            model: value,
                          },
                        })
                      }
                    >
                      <option value="">选择模型</option>
                      {provider?.models.map((model) => (
                        <option key={model}>{model}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              ) : (
                <div className="form-grid">
                  <Field label="协议">
                    <Select
                      value={draft.target.protocol}
                      onChange={(value) =>
                        setDraft({
                          ...draft,
                          target: {
                            ...(draft.target as Extract<
                              TaskProfile["target"],
                              { type: "custom" }
                            >),
                            protocol: value as Protocol,
                          },
                        })
                      }
                    >
                      {protocols.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="模型名称">
                    <input
                      value={draft.target.model}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          target: {
                            ...(draft.target as Extract<
                              TaskProfile["target"],
                              { type: "custom" }
                            >),
                            model: e.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label="Base URL">
                    <input
                      value={draft.target.baseUrl}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          target: {
                            ...(draft.target as Extract<
                              TaskProfile["target"],
                              { type: "custom" }
                            >),
                            baseUrl: e.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label="Token">
                    <input
                      type="password"
                      value={draft.target.apiKey ?? ""}
                      placeholder={
                        draft.target.hasApiKey
                          ? "已保存在服务端；留空则保持不变"
                          : "输入 Token"
                      }
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          target: {
                            ...(draft.target as Extract<
                              TaskProfile["target"],
                              { type: "custom" }
                            >),
                            apiKey: e.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                  <button
                    className="route-option form-wide"
                    aria-pressed={
                      (
                        draft.target as Extract<
                          TaskProfile["target"],
                          { type: "custom" }
                        >
                      ).autoRoute
                    }
                    onClick={() =>
                      setDraft({
                        ...draft,
                        target: {
                          ...(draft.target as Extract<
                            TaskProfile["target"],
                            { type: "custom" }
                          >),
                          autoRoute: !(
                            draft.target as Extract<
                              TaskProfile["target"],
                              { type: "custom" }
                            >
                          ).autoRoute,
                        },
                      })
                    }
                  >
                    <span>
                      <strong>自动路由</strong>
                      <small>关闭后将把 Base URL 作为最终对话接口地址</small>
                    </span>
                    <span
                      className={`toggle ${(draft.target as Extract<TaskProfile["target"], { type: "custom" }>).autoRoute ? "on" : ""}`}
                    >
                      <i />
                    </span>
                  </button>
                </div>
              )}
              <div className="probe-list">
                {probes.map(({ kind, title, detail, icon: Icon }) => {
                  const on = draft.tests.includes(kind);
                  return (
                    <button
                      key={kind}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          tests: on
                            ? draft.tests.filter((x) => x !== kind)
                            : [...draft.tests, kind],
                        })
                      }
                    >
                      <span className="probe-icon">
                        <Icon size={17} />
                      </span>
                      <span>
                        <strong>{title}</strong>
                        <small>{detail}</small>
                      </span>
                      <span className={`toggle ${on ? "on" : ""}`}>
                        <i />
                      </span>
                    </button>
                  );
                })}
              </div>
              {draft.tests.includes("context") && (
                <Field label="上下文阶梯 · TOKENS">
                  <input
                    value={draft.contextSizes.join(", ")}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        contextSizes: e.target.value
                          .split(",")
                          .map(Number)
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
              )}
              <div className="editor-actions">
                <button className="secondary" onClick={() => save()}>
                  保存任务
                </button>
                <button className="primary" disabled={running} onClick={run}>
                  <Play size={14} fill="currentColor" />
                  {running ? "测试进行中" : "保存并发起测试"}
                </button>
              </div>
            </>
          ) : (
            <Empty
              title="选择或新建任务"
              detail="任务、模型目标和测试项都会长期保存。"
            />
          )}
        </div>
        <div className="run-results compact-results">
          <div className="run-status">
            <div>
              <i className={running ? "live" : ""} />
              <strong>{progress}</strong>
            </div>
            <span>{results.length}</span>
          </div>
          {results.length ? (
            <div className="result-list">
              {results.map((item) => (
                <ResultItem key={item.id} result={item} />
              ))}
            </div>
          ) : (
            <Empty
              title="本次运行结果"
              detail="从左侧任务编辑器直接发起测试。"
            />
          )}
        </div>
      </div>
    </>
  );
}

function Runs({
  state,
  reload,
  notify,
}: {
  state: AppState;
  reload: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [selected, setSelected] = useState(state.runs[0]?.id ?? "");
  useEffect(() => {
    if (!selected && state.runs[0]) setSelected(state.runs[0].id);
  }, [selected, state.runs]);
  const run = state.runs.find((item) => item.id === selected);
  async function updateNote(id: string, note: string) {
    await api(`/api/runs/${id}`, {
      method: "PUT",
      body: JSON.stringify({ note }),
    });
    await reload();
    notify("备注已保存");
  }
  async function remove(id: string) {
    await api(`/api/runs/${id}`, { method: "DELETE" });
    await reload();
    setSelected("");
    notify("测试结果已删除");
  }
  return (
    <>
      <Header
        overline="RESULTS"
        title="测试结果"
        description="完整结果长期保存在服务端，可查看和删除。"
      />
      <div className="split-layout">
        <div className="collection-list">
          <div className="list-label">运行 · {state.runs.length}</div>
          {state.runs.map((item) => (
            <button
              key={item.id}
              className={
                selected === item.id
                  ? "collection-item active"
                  : "collection-item"
              }
              onClick={() => setSelected(item.id)}
            >
              <span className="provider-icon">
                {item.passed}/{item.total}
              </span>
              <span>
                <strong>{item.taskName}</strong>
                <small>
                  {new Date(item.completedAt).toLocaleString("zh-CN")}
                </small>
              </span>
            </button>
          ))}
        </div>
        <div className="editor-card">
          {run ? (
            <>
              <div className="card-title">
                <div>
                  <h2>{run.taskName}</h2>
                  <p>
                    {run.providerName} · {run.model}
                  </p>
                </div>
                <button
                  className="icon-button danger"
                  onClick={() => remove(run.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <Field label="结果备注">
                <input
                  defaultValue={run.note ?? ""}
                  placeholder="可选：记录本次测试说明"
                  onBlur={(e) => updateNote(run.id, e.target.value)}
                />
              </Field>
              <div className="metrics">
                <div>
                  <span>通过</span>
                  <strong>
                    {run.passed}/{run.total}
                  </strong>
                </div>
                <div>
                  <span>完成时间</span>
                  <strong className="small-value">
                    {new Date(run.completedAt).toLocaleString("zh-CN")}
                  </strong>
                </div>
              </div>
              <div className="result-list">
                {run.results.map((result) => (
                  <ResultItem key={result.id} result={result} />
                ))}
              </div>
            </>
          ) : (
            <Empty
              title="还没有测试结果"
              detail="运行任务后可在这里长期查看。"
            />
          )}
        </div>
      </div>
    </>
  );
}

function Login({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) });
      await onSuccess();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="login-shell"><form className="login-card" onSubmit={submit}>
    <div className="login-mark"><LockKeyhole size={20} /></div>
    <span>AT · ACCESS</span><h1>登录模型测试器</h1><p>平台已开启访问鉴权。</p>
    {error && <InlineError text={error} />}
    <Field label="访问密码"><input autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="输入平台密码" /></Field>
    <button className="primary login-button" disabled={busy}>{busy ? "正在验证" : "登录"}</button>
  </form></div>;
}

function Logs({ notify }: { notify: (s: string) => void }) {
  const [logs, setLogs] = useState<PlatformLog[]>([]);
  const [error, setError] = useState("");
  async function load() {
    try {
      const data = await api<{ logs: PlatformLog[] }>("/api/logs");
      setLogs(data.logs); setError("");
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { load(); }, []);
  async function clear() {
    if (!window.confirm("清空全部平台日志？此操作不可撤销。")) return;
    await api("/api/logs", { method: "DELETE" }); setLogs([]); notify("平台日志已清空");
  }
  return <>
    <Header overline="PLATFORM LOGS" title="平台日志" description="查看服务端发送给模型的原始请求与收到的流式响应。" action={<div className="header-actions"><button className="secondary" onClick={load}><RefreshCw size={14}/>刷新</button><button className="secondary danger" onClick={clear} disabled={!logs.length}><Trash2 size={14}/>清空</button></div>} />
    {error && <InlineError text={error} />}
    <div className="terminal-card log-terminal">{logs.length ? <><div className="terminal-head"><span><i/><i/><i/></span><strong>AT MODEL EXCHANGE LOG</strong><code>{logs.length} entries</code></div><div className="terminal-body">{[...logs].reverse().map((log, index) => <article className="terminal-entry" key={log.id}><div className="terminal-meta"><span>#{index + 1} · {new Date(log.createdAt).toLocaleString("zh-CN")}</span><code>{log.protocol} · {log.model} · {log.durationMs}ms · HTTP {log.status ?? "ERR"}</code><small>{log.url}</small></div><section><span>$ REQUEST</span><pre>{log.request}</pre></section><section><span>$ RESPONSE</span><pre>{log.response || log.error || "(empty)"}</pre></section>{log.error && <section className="terminal-error"><span>$ ERROR</span><pre>{log.error}</pre></section>}{log.truncated && <div className="terminal-warning">该次日志超过 128 KB，已安全截断。</div>}</article>)}</div></> : <Empty title="还没有平台日志" detail="运行一次测试后，全部原始模型输入输出会连续显示在这里。" />}</div>
  </>;
}

function Settings({ notify, onAuthChanged }: { notify: (s: string) => void; onAuthChanged: () => Promise<void> }) {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [password, setPassword] = useState("");
  const [sources, setSources] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { api<PlatformSettings>("/api/settings").then(value => { setSettings(value); setSources(value.allowedSources.join("\n")); }).catch(e => setError(e.message)); }, []);
  async function save() {
    if (!settings) return;
    setError("");
    try {
      const value = await api<PlatformSettings & { reloginRequired?: boolean }>("/api/settings", { method: "PUT", body: JSON.stringify({ ...settings, password, allowedSources: sources.split(/[\n,]+/).map(item => item.trim()).filter(Boolean) }) });
      setSettings(value); setSources(value.allowedSources.join("\n")); setPassword(""); notify("设置已保存"); await onAuthChanged();
    } catch (e) { setError((e as Error).message); }
  }
  async function logout() { await api("/api/auth/logout", { method: "POST" }); await onAuthChanged(); }
  if (!settings) return <div className="loading">正在读取设置…</div>;
  return <>
    <Header overline="SETTINGS" title="设置" description="管理平台访问鉴权和来源限制。" action={<button className="primary" onClick={save}>保存设置</button>} />
    {error && <InlineError text={error} />}
    <div className="settings-stack">
      <section className="settings-card"><div><span>ACCESS AUTH</span><h2>访问鉴权</h2><p>开启后，访问平台数据和功能前必须先登录。</p></div><button className="settings-switch" aria-pressed={settings.authEnabled} onClick={() => setSettings({ ...settings, authEnabled: !settings.authEnabled })}><span className={`toggle ${settings.authEnabled ? "on" : ""}`}><i/></span>{settings.authEnabled ? "已开启" : "已关闭"}</button><div className="settings-fields"><Field label={settings.hasPassword ? "修改密码" : "设置密码"}><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={settings.hasPassword ? "留空则保持当前密码" : "至少 8 个字符"}/></Field>{settings.authEnabled && <button className="secondary logout-button" onClick={logout}><LogOut size={14}/>退出当前登录</button>}</div></section>
      <section className="settings-card"><div><span>SOURCE POLICY</span><h2>访问源限制</h2><p>支持单个 IPv4、IPv6 地址和 IPv4 CIDR；本机访问始终保留。经反向代理部署时可设置 AT_TRUST_PROXY=1。</p></div><button className="settings-switch" aria-pressed={settings.restrictSources} onClick={() => setSettings({ ...settings, restrictSources: !settings.restrictSources })}><span className={`toggle ${settings.restrictSources ? "on" : ""}`}><i/></span>{settings.restrictSources ? "已限制" : "未限制"}</button><div className="settings-fields full"><Field label="允许的访问源"><textarea value={sources} onChange={e => setSources(e.target.value)} placeholder={"192.168.1.0/24\n10.0.0.8\n2001:db8::1"}/></Field></div></section>
    </div>
  </>;
}

function ResultItem({ result }: { result: TestResult }) {
  return (
    <div className="result-item">
      <span className={`result-icon ${result.status}`}>
        {result.status === "passed" ? (
          <Check size={14} />
        ) : (
          <CircleAlert size={14} />
        )}
      </span>
      <span>
        <strong>{result.label}</strong>
        <small>{result.detail}</small>
      </span>
      <span>
        <small>TTFT</small>
        {formatTime(result.ttftMs)}
      </span>
      <span>
        <small>速度</small>
        {result.tokensPerSecond ? `${result.tokensPerSecond} t/s` : "—"}
      </span>
    </div>
  );
}
function InlineError({ text }: { text: string }) {
  return (
    <div className="inline-error">
      <CircleAlert size={15} />
      {text}
    </div>
  );
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty">
      <span>
        <Activity size={20} />
      </span>
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
