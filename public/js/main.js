/* =========================================================
   Urdaneta City Library — main.js
   ========================================================= */

/* ── Page-load fade-in ── */
document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("loaded");
});

/* ── Navbar: scroll shadow + active link ── */
const navbar = document.querySelector(".navbar");

if (navbar) {
  // Scroll shadow
  window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 10);
  }, { passive: true });

  // Active link by pathname
  const path = window.location.pathname;
  document.querySelectorAll(".nav-links a").forEach(link => {
    const href = link.getAttribute("href");
    if (href === path || (href !== "/" && path.startsWith(href))) {
      link.classList.add("active");
    }
  });
}

/* ── Mobile hamburger toggle ── */
const toggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

if (toggle && navLinks) {
  toggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
    toggle.classList.toggle("open", open);
  });

  // Close on outside click
  document.addEventListener("click", e => {
    if (!toggle.contains(e.target) && !navLinks.contains(e.target)) {
      navLinks.classList.remove("open");
      toggle.classList.remove("open");
      toggle.setAttribute("aria-expanded", false);
    }
  });
}

/* ── Scroll-reveal (IntersectionObserver) ── */
(() => {
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => observer.observe(el));
})();

/* ── Staggered children reveal ── */
(() => {
  document.querySelectorAll(".reveal-stagger").forEach(parent => {
    const children = parent.children;
    Array.from(children).forEach((child, i) => {
      child.style.setProperty("--stagger-i", i);
      child.classList.add("reveal");
    });
  });

  // Re-run observer after stagger setup
  const els = document.querySelectorAll(".reveal:not(.revealed)");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.10 });
  els.forEach(el => observer.observe(el));
})();

/* ── Hero parallax (subtle) ── */
(() => {
  const media = document.querySelector(".hero-media");
  if (!media) return;

  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    media.style.transform = `scale(1.06) translateY(${y * 0.12}px)`;
  }, { passive: true });
})();

/* ── Policies Accordion ── */
(() => {
  const root = document.querySelector("#policyAccordion");
  if (!root) return;

  const items = root.querySelectorAll(".accordion-item");

  items.forEach(item => {
    const btn = item.querySelector(".accordion-btn");
    const panel = item.querySelector(".accordion-panel");
    const icon = item.querySelector(".accordion-icon");

    panel.style.maxHeight = "0px";

    btn.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");

      items.forEach(i => {
        i.classList.remove("open");
        const p = i.querySelector(".accordion-panel");
        const ic = i.querySelector(".accordion-icon");
        if (p) p.style.maxHeight = "0px";
        if (ic) ic.textContent = "+";
      });

      if (!isOpen) {
        item.classList.add("open");
        panel.style.maxHeight = panel.scrollHeight + "px";
        if (icon) icon.textContent = "–";
      }
    });
  });
})();

/* ── Gallery Lightbox ── */
(() => {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) return;

  const lightboxImg = lightbox.querySelector(".lightbox-img");
  const closeBtn = lightbox.querySelector(".lightbox-close");
  const caption = lightbox.querySelector(".lightbox-caption");
  const images = document.querySelectorAll(".gallery-item img");

  const open = (img) => {
    lightbox.classList.add("open");
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt || "Gallery Image";
    if (caption) caption.textContent = img.alt || "";
    document.body.style.overflow = "hidden";
  };

  const close = () => {
    lightbox.classList.remove("open");
    lightboxImg.src = "";
    document.body.style.overflow = "";
  };

  images.forEach(img => img.addEventListener("click", () => open(img)));
  if (closeBtn) closeBtn.addEventListener("click", close);
  lightbox.addEventListener("click", e => { if (e.target === lightbox) close(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
})();

/* ── Triple-click Admin Access ── */
(() => {
  const brand = document.querySelector(".brand");
  if (!brand) return;

  let clickCount = 0;
  let timer;

  brand.addEventListener("click", () => {
    clickCount++;
    if (clickCount === 1) {
      timer = setTimeout(() => { clickCount = 0; }, 1000);
    }
    if (clickCount === 3) {
      clearTimeout(timer);
      clickCount = 0;
      window.location.href = "/admin/login";
    }
  });
})();

/* ── Dynamic Live Search ── */
(() => {
  const searchInputs = document.querySelectorAll(".live-search");
  searchInputs.forEach(input => {
    input.addEventListener("input", (e) => {
      const targetSelector = input.getAttribute("data-target");
      if (!targetSelector) return;

      const items = document.querySelectorAll(targetSelector);
      const query = e.target.value.toLowerCase().trim();
      let hasVisible = false;

      const noResultsSelector = input.getAttribute("data-no-results");
      const noResults = noResultsSelector ? document.querySelector(noResultsSelector) : null;

      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
          item.style.display = "";
          hasVisible = true;
        } else {
          item.style.display = "none";
        }
      });

      if (noResults) {
        noResults.style.display = (hasVisible || items.length === 0) ? "none" : "";
      }
    });
  });
})();