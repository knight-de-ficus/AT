import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { AppState } from '../src/types.js';

const statePath = resolve(process.env.AT_DATA_DIR ?? resolve(process.cwd(), 'data'), 'state.json');
const initial: AppState = {
  providers: [{ id: 'default-openai', name: 'OpenAI', protocol: 'openai-chat', baseUrl: 'https://api.openai.com', apiKey: '', models: [], timeoutMs: 120000 }],
  tasks: [{ id: 'complete', name: '完整能力测试', tests: ['hello', 'context', 'tool', 'image', 'audio'], contextSizes: [1000, 4000, 16000], target: { type: 'provider', providerId: 'default-openai', model: '' } }],
  runs: []
};

export async function readState(): Promise<AppState> {
  try {
    const raw = JSON.parse(await readFile(statePath, 'utf8')) as AppState & { models?: unknown[]; history?: unknown[] };
    if (!raw.providers) return structuredClone(initial);
    return raw;
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return structuredClone(initial);
  }
}

export function publicState(state: AppState): AppState {
  return {
    providers: state.providers.map(({ apiKey, ...provider }) => ({ ...provider, apiKey: '', hasApiKey: Boolean(apiKey) })),
    tasks: state.tasks.map((task) => task.target.type === 'custom'
      ? { ...task, target: { ...task.target, apiKey: '', hasApiKey: Boolean(task.target.apiKey) } }
      : task),
    runs: state.runs
  };
}

export async function writeState(state: AppState): Promise<void> {
  await mkdir(dirname(statePath), { recursive: true });
  const temporary = `${statePath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, statePath);
}

