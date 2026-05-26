# Netopia Payments Integration Guide

## Environment Variables

Set the following environment variables in your Supabase project:

### 1. `NETOPIA_SIGNATURE`
Your POS Signature from Netopia dashboard. Example:
```
YOUR_POS_SIGNATURE_HERE
```

### 2. `NETOPIA_PUBLIC_CERT`
The Netopia public certificate in PEM format. Download from Netopia sandbox/production dashboard.
Store as a multi-line string in your environment:
```
-----BEGIN CERTIFICATE-----
MIIEijCCA3ICCQDe...
(certificate content)
...VzX4q9eFo=
-----END CERTIFICATE-----
```

### How to Set Environment Variables in Supabase

```bash
# Using Supabase CLI
supabase secrets set NETOPIA_SIGNATURE="your_signature"
supabase secrets set NETOPIA_PUBLIC_CERT="$(cat path/to/your/certificate.cer)"

# Or in Supabase Dashboard:
# Project Settings → Secrets and Credentials → Add Secrets
```

## Payment Flow

### 1. Frontend Request
Send a POST request to your Edge Function:
```javascript
const response = await fetch(
  'https://your-supabase-url.supabase.co/functions/v1/netopia-payment',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: 'ORDER_12345',
      amount: 99.99,
      customerEmail: 'customer@example.com',
      customerName: 'John Doe'
    })
  }
);

const { paymentUrl, env_key, data } = await response.json();
```

### 2. Redirect to Netopia
Create a hidden form and submit it to Netopia:
```javascript
// Create form dynamically
const form = document.createElement('form');
form.method = 'POST';
form.action = paymentUrl; // https://sandboxsecure.mobilpay.ro

// Add encrypted fields
const envKeyInput = document.createElement('input');
envKeyInput.type = 'hidden';
envKeyInput.name = 'env_key';
envKeyInput.value = env_key;

const dataInput = document.createElement('input');
dataInput.type = 'hidden';
dataInput.name = 'data';
dataInput.value = data;

form.appendChild(envKeyInput);
form.appendChild(dataInput);

// Submit form (redirects to Netopia)
document.body.appendChild(form);
form.submit();
```

### 3. Payment Webhook
Netopia will POST to your webhook endpoint (`/netopia-webhook`) on completion.

## Testing

### With Netopia Sandbox
- Netopia Sandbox URL: `https://sandboxsecure.mobilpay.ro`
- Test credentials provided by Netopia
- Test cards:
  - `4111 1111 1111 1111` (Visa - Success)
  - `4111 1111 1111 1112` (Visa - Decline)

### Local Testing
```bash
# Start local Supabase
supabase start

# Deploy function locally
supabase functions deploy netopia-payment

# Test with cURL
curl -X POST http://localhost:54321/functions/v1/netopia-payment \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "TEST_001",
    "amount": 100,
    "customerEmail": "test@example.com",
    "customerName": "Test User"
  }'
```

## Implementation Details

### Encryption Process
1. **Generate XML Payload**: Contains order, URLs, and customer data
2. **RC4 Encryption**: XML is encrypted with a random 16-byte key using RC4
3. **RSA Encryption**: The RC4 key is encrypted with Netopia's public certificate (RSA-OAEP)
4. **Base64 Encoding**: Both encrypted data and key are Base64 encoded

### CORS Configuration
The function allows requests from:
- `http://localhost:3000` (local development)
- `http://localhost:5173` (Vite dev)
- `https://coreform.vercel.app` (production)
- `https://www.coreform.vercel.app` (production with www)

Add additional origins as needed in `netopia-payment/index.ts`.

## Production Checklist

- [ ] Replace sandbox URL with production URL in response
- [ ] Update CORS allowed origins
- [ ] Set production NETOPIA_SIGNATURE and NETOPIA_PUBLIC_CERT
- [ ] Implement `/netopia-webhook` handler for payment confirmations
- [ ] Test end-to-end payment flow
- [ ] Set up logging and monitoring
- [ ] Add rate limiting if needed
- [ ] Test error scenarios and edge cases

## Security Notes

- The function automatically escapes XML special characters to prevent injection
- RC4 key is randomly generated per request (16 bytes)
- All sensitive data is encrypted before transmission
- CORS is strict and origin-dependent
- Never log or expose encryption keys or sensitive payment data

## Support

For Netopia integration issues:
- Netopia Sandbox Docs: https://www.mobilpay.ro
- Romania Payment Standard: PCI DSS compliant
