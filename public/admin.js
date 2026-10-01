const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let token = localStorage.getItem("dawai_admin_token");

let pharmacies = [];
let medicines = [];
let inventory = [];
let accounts = [];


/* =========================================================
   HELPERS
========================================================= */

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    c =>
      ({
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
    options.headers.Authorization =
      "Bearer " + token;
  }

  return fetch(url, options).then(
    async r => {
      const data =
        await r.json().catch(
          () => ({})
        );

      if (!r.ok) {
        throw new Error(
          data.error ||
            "حدث خطأ أثناء تنفيذ العملية."
        );
      }

      return data;
    }
  );
}


function statusPill(s) {
  if (s === "approved") {
    return `
      <span class="pill approved">
        معتمدة
      </span>
    `;
  }

  if (s === "suspended") {
    return `
      <span class="pill suspended">
        موقوفة
      </span>
    `;
  }

  return `
    <span class="pill pending">
      قيد المراجعة
    </span>
  `;
}


function inventoryPill(s) {
  if (s === "available") {
    return `
      <span class="pill approved">
        متوفر
      </span>
    `;
  }

  if (s === "limited") {
    return `
      <span class="pill pending">
        كمية محدودة
      </span>
    `;
  }

  return `
    <span class="pill suspended">
      غير متوفر
    </span>
  `;
}


function accountPill(active) {
  return active
    ? `
      <span class="pill approved">
        نشط
      </span>
    `
    : `
      <span class="pill suspended">
        معطل
      </span>
    `;
}


function dateText(value) {
  if (!value) {
    return "-";
  }

  const d =
    new Date(value);

  return Number.isNaN(
    d.getTime()
  )
    ? "-"
    : d.toLocaleString(
        "ar-SD",
        {
          dateStyle: "medium",
          timeStyle: "short"
        }
      );
}


/* =========================================================
   NAVIGATION
========================================================= */

function show(id) {
  $$(".view").forEach(
    x =>
      x.classList.add(
        "hidden"
      )
  );

  $("#" + id)?.classList.remove(
    "hidden"
  );

  $$(".nav").forEach(
    x =>
      x.classList.toggle(
        "active",
        x.dataset.view === id
      )
  );

  if (
    id === "pharmacies"
  ) {
    renderPharmacies();
  }

  if (
    id === "medicines"
  ) {
    renderMedicines();
  }

  if (
    id === "inventory"
  ) {
    renderInventory();
  }

  if (
    id === "accounts"
  ) {
    renderAccounts();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================================================
   MODAL
========================================================= */

function openModal(html) {
  $("#modalBody").innerHTML =
    html;

  $("#modal").classList.add(
    "show"
  );
}


function closeModal() {
  $("#modal").classList.remove(
    "show"
  );
}


/* =========================================================
   ADMIN STATISTICS
========================================================= */

async function loadStats() {
  const d =
    await api(
      "/api/admin/stats"
    );

  $("#nPh").textContent =
    d.pharmacies ?? 0;

  $("#nPe").textContent =
    d.pending ?? 0;

  $("#nAp").textContent =
    d.approved ?? 0;

  $("#nSu").textContent =
    d.suspended ?? 0;

  $("#nMe").textContent =
    d.medicines ?? 0;

  $("#nIn").textContent =
    d.inventory ?? 0;

  $("#pending").textContent =
    d.pending ?? 0;
}


/* =========================================================
   LOAD PHARMACIES
========================================================= */

async function loadPharmacies() {
  const status =
    $("#filter")?.value ||
    "";

  pharmacies =
    await api(
      "/api/admin/pharmacies?status=" +
        encodeURIComponent(
          status
        )
    );

  renderPharmacies();

  renderAccounts();

  renderHomePending();
}


function filteredPharmacies() {
  const q =
    (
      $("#pharmacySearch")
        ?.value || ""
    )
      .trim()
      .toLowerCase();

  return pharmacies.filter(
    p => {
      if (!q) {
        return true;
      }

      const email =
        p.pharmacy_accounts?.[0]
          ?.email || "";

      return [
        p.name,
        p.phone,
        p.address,
        email
      ].some(
        v =>
          String(
            v || ""
          )
            .toLowerCase()
            .includes(q)
      );
    }
  );
}


/* =========================================================
   RENDER PHARMACIES
========================================================= */

function renderPharmacies() {
  const list =
    filteredPharmacies();

  $("#pharmacySummary").textContent =
    `عرض ${list.length} من ${pharmacies.length} صيدلية`;

  $("#pharmacyTable").innerHTML =
    list.length
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

            ${list
              .map(p => {
                const email =
                  p.pharmacy_accounts?.[0]
                    ?.email || "";

                return `
                  <tr>

                    <td>
                      <b>
                        ${esc(p.name)}
                      </b>

                      <br>

                      <small>
                        ${esc(email)}
                      </small>
                    </td>

                    <td>
                      ${esc(
                        p.phone || "-"
                      )}
                    </td>

                    <td>
                      ${esc(
                        p.address || "-"
                      )}
                    </td>

                    <td>
                      ${
                        p.delivery
                          ? `
                            <span class="pill blue">
                              متاح
                            </span>
                          `
                          : `
                            <span class="pill">
                              غير متاح
                            </span>
                          `
                      }
                    </td>

                    <td>
                      ${statusPill(
                        p.status
                      )}
                    </td>

                    <td>

                      ${
                        p.status !==
                        "approved"
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
                        p.status !==
                        "suspended"
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
              })
              .join("")}

          </tbody>

        </table>
      `
      : `
        <div class="empty">
          لا توجد صيدليات مطابقة.
        </div>
      `;
}


/* =========================================================
   PHARMACY STATUS
========================================================= */

window.setPharmacyStatus =
  async (id, status) => {

    const labels = {
      approved:
        "اعتماد",

      suspended:
        "إيقاف",

      pending:
        "إعادة للمراجعة"
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
          method:
            "PATCH",

          body:
            JSON.stringify({
              status
            })
        }
      );

      await refreshAll();

    } catch (e) {
      alert(
        e.message
      );
    }
  };


/* =========================================================
   PHARMACY DETAILS
========================================================= */

window.viewPharmacy =
  id => {

    const p =
      pharmacies.find(
        x => x.id === id
      );

    if (!p) {
      return;
    }

    const a =
      p.pharmacy_accounts?.[0] ||
      {};

    openModal(`
      <h3>
        تفاصيل الصيدلية
      </h3>

      <div class="info-box">

        <b>
          ${esc(p.name)}
        </b>

        <br>

        الهاتف:
        ${esc(
          p.phone || "-"
        )}

        <br>

        البريد الحالي:
        ${esc(
          a.email || "-"
        )}

        <br>

        العنوان:
        ${esc(
          p.address || "-"
        )}

        <br>

        ساعات العمل:
        ${esc(
          p.opening_hours || "-"
        )}

        <br>

        التوصيل:
        ${
          p.delivery
            ? "متاح"
            : "غير متاح"
        }

        <br>

        الحالة:
        ${
          p.status ===
          "approved"
            ? "معتمدة"
            : p.status ===
              "suspended"
            ? "موقوفة"
            : "قيد المراجعة"
        }

      </div>

      <div class="reset-password-box">

        <div class="reset-password-title">
          📧 تغيير البريد الإلكتروني
        </div>

        <p>
          يمكن للإدارة تغيير البريد المستخدم لتسجيل دخول الصيدلية.
        </p>

        <input
          id="pharmacyEmail"
          type="email"
          value="${esc(
            a.email || ""
          )}"
          placeholder="البريد الإلكتروني الجديد"
          autocomplete="email"
        >

        <button
          class="primary wide"
          onclick="updatePharmacyEmail('${p.id}')"
        >
          تحديث البريد الإلكتروني
        </button>

      </div>

      <div class="reset-password-box">

        <div class="reset-password-title">
          🔑 إعادة تعيين كلمة المرور
        </div>

        <p>
          يمكن للإدارة تعيين كلمة مرور جديدة لحساب هذه الصيدلية.
        </p>

        <input
          id="resetPassword"
          type="password"
          minlength="8"
          placeholder="كلمة المرور الجديدة — 8 أحرف على الأقل"
          autocomplete="new-password"
        >

        <button
          class="primary wide"
          onclick="resetPharmacyPassword('${p.id}')"
        >
          تحديث كلمة المرور
        </button>

      </div>
    `);
  };/* =========================================================
   UPDATE PHARMACY EMAIL
========================================================= */

window.updatePharmacyEmail =
  async id => {

    const input =
      $("#pharmacyEmail");

    const email =
      input?.value.trim() || "";

    if (!email) {
      alert(
        "أدخل البريد الإلكتروني."
      );

      return;
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !emailPattern.test(email)
    ) {
      alert(
        "صيغة البريد الإلكتروني غير صحيحة."
      );

      return;
    }

    const p =
      pharmacies.find(
        x => x.id === id
      );

    if (!p) {
      return;
    }

    if (
      !confirm(
        `هل تريد تغيير البريد الإلكتروني لحساب ${p.name}؟`
      )
    ) {
      return;
    }

    try {

      const d =
        await api(
          `/api/admin/pharmacies/${id}/email`,
          {
            method:
              "PATCH",

            body:
              JSON.stringify({
                email
              })
          }
        );

      alert(
        `تم تحديث البريد الإلكتروني بنجاح.\n\nالصيدلية: ${p.name}\nالبريد الجديد: ${d.email}`
      );

      closeModal();

      await loadPharmacies();

    } catch (e) {

      alert(
        e.message
      );
    }
  };


/* =========================================================
   RESET PHARMACY PASSWORD
========================================================= */

window.resetPharmacyPassword =
  async id => {

    const input =
      $("#resetPassword");

    const password =
      input?.value || "";

    if (
      password.length < 8
    ) {
      alert(
        "كلمة المرور يجب أن تكون 8 أحرف على الأقل."
      );

      return;
    }

    const p =
      pharmacies.find(
        x => x.id === id
      );

    if (!p) {
      return;
    }

    if (
      !confirm(
        `هل تريد تعيين كلمة مرور جديدة لحساب ${p.name؟`
      )
    ) {
      return;
    }

    try {

      const d =
        await api(
          `/api/admin/pharmacies/${id}/password`,
          {
            method:
              "PATCH",

            body:
              JSON.stringify({
                password
              })
          }
        );

      alert(
        `تم تحديث كلمة المرور بنجاح للصيدلية: ${p.name}\nالبريد: ${d.email}`
      );

      closeModal();

    } catch (e) {

      alert(
        e.message
      );
    }
  };


/* =========================================================
   MEDICINES
========================================================= */

async function loadMedicines() {

  medicines =
    await api(
      "/api/admin/medicines"
    );

  renderMedicines();
}


function filteredMedicines() {

  const q =
    (
      $("#medicineSearch")
        ?.value || ""
    )
      .trim()
      .toLowerCase();

  const f =
    $("#medicineFilter")
      ?.value ||
    "all";

  return medicines.filter(
    m => {

      const matchQ =
        !q ||
        [
          m.name,
          m.generic_name,
          m.strength,
          m.form
        ].some(
          v =>
            String(
              v || ""
            )
              .toLowerCase()
              .includes(q)
        );

      const matchF =
        f === "all" ||
        (
          f === "active" &&
          m.active
        ) ||
        (
          f === "inactive" &&
          !m.active
        );

      return (
        matchQ &&
        matchF
      );
    }
  );
}


function renderMedicines() {

  const list =
    filteredMedicines();

  $("#medicineSummary").textContent =
    `عرض ${list.length} من ${medicines.length} دواء`;

  $("#medicineTable").innerHTML =
    list.length
      ? `
        <table class="data">

          <thead>
            <tr>
              <th>الدواء</th>
              <th>الاسم العلمي</th>
              <th>التركيز</th>
              <th>الشكل</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>

          <tbody>

            ${list
              .map(
                m => `
                  <tr>

                    <td>
                      <b>
                        ${esc(m.name)}
                      </b>
                    </td>

                    <td>
                      ${esc(
                        m.generic_name ||
                        "-"
                      )}
                    </td>

                    <td>
                      ${esc(
                        m.strength ||
                        "-"
                      )}
                    </td>

                    <td>
                      ${esc(
                        m.form ||
                        "-"
                      )}
                    </td>

                    <td>
                      ${
                        m.active
                          ? `
                            <span class="pill approved">
                              فعال
                            </span>
                          `
                          : `
                            <span class="pill suspended">
                              غير فعال
                            </span>
                          `
                      }
                    </td>

                    <td>

                      <button
                        class="act warn"
                        onclick="editMedicine('${m.id}')"
                      >
                        تعديل
                      </button>

                      <button
                        class="act ${
                          m.active
                            ? "stop"
                            : "ok"
                        }"
                        onclick="toggleMedicine('${m.id}',${!m.active})"
                      >
                        ${
                          m.active
                            ? "تعطيل"
                            : "تفعيل"
                        }
                      </button>

                    </td>

                  </tr>
                `
              )
              .join("")}

          </tbody>

        </table>
      `
      : `
        <div class="empty">
          لا توجد أدوية مطابقة.
        </div>
      `;
}


/* =========================================================
   TOGGLE MEDICINE
========================================================= */

window.toggleMedicine =
  async (
    id,
    active
  ) => {

    try {

      await api(
        `/api/admin/medicines/${id}`,
        {
          method:
            "PATCH",

          body:
            JSON.stringify({
              active
            })
        }
      );

      await refreshAll();

    } catch (e) {

      alert(
        e.message
      );
    }
  };


/* =========================================================
   MEDICINE FORM
========================================================= */

function medicineForm(
  m = {}
) {

  return `
    <div class="modal-form">

      <label>
        اسم الدواء

        <input
          id="mName"
          value="${esc(
            m.name || ""
          )}"
          required
        >
      </label>

      <label>
        الاسم العلمي

        <input
          id="mGeneric"
          value="${esc(
            m.generic_name || ""
          )}"
        >
      </label>

      <label>
        التركيز

        <input
          id="mStrength"
          value="${esc(
            m.strength || ""
          )}"
          placeholder="مثال: 625 mg"
        >
      </label>

      <label>
        الشكل

        <input
          id="mForm"
          value="${esc(
            m.form || ""
          )}"
          placeholder="مثال: أقراص"
        >
      </label>

      <div class="modal-actions">

        <button
          class="ghost"
          onclick="closeModal()"
        >
          إلغاء
        </button>

        <button
          class="primary"
          onclick="saveMedicine()"
        >
          حفظ
        </button>

      </div>

    </div>
  `;
}


/* =========================================================
   EDIT MEDICINE
========================================================= */

window.editMedicine =
  id => {

    const m =
      medicines.find(
        x => x.id === id
      );

    if (!m) {
      return;
    }

    openModal(`
      <h3>
        تعديل الدواء
      </h3>

      ${medicineForm(m)}
    `);

    window._editingMedicine =
      id;
  };


/* =========================================================
   SAVE MEDICINE
========================================================= */

window.saveMedicine =
  async () => {

    try {

      const body = {
        name:
          $("#mName")
            .value
            .trim(),

        generic_name:
          $("#mGeneric")
            .value
            .trim(),

        strength:
          $("#mStrength")
            .value
            .trim(),

        form:
          $("#mForm")
            .value
            .trim()
      };

      if (!body.name) {

        alert(
          "اسم الدواء مطلوب."
        );

        return;
      }

      if (
        window._editingMedicine
      ) {

        await api(
          `/api/admin/medicines/${window._editingMedicine}`,
          {
            method:
              "PATCH",

            body:
              JSON.stringify(
                body
              )
          }
        );

      } else {

        await api(
          "/api/admin/medicines",
          {
            method:
              "POST",

            body:
              JSON.stringify(
                body
              )
          }
        );
      }

      window._editingMedicine =
        null;

      closeModal();

      await refreshAll();

    } catch (e) {

      alert(
        e.message
      );
    }
  };


/* =========================================================
   INVENTORY
========================================================= */

async function loadInventory() {

  inventory =
    await api(
      "/api/admin/inventory"
    );

  renderInventory();

  renderHomeInventory();
}


function filteredInventory() {

  const q =
    (
      $("#inventorySearch")
        ?.value || ""
    )
      .trim()
      .toLowerCase();

  const f =
    $("#inventoryFilter")
      ?.value ||
    "all";

  return inventory.filter(
    x => {

      const text =
        [
          x.pharmacy?.name,
          x.medicine?.name,
          x.medicine?.generic_name
        ]
          .map(
            v =>
              String(
                v || ""
              ).toLowerCase()
          )
          .join(" ");

      return (
        (!q ||
          text.includes(q)) &&
        (
          f === "all" ||
          x.availability === f
        )
      );
    }
  );
}


function renderInventory() {

  const list =
    filteredInventory();

  $("#inventorySummary").textContent =
    `عرض ${list.length} من ${inventory.length} سجل مخزون`;

  $("#inventoryTable").innerHTML =
    list.length
      ? `
        <table class="data">

          <thead>
            <tr>
              <th>الصيدلية</th>
              <th>الدواء</th>
              <th>الكمية</th>
              <th>الحالة</th>
              <th>آخر تحديث</th>
            </tr>
          </thead>

          <tbody>

            ${list
              .map(
                x => `
                  <tr>

                    <td>
                      <b>
                        ${esc(
                          x.pharmacy?.name ||
                          "-"
                        )}
                      </b>

                      <br>

                      <small>
                        ${esc(
                          x.pharmacy?.status ||
                          ""
                        )}
                      </small>
                    </td>

                    <td>
                      <b>
                        ${esc(
                          x.medicine?.name ||
                          "-"
                        )}
                      </b>

                      <br>

                      <small>
                        ${esc(
                          x.medicine?.generic_name ||
                          ""
                        )}

                        ${esc(
                          x.medicine?.strength ||
                          ""
                        )}
                      </small>
                    </td>

                    <td>
                      <b>
                        ${Number(
                          x.quantity || 0
                        )}
                      </b>
                    </td>

                    <td>
                      ${inventoryPill(
                        x.availability
                      )}
                    </td>

                    <td>
                      ${dateText(
                        x.updated_at
                      )}
                    </td>

                  </tr>
                `
              )
              .join("")}

          </tbody>

        </table>
      `
      : `
        <div class="empty">
          لا توجد سجلات مخزون مطابقة.
        </div>
      `;/* =========================================================
   HOME INVENTORY SUMMARY
========================================================= */

function renderHomeInventory() {

  const el =
    $("#homeInventorySummary");

  if (!el) {
    return;
  }

  const available =
    inventory.filter(
      x =>
        x.availability ===
        "available"
    ).length;

  const limited =
    inventory.filter(
      x =>
        x.availability ===
        "limited"
    ).length;

  el.innerHTML = `
    <div class="mini-stat">
      <strong>
        ${inventory.length}
      </strong>
      <span>
        سجلات المخزون
      </span>
    </div>

    <div class="mini-stat">
      <strong>
        ${available}
      </strong>
      <span>
        متوفر
      </span>
    </div>

    <div class="mini-stat">
      <strong>
        ${limited}
      </strong>
      <span>
        محدود
      </span>
    </div>
  `;
}


/* =========================================================
   ACCOUNTS
========================================================= */

function filteredAccounts() {

  const q =
    (
      $("#accountSearch")
        ?.value || ""
    )
      .trim()
      .toLowerCase();

  const f =
    $("#accountFilter")
      ?.value ||
    "all";

  return pharmacies.filter(
    p => {

      const a =
        p.pharmacy_accounts?.[0] ||
        {};

      const text =
        [
          p.name,
          p.phone,
          a.email
        ]
          .map(
            v =>
              String(
                v || ""
              ).toLowerCase()
          )
          .join(" ");

      const matchQ =
        !q ||
        text.includes(q);

      const matchF =
        f === "all" ||
        (
          f === "active" &&
          a.active !== false
        ) ||
        (
          f === "inactive" &&
          a.active === false
        );

      return (
        matchQ &&
        matchF
      );
    }
  );
}


function renderAccounts() {

  const list =
    filteredAccounts();

  $("#accountSummary").textContent =
    `عرض ${list.length} من ${pharmacies.length} حساب`;

  $("#accountTable").innerHTML =
    list.length
      ? `
        <table class="data">

          <thead>
            <tr>
              <th>الصيدلية</th>
              <th>البريد</th>
              <th>حالة الصيدلية</th>
              <th>حساب الدخول</th>
              <th>الإجراء</th>
            </tr>
          </thead>

          <tbody>

            ${list
              .map(
                p => {

                  const a =
                    p.pharmacy_accounts?.[0] ||
                    {};

                  return `
                    <tr>

                      <td>

                        <b>
                          ${esc(
                            p.name
                          )}
                        </b>

                        <br>

                        <small>
                          ${esc(
                            p.phone || ""
                          )}
                        </small>

                      </td>

                      <td>
                        ${esc(
                          a.email || "-"
                        )}
                      </td>

                      <td>
                        ${statusPill(
                          p.status
                        )}
                      </td>

                      <td>
                        ${accountPill(
                          a.active !== false
                        )}
                      </td>

                      <td>

                        <button
                          class="act warn"
                          onclick="viewPharmacy('${p.id}')"
                        >
                          إدارة الحساب
                        </button>

                      </td>

                    </tr>
                  `;
                }
              )
              .join("")}

          </tbody>

        </table>
      `
      : `
        <div class="empty">
          لا توجد حسابات مطابقة.
        </div>
      `;
}


/* =========================================================
   REFRESH ALL
========================================================= */

async function refreshAll() {

  try {

    await Promise.all([
      loadStats(),
      loadPharmacies(),
      loadMedicines(),
      loadInventory()
    ]);

    renderAccounts();

  } catch (e) {

    console.error(e);

    alert(
      e.message ||
      "حدث خطأ أثناء تحديث البيانات."
    );
  }
}


/* =========================================================
   SEARCH / FILTER EVENTS
========================================================= */

document.addEventListener(
  "input",
  e => {

    if (
      e.target.id ===
      "pharmacySearch"
    ) {
      renderPharmacies();
    }

    if (
      e.target.id ===
      "medicineSearch"
    ) {
      renderMedicines();
    }

    if (
      e.target.id ===
      "inventorySearch"
    ) {
      renderInventory();
    }

    if (
      e.target.id ===
      "accountSearch"
    ) {
      renderAccounts();
    }
  }
);


document.addEventListener(
  "change",
  e => {

    if (
      e.target.id ===
      "pharmacyFilter"
    ) {
      renderPharmacies();
    }

    if (
      e.target.id ===
      "medicineFilter"
    ) {
      renderMedicines();
    }

    if (
      e.target.id ===
      "inventoryFilter"
    ) {
      renderInventory();
    }

    if (
      e.target.id ===
      "accountFilter"
    ) {
      renderAccounts();
    }
  }
);


/* =========================================================
   CLOSE MODAL WITH ESC
========================================================= */

document.addEventListener(
  "keydown",
  e => {

    if (
      e.key ===
      "Escape"
    ) {
      closeModal();
    }
  }
);


/* =========================================================
   LOGIN
========================================================= */

async function login() {

  const username =
    $("#loginUsername")
      ?.value
      .trim();

  const password =
    $("#loginPassword")
      ?.value || "";

  if (!username || !password) {

    alert(
      "أدخل اسم المستخدم وكلمة المرور."
    );

    return;
  }

  try {

    const data =
      await api(
        "/api/admin/login",
        {
          method:
            "POST",

          body:
            JSON.stringify({
              username,
              password
            })
        }
      );

    token =
      data.token;

    localStorage.setItem(
      "dawai_admin_token",
      token
    );

    showDashboard();

    await refreshAll();

  } catch (e) {

    alert(
      e.message ||
      "بيانات الدخول غير صحيحة."
    );
  }
}


/* =========================================================
   LOGOUT
========================================================= */

window.logout =
  () => {

    localStorage.removeItem(
      "dawai_admin_token"
    );

    token =
      null;

    location.reload();
  };


/* =========================================================
   LOGIN / DASHBOARD DISPLAY
========================================================= */

function showDashboard() {

  const loginBox =
    $("#loginView");

  const dashboard =
    $("#dashboardView");

  if (loginBox) {
    loginBox.style.display =
      "none";
  }

  if (dashboard) {
    dashboard.style.display =
      "block";
  }
}


function showLogin() {

  const loginBox =
    $("#loginView");

  const dashboard =
    $("#dashboardView");

  if (loginBox) {
    loginBox.style.display =
      "block";
  }

  if (dashboard) {
    dashboard.style.display =
      "none";
  }
}


/* =========================================================
   LOGIN BUTTON
========================================================= */

document.addEventListener(
  "click",
  e => {

    if (
      e.target.closest(
        "#loginBtn"
      )
    ) {
      login();
    }
  }
);


/* =========================================================
   INITIALIZATION
========================================================= */

async function init() {

  if (!token) {

    showLogin();

    return;
  }

  try {

    await api(
      "/api/admin/me"
    );

    showDashboard();

    await refreshAll();

  } catch (e) {

    console.warn(
      "Admin session invalid:",
      e
    );

    localStorage.removeItem(
      "dawai_admin_token"
    );

    token =
      null;

    showLogin();
  }
}


/* =========================================================
   START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);
