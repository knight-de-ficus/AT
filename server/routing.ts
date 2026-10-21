import type { Protocol } from '../src/types.js';

const routeByProtocol: Record<Protocol, string> = {
  'openai-chat': 'chat/completions',
  'openai-responses': 'responses',
  anthropic: 'messages'
};

export type EndpointPurpose = 'models' | 'inference';

export function resolveEndpoint(baseUrl: string, protocol: Protocol, purpose: EndpointPurpose, autoRoute = true): string {
  const normalized = baseUrl.trim().replaceAll('\\', '/').replace(/\/+$/, '');
  if (!autoRoute) return normalized;
  const url = new URL(normalized);
  const wanted = purpose === 'models' ? 'models' : routeByProtocol[protocol];
  let path = url.pathname.replace(/\/+$/, '');
  const v1Endpoint = path.match(/^(.*\/v1)\/(?:chat\/completions|responses|messages|models)$/);
  if (v1Endpoint) path = v1Endpoint[1];
  else if (!/\/v1$/.test(path)) {
    path = path.replace(/\/(?:chat\/completions|responses|messages|models)$/, '');
    path = `${path}/v1`.replace(/\/+/g, '/');
  }
  url.pathname = `${path}/${wanted}`.replace(/\/+/g, '/');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}
