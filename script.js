function toggleMenu() {
  const menu = document.querySelector(".menu-links");
  const icon = document.querySelector(".hamburger-icon");
  menu.classList.toggle("open");
  icon.classList.toggle("open");
}

// Theme Toggle
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
    });
});

/*
To add additional themeable icons:
1. Create two versions of the icon: e.g., 'new-icon-light.png' and 'new-icon-dark.png'.
2. Add the icon to your HTML with class 'icon' and the light version as the default src:
   <img src="./assets/new-icon-light.png" alt="New Icon" class="icon">
3. Ensure both images are in the ./assets/ folder.
The script above will automatically handle switching between them.
*/