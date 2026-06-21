// ===================== SCROLL REVEAL ===================== //
const revealElements = document.querySelectorAll(".reveal");

const revealOnScroll = () => {
  const triggerBottom = window.innerHeight * 0.88;

  revealElements.forEach((el) => {
    const top = el.getBoundingClientRect().top;

    if (top < triggerBottom) {
      el.classList.add("active");
    }
  });
};

window.addEventListener("scroll", revealOnScroll, { passive: true });
window.addEventListener("load", revealOnScroll);

// ===================== NAVBAR SCROLL STATE ===================== //
const navbar = document.getElementById("navbar");
const scrollBar = document.getElementById("scrollBar");
const backToTop = document.getElementById("backToTop");

const onScrollUI = () => {
  const scrollY = window.scrollY || document.documentElement.scrollTop;

  // navbar background
  if (navbar) navbar.classList.toggle("scrolled", scrollY > 12);

  // scroll progress
  if (scrollBar) {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
    scrollBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  }

  // back to top visibility
  if (backToTop) backToTop.classList.toggle("visible", scrollY > 500);
};

window.addEventListener("scroll", onScrollUI, { passive: true });
window.addEventListener("load", onScrollUI);

backToTop?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ===================== MOBILE NAV TOGGLE ===================== //
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

navToggle?.addEventListener("click", () => {
  navToggle.classList.toggle("open");
  navLinks.classList.toggle("open");
});

navLinks?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navToggle?.classList.remove("open");
    navLinks?.classList.remove("open");
  });
});

// ===================== CURSOR GLOW ===================== //
const cursorGlow = document.getElementById("cursorGlow");

if (cursorGlow && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  window.addEventListener("mousemove", (e) => {
    cursorGlow.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
  });
}

// ===================== WALLET CARD 3D TILT ===================== //
const walletCard = document.getElementById("walletCard");
const walletShine = document.getElementById("walletShine");

if (walletCard && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  walletCard.addEventListener("mousemove", (e) => {
    const rect = walletCard.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rotateX = ((y / rect.height) - 0.5) * -10;
    const rotateY = ((x / rect.width) - 0.5) * 12;

    walletCard.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;

    if (walletShine) {
      walletShine.style.setProperty("--mx", `${(x / rect.width) * 100}%`);
      walletShine.style.setProperty("--my", `${(y / rect.height) * 100}%`);
    }
  });

  walletCard.addEventListener("mouseleave", () => {
    walletCard.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)";
  });
}

// ===================== SPOTLIGHT CARDS (features / developers) ===================== //
const spotlightCards = document.querySelectorAll(".spotlight-card");

spotlightCards.forEach((card) => {
  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    card.style.setProperty("--my", `${e.clientY - rect.top}px`);
  });
});

// ===================== ANIMATED COUNTERS ===================== //
const counterEls = document.querySelectorAll("[data-count]");

const animateCounter = (el) => {
  const target = parseFloat(el.getAttribute("data-count"));
  const decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
  const suffix = el.getAttribute("data-suffix") || "";
  const duration = 1600;
  const start = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const value = target * eased;

    el.textContent = decimals > 0
      ? value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix
      : Math.round(value).toLocaleString() + suffix;

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = decimals > 0
        ? target.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix
        : target.toLocaleString() + suffix;
    }
  };

  requestAnimationFrame(tick);
};

if ("IntersectionObserver" in window) {
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counterEls.forEach((el) => counterObserver.observe(el));
} else {
  counterEls.forEach(animateCounter);
}

// ===================== NEWSLETTER FORM (demo only) ===================== //
const newsletterForm = document.getElementById("newsletterForm");
const newsletterMsg = document.getElementById("newsletterMsg");

newsletterForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const input = newsletterForm.querySelector("input[type='email']");

  if (input && input.value) {
    newsletterMsg.textContent = "Thanks — you're on the list! 🎉";
    input.value = "";
    setTimeout(() => { newsletterMsg.textContent = ""; }, 4000);
  }
});

// ===================== SMOOTH ANCHOR OFFSET (sticky navbar) ===================== //
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (e) => {
    const targetId = anchor.getAttribute("href");
    if (targetId.length <= 1) return;
    const targetEl = document.querySelector(targetId);
    if (!targetEl) return;

    e.preventDefault();
    const navHeight = navbar ? navbar.offsetHeight : 0;
    const top = targetEl.getBoundingClientRect().top + window.scrollY - navHeight - 12;
    window.scrollTo({ top, behavior: "smooth" });
  });
});