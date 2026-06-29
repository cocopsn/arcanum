export interface RouterResult<T> {
  provider: string;
  value: T;
}

/**
 * Try providers in PRIORITY ORDER (the array — config, not hardcode) until one
 * succeeds. Inverting [openai, anthropic] is a one-line change. Mirrored in the
 * Edge Function; tested here so the fallback behavior is guaranteed.
 */
export async function routeWithFallback<T>(
  providers: readonly string[],
  call: (provider: string) => Promise<T>,
): Promise<RouterResult<T>> {
  let lastErr: unknown;
  for (const provider of providers) {
    try {
      return { provider, value: await call(provider) };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("no AI provider available");
}
