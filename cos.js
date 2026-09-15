(function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────────────── */
  const CART_KEY                = 'cart';
  const PROMO_CODES             = { LICENTA20: 0.20 };
  const FREE_SHIPPING_THRESHOLD = 300;
  const SHIPPING_COST           = 20;

  /* ── State ──────────────────────────────────────────────────── */
  let activePromo = null; // { code: string, discount: number } | null

  /* ── Storage helpers ────────────────────────────────────────── */
  function getCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      console.log('Cart contents in cos.js:', raw);
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('cos.js: failed to parse cart from localStorage', e);
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  /* ── Formatting ─────────────────────────────────────────────── */
  function fmt(val) {
    return val.toFixed(2).replace('.', ',') + '\u00a0RON';
  }

  /* ── Badge ──────────────────────────────────────────────────── */
  function totalQty(cart) {
    return cart.reduce(function (s, i) { return s + (i.cantitate || i.quantity || 0); }, 0);
  }

  function updateBadge(cart) {
    var badge = document.getElementById('cartBadge');
    if (!badge) return;
    var n = totalQty(cart);
    badge.textContent = n > 99 ? '99+' : n > 0 ? String(n) : '';
    badge.classList.toggle('visible', n > 0);
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

  function calcDiscount(subtotal) {
    return activePromo ? subtotal * activePromo.discount : 0;
  }

  /* ── HTML builders ──────────────────────────────────────────── */
  function buildEmpty() {
    return (
      '<div class="cart-empty">' +
        '<div class="cart-empty-icon"><svg viewBox="0 0 24 24" aria-hidden="true">' +
          '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>' +
          '<line x1="3" y1="6" x2="21" y2="6"/>' +
          '<path d="M16 10a4 4 0 01-8 0"/>' +
        '</svg></div>' +
        '<h2>Coșul tău este gol</h2>' +
        '<p>Explorează produsele noastre și adaugă ce îți place.</p>' +
        '<a href="/produse.html" class="btn-back">Întoarce-te la magazin</a>' +
      '</div>'
    );
  }

  // Normalize a cart item — primary schema: { id, nume, pret, imagine, culoare, cantitate }
  // Legacy aliases kept for backward-compat with any old localStorage entries.
  function normalizeItem(item) {
    return {
      id:       item.id                                                      || item.productId    || null,
      name:     item.nume      || item.name        || item.productName       || 'Produs',
      color:    item.culoare   || item.color       || item.selectedColor     || '—',
      image:    item.imagine   || item.image       || item.productImage      || null,
      price:    parseFloat(item.pret  != null ? item.pret  : (item.price  != null ? item.price  : 0)) || 0,
      quantity: parseInt(item.cantitate != null ? item.cantitate : (item.quantity != null ? item.quantity : 1), 10) || 1
    };
  }

  function buildRow(item, idx) {
    var n = normalizeItem(item);
    var thumb = n.image
      ? '<img class="cart-item-thumb" src="' + n.image + '" alt="' + n.name + '" loading="lazy">'
      : '<div class="cart-item-thumb-placeholder">Fără img</div>';

    var rowSubtotal = n.price * n.quantity;

    return (
      '<tr>' +
        '<td>' +
          '<div class="cart-item-info">' +
            thumb +
            '<div>' +
              '<p class="cart-item-name">' + n.name + '</p>' +
              '<span class="cart-item-color">Culoare: ' + n.color + '</span>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td class="col-price">' + fmt(n.price) + '</td>' +
        '<td>' +
          '<div class="cart-qty">' +
            '<button class="cart-qty-btn" data-action="dec" data-idx="' + idx + '" aria-label="Scade cantitate">&minus;</button>' +
            '<span class="cart-qty-value">' + n.quantity + '</span>' +
            '<button class="cart-qty-btn" data-action="inc" data-idx="' + idx + '" aria-label="Crește cantitate">+</button>' +
          '</div>' +
        '</td>' +
        '<td class="col-subtotal">' + fmt(rowSubtotal) + '</td>' +
        '<td class="col-remove">' +
          '<button class="cart-remove-btn" data-idx="' + idx + '" aria-label="Șterge produs">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<polyline points="3 6 5 6 21 6"/>' +
              '<path d="M19 6l-1 14H6L5 6"/>' +
              '<path d="M10 11v6"/><path d="M14 11v6"/>' +
              '<path d="M9 6V4h6v2"/>' +
            '</svg>' +
          '</button>' +
        '</td>' +
      '</tr>'
    );
  }

  function buildSummary(subtotal, shipping, discount, total) {
    var remaining = FREE_SHIPPING_THRESHOLD - subtotal;

    var shippingDisplay = shipping === 0
      ? '<span class="free-badge">Gratuit</span>'
      : fmt(shipping);

    var shippingNote = remaining > 0
      ? '<p class="shipping-note">Mai adaugă produse de <strong>' + fmt(remaining) + '</strong> pentru transport gratuit!</p>'
      : '<p class="shipping-note is-free">&#10003; Transport gratuit aplicat!</p>';

    var discountRow = activePromo
      ? '<div class="cart-summary-row is-discount"><span>Reducere (' +
          (activePromo.discount * 100).toFixed(0) + '%)</span>' +
          '<span>&minus;' + fmt(discount) + '</span></div>'
      : '';

    var promoApplied = activePromo
      ? '<p class="promo-applied">Cod <strong>' + activePromo.code + '</strong> activat cu succes!</p>'
      : '';

    var promoAttrs = activePromo ? ' readonly' : '';
    var promoBtnAttrs = activePromo ? ' disabled' : '';
    var promoBtnLabel = activePromo ? 'Aplicat ✓' : 'Aplică';

    return (
      '<div class="cart-summary">' +
        '<h2 class="cart-summary-title">Sumar comandă</h2>' +
        '<div class="cart-summary-row"><span>Subtotal</span><span>' + fmt(subtotal) + '</span></div>' +
        '<div class="cart-summary-row"><span>Transport</span><span>' + shippingDisplay + '</span></div>' +
        shippingNote +
        discountRow +
        '<div class="cart-summary-row total"><span>Total</span><span>' + fmt(total) + '</span></div>' +
        '<div class="promo-box">' +
          '<input type="text" id="promoInput" class="promo-input" placeholder="Cod promoțional" ' +
            'value="' + (activePromo ? activePromo.code : '') + '" ' +
            'aria-label="Cod promoțional" autocomplete="off"' + promoAttrs + '>' +
          '<button id="promoBtn" class="promo-btn"' + promoBtnAttrs + '>' + promoBtnLabel + '</button>' +
        '</div>' +
        promoApplied +
        '<a href="/checkout.html" class="btn-checkout">Finalizează Comanda</a>' +
        '<a href="/produse.html" class="cart-continue">Continuă cumpărăturile</a>' +
      '</div>'
    );
  }

  /* ── Render ─────────────────────────────────────────────────── */
  function render() {
    var cart      = getCart();
    var container = document.getElementById('cart-container');
    if (!container) return;

    updateBadge(cart);

    if (cart.length === 0) {
      container.innerHTML = buildEmpty();
      return;
    }

    var subtotal = calcSubtotal(cart);
    var shipping = calcShipping(subtotal);
    var discount = calcDiscount(subtotal);
    var total    = Math.max(0, subtotal + shipping - discount);

    var rows = cart.map(buildRow).join('');

    container.innerHTML = (
      '<div class="cart-layout">' +
        '<div class="cart-items-col">' +
          '<table class="cart-table">' +
            '<thead><tr>' +
              '<th>Produs</th>' +
              '<th class="col-price">Preț unitar</th>' +
              '<th>Cantitate</th>' +
              '<th class="col-subtotal">Subtotal</th>' +
              '<th></th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
        buildSummary(subtotal, shipping, discount, total) +
      '</div>'
    );

    bindEvents(container);
  }

  /* ── Event binding ──────────────────────────────────────────── */
  function bindEvents(container) {
    /* Quantity controls + remove */
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action], .cart-remove-btn');
      if (!btn) return;

      var cart = getCart();
      var idx  = parseInt(btn.dataset.idx, 10);
      if (isNaN(idx) || idx < 0 || idx >= cart.length) return;

      if (btn.classList.contains('cart-remove-btn')) {
        cart.splice(idx, 1);
      } else if (btn.dataset.action === 'inc') {
        var cur = parseInt(cart[idx].cantitate != null ? cart[idx].cantitate : cart[idx].quantity, 10) || 1;
        cart[idx].cantitate = cur + 1;
      } else if (btn.dataset.action === 'dec') {
        var cur = parseInt(cart[idx].cantitate != null ? cart[idx].cantitate : cart[idx].quantity, 10) || 1;
        cart[idx].cantitate = Math.max(1, cur - 1);
      }

      saveCart(cart);
      render();
    });

    /* Promo code */
    var promoBtn   = document.getElementById('promoBtn');
    var promoInput = document.getElementById('promoInput');

    function applyPromo() {
      var code = (promoInput ? promoInput.value : '').trim().toUpperCase();
      if (PROMO_CODES[code]) {
        activePromo = { code: code, discount: PROMO_CODES[code] };
        render();
      } else {
        showPromoError('Cod invalid sau expirat.');
      }
    }

    if (promoBtn)   promoBtn.addEventListener('click', applyPromo);
    if (promoInput) promoInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') applyPromo();
    });
  }

  function showPromoError(msg) {
    var existing = document.getElementById('promoError');
    if (existing) existing.remove();

    var el       = document.createElement('p');
    el.id        = 'promoError';
    el.className = 'promo-error';
    el.textContent = msg;

    var box = document.querySelector('.promo-box');
    if (box) box.insertAdjacentElement('afterend', el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 3000);
  }

  /* ── Bootstrap ──────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }

}());
