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

// ===== Highlight Stats Animation =====
const statNumbers = document.querySelectorAll('.stat-number');

const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.animation = 'pulse 1s ease-out';
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

statNumbers.forEach(stat => {
    statsObserver.observe(stat);
});

// Add pulse animation to CSS dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0%, 100% {
            transform: scale(1);
        }
        50% {
            transform: scale(1.1);
        }
    }
`;
document.head.appendChild(style);

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
