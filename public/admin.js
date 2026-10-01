const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let token = localStorage.getItem("dawai_admin_token");
let pharmacies = [];
let medicines = [];
let inventory = [];
let accounts = [];

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c])
  );
}

function api(url, options = {}) {
  options.headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json"
  };

  if (token) {
    options.headers.Authorization = "Bearer " + token;
  }

  return fetch(url, options).then(async r => {
    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      throw new Error(
        data.error || "حدث خطأ أثناء تنفيذ العملية."
      );
    }

    return data;
  });
}

function statusPill(s) {
  if (s === "approved") {
    return '<span class="pill approved">معتمدة</span>';
  }

  if (s === "suspended") {
    return '<span class="pill suspended">موقوفة</span>';
  }

  return '<span class="pill pending">قيد المراجعة</span>';
}

function inventoryPill(s) {
  if (s === "available") {
    return '<span class="pill approved">متوفر</span>';
  }

  if (s === "limited") {
    return '<span class="pill pending">كمية محدودة</span>';
  }

  return '<span class="pill suspended">غير متوفر</span>';
}

function accountPill(active) {
  return active
    ? '<span class="pill approved">نشط</span>'
    : '<span class="pill suspended">معطل</span>';
}

function dateText(value) {
  if (!value) return "-";

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleString("ar-SD", {
        dateStyle: "medium",
        timeStyle: "short"
      });
}

/* =========================================================
   التنقل بين أقسام لوحة الإدارة
   ========================================================= */

function show(id) {
  const target = document.getElementById(id);

  if (!target) {
    console.warn("القسم غير موجود:", id);
    return;
  }

  $$(".view").forEach(view => {
    view.classList.add("hidden");
  });

  target.classList.remove("hidden");

  $$(".nav").forEach(nav => {
    nav.classList.toggle(
      "active",
      nav.dataset.view === id
    );
  });

  if (id === "pharmacies") {
    renderPharmacies();
  }

  if (id === "medicines") {
    renderMedicines();
  }

  if (id === "inventory") {
    renderInventory();
  }

  if (id === "accounts") {
    renderAccounts();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/*
  جعل show متاحًا للأزرار الموجودة داخل HTML
*/
window.show = show;

function setupNavigation() {
  const navItems = $$(".nav");

  navItems.forEach(nav => {
    nav.onclick = function (event) {
      event.preventDefault();
      event.stopPropagation();

      const view = this.dataset.view;

      if (view) {
        show(view);
      }
    };
  });

  /*
    دعم النقر من خلال event delegation أيضًا،
    حتى لو أعيد إنشاء عناصر في الصفحة.
  */
  document.addEventListener("click", function (event) {
    const nav = event.target.closest(".nav");

    if (!nav) return;

    event.preventDefault();

    const view = nav.dataset.view;

    if (view) {
      show(view);
    }
  });
}

/* =========================================================
   النوافذ المنبثقة
   ========================================================= */

function openModal(html) {
  const body = $("#modalBody");
  const modal = $("#modal");

  if (!body || !modal) return;

  body.innerHTML = html;
  modal.classList.add("show");
}

function closeModal() {
  const modal = $("#modal");

  if (modal) {
    modal.classList.remove("show");
  }
}

window.openModal = openModal;
window.closeModal = closeModal;

/* =========================================================
   الإحصائيات
   ========================================================= */

async function loadStats() {
  const d = await api("/api/admin/stats");

  $("#nPh").textContent = d.pharmacies ?? 0;
  $("#nPe").textContent = d.pending ?? 0;
  $("#nAp").textContent = d.approved ?? 0;
  $("#nSu").textContent = d.suspended ?? 0;
  $("#nMe").textContent = d.medicines ?? 0;
  $("#nIn").textContent = d.inventory ?? 0;
  $("#pending").textContent = d.pending ?? 0;
}

/* =========================================================
   الصيدليات
   ========================================================= */

async function loadPharmacies() {
  const status = $("#filter")?.value || "";

  pharmacies = await api(
    "/api/admin/pharmacies?status=" +
      encodeURIComponent(status)
  );

  renderPharmacies();
  renderAccounts();
  renderHomePending();
}

function filteredPharmacies() {
  const q = (
    $("#pharmacySearch")?.value || ""
  )
    .trim()
    .toLowerCase();

  return pharmacies.filter(p => {
    if (!q) return true;

    const email =
      p.pharmacy_accounts?.[0]?.email || "";

    return [
      p.name,
      p.phone,
      p.address,
      email
    ].some(v =>
      String(v || "")
        .toLowerCase()
        .includes(q)
    );
  });
}

function renderPharmacies() {
  const table = $("#pharmacyTable");
  const summary = $("#pharmacySummary");

  if (!table || !summary) return;

  const list = filteredPharmacies();

  summary.textContent =
    `عرض ${list.length} من ${pharmacies.length} صيدلية`;

  table.innerHTML = list.length
    ? `
      <table class="data">
        <thead>
          <tr>
            <th>الصيدلية</th>
            <th>الهاتف</th>
            <th>العنوان</th>
            <th>التوصيل</th>
            <th>الحالة</th>
            <th>الإجراءات</th>
          </tr>
        </thead>

        <tbody>

          ${list.map(p => {
            const email =
              p.pharmacy_accounts?.[0]?.email || "";

            return `
              <tr>

                <td>
                  <b>${esc(p.name)}</b>
                  <br>
                  <small>${esc(email)}</small>
                </td>

                <td>
                  ${esc(p.phone || "-")}
                </td>

                <td>
                  ${esc(p.address || "-")}
                </td>

                <td>
                  ${
                    p.delivery
                      ? '<span class="pill blue">متاح</span>'
                      : '<span class="pill">غير متاح</span>'
                  }
                </td>

                <td>
                  ${statusPill(p.status)}
                </td>

                <td>

                  ${
                    p.status !== "approved"
                      ? `
                        <button
                          class="act ok"
                          onclick="setPharmacyStatus('${p.id}','approved')"
                        >
                          اعتماد
                        </button>
                      `
                      : ""
                  }

                  ${
                    p.status !== "suspended"
                      ? `
                        <button
                          class="act stop"
                          onclick="setPharmacyStatus('${p.id}','suspended')"
                        >
                          إيقاف
                        </button>
                      `
                      : `
                        <button
                          class="act warn"
                          onclick="setPharmacyStatus('${p.id}','pending')"
                        >
                          إعادة للمراجعة
                        </button>
                      `
                  }

                  <button
                    class="act warn"
                    onclick="viewPharmacy('${p.id}')"
                  >
                    تفاصيل
                  </button>

                </td>

              </tr>
            `;
          }).join("")}

        </tbody>
      </table>
    `
    : '<div class="empty">لا توجد صيدليات مطابقة.</div>';
}

window.setPharmacyStatus = async function (id, status) {
  const labels = {
    approved: "اعتماد",
    suspended: "إيقاف",
    pending: "إعادة للمراجعة"
  };

  if (
    !confirm(
      `هل تريد ${labels[status]} هذه الصيدلية؟`
    )
  ) {
    return;
  }

  try {
    await api(
      `/api/admin/pharmacies/${id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status })
      }
    );

    await refreshAll();

  } catch (e) {
    alert(e.message);
  }
};

window.viewPharmacy = function (id) {
  const p = pharmacies.find(
    x => x.id === id
  );

  if (!p) return;

  const a =
    p.pharmacy_accounts?.[0] || {};

  openModal(`
    <h3>تفاصيل الصيدلية</h3>

    <div class="info-box">

      <b>${esc(p.name)}</b>
      <br>

      الهاتف:
      ${esc(p.phone || "-")}
      <br>

      البريد:
      ${esc(a.email || "-")}
      <br>

      العنوان:
      ${esc(p.address || "-")}
      <br>

      ساعات العمل:
      ${esc(p.opening_hours || "-")}
      <br>

      التوصيل:
      ${p.delivery ? "متاح" : "غير متاح"}
      <br>

      الحالة:
      ${
        p.status === "approved"
          ? "معتمدة"
          : p.status === "suspended"
          ? "موقوفة"
          : "قيد المراجعة"
      }

    </div>
  `);
};
