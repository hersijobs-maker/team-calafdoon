import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Establish the caller's identity from their access token. Never trust an id
    // supplied in the request body.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // Demo payment instrument validation. When a real gateway is connected this
    // block is replaced by a charge request / webhook signature check, and the
    // amount below still comes from app_config, never from the client.
    const cardNumber = String(body.card_number ?? "").replace(/\D/g, "");
    const expiry = String(body.expiry ?? "");
    const cvc = String(body.cvc ?? "").replace(/\D/g, "");
    if (cardNumber.length < 13 || cardNumber.length > 19) {
      return json({ error: "The card details provided are not valid." }, 400);
    }
    if (!/^\d{2}\s*\/\s*\d{2}$/.test(expiry)) {
      return json({ error: "The card details provided are not valid." }, 400);
    }
    if (cvc.length < 3 || cvc.length > 4) {
      return json({ error: "The card details provided are not valid." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: config, error: configError } = await admin
      .from("app_config")
      .select("registration_fee, currency")
      .eq("id", 1)
      .maybeSingle();

    if (configError || !config) {
      console.error("config load failed", configError);
      return json({ error: "Payment could not be processed. Please try again." }, 500);
    }

    // Atomic single-use claim: only a row still in `pending` and owned by this
    // caller can transition to `paid`, so two concurrent requests cannot both win.
    const now = new Date().toISOString();
    const { data: claimed, error: claimError } = await admin
      .from("payments")
      .update({
        status: "paid",
        amount: config.registration_fee,
        currency: config.currency,
        provider_transaction_id: `txn_${crypto.randomUUID()}`,
        provider_reference: `ref_${crypto.randomUUID().slice(0, 8)}`,
        paid_at: now,
        updated_at: now,
      })
      .eq("user_id", userId)
      .eq("status", "pending")
      .select("id, amount, currency, provider_transaction_id, provider_reference")
      .maybeSingle();

    if (claimError) {
      console.error("payment claim failed", claimError);
      return json({ error: "Payment could not be processed. Please try again." }, 500);
    }

    if (!claimed) {
      const { data: existing } = await admin
        .from("payments")
        .select("id, amount, currency, provider_transaction_id, provider_reference")
        .eq("user_id", userId)
        .eq("status", "paid")
        .maybeSingle();

      if (existing) {
        return json({ payment: existing, already_paid: true });
      }
      return json({ error: "No pending registration payment was found." }, 409);
    }

    return json({ payment: claimed, already_paid: false });
  } catch (err) {
    console.error("confirm-registration-payment error", err);
    return json({ error: "Payment could not be processed. Please try again." }, 500);
  }
});
