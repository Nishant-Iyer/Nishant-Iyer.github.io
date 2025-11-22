document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM fully loaded and parsed");

    // ===================================================================
    // DYNAMIC CONTENT LOADING
    // ===================================================================
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            populateExperience(data.experience);
            populateProjects(data.projects);
            // Re-initialize animations after content is loaded
            initializeScrollAnimations(); 
        })
        .catch(error => console.error("Error loading portfolio data:", error));

    function populateExperience(experience) {
        const container = document.querySelector('#experience .experience-details-container');
        container.innerHTML = ''; // Clear existing
        experience.forEach(job => {
            const entry = document.createElement('div');
            entry.className = 'experience-entry';

            const logoContainer = document.createElement('div');
            logoContainer.className = 'logo-container';
            const logo = document.createElement('img');
            logo.src = job.logo_light;
            logo.alt = job.alt;
            logoContainer.appendChild(logo);

            const textContainer = document.createElement('div');
            textContainer.className = 'text-container';
            const title = document.createElement('h3');
            title.textContent = job.title;
            const dates = document.createElement('p');
            dates.textContent = job.dates;
            const dutiesList = document.createElement('ul');
            job.duties.forEach(dutyText => {
                const duty = document.createElement('li');
                duty.textContent = dutyText;
                dutiesList.appendChild(duty);
            });

            textContainer.appendChild(title);
            textContainer.appendChild(dates);
            textContainer.appendChild(dutiesList);

            entry.appendChild(logoContainer);
            entry.appendChild(textContainer);

            container.appendChild(entry);
        });
    }

    function populateProjects(projects) {
        const container = document.querySelector('#projects .projects-container');
        container.innerHTML = ''; // Clear existing
        projects.forEach(project => {
            const card = document.createElement('div');
            card.className = 'details-container color-container'; // Using existing styling

            const articleContainer = document.createElement('div');
            articleContainer.className = 'article-container';
            const projectImg = document.createElement('img');
            projectImg.src = project.image;
            projectImg.alt = `${project.title} Project Thumbnail`;
            projectImg.className = 'project-img';
            articleContainer.appendChild(projectImg);

            const projectTitle = document.createElement('h2');
            projectTitle.className = 'experience-sub-title project-title';
            projectTitle.textContent = project.title;

            const projectDescription = document.createElement('p');
            projectDescription.className = 'project-description';
            projectDescription.textContent = project.description;

            const btnContainer = document.createElement('div');
            btnContainer.className = 'btn-container';

            const githubBtn = document.createElement('button');
            githubBtn.className = 'btn btn-color-2 project-btn';
            githubBtn.textContent = 'Github';
            githubBtn.addEventListener('click', () => {
                window.location.href = project.github;
            });
            btnContainer.appendChild(githubBtn);

            if (project.liveDemo) {
                const demoBtn = document.createElement('button');
                demoBtn.className = 'btn btn-color-2 project-btn';
                const demoText = project.liveDemo.includes('github.com') ? 'View Notebook' : 'Live Demo';
                demoBtn.textContent = demoText;
                demoBtn.addEventListener('click', () => {
                    window.location.href = project.liveDemo;
                });
                btnContainer.appendChild(demoBtn);
            }

            card.appendChild(articleContainer);
            card.appendChild(projectTitle);
            card.appendChild(projectDescription);
            card.appendChild(btnContainer);

            container.appendChild(card);
        });
    }


    // ===================================================================
    // MOBILE NAVIGATION
    // ===================================================================
    function toggleMenu() {
        const navLinks = document.querySelector(".nav-links");
        const hamburgerIcon = document.querySelector(".hamburger-icon");
        navLinks.classList.toggle("open");
        hamburgerIcon.classList.toggle("open");
    }

    const hamburgerIcon = document.querySelector('.hamburger-icon');
    if (hamburgerIcon) {
        hamburgerIcon.addEventListener('click', toggleMenu);
    }

    document.querySelectorAll('.menu-links a').forEach(link => {
        link.addEventListener('click', () => {
            const navLinks = document.querySelector(".nav-links");
            const hamburgerIcon = document.querySelector(".hamburger-icon");
            if (navLinks.classList.contains('open')) {
                navLinks.classList.remove('open');
                hamburgerIcon.classList.remove('open');
            }
        });
    });

    // ===================================================================
    // NAVIGATION SCROLL EFFECT
    // ===================================================================
    let lastScrollY = window.scrollY;
    const mainNav = document.getElementById('main-nav');

    window.addEventListener('scroll', () => {
        if (lastScrollY < window.scrollY && window.scrollY > 150) {
            // Scrolling down
            mainNav.style.top = '-80px';
        } else {
            // Scrolling up
            mainNav.style.top = '0';
        }
        lastScrollY = window.scrollY;
    });


    // ===================================================================
    // ANIMATIONS & EFFECTS
    // ===================================================================

    // Parallax for profile pic
    window.addEventListener('scroll', () => {
        const picContainer = document.querySelector('.section__pic-container');
        if (picContainer) {
            picContainer.style.transform = `translateY(${window.scrollY * 0.2}px)`;
        }
    });

    // Magnetic Button Effect
    document.querySelectorAll('.btn, .nav-links a, .logo-svg').forEach(el => {
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            el.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px)`;
            el.style.transition = 'transform 0.1s ease-out';
        });

        el.addEventListener('mouseleave', () => {
            el.style.transform = 'translate(0, 0)';
            el.style.transition = 'transform 0.3s ease';
        });
    });

    // GSAP Animations
    function initializeScrollAnimations() {
        if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
            gsap.registerPlugin(ScrollTrigger);

            // Animate headings
            document.querySelectorAll('h1, h2').forEach(heading => {
                gsap.fromTo(heading, { y: 50, opacity: 0, skewY: 5 }, {
                    y: 0, opacity: 1, skewY: 0, duration: 0.8, ease: "power4.out",
                    scrollTrigger: { trigger: heading, start: "top 85%" }
                });
            });

            // Staggered reveal for experience entries
            gsap.utils.toArray('.experience-entry').forEach((entry, i) => {
                gsap.fromTo(entry, { y: 50, opacity: 0 }, {
                    y: 0, opacity: 1, duration: 0.8, delay: i * 0.1,
                    scrollTrigger: { trigger: entry, start: "top 90%" }
                });
            });
            
            // Staggered reveal for project cards
            gsap.utils.toArray('.details-container.color-container').forEach((card, i) => {
                gsap.fromTo(card, { y: 50, opacity: 0 }, {
                    y: 0, opacity: 1, duration: 0.8, delay: i * 0.1,
                    scrollTrigger: { trigger: card, start: "top 90%" }
                });
            });
        }
    }

    // Initial call for animations on static content
    initializeScrollAnimations();

    // ===================================================================
    // DYNAMIC YEAR IN FOOTER
    // ===================================================================
    const yearSpan = document.getElementById('current-year');
    if(yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // ===================================================================
    // CONTACT FORM SUBMISSION
    // ===================================================================
    const contactForm = document.getElementById('contact-form');
    if(contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const form = e.target;
            const data = new FormData(form);
            const action = form.action;
            const submitButton = form.querySelector('button');

            submitButton.disabled = true;
            submitButton.textContent = 'Sending...';

            fetch(action, {
                method: 'POST',
                body: data,
                headers: {
                    'Accept': 'application/json'
                }
            }).then(response => {
                if (response.ok) {
                    submitButton.textContent = 'Message Sent!';
                    submitButton.style.backgroundColor = '#28a745'; // Green for success
                    form.reset();
                } else {
                    response.json().then(data => {
                        if (Object.hasOwn(data, 'errors')) {
                            alert(data["errors"].map(error => error["message"]).join(", "));
                        } else {
                            submitButton.textContent = 'Send Message';
                            alert('Oops! There was a problem submitting your form');
                        }
                    })
                }
            }).catch(error => {
                submitButton.textContent = 'Send Message';
                alert('Oops! There was a problem submitting your form');
            }).finally(() => {
                setTimeout(() => {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Send Message';
                    submitButton.style.backgroundColor = ''; // Revert to original color
                }, 3000);
            });
        });
    }
});

