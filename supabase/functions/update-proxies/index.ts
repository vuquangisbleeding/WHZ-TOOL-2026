import {
  corsPreflight,
  customerResponse,
  findCustomerByEmail,
  json,
  normalizeEmail,
  supabase,
} from "../_shared/customer.ts";

Deno.serve(async (request) => {
  const preflight = corsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "PATCH") return json({ error: "Method not allowed" }, 405);

  let body: { email?: unknown; proxies?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  const email = normalizeEmail(body.email);
  const proxies = Array.isArray(body.proxies)
    ? body.proxies.map((proxy) => typeof proxy === "string" ? proxy.trim() : "").filter(Boolean)
    : null;
  if (!email) return json({ error: "email is required" }, 400);
  if (!proxies || proxies.length > 100) {
    return json({ error: "proxies must be an array with at most 100 non-empty strings" }, 400);
  }

  try {
    const row = await findCustomerByEmail(email);
    if (!row) return json({ error: "Customer not found" }, 404);

    const customer = { ...row.data };
    const accounts = Array.isArray(customer.accounts)
      ? customer.accounts.map((account: Record<string, unknown>) => ({ ...account }))
      : [];
    proxies.forEach((proxy, index) => {
      accounts[index] = { ...(accounts[index] ?? {}), proxy };
    });
    customer.accounts = accounts;
    customer.lastEditedAt = new Date().toISOString();

    const updateRow = {
      id: row.id,
      data: customer,
      updated_at: customer.lastEditedAt,
      last_edited_at: customer.lastEditedAt,
    };
    let { error } = await supabase.from("customers").upsert(updateRow);
    if (error?.message?.includes("last_edited_at")) {
      ({ error } = await supabase.from("customers").upsert({
        id: row.id,
        data: customer,
        updated_at: customer.lastEditedAt,
      }));
    }
    if (error) throw error;
    return json(customerResponse(customer));
  } catch (error) {
    console.error("update-proxies failed", error);
    return json({
      error: "Could not update proxies",
      detail: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
