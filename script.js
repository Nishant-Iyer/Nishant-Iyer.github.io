document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM fully loaded and parsed");

    // ===================================================================
    // LOADING SCREEN
    // ===================================================================
    const loader = document.getElementById('loader');
    const profileSection = document.getElementById('profile');

    // Prevent scrolling while loading
    document.body.style.overflow = 'hidden';

    // Hide loader and reveal content smoothly
    setTimeout(() => {
        if (loader) {
            loader.classList.add('hidden');
        }
        document.body.style.overflow = 'auto';

        // Smooth reveal of profile section
        if (profileSection) {
            profileSection.classList.add('revealed');
        }
    }, 1500);

    // ===================================================================
    // CUSTOM CURSOR
    // ===================================================================
    const cursor = document.querySelector('.cursor');
    const cursorFollower = document.querySelector('.cursor-follower');

    // Function to attach cursor hover events - reusable for dynamic content
    function attachCursorHover(elements) {
        if (!cursor || !cursorFollower) return;

        elements.forEach(el => {
            // Prevent duplicate listeners
            if (el.dataset.cursorAttached) return;
            el.dataset.cursorAttached = 'true';

            el.addEventListener('mouseenter', () => {
                cursor.classList.add('hover');
                cursorFollower.classList.add('hover');
            });
            el.addEventListener('mouseleave', () => {
                cursor.classList.remove('hover');
                cursorFollower.classList.remove('hover');
            });
        });
    }

    if (cursor && cursorFollower && window.matchMedia('(hover: hover)').matches) {
        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let cursorX = mouseX;
        let cursorY = mouseY;
        let followerX = mouseX;
        let followerY = mouseY;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        // Smooth cursor animation using RAF
        function animateCursor() {
            // Main cursor - faster follow
            cursorX += (mouseX - cursorX) * 0.25;
            cursorY += (mouseY - cursorY) * 0.25;
            cursor.style.left = cursorX + 'px';
            cursor.style.top = cursorY + 'px';

            // Follower - slower, smooth follow
            followerX += (mouseX - followerX) * 0.12;
            followerY += (mouseY - followerY) * 0.12;
            cursorFollower.style.left = followerX + 'px';
            cursorFollower.style.top = followerY + 'px';

            requestAnimationFrame(animateCursor);
        }
        animateCursor();

        // Attach hover to initial static elements
        const staticInteractiveElements = document.querySelectorAll('a, button, .btn, .icon, input, textarea');
        attachCursorHover(staticInteractiveElements);

        // Click effect
        document.addEventListener('mousedown', () => cursor.classList.add('click'));
        document.addEventListener('mouseup', () => cursor.classList.remove('click'));

        // Hide cursor when leaving window
        document.addEventListener('mouseleave', () => {
            cursor.style.opacity = '0';
            cursorFollower.style.opacity = '0';
        });
        document.addEventListener('mouseenter', () => {
            cursor.style.opacity = '1';
            cursorFollower.style.opacity = '1';
        });
    }

    // Make attachCursorHover available globally for dynamic content
    window.attachCursorHover = attachCursorHover;

    // ===================================================================
    // SCROLL PROGRESS INDICATOR
    // ===================================================================
    const scrollProgress = document.querySelector('.scroll-progress');

    // ===================================================================
    // PARTICLES BACKGROUND - PREMIUM COLORS
    // ===================================================================
    function createParticles() {
        const profile = document.getElementById('profile');
        const canvas = document.createElement('canvas');
        canvas.id = 'particles-canvas';
        profile.insertBefore(canvas, profile.firstChild);

        const ctx = canvas.getContext('2d');
        let particles = [];
        let mouseX = 0, mouseY = 0;

        // Premium color palette
        const colors = [
            { r: 0, g: 212, b: 255 },   // Cyan
            { r: 168, g: 85, b: 247 },  // Purple
            { r: 0, g: 168, b: 204 }    // Teal
        ];

        function resizeCanvas() {
            canvas.width = profile.offsetWidth;
            canvas.height = profile.offsetHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        class Particle {
            constructor() {
                this.reset();
            }

            reset() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 2 + 0.5;
                this.speedX = (Math.random() - 0.5) * 0.3;
                this.speedY = (Math.random() - 0.5) * 0.3;
                this.opacity = Math.random() * 0.4 + 0.1;
                this.color = colors[Math.floor(Math.random() * colors.length)];
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;

                // Mouse interaction - repel
                const dx = mouseX - this.x;
                const dy = mouseY - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 120) {
                    const force = (120 - distance) / 120;
                    this.x -= dx * force * 0.03;
                    this.y -= dy * force * 0.03;
                }

                // Boundary wrap
                if (this.x < -10) this.x = canvas.width + 10;
                if (this.x > canvas.width + 10) this.x = -10;
                if (this.y < -10) this.y = canvas.height + 10;
                if (this.y > canvas.height + 10) this.y = -10;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${this.opacity})`;
                ctx.fill();
            }
        }

        // Create particles - fewer for cleaner look
        const particleCount = Math.min(60, Math.floor((canvas.width * canvas.height) / 15000));
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }

        // Track mouse on profile section
        profile.addEventListener('mousemove', (e) => {
            const rect = profile.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;
        });

        function connectParticles() {
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < 150) {
                        const opacity = 0.1 * (1 - distance / 150);
                        // Gradient line between colors
                        const gradient = ctx.createLinearGradient(
                            particles[i].x, particles[i].y,
                            particles[j].x, particles[j].y
                        );
                        gradient.addColorStop(0, `rgba(${particles[i].color.r}, ${particles[i].color.g}, ${particles[i].color.b}, ${opacity})`);
                        gradient.addColorStop(1, `rgba(${particles[j].color.r}, ${particles[j].color.g}, ${particles[j].color.b}, ${opacity})`);

                        ctx.beginPath();
                        ctx.strokeStyle = gradient;
                        ctx.lineWidth = 0.5;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach(particle => {
                particle.update();
                particle.draw();
            });

            connectParticles();
            requestAnimationFrame(animate);
        }
        animate();
    }

    createParticles();



    // ===================================================================
    // VANILLA TILT FOR PROJECT CARDS
    // ===================================================================
    function initTiltCards() {
        const cards = document.querySelectorAll('.details-container.color-container');
        if (typeof VanillaTilt !== 'undefined') {
            VanillaTilt.init(cards, {
                max: 15,
                speed: 400,
                glare: true,
                "max-glare": 0.2,
                perspective: 1000
            });
        }
    }

    // ===================================================================
    // SCROLL TO TOP BUTTON
    // ===================================================================
    const scrollTopBtnEl = document.createElement('button');
    scrollTopBtnEl.className = 'scroll-top-btn';
    scrollTopBtnEl.innerHTML = '<i class="fas fa-arrow-up"></i>';
    scrollTopBtnEl.setAttribute('aria-label', 'Scroll to top');
    document.body.appendChild(scrollTopBtnEl);

    scrollTopBtnEl.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // ===================================================================
    // ACTIVE NAV LINK HIGHLIGHTING
    // ===================================================================
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = document.querySelectorAll('section');

    function updateActiveNav() {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            if (window.scrollY >= sectionTop) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').includes(current)) {
                link.classList.add('active');
            }
        });
    }

    // ===================================================================
    // DYNAMIC CONTENT LOADING
    // ===================================================================
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            populateExperience(data.experience);
            populateProjects(data.projects);

            // Re-initialize animations and effects after content is loaded
            initializeScrollAnimations();
            initTiltCards();
            initMagneticButtons();

            // Attach cursor hover to dynamically loaded content
            if (window.attachCursorHover) {
                const dynamicElements = document.querySelectorAll('.experience-entry, .details-container.color-container, .project-btn');
                window.attachCursorHover(dynamicElements);
            }
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

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            const navLinksEl = document.querySelector(".nav-links");
            const hamburgerIconEl = document.querySelector(".hamburger-icon");
            if (navLinksEl.classList.contains('open')) {
                navLinksEl.classList.remove('open');
                hamburgerIconEl.classList.remove('open');
            }
        });
    });

    // ===================================================================
    // CONSOLIDATED SCROLL HANDLER - Better Performance
    // ===================================================================
    let lastScrollY = window.scrollY;
    const mainNav = document.getElementById('main-nav');
    const picContainer = document.querySelector('.section__pic-container');

    // Single scroll handler for all scroll-based effects
    function handleScroll() {
        const currentScrollY = window.scrollY;
        const scrollTop = document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

        // Scroll progress indicator
        if (scrollProgress) {
            const progress = (scrollTop / scrollHeight) * 100;
            scrollProgress.style.width = progress + '%';
        }

        // Navigation hide/show on scroll
        if (mainNav) {
            if (lastScrollY < currentScrollY && currentScrollY > 150) {
                mainNav.classList.add('nav-hidden');
            } else {
                mainNav.classList.remove('nav-hidden');
            }
        }

        // Parallax for profile pic - only when revealed and in view
        if (picContainer && profileSection && profileSection.classList.contains('revealed') && currentScrollY < window.innerHeight) {
            picContainer.style.transform = `translateY(${currentScrollY * 0.15}px)`;
        }

        // Scroll to top button visibility
        const scrollTopBtn = document.querySelector('.scroll-top-btn');
        if (scrollTopBtn) {
            if (currentScrollY > 500) {
                scrollTopBtn.classList.add('visible');
            } else {
                scrollTopBtn.classList.remove('visible');
            }
        }

        // Update active nav link
        updateActiveNav();

        lastScrollY = currentScrollY;
    }

    // Throttle scroll handler for performance
    let scrollTicking = false;
    window.addEventListener('scroll', () => {
        if (!scrollTicking) {
            window.requestAnimationFrame(() => {
                handleScroll();
                scrollTicking = false;
            });
            scrollTicking = true;
        }
    });

    // ===================================================================
    // ANIMATIONS & EFFECTS
    // ===================================================================

    // Magnetic Button Effect - Subtle and smooth
    function initMagneticButtons() {
        document.querySelectorAll('.btn, .nav-links a').forEach(el => {
            if (el.dataset.magneticAttached) return;
            el.dataset.magneticAttached = 'true';

            el.addEventListener('mousemove', (e) => {
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                el.style.setProperty('--magnetic-x', `${x * 0.08}px`);
                el.style.setProperty('--magnetic-y', `${y * 0.08}px`);
            });

            el.addEventListener('mouseleave', () => {
                el.style.setProperty('--magnetic-x', '0px');
                el.style.setProperty('--magnetic-y', '0px');
            });
        });
    }
    initMagneticButtons();

    // GSAP Animations
    function initializeScrollAnimations() {
        if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
            gsap.registerPlugin(ScrollTrigger);

            // Animate section titles
            document.querySelectorAll('section:not(#profile) .title').forEach(title => {
                gsap.fromTo(title,
                    { y: 50, opacity: 0 },
                    {
                        y: 0,
                        opacity: 1,
                        duration: 0.8,
                        ease: "power3.out",
                        scrollTrigger: {
                            trigger: title,
                            start: "top 85%"
                        }
                    }
                );
            });

            // Animate subtitle text
            document.querySelectorAll('section:not(#profile) .section__text__p1').forEach(subtitle => {
                gsap.fromTo(subtitle,
                    { y: 30, opacity: 0 },
                    {
                        y: 0,
                        opacity: 1,
                        duration: 0.6,
                        ease: "power3.out",
                        scrollTrigger: {
                            trigger: subtitle,
                            start: "top 85%"
                        }
                    }
                );
            });

            // Staggered reveal for experience entries
            gsap.utils.toArray('.experience-entry').forEach((entry, i) => {
                gsap.fromTo(entry,
                    { y: 40, opacity: 0 },
                    {
                        y: 0,
                        opacity: 1,
                        duration: 0.6,
                        delay: i * 0.1,
                        ease: "power3.out",
                        scrollTrigger: {
                            trigger: entry,
                            start: "top 90%"
                        }
                    }
                );
            });

            // Staggered reveal for project cards
            gsap.utils.toArray('.details-container.color-container').forEach((card, i) => {
                gsap.fromTo(card,
                    { y: 50, opacity: 0 },
                    {
                        y: 0,
                        opacity: 1,
                        duration: 0.6,
                        delay: i * 0.1,
                        ease: "power3.out",
                        scrollTrigger: {
                            trigger: card,
                            start: "top 90%"
                        }
                    }
                );
            });

            // About section details containers
            gsap.utils.toArray('.about-containers .details-container').forEach((container, i) => {
                gsap.fromTo(container,
                    { y: 30, opacity: 0 },
                    {
                        y: 0,
                        opacity: 1,
                        duration: 0.5,
                        delay: i * 0.15,
                        ease: "power3.out",
                        scrollTrigger: {
                            trigger: container,
                            start: "top 85%"
                        }
                    }
                );
            });

            // Contact form reveal
            const contactForm = document.querySelector('.contact-form-container');
            if (contactForm) {
                gsap.fromTo(contactForm,
                    { y: 40, opacity: 0 },
                    {
                        y: 0,
                        opacity: 1,
                        duration: 0.6,
                        ease: "power3.out",
                        scrollTrigger: {
                            trigger: contactForm,
                            start: "top 85%"
                        }
                    }
                );
            }
        } else {
            // Fallback - show all elements if GSAP isn't available
            document.querySelectorAll('.experience-entry, .details-container, .contact-form-container, section .title, section .section__text__p1').forEach(el => {
                el.style.opacity = '1';
            });
        }
    }

    // Initialize animations for static content (About section)
    // Dynamic content (Experience, Projects) will re-init after fetch
    // Note: Main initialization happens after fetch completes

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
                    submitButton.style.backgroundColor = '#10B981'; // Green for success
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

    // ===================================================================
    // MOUSE GRADIENT SPOTLIGHT EFFECT
    // ===================================================================
    document.addEventListener('mousemove', (e) => {
        const spotlight = document.documentElement;
        spotlight.style.setProperty('--mouse-x', e.clientX + 'px');
        spotlight.style.setProperty('--mouse-y', e.clientY + 'px');
    });
});
