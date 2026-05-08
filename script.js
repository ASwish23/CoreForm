// Get references to sections
const leftSection = document.getElementById('leftSection');
const rightSection = document.getElementById('rightSection');
const logo = document.querySelector('.logo');

// Add smooth logo animation on hover
leftSection.addEventListener('mouseenter', () => {
    logo.style.transform = 'rotate(-5deg) scale(1.05)';
});

rightSection.addEventListener('mouseenter', () => {
    logo.style.transform = 'rotate(5deg) scale(1.05)';
});

leftSection.addEventListener('mouseleave', () => {
    logo.style.transform = '';
});

rightSection.addEventListener('mouseleave', () => {
    logo.style.transform = '';
});

// Add a subtle entrance animation on page load
window.addEventListener('load', () => {
    leftSection.style.opacity = '0';
    rightSection.style.opacity = '0';
    
    setTimeout(() => {
        leftSection.style.transition = 'opacity 0.8s ease-in-out, width 0.6s ease-in-out';
        rightSection.style.transition = 'opacity 0.8s ease-in-out, width 0.6s ease-in-out';
        leftSection.style.opacity = '1';
        rightSection.style.opacity = '1';
    }, 100);
});

// Optional: Add keyboard navigation for accessibility
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
        window.location.href = '/marketing.html';
    } else if (e.key === 'ArrowRight') {
        window.location.href = '/prints.html';
    }
});