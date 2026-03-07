/* Side-nav toggle — shared across all pages */
(function () {
    const toggle = document.getElementById('nav-toggle');
    const sideNav = document.getElementById('side-nav');
    const overlay = document.getElementById('nav-overlay');
    if (!toggle || !sideNav || !overlay) return;

    function closeNav() {
        sideNav.classList.remove('open');
        overlay.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function () {
        var open = sideNav.classList.toggle('open');
        overlay.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
    });

    overlay.addEventListener('click', closeNav);

    sideNav.querySelectorAll('.side-nav-link').forEach(function (link) {
        link.addEventListener('click', closeNav);
    });
})();
