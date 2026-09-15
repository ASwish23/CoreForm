// ── Supabase config ──────────────────────────────────────────────────────────
// Loaded from config.js (gitignored) — see config.example.js for the template.
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_KEY = window.SUPABASE_ANON_KEY;

const db = supabase.createClient(SUPABASE_URL.trim(), SUPABASE_KEY.trim());

// ── localStorage key ─────────────────────────────────────────────────────────
const CART_KEY = 'cart'; // single source of truth shared with cos.js

// ── Module-level product state ────────────────────────────────────────────────
let currentProduct = null;

// ── DOM refs ─────────────────────────────────────────────────────────────────
const skeletonEl          = document.getElementById('productSkeleton');
const contentEl           = document.getElementById('productContent');
const errorEl             = document.getElementById('productError');
const errorMsgEl          = document.getElementById('productErrorMsg');
const imageWrapEl         = document.getElementById('productImageWrapper');
const categoryEl          = document.getElementById('productCategory');
const nameEl              = document.getElementById('productName');
const pretEl              = document.getElementById('produs-pret');
const descriptionEl       = document.getElementById('productDescription');
const addToCartBtn        = document.getElementById('addToCartBtn');
const colorPickerEl       = document.getElementById('colorPickerContainer');
const colorPickerErrorEl  = document.getElementById('colorPickerError');
const cartBadgeEl         = document.getElementById('cartBadge');
const cartToastEl         = document.getElementById('cartToast');

// ── Extract product ID from URL ───────────────────────────────────────────────
const params    = new URLSearchParams(window.location.search);
const productId = params.get('id');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parses the imagine_url field which can arrive from Supabase
 * as an Array, a JSON-like string, or a plain URL string.
 * Returns the first image URL, or null.
 */
function parseImageUrl(rawValue) {
    if (!rawValue) return null;

    if (Array.isArray(rawValue) && rawValue.length > 0) {
        return rawValue[0].trim();
    }

    if (typeof rawValue === 'string') {
        const cleaned = rawValue.replace(/[{}"']/g, '');
        const parts   = cleaned.split(',');
        if (parts.length > 0 && parts[0].trim()) {
            return parts[0].trim();
        }
    }

    return null;
}

function showError(msg) {
    skeletonEl.style.display = 'none';
    contentEl.style.display  = 'none';
    errorEl.style.display    = 'block';
    if (msg) errorMsgEl.textContent = msg;
}

// ── Render product into the DOM ───────────────────────────────────────────────
function renderProduct(product) {
    // Store product data for use in cart logic
    currentProduct = product;

    // Image
    const imageSrc = parseImageUrl(product.imagine_url);
    if (imageSrc) {
        const img = document.createElement('img');
        img.src       = imageSrc;
        img.alt       = product.nume || '';
        img.className = 'product-main-image';
        imageWrapEl.innerHTML = '';
        imageWrapEl.appendChild(img);
    }

    // Text content
    categoryEl.textContent    = product.categorie || '';
    nameEl.textContent        = product.nume      || 'Produs fără nume';
    if (pretEl) {
        pretEl.textContent = product.pret != null ? product.pret + ' RON' : '';
    }
    descriptionEl.textContent = product.descriere || '';

    // Update browser tab title and the rest of the per-product SEO metadata.
    document.title = (product.nume || 'Produs') + ' — CoreForm Prints';
    updateProductMeta(product);

    // Show content, hide skeleton
    skeletonEl.style.display = 'none';
    contentEl.style.display  = 'grid';
}

/* ── Per-product SEO metadata ─────────────────────────────────────────────────
   The page is one template served for every ?id=, so the canonical URL, the
   description and the social tags all have to be rewritten per product.
   Without this, every product collapses onto https://coreform.ro/produs in the
   search index. ------------------------------------------------------------ */

function setMeta(selector, attr, value) {
    const el = document.head.querySelector(selector);
    if (el && value) el.setAttribute(attr, value);
}

function updateProductMeta(product) {
    const SITE = 'https://coreform.ro';
    const name = product.nume || 'Produs';
    const url  = SITE + '/produs?id=' + encodeURIComponent(product.id);

    const raw  = (product.descriere || '').replace(/\s+/g, ' ').trim();
    const desc = raw
        ? (raw.length > 155 ? raw.slice(0, 152).trimEnd() + '…' : raw)
        : name + ' — piesă printată 3D de CoreForm Prints, livrare în toată România.';

    let image = product.imagine || product.image || '';
    if (image && !/^https?:\/\//.test(image)) {
        image = SITE + '/' + image.replace(/^\//, '');
    }
    if (!image) image = SITE + '/PozeMarketing/og-default.jpg';

    setMeta('link[rel="canonical"]', 'href', url);
    setMeta('meta[name="description"]', 'content', desc);
    setMeta('meta[property="og:title"]', 'content', name + ' | CoreForm Prints');
    setMeta('meta[property="og:description"]', 'content', desc);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[property="og:image"]', 'content', image);
    setMeta('meta[property="og:type"]', 'content', 'product');
    setMeta('meta[name="twitter:title"]', 'content', name + ' | CoreForm Prints');
    setMeta('meta[name="twitter:description"]', 'content', desc);
    setMeta('meta[name="twitter:image"]', 'content', image);

    // Product structured data, so the listing can show price and availability.
    const ld = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: name,
        description: desc,
        image: image,
        url: url,
        brand: { '@type': 'Brand', name: 'CoreForm Prints' }
    };
    if (product.pret != null) {
        ld.offers = {
            '@type': 'Offer',
            price: String(product.pret),
            priceCurrency: 'RON',
            availability: 'https://schema.org/InStock',
            url: url,
            seller: { '@type': 'Organization', name: 'CORE FORM S.R.L.' }
        };
    }
    let script = document.getElementById('productJsonLd');
    if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'productJsonLd';
        document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(ld);
}

// ── Cart helpers ──────────────────────────────────────────────────────────────

function getCart() {
    try {
        return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function getTotalQuantity(cart) {
    return cart.reduce(function (sum, item) { return sum + (item.cantitate || item.quantity || 0); }, 0);
}

function updateCartBadge() {
    var total = getTotalQuantity(getCart());
    if (total > 0) {
        cartBadgeEl.textContent = total > 99 ? '99+' : String(total);
        cartBadgeEl.classList.add('visible');
    } else {
        cartBadgeEl.textContent = '';
        cartBadgeEl.classList.remove('visible');
    }
}

var toastTimer = null;
function showToast(msg) {
    cartToastEl.textContent = msg;
    cartToastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
        cartToastEl.classList.remove('show');
    }, 3000);
}

// ── Color picker ──────────────────────────────────────────────────────────────
let selectedSwatch = null;

document.querySelectorAll('.color-swatch').forEach(function (btn) {
    btn.addEventListener('click', function () {
        if (selectedSwatch) selectedSwatch.classList.remove('selected');
        btn.classList.add('selected');
        selectedSwatch = btn;
        // Clear validation error once a color is chosen
        colorPickerErrorEl.classList.remove('visible');
    });
});

// ── Cart button ───────────────────────────────────────────────────────────────
addToCartBtn.addEventListener('click', function () {
    // 1. Validate: color must be selected
    if (!selectedSwatch) {
        colorPickerErrorEl.classList.add('visible');
        colorPickerEl.classList.remove('shake');
        // Force reflow so animation restarts if triggered twice quickly
        void colorPickerEl.offsetWidth;
        colorPickerEl.classList.add('shake');
        colorPickerEl.addEventListener('animationend', function handler() {
            colorPickerEl.classList.remove('shake');
            colorPickerEl.removeEventListener('animationend', handler);
        });
        colorPickerEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
    }

    // 2. Build cart item
    var pretVal = currentProduct
        ? (parseFloat(currentProduct.pret) || 0)
        : (parseFloat((pretEl ? pretEl.textContent : '').replace(/[^\d.,]/g, '').replace(',', '.')) || 0);

    var item = {
        id:        productId,
        nume:      currentProduct ? (currentProduct.nume || nameEl.textContent) : nameEl.textContent,
        pret:      pretVal,
        imagine:   currentProduct ? parseImageUrl(currentProduct.imagine_url) : null,
        culoare:   selectedSwatch.dataset.color,
        cantitate: 1
    };

    // 3. Load current cart
    var cart = getCart();

    // 4. Duplicate check — same product ID AND same color
    var existingIdx = cart.findIndex(function (i) {
        return String(i.id) === String(item.id) &&
               i.culoare === item.culoare;
    });

    if (existingIdx > -1) {
        cart[existingIdx].cantitate += 1;
    } else {
        cart.push(item);
    }

    // 5. Persist
    saveCart(cart);

    // 6. Update nav badge
    updateCartBadge();

    // 7. Button feedback
    addToCartBtn.disabled = true;
    var originalHTML = addToCartBtn.innerHTML;
    addToCartBtn.innerHTML = '&#10003; Adăugat!';
    addToCartBtn.style.background   = '#2C4A3B';
    addToCartBtn.style.color        = '#FADADA';
    addToCartBtn.style.borderColor  = '#2C4A3B';

    setTimeout(function () {
        addToCartBtn.innerHTML       = originalHTML;
        addToCartBtn.style.background  = '';
        addToCartBtn.style.color       = '';
        addToCartBtn.style.borderColor = '';
        addToCartBtn.disabled          = false;
    }, 2000);

    // 8. Toast
    var qty = cart[existingIdx > -1 ? existingIdx : cart.length - 1].cantitate;
    var qtyLabel = qty > 1 ? ' (x' + qty + ' în coș)' : '';
    showToast('✓ ' + item.nume + ' — ' + item.culoare + qtyLabel + ' adăugat în coș');
});

// ── Init badge on page load ───────────────────────────────────────────────────
updateCartBadge();

// ── Recommendations ──────────────────────────────────────────────────────────
const sectiuneRecomandarilor     = document.getElementById('sectiune-recomandari');
const containerRecomandarilor    = document.getElementById('recomandari-container');

async function incarcaRecomandari(categorie, idCurent) {
    const { data, error } = await db
        .from('produse')
        .select('id, nume, imagine_url, pret')
        .eq('categorie', categorie)
        .neq('id', idCurent)
        .limit(4);

    if (error || !data || data.length === 0) return;

    containerRecomandarilor.innerHTML = '';

    data.forEach(function (rec) {
        var imageSrc = parseImageUrl(rec.imagine_url);

        var card = document.createElement('a');
        card.href      = '/produs.html?id=' + rec.id;
        card.className = 'rec-card';
        card.setAttribute('aria-label', rec.nume || 'Produs recomandat');

        var imageDiv = document.createElement('div');
        imageDiv.className = 'rec-card-image';

        if (imageSrc) {
            var img = document.createElement('img');
            img.src     = imageSrc;
            img.alt     = rec.nume || '';
            img.loading = 'lazy';
            imageDiv.appendChild(img);
        } else {
            var placeholder = document.createElement('div');
            placeholder.className   = 'mini-card-image-placeholder';
            placeholder.textContent = 'Fără imagine';
            imageDiv.appendChild(placeholder);
        }

        var bodyDiv = document.createElement('div');
        bodyDiv.className = 'rec-card-body';

        var cardName = document.createElement('p');
        cardName.className   = 'rec-card-name';
        cardName.textContent = rec.nume || '';

        var cardPrice = document.createElement('p');
        cardPrice.className   = 'rec-card-price';
        cardPrice.textContent = rec.pret != null ? rec.pret + ' RON' : '';

        bodyDiv.appendChild(cardName);
        bodyDiv.appendChild(cardPrice);
        card.appendChild(imageDiv);
        card.appendChild(bodyDiv);
        containerRecomandarilor.appendChild(card);
    });

    sectiuneRecomandarilor.style.display = 'block';
}

// ── Fetch & bootstrap ─────────────────────────────────────────────────────────
async function fetchProduct() {
    if (!productId) {
        showError('Niciun produs specificat. Verifică URL-ul.');
        return;
    }

    const { data, error } = await db
        .from('produse')
        .select('*')
        .eq('id', productId)
        .single();

    if (error || !data) {
        showError('Produsul cu ID-ul "' + productId + '" nu a fost găsit.');
        return;
    }

    renderProduct(data);
    incarcaRecomandari(data.categorie, data.id);
}

fetchProduct();
