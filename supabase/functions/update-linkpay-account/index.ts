import {
  corsPreflight,
  customerResponse,
  findCustomerByUsername,
  json,
  supabase,
} from "../_shared/customer.ts";

Deno.serve(async (request) => {
  const preflight = corsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "PATCH") return json({ error: "Method not allowed" }, 405);

  let body: { username?: unknown; linkpay?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const linkpay = typeof body.linkpay === "string" ? body.linkpay.trim() : "";
  if (!username) return json({ error: "username is required" }, 400);
  if (!linkpay) return json({ error: "linkpay is required" }, 400);

  try {
    const matches = await findCustomerByUsername(username);
    if (matches.length === 0) return json({ error: "Account not found" }, 404);
    if (matches.length > 1) {
      return json({ error: "Username matches multiple accounts" }, 409);
    }

    const row = matches[0];
    const customer = { ...row.data };
    const accounts = Array.isArray(customer.accounts)
      ? customer.accounts.map((account) => (
        account && typeof account === "object" ? { ...account } : {}
      ))
      : [];
    const accountIndex = accounts.findIndex((account) =>
      typeof account.username === "string" &&
      account.username.trim().toLowerCase() === username.toLowerCase()
    );
    if (accountIndex < 0) return json({ error: "Account not found" }, 404);

    accounts[accountIndex].payLink = linkpay;
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
    console.error("update-linkpay-account failed", error);
    return json({
      error: "Could not update linkpay",
      detail: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
