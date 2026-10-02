const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let lastQuery = "";
let lastResults = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("ar-SD");
}

function formatUpdatedAt(value) {
  if (!value) return "وقت التحديث غير متاح";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "وقت التحديث غير متاح";

  return `آخر تحديث: ${date.toLocaleString("ar-SD", {
    dateStyle: "medium",
    timeStyle: "short"
  })}`;
}

function availabilityInfo(value) {
  if (value === "available") {
    return {
      label: "متوفر الآن",
      className: "available",
      icon: "✓"
    };
  }

  if (value === "limited") {
    return {
      label: "كمية محدودة",
      className: "limited",
      icon: "!"
    };
  }

  return {
    label: "غير متوفر",
    className: "unavailable",
    icon: "×"
  };
}

function show(id) {
  $(id)?.classList.remove("hidden");
}

function hide(id) {
  $(id)?.classList.add("hidden");
}

function setSearchState(state) {
  hide("#searchState");
  hide("#loadingState");
  hide("#errorState");
  hide("#resultsWrap");

  if (state === "idle") show("#searchState");
  if (state === "loading") show("#loadingState");
  if (state === "error") show("#errorState");
  if (state === "results") show("#resultsWrap");
}

function renderResults(results, query) {
  lastResults = Array.isArray(results) ? results : [];

  $("#resultTitle").textContent = `نتائج البحث عن «${query}»`;
  $("#resultCount").textContent =
    `${lastResults.length.toLocaleString("ar-SD")} صيدلية`;

  if (!lastResults.length) {
    $("#resultsGrid").innerHTML = `
      <div class="no-results">
        <div class="state-icon">⌕</div>
        <h3>لم نجد نتائج لهذا الدواء</h3>
        <p>
          لا توجد حاليًا صيدليات معتمدة لديها تحديث متوفر أو محدود
          لهذا الدواء. جرّب اسمًا آخر أو راجع الاسم العلمي.
        </p>
      </div>
    `;
    return;
  }

  $("#resultsGrid").innerHTML = lastResults.map((item) => {
    const medicine = item.medicine || {};
    const pharmacy = item.pharmacy || {};
    const status = availabilityInfo(item.availability);

    const phone = pharmacy.phone
      ? `<a class="phone-link" href="tel:${escapeHtml(pharmacy.phone)}">☎ ${escapeHtml(pharmacy.phone)}</a>`
      : "";

    const address = pharmacy.address
      ? `<span class="address">📍 ${escapeHtml(pharmacy.address)}</span>`
      : "";

    return `
      <article class="result-card">
        <div class="result-card-top">
          <div class="pharmacy-icon">🏪</div>
          <span class="status ${status.className}">
            <i>${status.icon}</i>${status.label}
          </span>
        </div>

        <div class="result-main">
          <span class="medicine-label">الدواء المطلوب</span>
          <h3>${escapeHtml(medicine.name || query)}</h3>

          <div class="medicine-details">
            ${medicine.generic_name ? `<span>الاسم العلمي: <b>${escapeHtml(medicine.generic_name)}</b></span>` : ""}
            ${medicine.strength ? `<span>التركيز: <b>${escapeHtml(medicine.strength)}</b></span>` : ""}
            ${medicine.form ? `<span>الشكل: <b>${escapeHtml(medicine.form)}</b></span>` : ""}
          </div>
        </div>

        <div class="pharmacy-name">
          <span>الصيدلية</span>
          <strong>${escapeHtml(pharmacy.name || "صيدلية معتمدة")}</strong>
        </div>

        <div class="quantity-box">
          <div>
            <span>الكمية المتاحة</span>
            <strong>${formatNumber(item.quantity)}</strong>
          </div>
          <span class="quantity-unit">وحدة</span>
        </div>

        <div class="result-meta">
          ${address}
          ${phone}
          <span>🕒 ${escapeHtml(formatUpdatedAt(item.updatedAt))}</span>
        </div>

        <div class="result-actions">
          ${pharmacy.latitude && pharmacy.longitude
            ? `<a class="map-link" target="_blank" rel="noopener"
                 href="https://www.google.com/maps?q=${encodeURIComponent(pharmacy.latitude + "," + pharmacy.longitude)}">
                 📍 الموقع
               </a>`
            : `<span class="map-link muted">📍 الموقع غير محدد</span>`
          }
          ${phone ? "" : `<span class="map-link muted">☎ لا يوجد هاتف</span>`}
        </div>
      </article>
    `;
  }).join("");
}

async function searchMedicine(query) {
  const q = String(query || "").trim();

  if (!q) {
    $("#medicineSearch").focus();
    $("#resultsHint").textContent = "اكتب اسم الدواء أولًا.";
    setSearchState("idle");
    return;
  }

  lastQuery = q;
  $("#medicineSearch").value = q;
  $("#resultsHint").textContent = `البحث عن: ${q}`;
  $("#clearResults").classList.remove("hidden");

  setSearchState("loading");

  try {
    const response = await fetch(`/api/medicines/search?q=${encodeURIComponent(q)}`, {
      headers: { "Accept": "application/json" }
    });

    const data = await response.json().catch(() => []);

    if (!response.ok) {
      throw new Error(data?.error || "تعذر تنفيذ البحث.");
    }

    renderResults(data, q);
    setSearchState("results");
    $("#search").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error("Medicine search error:", error);
    $("#errorText").textContent =
      error.message || "تعذر الاتصال بالخادم. حاول مرة أخرى.";
    setSearchState("error");
  }
}

function clearResults() {
  lastQuery = "";
  lastResults = [];
  $("#medicineSearch").value = "";
  $("#resultsHint").textContent = "اكتب اسم الدواء ثم اضغط «ابحث الآن».";
  $("#clearResults").classList.add("hidden");
  setSearchState("idle");
}

function initMenu() {
  $("#menuBtn")?.addEventListener("click", () => {
    $("nav")?.classList.toggle("open");
  });

  $$("nav a").forEach((link) => {
    link.addEventListener("click", () => $("nav")?.classList.remove("open"));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  $("#year").textContent = new Date().getFullYear();

  initMenu();

  $("#searchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    searchMedicine($("#medicineSearch").value);
  });

  $$("[data-query]").forEach((button) => {
    button.addEventListener("click", () => {
      searchMedicine(button.dataset.query);
    });
  });

  $("#clearResults")?.addEventListener("click", clearResults);
  $("#retryBtn")?.addEventListener("click", () => searchMedicine(lastQuery));

  $("#medicineSearch")?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") clearResults();
  });
});
