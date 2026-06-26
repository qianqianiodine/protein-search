/**
 * 通用 fetch 封装
 * 带 30s 超时 + AbortController 支持
 */

const DEFAULT_TIMEOUT = 30_000;

export class ApiError extends Error {
  status: number;
  statusText: string;
  url: string;
  constructor(status: number, statusText: string, url: string, message?: string) {
    super(message || `HTTP ${status}: ${statusText}`);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.url = url;
  }
}

export class TimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request timeout after ${timeoutMs}ms: ${url}`);
    this.name = 'TimeoutError';
  }
}

interface FetchOptions<TBody = unknown> {
  method?: 'GET' | 'POST';
  body?: TBody;
  signal?: AbortSignal;
  timeout?: number;
  headers?: Record<string, string>;
}

export async function apiFetch<T>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const { method = 'GET', body, signal, timeout = DEFAULT_TIMEOUT, headers = {} } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // 合并外部 signal
  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...headers,
    },
    signal: controller.signal,
  };

  if (body && method === 'POST') {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new ApiError(response.status, response.statusText, url);
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof ApiError || err instanceof TimeoutError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      if (signal?.aborted) throw err; // 外部取消，原样抛出
      throw new TimeoutError(url, timeout);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
