import {
  corsPreflight,
  customerResponse,
  findCustomerByEmail,
  json,
  normalizeEmail,
} from "../_shared/customer.ts";

Deno.serve(async (request) => {
  const preflight = corsPreflight(request);
  if (preflight) return preflight;
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const email = normalizeEmail(new URL(request.url).searchParams.get("email"));
  if (!email) return json({ error: "Query parameter email is required" }, 400);

  try {
    const row = await findCustomerByEmail(email);
    if (!row) return json({ error: "Customer not found" }, 404);
    return json(customerResponse(row.data));
  } catch (error) {
    console.error("customer-by-email failed", error);
    return json({
      error: "Could not load customer",
      detail: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});
