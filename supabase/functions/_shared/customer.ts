import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET, PATCH, OPTIONS",
    },
  });
}

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function accountWithoutPassword(account: Record<string, unknown>) {
  const { password: _password, ...safeAccount } = account;
  return safeAccount;
}

export function customerResponse(customer: Record<string, any>) {
  const accounts = Array.isArray(customer.accounts) ? customer.accounts : [];
  return {
    id: customer.id,
    facebook: customer.facebook ?? "",
    quantity: Number(customer.quantity ?? 0),
    lastEditedAt: customer.lastEditedAt ?? null,
    profile: customer.profile ?? {},
    accounts: accounts.map(accountWithoutPassword),
    proxies: accounts.map((account) => account?.proxy ?? ""),
  };
}

export async function findCustomerByEmail(email: string) {
  let { data, error } = await supabase
    .from("customers")
    .select("id,data,updated_at,last_edited_at");
  if (error?.message?.includes("last_edited_at")) {
    ({ data, error } = await supabase
      .from("customers")
      .select("id,data,updated_at"));
  }
  if (error) throw error;

  const match = (data ?? []).find((row: { data?: Record<string, any> }) =>
    normalizeEmail(row.data?.profile?.contact?.email) === email
  );
  return match ?? null;
}

export async function findCustomerByUsername(username: string) {
  let { data, error } = await supabase
    .from("customers")
    .select("id,data,updated_at,last_edited_at");
  if (error?.message?.includes("last_edited_at")) {
    ({ data, error } = await supabase
      .from("customers")
      .select("id,data,updated_at"));
  }
  if (error) throw error;

  const normalizedUsername = username.trim().toLowerCase();
  return (data ?? []).filter((row: { data?: Record<string, any> }) =>
    Array.isArray(row.data?.accounts) &&
    row.data.accounts.some((account: Record<string, unknown>) =>
      typeof account?.username === "string" &&
      account.username.trim().toLowerCase() === normalizedUsername
    )
  );
}

export function corsPreflight(request: Request) {
  return request.method === "OPTIONS" ? json({}, 204) : null;
}
