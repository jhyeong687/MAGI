// A read-only Billing token is intentionally separate from deploy credentials.
// Unknown / unavailable billing state closes the trial before inference.
export function freeSubscriptions(payload: unknown): boolean {
  const body = payload as {
    success?: boolean;
    result?: { rate_plan?: { id?: string }; price?: number; status?: string }[];
    result_info?: { total_pages?: number };
  };
  if (
    body?.success !== true ||
    !Array.isArray(body.result) ||
    (body.result_info?.total_pages || 1) > 1
  )
    return false;
  return body.result.every((item) => {
    const id = item.rate_plan?.id;
    if (typeof id !== 'string') return false;
    if (!id.toLowerCase().includes('worker')) return true;
    return id === 'workers_free' && (item.price === undefined || item.price === 0);
  });
}
export async function checkFreePlan(
  account: string,
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!/^[a-f0-9]{32}$/.test(account) || !token) return false;
  try {
    const response = await fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${account}/subscriptions`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) },
    );
    return response.ok && freeSubscriptions(await response.json());
  } catch {
    return false;
  }
}
