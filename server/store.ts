import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { AppState, PlatformLog } from '../src/types.js';

export interface StoredSettings {
  authEnabled: boolean;
  passwordHash: string;
  restrictSources: boolean;
  allowedSources: string[];
}

export interface StoredState extends AppState {
  logs: PlatformLog[];
  settings: StoredSettings;
}

const statePath = resolve(process.env.AT_DATA_DIR ?? resolve(process.cwd(), 'data'), 'state.json');
const initial: StoredState = {
  providers: [{ id: 'default-openai', name: 'OpenAI', protocol: 'openai-chat', baseUrl: 'https://api.openai.com', apiKey: '', models: [], timeoutMs: 120000, autoRoute: true }],
  tasks: [{ id: 'complete', name: '完整能力测试', tests: ['hello', 'stream', 'reasoning', 'context', 'tool', 'image', 'audio'], contextSizes: [1000, 4000, 16000], target: { type: 'provider', providerId: 'default-openai', model: '' } }],
  runs: [],
  logs: [],
  settings: { authEnabled: false, passwordHash: '', restrictSources: false, allowedSources: [] }
};

export async function readState(): Promise<StoredState> {
  try {
    const raw = JSON.parse(await readFile(statePath, 'utf8')) as StoredState & { models?: unknown[]; history?: unknown[] };
    if (!raw.providers) return structuredClone(initial);
    raw.providers = raw.providers.map(provider => ({ ...provider, autoRoute: provider.autoRoute !== false }));
    raw.tasks = raw.tasks.map(task => task.target.type === 'custom'
      ? { ...task, target: { ...task.target, autoRoute: task.target.autoRoute !== false } }
      : task);
    raw.logs ??= [];
    raw.settings = {
      authEnabled: raw.settings?.authEnabled === true,
      passwordHash: raw.settings?.passwordHash ?? '',
      restrictSources: raw.settings?.restrictSources === true,
      allowedSources: Array.isArray(raw.settings?.allowedSources) ? raw.settings.allowedSources : []
    };
    return raw;
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return structuredClone(initial);
  }
}

export function publicState(state: StoredState): AppState {
  return {
    providers: state.providers.map(({ apiKey, ...provider }) => ({ ...provider, apiKey: '', hasApiKey: Boolean(apiKey) })),
    tasks: state.tasks.map((task) => task.target.type === 'custom'
      ? { ...task, target: { ...task.target, apiKey: '', hasApiKey: Boolean(task.target.apiKey) } }
      : task),
    runs: state.runs
  };
}

export async function writeState(state: StoredState): Promise<void> {
  await mkdir(dirname(statePath), { recursive: true });
  const temporary = `${statePath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, statePath);
}

