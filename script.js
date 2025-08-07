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

        const fadeDuration = 500;

        // Fade and update all icons based on theme
        const isDark = document.body.classList.contains('dark');
        document.querySelectorAll('.icon').forEach(img => {
            img.classList.add('fade');
            setTimeout(() => {
                img.src = isDark
                    ? img.src.replace('-light.png', '-dark.png')
                    : img.src.replace('-dark.png', '-light.png');
                img.classList.remove('fade');
            }, fadeDuration);
        });

        // Fade and update logo SVGs based on theme
        document.querySelectorAll('.logo-svg').forEach(logo => {
            logo.classList.add('fade');
            setTimeout(() => {
                logo.src = isDark
                    ? 'https://readme-typing-svg.demolab.com/?font=Fira+Code&weight=900&size=36&pause=1000&color=FFFFFF&center=true&vCenter=true&width=250&lines=Nishant+Iyer'
                    : 'https://readme-typing-svg.demolab.com/?font=Fira+Code&weight=900&size=36&pause=1000&color=000000&center=true&vCenter=true&width=250&lines=Nishant+Iyer';
                logo.classList.remove('fade');

                // Ensure SVG loads correctly, log error if it fails
                logo.onerror = () => {
                    console.error('Failed to load SVG:', logo.src);
                };
            }, fadeDuration);
        });
    });
});
