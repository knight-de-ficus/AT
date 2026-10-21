import { describe, expect, it } from 'vitest';
import { resolveEndpoint } from './routing.js';

describe('resolveEndpoint', () => {
  it.each([
    ['https://relay.example.com', 'https://relay.example.com/v1/chat/completions'],
    ['https://relay.example.com/v1', 'https://relay.example.com/v1/chat/completions'],
    ['https://relay.example.com/v1/chat/completions', 'https://relay.example.com/v1/chat/completions'],
    ['https://relay.example.com/v1/models', 'https://relay.example.com/v1/chat/completions'],
    ['https://relay.example.com/openai/v1', 'https://relay.example.com/openai/v1/chat/completions']
  ])('resolves Chat URL from %s', (base, expected) => {
    expect(resolveEndpoint(base, 'openai-chat', 'inference', true)).toBe(expected);
  });

  it('switches a full conversation path to models', () => {
    expect(resolveEndpoint('https://relay.example.com/v1/chat/completions', 'openai-chat', 'models', true))
      .toBe('https://relay.example.com/v1/models');
  });

  it('uses protocol-specific inference paths', () => {
    expect(resolveEndpoint('https://relay.example.com/v1', 'openai-responses', 'inference', true)).toBe('https://relay.example.com/v1/responses');
    expect(resolveEndpoint('https://relay.example.com/v1', 'anthropic', 'inference', true)).toBe('https://relay.example.com/v1/messages');
  });

  it('normalizes pasted backslashes', () => {
    expect(resolveEndpoint('https:\\relay.example.com\\v1', 'openai-chat', 'inference', true)).toBe('https://relay.example.com/v1/chat/completions');
  });

  it('leaves the address untouched when automatic routing is disabled', () => {
    expect(resolveEndpoint('https://relay.example.com/custom/generate', 'openai-chat', 'inference', false))
      .toBe('https://relay.example.com/custom/generate');
  });
});
