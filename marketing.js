// ===== Navbar Scroll Effect =====
const navbar = document.querySelector('.navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    
    lastScroll = currentScroll;
});

// ===== Case Card Hover Animation =====
const caseCards = document.querySelectorAll('.case-card');

caseCards.forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-10px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0) scale(1)';
    });
});

// ===== Intersection Observer for Scroll Animations =====
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const fadeInElements = document.querySelectorAll('.case-card');

const fadeInObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            setTimeout(() => {
                entry.target.style.opacity = '0';
                entry.target.style.transform = 'translateY(30px)';
                
                requestAnimationFrame(() => {
                    entry.target.style.transition = 'all 0.6s ease-out';
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                });
            }, index * 100);
            
            fadeInObserver.unobserve(entry.target);
        }
    });
}, observerOptions);

fadeInElements.forEach(element => {
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

// ===== Package Card 3D Hover Effect (transferred from old pricing cards) =====
const allPackageCards = document.querySelectorAll('.package-card');

allPackageCards.forEach(card => {
    // On enter: suppress transform transition so JS can drive each frame instantly
    card.addEventListener('mouseenter', () => {
        card.style.transition = 'box-shadow 0.35s ease, border-color 0.35s ease';
    });

    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
    });

    card.addEventListener('mouseleave', () => {
        // Re-enable transform transition only for the smooth snap-back
        card.style.transition = 'transform 0.4s ease-out, box-shadow 0.35s ease, border-color 0.35s ease';
        card.style.transform = '';
    });
});

// ===== Counter Animation for Metrics =====
function animateCounter(element, target, duration = 2000) {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
}

// ===== Parallax Effect on Hero Image =====
const heroImage = document.querySelector('.hero-image');

if (heroImage) {
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const parallax = scrolled * 0.3;
        
        if (scrolled < window.innerHeight) {
            heroImage.style.transform = `translateY(${parallax}px)`;
        }
    });
}

// ===== Button Ripple Effect =====
function createRipple(event) {
    const button = event.currentTarget;
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple');
    
    button.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

document.querySelectorAll('.btn-primary, .btn-secondary, .package-cta, .btn-primary-large').forEach(button => {
    button.addEventListener('click', createRipple);
});

// Add ripple CSS dynamically
const style = document.createElement('style');
style.textContent = `
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
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

// ===== Console Easter Egg =====
console.log('%c🚀 CoreForm Marketing', 'font-size: 24px; font-weight: bold; color: #F3E5E5;');
console.log('%cInteresați de marketing bazat pe performanță? Hai să vorbim.', 'font-size: 14px; color: #2C4A3B;');
console.log('%c📧 contact@coreform.marketing', 'font-size: 12px; color: #F3E5E5;');

// ===== Package Selection — Navigate to Contact with Pre-fill =====
function selectPackageAndNavigate(packageName) {
    const encoded = encodeURIComponent(packageName);
    window.location.href = 'contact.html?pachet=' + encoded;
}

// Main package CTA buttons
document.querySelectorAll('.package-cta').forEach(function(btn) {
    btn.addEventListener('click', function() {
        selectPackageAndNavigate(this.dataset.package);
    });
});

// Individual sub-package rows
document.querySelectorAll('.sub-package').forEach(function(row) {
    row.addEventListener('click', function() {
        selectPackageAndNavigate(this.dataset.package);
    });
});

// ===== Scroll Animation for Package Cards =====
const packageCards = document.querySelectorAll('.package-card');

if (packageCards.length > 0) {
    const packageObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry, index) {
            if (entry.isIntersecting) {
                setTimeout(function() {
                    entry.target.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    // Clear inline styles after animation so CSS hover & JS 3D effect take over cleanly
                    setTimeout(function() {
                        entry.target.style.transition = '';
                        entry.target.style.transform = '';
                        entry.target.style.opacity = '';
                    }, 700);
                }, index * 120);
                packageObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    packageCards.forEach(function(card) {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        packageObserver.observe(card);
    });
}