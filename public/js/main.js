/* ===========================
   NAV TOGGLE (Mobile)
   =========================== */
const toggle = document.getElementById("navToggle");
const links = document.getElementById("navLinks");

if (toggle && links) {
  toggle.addEventListener("click", () => {
    links.classList.toggle("active");
  });
}


/* ===========================
   POLICIES ACCORDION
   =========================== */
(() => {
  const root = document.querySelector("#policyAccordion");
  if (!root) return;

  const items = root.querySelectorAll(".accordion-item");

  items.forEach(item => {
    const btn = item.querySelector(".accordion-btn");
    const panel = item.querySelector(".accordion-panel");
    const icon = item.querySelector(".accordion-icon");

    // closed by default
    panel.style.maxHeight = "0px";

    btn.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");

      // close others
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


/* ===========================
   GALLERY LIGHTBOX
   =========================== */
document.addEventListener("DOMContentLoaded", () => {

  const lightbox = document.getElementById("lightbox");
  if (!lightbox) return; // only runs on gallery page

  const lightboxImg = lightbox.querySelector(".lightbox-img");
  const closeBtn = lightbox.querySelector(".lightbox-close");
  const images = document.querySelectorAll(".gallery-item img");

  // Open lightbox
  images.forEach(img => {
    img.addEventListener("click", () => {
      lightbox.classList.add("open");
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt || "Gallery Image";
      document.body.style.overflow = "hidden";
    });
  });

  // Close button
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      lightbox.classList.remove("open");
      document.body.style.overflow = "";
      lightboxImg.src = "";
    });
  }

  // Click outside image closes
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) {
      lightbox.classList.remove("open");
      document.body.style.overflow = "";
      lightboxImg.src = "";
    }
  });

  // ESC key closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox.classList.contains("open")) {
      lightbox.classList.remove("open");
      document.body.style.overflow = "";
      lightboxImg.src = "";
    }
  });

});

/* ===========================
   TRIPLE CLICK ADMIN ACCESS
   =========================== */

const brand = document.querySelector(".brand");

if (brand) {
  let clickCount = 0;
  let clickTimer;

  brand.addEventListener("click", () => {
    clickCount++;

    if (clickCount === 1) {
      clickTimer = setTimeout(() => {
        clickCount = 0;
      }, 1000); // reset if 3 clicks not completed within 1 sec
    }

    if (clickCount === 3) {
      clearTimeout(clickTimer);
      clickCount = 0;
      window.location.href = "/admin/login";
    }
  });
}