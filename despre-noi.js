// ===== Navbar Scroll Effect (hide on scroll down, show on scroll up) =====
const navbar = document.querySelector('.navbar');
let lastScrollY = window.scrollY;

window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;

    // Background tint
    navbar.style.background = currentScrollY > 100
        ? 'rgba(26, 45, 36, 0.98)'
        : 'rgba(44, 74, 59, 0.95)';

    // Hide / reveal
    if (currentScrollY > 50 && currentScrollY > lastScrollY) {
        navbar.classList.add('navbar-hidden');
    } else {
        navbar.classList.remove('navbar-hidden');
    }

    lastScrollY = currentScrollY;
});

// ===== Mobile Hamburger Nav Toggle =====
(function () {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    if (!hamburger || !navMenu) return;

    function closeMenu() {
        navMenu.classList.remove('active');
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
    }

    hamburger.addEventListener('click', function () {
        const isActive = navMenu.classList.toggle('active');
        hamburger.classList.toggle('active', isActive);
        hamburger.setAttribute('aria-expanded', String(isActive));
    });

    navMenu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', closeMenu);
    });

    window.addEventListener('scroll', function () {
        if (navMenu.classList.contains('active')) {
            closeMenu();
        }
    }, { passive: true });
})();

// ===== Fade-in Animation on Scroll =====
const observerOptions = {
    threshold: 0.15,
    rootMargin: '0px 0px -100px 0px'
};

const fadeInObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            fadeInObserver.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe all fade-in elements
document.querySelectorAll('.fade-in').forEach(element => {
    fadeInObserver.observe(element);
});

// ===== Smooth Scroll for Navigation Links =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        
        if (target) {
            const offsetTop = target.offsetTop - 80;
            
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// ===== Parallax Effect on Images =====
const images = document.querySelectorAll('.content-image img, .hero-image img');

window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    
    images.forEach(img => {
        const imageTop = img.offsetTop;
        const imageHeight = img.offsetHeight;
        const windowHeight = window.innerHeight;
        
        if (scrolled + windowHeight > imageTop && scrolled < imageTop + imageHeight) {
            const parallax = (scrolled - imageTop) * 0.1;
            img.style.transform = `translateY(${parallax}px) scale(1.05)`;
        }
    });
});

// ===== Count-Up Animation for Stat Numbers =====
function animateCountUp(element, duration = 1200) {
    const match = element.textContent.trim().match(/^([\d.]+)(.*)$/);
    if (!match) return;

    const target = parseFloat(match[1]);
    const suffix = match[2];
    const decimals = (match[1].split('.')[1] || '').length;
    const startTime = performance.now();

    function tick(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = (target * eased).toFixed(decimals) + suffix;

        if (progress < 1) {
            requestAnimationFrame(tick);
        } else {
            element.textContent = target.toFixed(decimals) + suffix;
        }
    }

    requestAnimationFrame(tick);
}

const statNumbers = document.querySelectorAll('.stat-number');

const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCountUp(entry.target);
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

statNumbers.forEach(stat => {
    statsObserver.observe(stat);
});

// ===== Loading Animation =====
window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    
    requestAnimationFrame(() => {
        document.body.style.transition = 'opacity 0.5s ease-in-out';
        document.body.style.opacity = '1';
    });
});

// ===== Interactive Highlight Items =====
const highlightItems = document.querySelectorAll('.highlight-item');

highlightItems.forEach(item => {
    item.addEventListener('mouseenter', function() {
        this.style.transform = 'translateX(15px)';
        this.style.boxShadow = '0 10px 30px rgba(250, 218, 218, 0.2)';
    });
    
    item.addEventListener('mouseleave', function() {
        this.style.transform = 'translateX(0)';
        this.style.boxShadow = 'none';
    });
});

// ===== Console Easter Egg =====
console.log('%c🚀 CoreForm Marketing', 'font-size: 24px; font-weight: bold; color: #FADADA;');
console.log('%cForța creativă din spatele brandurilor de succes.', 'font-size: 14px; color: #2C4A3B;');
console.log('%c📧 contact@coreform.marketing', 'font-size: 12px; color: #FADADA;');
