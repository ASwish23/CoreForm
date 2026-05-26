/**
 * Frontend Integration Example for Netopia Payments
 * 
 * This example shows how to:
 * 1. Call the Edge Function with payment details
 * 2. Receive encrypted data
 * 3. Redirect to Netopia payment gateway
 */

// Configuration
const EDGE_FUNCTION_URL = 'https://your-supabase-url.supabase.co/functions/v1/netopia-payment';

/**
 * Initialize payment process
 * @param {Object} paymentData - { orderId, amount, customerEmail, customerName }
 */
async function initiateNetopiaPayment(paymentData) {
  try {
    console.log('Initiating Netopia payment...', paymentData);

    // Call Edge Function to get encrypted data
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: paymentData.orderId,
        amount: parseFloat(paymentData.amount),
        customerEmail: paymentData.customerEmail,
        customerName: paymentData.customerName,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Payment initiation failed');
    }

    const { paymentUrl, env_key, data } = await response.json();
    console.log('Payment data received, redirecting to Netopia...');

    // Redirect to Netopia with encrypted data
    redirectToNetopia(paymentUrl, env_key, data);
  } catch (error) {
    console.error('Payment error:', error);
    alert(`Payment error: ${error.message}`);
  }
}

/**
 * Create hidden form and redirect to Netopia
 * @param {string} paymentUrl - Netopia URL (sandbox or production)
 * @param {string} envKey - Encrypted RC4 key
 * @param {string} data - Encrypted XML payload
 */
function redirectToNetopia(paymentUrl, envKey, data) {
  // Create form element
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = paymentUrl;
  form.style.display = 'none';

  // Create env_key input
  const envKeyInput = document.createElement('input');
  envKeyInput.type = 'hidden';
  envKeyInput.name = 'env_key';
  envKeyInput.value = envKey;

  // Create data input
  const dataInput = document.createElement('input');
  dataInput.type = 'hidden';
  dataInput.name = 'data';
  dataInput.value = data;

  // Append inputs to form
  form.appendChild(envKeyInput);
  form.appendChild(dataInput);

  // Append form to body and submit
  document.body.appendChild(form);
  form.submit();
}

/**
 * Handle payment return from Netopia
 * Called after customer completes payment on Netopia
 */
function handlePaymentReturn() {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status');
  const orderId = urlParams.get('orderId');

  console.log(`Payment return - Status: ${status}, Order: ${orderId}`);

  if (status === 'success') {
    // Payment successful - verify with your backend
    verifyPaymentStatus(orderId);
  } else {
    // Payment failed or cancelled
    console.warn('Payment was not successful');
  }
}

/**
 * Verify payment status with your backend
 * @param {string} orderId - The order ID from Netopia
 */
async function verifyPaymentStatus(orderId) {
  try {
    const response = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });

    const result = await response.json();
    console.log('Payment verification:', result);
  } catch (error) {
    console.error('Verification error:', error);
  }
}

// ============================================================================
// HTML Integration Example
// ============================================================================

/*
<html>
<head>
  <title>CoreForm Checkout</title>
</head>
<body>
  <div class="checkout-container">
    <h1>Finalizare Comanda</h1>

    <form id="paymentForm">
      <div>
        <label for="orderId">ID Comanda:</label>
        <input type="text" id="orderId" value="ORDER_12345" required>
      </div>

      <div>
        <label for="amount">Suma (RON):</label>
        <input type="number" id="amount" value="99.99" step="0.01" required>
      </div>

      <div>
        <label for="customerName">Nume Client:</label>
        <input type="text" id="customerName" placeholder="John Doe" required>
      </div>

      <div>
        <label for="customerEmail">Email:</label>
        <input type="email" id="customerEmail" placeholder="john@example.com" required>
      </div>

      <button type="submit" id="payButton">Plateaza cu Netopia</button>
    </form>
  </div>

  <script src="netopia-payment.js"></script>
  <script>
    document.getElementById('paymentForm').addEventListener('submit', (e) => {
      e.preventDefault();

      initiateNetopiaPayment({
        orderId: document.getElementById('orderId').value,
        amount: document.getElementById('amount').value,
        customerName: document.getElementById('customerName').value,
        customerEmail: document.getElementById('customerEmail').value,
      });
    });

    // Check if returning from payment
    if (window.location.pathname === '/succes.html') {
      handlePaymentReturn();
    }
  </script>
</body>
</html>
*/
