const toggle = document.getElementById("navToggle");
const links = document.getElementById("navLinks");
if (toggle && links) {
  toggle.addEventListener("click", () => links.classList.toggle("active"));
}

// Policies accordion
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

      // close others (single-open behavior)
      items.forEach(i => {
        i.classList.remove("open");
        const p = i.querySelector(".accordion-panel");
        const ic = i.querySelector(".accordion-icon");
        p.style.maxHeight = "0px";
        ic.textContent = "+";
      });

      if (!isOpen) {
        item.classList.add("open");
        panel.style.maxHeight = panel.scrollHeight + "px";
        icon.textContent = "–";
      }
    });
  });
})();
