// Small, dependency-free behaviors. The page works fully without this file.
(function () {
  'use strict';

  var root = document.documentElement;

  // ---------- Theme toggle ----------
  var themeBtn = document.querySelector('.theme-toggle');
  var systemLight = window.matchMedia('(prefers-color-scheme: light)');

  function currentTheme() {
    return root.getAttribute('data-theme') || (systemLight.matches ? 'light' : 'dark');
  }
  function syncThemeLabel() {
    if (!themeBtn) return;
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    themeBtn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      syncThemeLabel();
    });
    if (systemLight.addEventListener) systemLight.addEventListener('change', syncThemeLabel);
    syncThemeLabel();
  }

  // ---------- Mobile menu ----------
  var navToggle = document.querySelector('.nav-toggle');
  var navLinks = document.getElementById('nav-links');
  function closeMenu() {
    if (!navLinks) return;
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  }
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    navLinks.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  }

  // ---------- Header border + active section ----------
  var header = document.querySelector('.site-header');
  function onScroll() { if (header) header.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if ('IntersectionObserver' in window) {
    var links = {};
    document.querySelectorAll('.nav-links a[href^="#"]').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = links[entry.target.id];
        if (!link) return;
        if (entry.isIntersecting) {
          Object.keys(links).forEach(function (k) { links[k].removeAttribute('aria-current'); });
          link.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  // ---------- Footer year ----------
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // ---------- Contact form ----------
  var form = document.getElementById('contact-form');
  if (!form) return;
  var status = form.querySelector('.form-status');
  var submit = form.querySelector('button[type="submit"]');
  var CONTACT_EMAIL = 'contact@konnectingnots.com';

  function setStatus(msg, kind) {
    status.textContent = msg;
    status.className = 'form-status' + (kind ? ' ' + kind : '');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var invalid = null;
    ['name', 'email', 'message'].forEach(function (id) {
      var field = form.elements[id];
      var ok = field.checkValidity();
      field.setAttribute('aria-invalid', String(!ok));
      if (!ok && !invalid) invalid = field;
    });
    if (invalid) {
      setStatus(invalid.name === 'email' ? 'Enter a valid email address.' : 'Fill in your name, email and message.', 'err');
      invalid.focus();
      return;
    }
    if (form.elements.botcheck && form.elements.botcheck.checked) return;

    var key = form.elements.access_key.value;
    var name = form.elements.name.value.trim();
    var email = form.elements.email.value.trim();
    var message = form.elements.message.value.trim();

    // No form service configured yet: hand off to the visitor's email app.
    if (!key || key.indexOf('YOUR_') === 0) {
      var subject = encodeURIComponent('Portfolio contact from ' + name);
      var body = encodeURIComponent(message + '\n\n' + name + '\n' + email);
      window.location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + subject + '&body=' + body;
      setStatus('Opening your email app. If nothing happens, email ' + CONTACT_EMAIL + ' directly.');
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Sending…';
    setStatus('');

    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok && d.success, data: d }; }); })
      .then(function (res) {
        if (res.ok) {
          form.reset();
          setStatus('Message sent. I’ll reply to ' + email + ' soon.', 'ok');
        } else {
          setStatus('The message didn’t send. Try again, or email ' + CONTACT_EMAIL + '.', 'err');
        }
      })
      .catch(function () {
        setStatus('Couldn’t reach the server. Check your connection, or email ' + CONTACT_EMAIL + '.', 'err');
      })
      .finally(function () {
        submit.disabled = false;
        submit.textContent = 'Send message';
      });
  });
})();
