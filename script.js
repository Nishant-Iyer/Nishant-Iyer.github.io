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
      });
  });