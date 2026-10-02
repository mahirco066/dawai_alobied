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


async function searchPrescriptionMedicines(names) {
  const unique = [...new Set(names.map(x => x.trim()).filter(x => x.length >= 3))].slice(0, 8);
  const container = $("#ocrMedicines");
  if (!container) return;

  if (!unique.length) {
    container.innerHTML = `<span class="ocr-note">لم أتمكن من استخراج أسماء أدوية واضحة. جرّب صورة أوضح ومباشرة للروشتة.</span>`;
    return;
  }

  container.innerHTML = unique.map(name =>
    `<button type="button" class="ocr-medicine searching" data-ocr-name="${escapeHtml(name)}">${escapeHtml(name)} — جاري البحث</button>`
  ).join("");

  for (const name of unique) {
    try {
      const response = await fetch(`/api/medicines/search?q=${encodeURIComponent(name)}`, {
        headers: { "Accept": "application/json" }
      });
      const data = await response.json().catch(() => []);
      const btn = container.querySelector(`[data-ocr-name="${CSS.escape(name)}"]`);
      if (btn) {
        btn.classList.remove("searching");
        btn.textContent = `${name} — ${Array.isArray(data) && data.length ? `${data.length} نتيجة` : "لا توجد نتيجة"}`;
        btn.onclick = () => {
          $("#medicineSearch").value = name;
          renderResults(data, name);
          $("#resultTitle").textContent = `نتائج البحث عن «${name}»`;
          $("#resultCount").textContent = `${Array.isArray(data) ? data.length.toLocaleString("ar-SD") : 0} صيدلية`;
          setSearchState("results");
          $("#search").scrollIntoView({ behavior:"smooth", block:"start" });
        };
      }
    } catch {
      const btn = container.querySelector(`[data-ocr-name="${CSS.escape(name)}"]`);
      if (btn) {
        btn.classList.remove("searching");
        btn.textContent = `${name} — تعذر البحث`;
      }
    }
  }
}

function guessMedicineNames(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(x => x.replace(/[|_~`]+/g, " ").trim())
    .filter(x => x.length >= 3);

  const stop = new Set([
    "الاسم","اسم","المريض","المريضة","التاريخ","الطبيب","الدكتور","دكتورة",
    "وصفة","روشتة","prescription","patient","date","doctor","rx",
    "mg","ml","tablet","tablets","capsule","capsules","شراب","أقراص","كبسولات"
  ]);

  return lines
    .map(line => line.replace(/^[\d\-\.\)\(]+\s*/, "").trim())
    .filter(line => !stop.has(line.toLowerCase()))
    .filter(line => /[A-Za-z\u0600-\u06FF]/.test(line))
    .map(line => line.replace(/\s{2,}/g, " "))
    .slice(0, 8);
}

async function processPrescription(file) {
  const panel = $("#ocrPanel");
  const preview = $("#prescriptionPreview");
  const status = $("#ocrStatus");
  const bar = $("#ocrProgressBar");
  const textBox = $("#ocrText");
  const medicinesBox = $("#ocrMedicines");

  panel?.classList.remove("hidden");
  medicinesBox.innerHTML = "";
  status.textContent = "جاري قراءة الصورة...";
  bar.style.width = "2%";

  const url = URL.createObjectURL(file);
  preview.src = url;

  if (!window.Tesseract) {
    status.textContent = "تعذر تحميل محرك قراءة الروشتة.";
    return;
  }

  try {
    const result = await Tesseract.recognize(file, "ara+eng", {
      logger: message => {
        if (message.status === "recognizing text" && typeof message.progress === "number") {
          bar.style.width = `${Math.max(2, Math.round(message.progress * 100))}%`;
          status.textContent = `جاري قراءة الروشتة ${Math.round(message.progress * 100)}%`;
        } else if (message.status) {
          status.textContent = "جاري تحليل الروشتة...";
        }
      }
    });

    const text = result?.data?.text || "";
    textBox.textContent = text.trim() || "لم يتم استخراج نص واضح من الصورة.";
    bar.style.width = "100%";
    status.textContent = "تمت قراءة الصورة.";

    const names = guessMedicineNames(text);
    await searchPrescriptionMedicines(names);
  } catch (error) {
    console.error("Prescription OCR error:", error);
    status.textContent = "تعذر قراءة الروشتة.";
    textBox.textContent = "حدث خطأ أثناء قراءة الصورة. جرّب صورة أوضح.";
  }
}

function initPrescriptionSearch() {
  const button = $("#prescriptionBtn");
  const input = $("#prescriptionInput");
  const close = $("#ocrClose");

  button?.addEventListener("click", () => input?.click());

  input?.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("يرجى اختيار صورة للروشتة.");
      input.value = "";
      return;
    }
    processPrescription(file);
  });

  close?.addEventListener("click", () => {
    $("#ocrPanel")?.classList.add("hidden");
    if (input) input.value = "";
  });
}


document.addEventListener("DOMContentLoaded", () => {
  $("#year").textContent = new Date().getFullYear();

  initMenu();
  initPrescriptionSearch();

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
