export async function consumeSse(
  response: Response,
  onEvent: (event: string, data: unknown) => void
): Promise<void> {
  if (!response.body) throw new Error('响应没有可读取的流');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = 'message';
  let dataLines: string[] = [];

  const flush = () => {
    if (!dataLines.length) return;
    const raw = dataLines.join('\n');
    if (raw !== '[DONE]') {
      try { onEvent(eventName, JSON.parse(raw)); }
      catch { onEvent(eventName, raw); }
    }
    eventName = 'message';
    dataLines = [];
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line === '') flush();
      else if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (done) break;
  }
  if (buffer.startsWith('data:')) dataLines.push(buffer.slice(5).trimStart());
  flush();
}

