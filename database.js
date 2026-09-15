// Loaded from config.js (gitignored) — see config.example.js for the template.
const rawUrl = window.SUPABASE_URL;
const rawKey = window.SUPABASE_ANON_KEY;

// Aici curățăm URL-ul automat în caz că are o bară oblică "/" sau spații la final
const supabaseUrl = rawUrl.trim().replace(/\/$/, "");
const supabaseKey = rawKey.trim();

const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// ── Category → data-carousel ID mapping ─────────────────────────────────────
// Keys should match the `categorie` values stored in Supabase (lookup below
// is case/whitespace-insensitive so small data inconsistencies don't cause
// products to silently disappear).
const CATEGORY_MAP = {
    'Accesorii personale': 'accesorii',
    'Decoratiuni':          'decoratiuni',
    'Birotica':             'birotica',
    'Organizarea casei':    'organizare'
};

// Normalized (trimmed, lowercased) lookup so trailing spaces or casing
// differences between the UI/DB don't cause a strict-match miss.
const CATEGORY_MAP_NORMALIZED = Object.keys(CATEGORY_MAP).reduce(function (acc, key) {
    acc[key.trim().toLowerCase()] = CATEGORY_MAP[key];
    return acc;
}, {});

function resolveCarouselId(categorie) {
    if (!categorie || typeof categorie !== 'string') return undefined;
    return CATEGORY_MAP_NORMALIZED[categorie.trim().toLowerCase()];
}

// ── Build a single <li class="carousel-card"> element ───────────────────────
function buildCardElement(product) {
    const li = document.createElement('li');
    li.className = 'carousel-card';

    // ── Image area ──────────────────────────────────────────────────────────
    const imageDiv = document.createElement('div');
    imageDiv.className = 'carousel-card-image';

    // imagine_url can be an Array or a plain string in Supabase
    let imageSrc = null;
    if (Array.isArray(product.imagine_url) && product.imagine_url.length > 0) {
        imageSrc = product.imagine_url[0];
    } else if (typeof product.imagine_url === 'string' && product.imagine_url) {
        imageSrc = product.imagine_url;
    }

    if (imageSrc) {
        const img = document.createElement('img');
        img.src = imageSrc;
        img.alt = product.nume || '';
        img.className = 'carousel-card-img';
        imageDiv.appendChild(img);
    } else {
        // Fallback placeholder icon (matches existing static card style)
        imageDiv.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>';
    }

    // ── Body area ────────────────────────────────────────────────────────────
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'carousel-card-body';

    const tag = document.createElement('p');
    tag.className = 'carousel-card-tag';
    tag.textContent = product.categorie || '';

    const title = document.createElement('h3');
    title.textContent = product.nume || '';

    const desc = document.createElement('p');
    desc.textContent = product.descriere || '';

    bodyDiv.appendChild(tag);
    bodyDiv.appendChild(title);
    bodyDiv.appendChild(desc);

    li.appendChild(imageDiv);
    li.appendChild(bodyDiv);

    return li;
}

// ── Scroll-triggered section animations ───────────────────────────────────────────
function initScrollAnimations() {
    var elements = document.querySelectorAll('.scroll-animate');
    console.log('Scroll Animations Initialized. Elements found: ' + elements.length);

    var observer = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    elements.forEach(function (el) {
        observer.observe(el);
    });
}

// ── Render all products into their carousel tracks ───────────────────────────────────────
function renderProducts(data) {
    if (!data || data.length === 0) {
        initScrollAnimations(); // no products — still reveal sections
        return;
    }

    // 1. Grupăm produsele în funcție de ID-ul caruselului țintă
    const grouped = {};
    data.forEach(function (product) {
        const carouselId = resolveCarouselId(product.categorie);
        if (!carouselId) return; // categorie necunoscută — o sărim
        if (!grouped[carouselId]) grouped[carouselId] = [];
        grouped[carouselId].push(product);
    });

    // 2. Pentru fiecare grup: curățăm sliderele vechi și le adăugăm pe cele noi din baza de date
    Object.keys(grouped).forEach(function (carouselId) {
        const stage = document.querySelector('[data-carousel="' + carouselId + '"]');
        if (!stage) return;

        const track = stage.querySelector('.carousel-track');
        if (!track) return;

        // Ștergem cardurile statice de test (placeholderele)
        track.innerHTML = '';

        // Creăm și adăugăm cardul pentru fiecare produs din această categorie
        grouped[carouselId].forEach(function (product) {
            
            // --- LOGICA DE CURĂȚARE A IMAGINII ---
            let imagineSrc = '';
            if (product.imagine_url) {
                if (Array.isArray(product.imagine_url) && product.imagine_url.length > 0) {
                    imagineSrc = product.imagine_url[0];
                } else if (typeof product.imagine_url === 'string') {
                    // Eliminăm caracterele reziduale de la Supabase ({, }, ", ')
                    let cleanString = product.imagine_url.replace(/[{}"']/g, ''); 
                    let links = cleanString.split(','); 
                    if (links.length > 0 && links[0].trim() !== '') {
                        imagineSrc = links[0].trim(); 
                    }
                }
            }

            // --- CONSTRUIREA STRUCTURII HTML ---
            // Folosim flexbox pentru a forța imaginea sus și textul jos
            const cardHTML = `
                <li class="carousel-card" style="display: flex; flex-direction: column; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); height: 320px; cursor: pointer;">
                  <a href="/produs.html?id=${product.id}" style="display: flex; flex-direction: column; height: 100%; text-decoration: none;">

                    <div class="carousel-card-image" style="flex: 0 0 75%; overflow: hidden; background-color: #f5f5f5;">
                      ${imagineSrc
                          ? `<img src="${imagineSrc}" alt="${product.nume}" style="width: 100%; height: 100%; object-fit: cover; display: block;">`
                          : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #888;">Fără imagine</div>`
                      }
                    </div>

                    <div class="carousel-card-body" style="flex: 0 0 25%; background-color: #FADADA; padding: 10px 14px; display: flex; flex-direction: column; justify-content: center; overflow: hidden;">
                      <h3 style="margin: 0 0 2px 0; font-size: 1rem; color: #2C4A3B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          ${product.nume}
                      </h3>
                      ${product.pret != null ? `<p style="margin: 0; font-size: 0.85rem; font-weight: 700; color: #2C4A3B;">${product.pret} RON</p>` : ''}
                    </div>

                  </a>
                </li>
            `;

            // Adăugăm cardul creat în slider-ul categoriei
            track.innerHTML += cardHTML;
        });
    });

    // 3. Reinițializăm mecanismul de slider (stânga-dreapta) abia ACUM, după ce toate cardurile sunt pe ecran
    if (typeof window.initCarousels === 'function') {
        window.initCarousels();
    }

    // 4. Inițializăm animațiile de scroll DUPĂ ce toate cardurile sunt în DOM
    initScrollAnimations();
}

// ── Fetch products from Supabase ─────────────────────────────────────────────
async function getProducts() {
    console.log("Încerc să mă conectez la Supabase...");

    const { data, error } = await _supabase
        // MARE ATENȚIE: Aici pui numele EXACT. Dacă în Supabase e "Produse" cu P mare, pune "Produse"
        .from('produse')
        .select('*');

    if (error) {
        console.error('Eroare la conectare:', error);
        initScrollAnimations(); // fallback — ensure sections are never permanently hidden
        return;
    }

    console.log('Produsele primite:', data);
    renderProducts(data);
}

getProducts();