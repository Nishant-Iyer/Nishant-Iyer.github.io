// Toggle mobile menu
function toggleMenu() {
    const menu = document.querySelector(".menu-links");
    const icon = document.querySelector(".hamburger-icon");
    menu.classList.toggle("open");
    icon.classList.toggle("open");
}

// Contact form mailto handler
const contactForm = document.querySelector('#contact-form');

if (contactForm) {
    contactForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = contactForm.name.value.trim();
        const email = contactForm.email.value.trim();
        const message = contactForm.message.value.trim();

        const subject = encodeURIComponent(`Portfolio contact from ${name || 'a collaborator'}`);
        const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);

        window.location.href = `mailto:itsnishantiyer@gmail.com?subject=${subject}&body=${body}`;
    });
}

// Initialize AOS animations
AOS.init({
    duration: 600,
    once: true,
});
