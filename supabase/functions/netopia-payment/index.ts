import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import forge from "npm:node-forge@1.3.1";



// ============================================================================
// XML Payload Generation
// ============================================================================

interface PaymentRequest {
  orderId: string;
  amount: number;
  customerEmail: string;
  customerName: string;
}

function generateXmlPayload(
  request: PaymentRequest,
  signature: string,
  timestamp: number,
  confirmUrl: string,
  returnUrl: string
): string {
  // Escape XML special characters
  const escape = (str: string): string =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<order id="${escape(request.orderId)}" timestamp="${timestamp}" type="card">
  <signature>${signature}</signature>
  <url>
    <confirm>${escape(confirmUrl)}</confirm>
    <return>${escape(returnUrl)}</return>
  </url>
  <invoice currency="RON" amount="${request.amount}">
    <details>Plata comanda CoreForm</details>
    <contact_info>
      <email>${escape(request.customerEmail)}</email>
      <first_name>${escape(request.customerName)}</first_name>
    </contact_info>
  </invoice>
</order>`;

  return xml;
}

// ============================================================================
// Encryption & Signing
// ============================================================================

/**
 * Encrypt the XML payload using RC4 and RSA-PKCS#1 v1.5 via node-forge.
 * node-forge handles X.509 certificates and legacy ciphers natively,
 * avoiding Deno's incomplete node:crypto polyfill.
 * Returns: { envKey: base64, data: base64 }
 */
async function encryptPayload(
  xmlPayload: string,
  publicCertPem: string
): Promise<{ envKey: string; data: string }> {
  // Normalize the PEM certificate: the Supabase Dashboard flattens multiline
  // secrets into a single string, so we reconstruct the proper PEM format.
  let cleanCert = publicCertPem.replace(/\\n/g, "\n").replace(/\r/g, "");
  if (!cleanCert.includes("\n")) {
    const header = "-----BEGIN CERTIFICATE-----";
    const footer = "-----END CERTIFICATE-----";
    if (cleanCert.startsWith(header) && cleanCert.endsWith(footer)) {
      const body = cleanCert.slice(header.length, -footer.length).replace(/\s/g, "");
      // Split the Base64 body into lines of 64 characters
      const wrapped = body.match(/.{1,64}/g)?.join("\n") || "";
      cleanCert = `${header}\n${wrapped}\n${footer}`;
    }
  }

  // 1. Generate 16-byte random key using native Web Crypto
  const rc4KeyBytes = new Uint8Array(16);
  crypto.getRandomValues(rc4KeyBytes);
  let rc4KeyString = "";
  for (let i = 0; i < rc4KeyBytes.length; i++) {
    rc4KeyString += String.fromCharCode(rc4KeyBytes[i]);
  }

  // 2. Encrypt the RC4 key with RSA using forge (PKCS#1 v1.5)
  const cert = forge.pki.certificateFromPem(cleanCert);
  const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;
  const encryptedRc4Key = publicKey.encrypt(rc4KeyString);
  const env_key = forge.util.encode64(encryptedRc4Key);

  // 3. Pure TypeScript RC4 implementation — avoids forge.rc4 which is
  //    undefined in some esm.sh builds
  function encryptRC4(keyStr: string, text: string): Uint8Array {
    const s = new Uint8Array(256);
    for (let i = 0; i < 256; i++) s[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + s[i] + keyStr.charCodeAt(i % keyStr.length)) % 256;
      const temp = s[i]; s[i] = s[j]; s[j] = temp;
    }
    const data = new TextEncoder().encode(text);
    const res = new Uint8Array(data.length);
    let i = 0; j = 0;
    for (let k = 0; k < data.length; k++) {
      i = (i + 1) % 256;
      j = (j + s[i]) % 256;
      const temp = s[i]; s[i] = s[j]; s[j] = temp;
      res[k] = data[k] ^ s[(s[i] + s[j]) % 256];
    }
    return res;
  }

  // 4. Encrypt the XML payload with RC4 — becomes the `data` parameter
  const rc4Encrypted = encryptRC4(rc4KeyString, xmlPayload);
  let binaryStr = "";
  for (let i = 0; i < rc4Encrypted.length; i++) {
    binaryStr += String.fromCharCode(rc4Encrypted[i]);
  }
  const data = btoa(binaryStr);

  return { envKey: env_key, data };
}

// ============================================================================
// Main Handler
// ============================================================================

interface ErrorResponse {
  error: string;
  details?: string;
}

async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." } as ErrorResponse),
      {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  try {
    // Parse request body
    let body: PaymentRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" } as ErrorResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate required fields
    const { orderId, amount, customerEmail, customerName } = body;
    if (!orderId || !amount || !customerEmail || !customerName) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          details:
            "Expected: orderId, amount, customerEmail, customerName",
        } as ErrorResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate amount is a positive number
    if (typeof amount !== "number" || amount <= 0) {
      return new Response(
        JSON.stringify({
          error: "Invalid amount",
          details: "Amount must be a positive number",
        } as ErrorResponse),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get environment variables
    const netopiaSignature = Deno.env.get("NETOPIA_SIGNATURE");
    const netopiaPublicCert = Deno.env.get("NETOPIA_PUBLIC_CERT");

    if (!netopiaSignature || !netopiaPublicCert) {
      console.error(
        "Missing environment variables: NETOPIA_SIGNATURE or NETOPIA_PUBLIC_CERT"
      );
      return new Response(
        JSON.stringify({
          error: "Server configuration error",
          details: "Missing payment gateway credentials",
        } as ErrorResponse),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Generate timestamp (Unix timestamp in seconds)
    const timestamp = Math.floor(Date.now() / 1000);

    // Determine URLs based on environment
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ||
      "https://your-supabase-project.supabase.co";
    const confirmUrl = `${SUPABASE_URL}/functions/v1/netopia-webhook`;
    const returnUrl = "http://127.0.0.1:5500/succes.html";

    // Generate XML payload
    const xmlPayload = generateXmlPayload(
      { orderId, amount, customerEmail, customerName },
      netopiaSignature,
      timestamp,
      confirmUrl,
      returnUrl
    );

    console.log("Generated XML Payload:", xmlPayload);

    // Encrypt the payload
    const { envKey, data } = await encryptPayload(
      xmlPayload,
      netopiaPublicCert
    );

    // Return response
    return new Response(
      JSON.stringify({
        paymentUrl: "https://sandboxsecure.mobilpay.ro",
        env_key: envKey,
        data: data,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("Payment handler error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: errorMessage,
      } as ErrorResponse),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
}

// ============================================================================
// Serve the function
// ============================================================================
serve(handler);
