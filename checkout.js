(function () {
  'use strict';

  /* ── Constants ──────────────────────────────────────────────── */
  const CART_KEY                = 'cart';
  const FREE_SHIPPING_THRESHOLD = 300;
  const SHIPPING_COST           = 20;

  const EDGE_FN_URL = 'https://gvqgmivhqfsdswrtaxyl.supabase.co/functions/v1/netopia-payment';

  /* ── Helpers ────────────────────────────────────────────────── */
  function fmt(val) {
    return val.toFixed(2).replace('.', ',') + '\u00a0RON';
  }

  function getCart() {
    try {
      var raw    = localStorage.getItem(CART_KEY);
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function normalizeItem(item) {
    return {
      id:       item.id       || item.productId    || null,
      name:     item.nume     || item.name         || item.productName   || 'Produs',
      color:    item.culoare  || item.color        || item.selectedColor || '—',
      image:    item.imagine  || item.image        || item.productImage  || null,
      price:    parseFloat(item.pret      != null ? item.pret      : (item.price    != null ? item.price    : 0)) || 0,
      quantity: parseInt (item.cantitate  != null ? item.cantitate : (item.quantity != null ? item.quantity : 1), 10) || 1
    };
  }

  function calcSubtotal(cart) {
    return cart.reduce(function (s, i) {
      var n = normalizeItem(i);
      return s + n.price * n.quantity;
    }, 0);
  }

  function calcShipping(subtotal) {
    return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  }

  function totalQty(cart) {
    return cart.reduce(function (s, i) {
      return s + (i.cantitate || i.quantity || 0);
    }, 0);
  }

  function updateBadge(cart) {
    var badge = document.getElementById('cartBadge');
    if (!badge) return;
    var n = totalQty(cart);
    badge.textContent = n > 99 ? '99+' : n > 0 ? String(n) : '';
    badge.classList.toggle('visible', n > 0);
  }

  /* ── Build summary items HTML ───────────────────────────────── */
  function buildSummaryItems(cart) {
    return cart.map(function (item) {
      var n = normalizeItem(item);
      var thumb = n.image
        ? '<img class="summary-item-thumb" src="' + n.image + '" alt="' + n.name + '" loading="lazy">'
        : '<div class="summary-item-thumb-placeholder">—</div>';
      return (
        '<div class="summary-item">' +
          thumb +
          '<div class="summary-item-info">' +
            '<div class="summary-item-name">' + n.name + '</div>' +
            '<div class="summary-item-meta">Culoare: ' + n.color + ' &times; ' + n.quantity + '</div>' +
          '</div>' +
          '<div class="summary-item-price">' + fmt(n.price * n.quantity) + '</div>' +
        '</div>'
      );
    }).join('');
  }

  /* ── SVG helpers ────────────────────────────────────────────── */
  var ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';

  /* ── Render main layout ─────────────────────────────────────── */
  function render() {
    var cart      = getCart();
    var container = document.getElementById('checkout-container');
    if (!container) return;

    updateBadge(cart);

    if (cart.length === 0) {
      container.innerHTML =
        '<div class="checkout-empty">' +
          '<h2>Coșul tău este gol</h2>' +
          '<p>Adaugă produse în coș înainte de a finaliza comanda.</p>' +
          '<a href="produse.html" class="btn-back">Vezi produsele</a>' +
        '</div>';
      return;
    }

    var subtotal = calcSubtotal(cart);
    var shipping = calcShipping(subtotal);
    var total    = subtotal + shipping;

    var shippingDisplay = shipping === 0
      ? '<span class="free-badge">Gratuit</span>'
      : fmt(shipping);

    container.innerHTML =
      '<div class="checkout-layout">' +

        /* ── Left column: form ── */
        '<div class="checkout-form-col">' +

          '<div id="globalError" class="global-error" role="alert" aria-live="assertive"></div>' +

          '<form id="checkoutForm" novalidate>' +

            /* Delivery details */
            '<div class="form-section">' +
              '<p class="form-section-title">Date de livrare</p>' +
              '<div class="form-row">' +
                '<div class="form-group full">' +
                  '<label class="form-label" for="fullName">Nume complet <span aria-hidden="true">*</span></label>' +
                  '<input class="form-input" type="text" id="fullName" name="fullName" placeholder="ex. Ion Popescu" autocomplete="name" required>' +
                  '<span class="form-error-msg" id="err-fullName">Câmpul este obligatoriu.</span>' +
                '</div>' +
                '<div class="form-group">' +
                  '<label class="form-label" for="phone">Telefon <span aria-hidden="true">*</span></label>' +
                  '<input class="form-input" type="tel" id="phone" name="phone" placeholder="07XX XXX XXX" autocomplete="tel" required>' +
                  '<span class="form-error-msg" id="err-phone">Număr de telefon invalid.</span>' +
                '</div>' +
                '<div class="form-group">' +
                  '<label class="form-label" for="email">Email <span aria-hidden="true">*</span></label>' +
                  '<input class="form-input" type="email" id="email" name="email" placeholder="email@exemplu.ro" autocomplete="email" required>' +
                  '<span class="form-error-msg" id="err-email">Adresă de email invalidă.</span>' +
                '</div>' +
                '<div class="form-group full">' +
                  '<label class="form-label" for="address">Adresă de livrare <span aria-hidden="true">*</span></label>' +
                  '<input class="form-input" type="text" id="address" name="address" placeholder="Str. Exemplu, nr. 1, ap. 2" autocomplete="street-address" required>' +
                  '<span class="form-error-msg" id="err-address">Câmpul este obligatoriu.</span>' +
                '</div>' +
                '<div class="form-group">' +
                  '<label class="form-label" for="city">Oraș <span aria-hidden="true">*</span></label>' +
                  '<input class="form-input" type="text" id="city" name="city" placeholder="ex. București" autocomplete="address-level2" required>' +
                  '<span class="form-error-msg" id="err-city">Câmpul este obligatoriu.</span>' +
                '</div>' +
              '</div>' +
            '</div>' +

            /* Payment method */
            '<div class="form-section">' +
              '<p class="form-section-title">Metodă de plată</p>' +
              '<div class="payment-options">' +
                '<label class="payment-option">' +
                  '<input type="radio" name="paymentMethod" value="card" checked>' +
                  '<div class="payment-option-body">' +
                    '<span class="payment-option-label">Plată cu cardul</span>' +
                    '<span class="payment-option-desc">Visa, Mastercard — procesare securizată</span>' +
                  '</div>' +
                  '<div class="payment-option-icon">' +
                    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                      '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>' +
                      '<line x1="1" y1="10" x2="23" y2="10"/>' +
                    '</svg>' +
                  '</div>' +
                '</label>' +
                '<label class="payment-option">' +
                  '<input type="radio" name="paymentMethod" value="ramburs">' +
                  '<div class="payment-option-body">' +
                    '<span class="payment-option-label">Plată Ramburs (la livrare)</span>' +
                    '<span class="payment-option-desc">Plătești cash la primirea coletului</span>' +
                  '</div>' +
                  '<div class="payment-option-icon">' +
                    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                      '<rect x="2" y="6" width="20" height="12" rx="2"/>' +
                      '<circle cx="12" cy="12" r="3"/>' +
                      '<path d="M6 12h.01M18 12h.01"/>' +
                    '</svg>' +
                  '</div>' +
                '</label>' +
              '</div>' +
            '</div>' +

            /* Submit */
            '<button type="submit" class="btn-place-order" id="placeOrderBtn">' +
              ICON_CHECK +
              'Plasează Comanda' +
            '</button>' +

          '</form>' +

          '<a href="cos.html" class="btn-back-cart">&#8592; Înapoi la coș</a>' +

        '</div>' +

        /* ── Right column: order summary ── */
        '<aside class="checkout-summary" aria-label="Sumar comandă">' +
          '<h2 class="checkout-summary-title">Sumar comandă</h2>' +
          '<div class="summary-items-list">' + buildSummaryItems(cart) + '</div>' +
          '<div class="summary-row"><span>Subtotal</span><span>' + fmt(subtotal) + '</span></div>' +
          '<div class="summary-row"><span>Transport</span><span>' + shippingDisplay + '</span></div>' +
          '<div class="summary-row total"><span>Total</span><span>' + fmt(total) + '</span></div>' +
        '</aside>' +

      '</div>';

    bindFormEvents();
  }

  /* ── Validation ─────────────────────────────────────────────── */
  function validateForm() {
    var valid = true;

    var fullName = document.getElementById('fullName');
    var phone    = document.getElementById('phone');
    var email    = document.getElementById('email');
    var address  = document.getElementById('address');
    var city     = document.getElementById('city');

    if (!fullName.value.trim()) {
      showFieldError(fullName, 'err-fullName', 'Câmpul este obligatoriu.');
      valid = false;
    }

    var phoneVal = phone.value.trim();
    if (!phoneVal || !/^[0-9 +\-()]{7,20}$/.test(phoneVal)) {
      showFieldError(phone, 'err-phone', 'Număr de telefon invalid.');
      valid = false;
    }

    var emailVal = email.value.trim();
    if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      showFieldError(email, 'err-email', 'Adresă de email invalidă.');
      valid = false;
    }

    if (!address.value.trim()) {
      showFieldError(address, 'err-address', 'Câmpul este obligatoriu.');
      valid = false;
    }

    if (!city.value.trim()) {
      showFieldError(city, 'err-city', 'Câmpul este obligatoriu.');
      valid = false;
    }

    return valid;
  }

  function showFieldError(input, errId, msg) {
    input.classList.add('error');
    var errEl = document.getElementById(errId);
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.add('visible');
    }
  }

  function clearFieldError(input) {
    input.classList.remove('error');
    var errEl = document.getElementById('err-' + input.id);
    if (errEl) errEl.classList.remove('visible');
  }

  /* ── Global error banner ────────────────────────────────────── */
  function showGlobalError(msg) {
    var el = document.getElementById('globalError');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visible');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function hideGlobalError() {
    var el = document.getElementById('globalError');
    if (el) el.classList.remove('visible');
  }

  /* ── Payment processing overlay ─────────────────────────────── */
  function showProcessingOverlay() {
    var overlay = document.getElementById('paymentOverlay');
    if (overlay) {
      overlay.classList.add('visible');
      overlay.setAttribute('aria-hidden', 'false');
    }
  }

  function hideProcessingOverlay() {
    var overlay = document.getElementById('paymentOverlay');
    if (overlay) {
      overlay.classList.remove('visible');
      overlay.setAttribute('aria-hidden', 'true');
    }
  }

  /* ── EmailJS: send order notification ─────────────────────── */
  // Formats cart items into a human-readable string and fires the
  // EmailJS template. Non-blocking — errors are logged but never
  // interrupt the checkout flow.
  function trimiteNotificareEmail(nume, telefon, email, detalii, total) {
    var templateParams = {
      nume_client:     nume,
      telefon_client:  telefon,
      email_client:    email,
      detalii_comanda: detalii,
      total_plata:     total
    };

    // Return the promise so callers can await it.
    // Logging and error handling are done at the call site.
    return emailjs.send('service_6dsjm16', 'template_v1dpcx2', templateParams);
  }

  /* ── Format cart for email body ─────────────────────────────── */
  function formatCartForEmail(cart, shipping, total) {
    var lines = cart.map(normalizeItem).map(function (item) {
      return item.name +
        ' (Culoare: ' + item.color + ')' +
        ' x' + item.quantity +
        ' — ' + fmt(item.price * item.quantity);
    });
    lines.push('');
    lines.push('Transport: ' + (shipping === 0 ? 'Gratuit' : fmt(shipping)));
    lines.push('TOTAL: ' + fmt(total));
    return lines.join('\n');
  }

  /* ── Supabase: persist order ────────────────────────────────── */
  // .select('id').single() returns the newly created row so that
  // result.data.id can be forwarded to the Netopia Edge Function.
  function saveOrder(orderData) {
    return _supabase
      .from('comenzi')
      .insert([orderData])
      .select('id')
      .single();
  }

  /* ── Netopia: initiate payment session ─────────────────────── */
  // POSTs orderId, amount, and customer details to the Supabase Edge
  // Function. Returns { paymentUrl, env_key, data } for the gateway.
  function initiateNetopiaPayment(orderId, amount, customerEmail, customerName) {
    return fetch(EDGE_FN_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        // supabaseKey is the anon key declared in database.js (loaded first)
        'Authorization': 'Bearer ' + supabaseKey
      },
      body: JSON.stringify({
        orderId:       String(orderId),
        amount:        amount,
        customerEmail: customerEmail,
        customerName:  customerName
      })
    })
    .then(function (res) {
      // Always parse JSON so we can surface server-side error messages
      return res.json().then(function (body) {
        if (!res.ok) {
          var serverMsg = (body && body.error) ? body.error : 'HTTP ' + res.status;
          throw new Error(serverMsg);
        }
        return body;
      });
    });
  }

  /* ── Netopia: POST redirect to secure payment page ──────────── */
  // Netopia requires a browser-level POST (not a redirect) so we
  // dynamically build a hidden form and submit it programmatically.
  function redirectToNetopia(paymentUrl, envKey, data) {
    var form = document.createElement('form');
    form.method = 'POST';
    form.action = paymentUrl;

    var envKeyInput = document.createElement('input');
    envKeyInput.type  = 'hidden';
    envKeyInput.name  = 'env_key';
    envKeyInput.value = envKey;
    form.appendChild(envKeyInput);

    var dataInput = document.createElement('input');
    dataInput.type  = 'hidden';
    dataInput.name  = 'data';
    dataInput.value = data;
    form.appendChild(dataInput);

    document.body.appendChild(form);
    form.submit();
  }

  /* ── Place order flow ───────────────────────────────────────── */
  function placeOrder(formData) {
    var btn = document.getElementById('placeOrderBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = ICON_CHECK + 'Se procesează\u2026';
    }
    hideGlobalError();

    var cart     = getCart();
    var subtotal = calcSubtotal(cart);
    var shipping = calcShipping(subtotal);
    var total    = subtotal + shipping;

    function resetBtn() {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = ICON_CHECK + 'Plasează Comanda';
      }
    }

    // Save the order to Supabase first, regardless of payment method.
    // Card orders are stored with 'in_asteptare' until Netopia confirms.
    var orderStatus = formData.paymentMethod === 'card' ? 'in_asteptare' : 'nou';

    saveOrder({
      nume_client:  formData.fullName,
      email:        formData.email,
      telefon:      formData.phone,
      adresa:       formData.address,
      oras:         formData.city,
      produse:      JSON.stringify(cart.map(normalizeItem)),
      total:        total,
      metoda_plata: formData.paymentMethod,
      status:       orderStatus
    })
    .then(async function (result) {
      if (result.error) {
        console.error('[checkout] Supabase error:', result.error);
        resetBtn();
        Swal.fire({
          title: 'Eroare la plasarea comenzii',
          text: 'Ceva nu a mers bine. Te rugăm să încerci din nou.',
          icon: 'error',
          confirmButtonColor: '#2C4A3B'
        });
        return;
      }

      var orderId = result.data && result.data.id;

      if (formData.paymentMethod === 'card') {
        /* ── Netopia Payments ──────────────────────────────────────
           1. Show SweetAlert2 loading state while calling the Edge Function.
           2. POST orderId + amount + customer details to the Edge Function.
           3. Dynamically submit a hidden form to Netopia's gateway.        */
        Swal.fire({
          title: 'Se pregătește plata securizată...',
          allowOutsideClick: false,
          allowEscapeKey:    false,
          didOpen: function () { Swal.showLoading(); }
        });

        try {
          var body = await initiateNetopiaPayment(
            orderId,
            total,
            formData.email,
            formData.fullName
          );

          if (!body || !body.paymentUrl || !body.env_key || !body.data) {
            throw new Error('Răspuns invalid de la server: date de plată incomplete.');
          }

          redirectToNetopia(body.paymentUrl, body.env_key, body.data);
        } catch (err) {
          console.error('[checkout] Netopia redirect error:', err);
          Swal.fire({
            title: 'Eroare la procesarea plății',
            text: 'Ceva nu a mers bine. Te rugăm să încerci din nou.',
            icon: 'error',
            confirmButtonColor: '#2C4A3B'
          });
          resetBtn();
        }

      } else {
        /* ── Cash on delivery ──────────────────────────────────────
           Send notification email then redirect to succes.html.     */
        var detalii = formatCartForEmail(cart, shipping, total);
        try {
          await trimiteNotificareEmail(
            formData.fullName,
            formData.phone,
            formData.email,
            detalii,
            Math.round(total) + ' lei'
          );
          console.log('[checkout] Email notificare trimis cu succes.');
        } catch (emailErr) {
          console.error('[checkout] Email notificare eșuat (comanda a fost salvată):', emailErr);
        }

        localStorage.removeItem(CART_KEY);
        Swal.fire({
          title: 'Comandă înregistrată!',
          text: 'Îți mulțumim! Comanda ta a fost preluată cu succes.',
          icon: 'success',
          confirmButtonColor: '#2C4A3B'
        }).then(function () {
          window.location.href = 'succes.html';
        });
      }
    })
    .catch(function (err) {
      console.error('[checkout] Unexpected error:', err);
      resetBtn();
      Swal.fire({
        title: 'Eroare la plasarea comenzii',
        text: 'Ceva nu a mers bine. Te rugăm să încerci din nou.',
        icon: 'error',
        confirmButtonColor: '#2C4A3B'
      });
    });
  }

  /* ── Form event binding ─────────────────────────────────────── */
  function bindFormEvents() {
    var form = document.getElementById('checkoutForm');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateForm()) return;

      var checked = form.querySelector('input[name="paymentMethod"]:checked');
      placeOrder({
        fullName:      document.getElementById('fullName').value.trim(),
        phone:         document.getElementById('phone').value.trim(),
        email:         document.getElementById('email').value.trim(),
        address:       document.getElementById('address').value.trim(),
        city:          document.getElementById('city').value.trim(),
        paymentMethod: checked ? checked.value : 'ramburs'
      });
    });

    /* Clear field errors on edit */
    form.querySelectorAll('.form-input').forEach(function (input) {
      input.addEventListener('input', function () { clearFieldError(input); });
    });
  }

  /* ── Mobile nav ─────────────────────────────────────────────── */
  function initMobileNav() {
    var navToggle = document.getElementById('navToggle');
    var navLinks  = document.getElementById('navLinks');
    if (!navToggle || !navLinks) return;
    navToggle.addEventListener('click', function () {
      var isOpen = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
      navToggle.setAttribute('aria-label', isOpen ? 'Închide meniu' : 'Deschide meniu');
    });
  }

  /* ── Bootstrap ──────────────────────────────────────────────── */
  function init() {
    initMobileNav();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
