// Toggle mobile menu
function toggleMenu() {
    const menu = document.querySelector(".menu-links");
    const icon = document.querySelector(".hamburger-icon");
    menu.classList.toggle("open");
    icon.classList.toggle("open");
}

// Theme toggle functionality
document.querySelectorAll('.theme-icon').forEach(icon => {
    icon.addEventListener('click', function() {
        document.body.classList.toggle('dark');

        // Update all icons based on theme
        document.querySelectorAll('.icon').forEach(img => {
            if (document.body.classList.contains('dark')) {
                img.src = img.src.replace('-light.png', '-dark.png');
            } else {
                img.src = img.src.replace('-dark.png', '-light.png');
            }
        });

        // Update logo SVGs based on theme
        document.querySelectorAll('.logo-svg').forEach(logo => {
            if (document.body.classList.contains('dark')) {
                logo.src = 'https://readme-typing-svg.demolab.com/?font=Fira+Code&weight=900&size=36&pause=1000&color=FFFFFF&center=true&vCenter=true&width=250&lines=Nishant+Iyer';
            } else {
                logo.src = 'https://readme-typing-svg.demolab.com/?font=Fira+Code&weight=900&size=36&pause=1000&color=000000&center=true&vCenter=true&width=250&lines=Nishant+Iyer';
            }

            // Ensure SVG loads correctly, log error if it fails
            logo.onerror = () => {
                console.error('Failed to load SVG:', logo.src);
            };
        });
    });
});