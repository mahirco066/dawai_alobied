const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let token = localStorage.getItem("dawai_admin_token");
let pharmacies = [];
let medicines = [];
let inventory = [];

/* حماية النصوص */
function esc(v) {
  return String(v ?? "").replace(
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

/* حالة الصيدلية */
function status(s) {
  if (s === "pending") {
    return '<span class="pill pending">قيد المراجعة</span>';
  }

  if (s === "approved") {
    return '<span class="pill approved">معتمدة</span>';
  }

  return '<span class="pill suspended">موقوفة</span>';
}

/* الاتصال بالـ API */
async function api(url, opt = {}) {

  opt.headers = {
    ...(opt.headers || {}),
    "Content-Type": "application/json"
  };

  if (token) {
    opt.headers.Authorization = "Bearer " + token;
  }

  const r = await fetch(url, opt);

  const d = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw Error(d.error || "حدث خطأ");
  }

  return d;
}

/* تغيير الصفحة */
function show(id) {

  $$(".view").forEach(x => {
    x.classList.add("hidden");
  });

  $("#" + id).classList.remove("hidden");

  $$(".nav").forEach(x => {
    x.classList.toggle(
      "active",
      x.dataset.view === id
    );
  });
}

/* فتح النافذة */
function openModal(html) {

  $("#modalBody").innerHTML = html;

  $("#modal").classList.add("show");
}

/* إغلاق النافذة */
function closeModal() {

  $("#modal").classList.remove("show");
}

/* الإحصائيات */
async function stats() {

  const d = await api("/api/admin/stats");

  $("#nPh").textContent = d.pharmacies;
  $("#nPe").textContent = d.pending;
  $("#nAp").textContent = d.approved;
  $("#nMe").textContent = d.medicines;
  $("#nIn").textContent = d.inventory;

  $("#pending").textContent = d.pending;
}

/* تحميل الصيدليات */
async function loadPharmacies() {

  pharmacies = await api(
    "/api/admin/pharmacies?status=" +
    encodeURIComponent($("#filter").value)
  );

  $("#pharmacyTable").innerHTML =
    pharmacies.length
      ? `
        <table class="data">

          <tr>
            <th>الصيدلية</th>
            <th>الهاتف</th>
            <th>العنوان</th>
            <th>الحالة</th>
            <th>الإجراء</th>
          </tr>

          ${pharmacies.map(p => `

            <tr>

              <td>
                <b>${esc(p.name)}</b>
                <br>
                <small>
                  ${esc(
                    p.pharmacy_accounts?.[0]?.email || ""
                  )}
                </small>
              </td>

              <td>${esc(p.phone || "-")}</td>

              <td>${esc(p.address || "-")}</td>

              <td>${status(p.status)}</td>

              <td>

                ${
                  p.status !== "approved"
                    ? `
                      <button
                        class="act ok"
                        onclick="setStatus('${p.id}','approved')">
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
                        onclick="setStatus('${p.id}','suspended')">
                        إيقاف
                      </button>
                    `
                    : ""
                }

                ${
                  p.status === "suspended"
                    ? `
                      <button
                        class="act warn"
                        onclick="setStatus('${p.id}','pending')">
                        إعادة
                      </button>
                    `
                    : ""
                }

                <button
                  class="act stop"
                  onclick="delPharmacy('${p.id}')">
                  حذف
                </button>

              </td>

            </tr>

          `).join("")}

        </table>
      `
      : "<div>لا توجد صيدليات.</div>";
}

/* تغيير حالة الصيدلية */
window.setStatus = async (id, s) => {

  try {

    await api(
      "/api/admin/pharmacies/" + id + "/status",
      {
        method: "PATCH",
        body: JSON.stringify({
          status: s
        })
      }
    );

    await refresh();

  } catch (e) {

    alert(e.message);
  }
};

/* حذف الصيدلية */
window.delPharmacy = async id => {

  if (!confirm("حذف الصيدلية؟")) {
    return;
  }

  try {

    await api(
      "/api/admin/pharmacies/" + id,
      {
        method: "DELETE"
      }
    );

    await refresh();

  } catch (e) {

    alert(e.message);
  }
};

/* تحميل الأدوية */
async function loadMedicines() {

  medicines = await api(
    "/api/admin/medicines"
  );

  $("#medicineTable").innerHTML = `

    <table class="data">

      <tr>
        <th>الدواء</th>
        <th>الاسم العلمي</th>
        <th>التركيز</th>
        <th>الشكل</th>
        <th>الحالة</th>
        <th>إجراء</th>
      </tr>

      ${
        medicines.length
          ? medicines.map(m => `

            <tr>

              <td>
                <b>${esc(m.name)}</b>
              </td>

              <td>
                ${esc(m.generic_name || "-")}
              </td>

              <td>
                ${esc(m.strength || "-")}
              </td>

              <td>
                ${esc(m.form || "-")}
              </td>

              <td>
                ${
                  m.active
                    ? '<span class="pill approved">فعال</span>'
                    : '<span class="pill suspended">غير فعال</span>'
                }
              </td>

              <td>

                <button
                  class="act warn"
                  onclick="editMed('${m.id}')">
                  تعديل
                </button>

                ${
                  m.active
                    ? `
                      <button
                        class="act stop"
                        onclick="toggleMed('${m.id}',false)">
                        تعطيل
                      </button>
                    `
                    : `
                      <button
                        class="act ok"
                        onclick="toggleMed('${m.id}',true)">
                        تفعيل
                      </button>
                    `
                }

              </td>

            </tr>

          `).join("")
          : `
            <tr>
              <td colspan="6">
                لا توجد أدوية.
              </td>
            </tr>
          `
      }

    </table>
  `;
}

/* تفعيل / تعطيل دواء */
window.toggleMed = async (id, active) => {

  try {

    await api(
      "/api/admin/medicines/" + id,
      {
        method: "PATCH",
        body: JSON.stringify({
          active
        })
      }
    );

    await refresh();

  } catch (e) {

    alert(e.message);
  }
};

/* تعديل دواء */
window.editMed = id => {

  const m = medicines.find(
    x => x.id === id
  );

  if (!m) return;

  openModal(`

    <h3>تعديل الدواء</h3>

    <label>
      اسم الدواء
      <input
        id="m1"
        value="${esc(m.name)}">
    </label>

    <label>
      الاسم العلمي
      <input
        id="m2"
        value="${esc(m.generic_name || "")}">
    </label>

    <label>
      التركيز
      <input
        id="m3"
        value="${esc(m.strength || "")}">
    </label>

    <label>
      الشكل
      <input
        id="m4"
        value="${esc(m.form || "")}">
    </label>

    <button
      class="save"
      onclick="saveMed('${id}')">
      حفظ التعديل
    </button>

  `);
};

/* حفظ تعديل الدواء */
window.saveMed = async id => {

  try {

    await api(
      "/api/admin/medicines/" + id,
      {
        method: "PATCH",
        body: JSON.stringify({

          name: $("#m1").value.trim(),

          generic_name:
            $("#m2").value.trim(),

          strength:
            $("#m3").value.trim(),

          form:
            $("#m4").value.trim()

        })
      }
    );

    closeModal();

    await refresh();

  } catch (e) {

    alert(e.message);
  }
};

/* إضافة دواء واحد */
$("#addMedicine").onclick = () => {

  openModal(`

    <h3>إضافة دواء</h3>

    <label>
      اسم الدواء
      <input id="m1">
    </label>

    <label>
      الاسم العلمي
      <input id="m2">
    </label>

    <label>
      التركيز
      <input id="m3">
    </label>

    <label>
      الشكل
      <input id="m4">
    </label>

    <button
      class="save"
      onclick="createMed()">
      إضافة الدواء
    </button>

  `);
};

/* إنشاء دواء واحد */
window.createMed = async () => {

  const name = $("#m1").value.trim();

  if (!name) {
    alert("يرجى إدخال اسم الدواء");
    return;
  }

  try {

    await api(
      "/api/admin/medicines",
      {
        method: "POST",
        body: JSON.stringify({

          name,

          generic_name:
            $("#m2").value.trim(),

          strength:
            $("#m3").value.trim(),

          form:
            $("#m4").value.trim()

        })
      }
    );

    closeModal();

    await refresh();

  } catch (e) {

    alert(e.message);
  }
};

/* ============================
   إضافة مجموعة أدوية
============================ */

let bulkRowCounter = 0;

/* إنشاء صف دواء */
function createBulkRow() {

  bulkRowCounter++;

  return `

    <div
      class="bulk-row"
      data-row="${bulkRowCounter}">

      <div class="bulk-number">
        ${bulkRowCounter}
      </div>

      <input
        class="bulk-name"
        placeholder="اسم الدواء">

      <input
        class="bulk-generic"
        placeholder="الاسم العلمي">

      <input
        class="bulk-strength"
        placeholder="التركيز">

      <input
        class="bulk-form"
        placeholder="الشكل">

      <button
        type="button"
        class="bulk-remove"
        onclick="removeBulkRow(this)"
        title="حذف الصف">
        ×
      </button>

    </div>

  `;
}

/* فتح نافذة الإضافة الجماعية */
$("#addMedicineBulk").onclick = () => {

  bulkRowCounter = 0;

  openModal(`

    <div class="bulk-header">

      <div>
        <h3>إضافة مجموعة أدوية</h3>

        <p>
          أضف عدة أدوية مرة واحدة ثم اضغط
          «إضافة جميع الأدوية».
        </p>
      </div>

    </div>

    <div class="bulk-table-head">

      <span>#</span>
      <span>اسم الدواء</span>
      <span>الاسم العلمي</span>
      <span>التركيز</span>
      <span>الشكل</span>
      <span></span>

    </div>

    <div id="bulkRows"></div>

    <div class="bulk-footer">

      <button
        type="button"
        class="add-row-btn"
        onclick="addBulkRow()">
        ＋ إضافة صف
      </button>

      <button
        type="button"
        class="save"
        id="bulkSaveBtn"
        onclick="saveBulkMedicines()">
        إضافة جميع الأدوية
      </button>

    </div>

    <div
      id="bulkProgress"
      class="bulk-progress">
    </div>

  `);

  addBulkRow();
  addBulkRow();
  addBulkRow();
};

/* إضافة صف */
window.addBulkRow = () => {

  $("#bulkRows").insertAdjacentHTML(
    "beforeend",
    createBulkRow()
  );

  renumberBulkRows();
};

/* حذف صف */
window.removeBulkRow = button => {

  const rows =
    document.querySelectorAll(".bulk-row");

  if (rows.length <= 1) {

    alert("يجب أن يبقى صف واحد على الأقل.");

    return;
  }

  button.closest(".bulk-row").remove();

  renumberBulkRows();
};

/* إعادة ترقيم الصفوف */
function renumberBulkRows() {

  document
    .querySelectorAll(".bulk-row")
    .forEach((row, index) => {

      const number =
        row.querySelector(".bulk-number");

      if (number) {
        number.textContent = index + 1;
      }

    });
}

/* حفظ مجموعة الأدوية */
window.saveBulkMedicines = async () => {

  const rows =
    [...document.querySelectorAll(".bulk-row")];

  const data = rows
    .map(row => ({

      name:
        row.querySelector(".bulk-name")
          .value.trim(),

      generic_name:
        row.querySelector(".bulk-generic")
          .value.trim(),

      strength:
        row.querySelector(".bulk-strength")
          .value.trim(),

      form:
        row.querySelector(".bulk-form")
          .value.trim()

    }))
    .filter(x => x.name);

  if (!data.length) {

    alert("يرجى إدخال اسم دواء واحد على الأقل.");

    return;
  }

  const saveButton =
    $("#bulkSaveBtn");

  const progress =
    $("#bulkProgress");

  saveButton.disabled = true;

  let success = 0;
  let failed = 0;

  progress.textContent =
    `جاري إضافة ${data.length} دواء...`;

  for (const medicine of data) {

    try {

      await api(
        "/api/admin/medicines",
        {
          method: "POST",
          body: JSON.stringify(medicine)
        }
      );

      success++;

      progress.textContent =
        `تمت إضافة ${success} من ${data.length}...`;

    } catch (e) {

      failed++;
    }
  }

  await loadMedicines();
  await stats();

  if (failed === 0) {

    progress.textContent =
      `تمت إضافة جميع الأدوية بنجاح: ${success} دواء.`;

    setTimeout(() => {

      closeModal();

    }, 1000);

  } else {

    progress.textContent =
      `تمت إضافة ${success} دواء، وتعذر إضافة ${failed} دواء.`;

    saveButton.disabled = false;
  }
};

/* تحميل المخزون */
async function loadInventory() {

  inventory =
    await api("/api/admin/inventory");

  $("#inventoryTable").innerHTML =
    inventory.length
      ? `

        <table class="data">

          <tr>
            <th>الصيدلية</th>
            <th>الدواء</th>
            <th>الكمية</th>
            <th>الحالة</th>
            <th>آخر تحديث</th>
          </tr>

          ${inventory.map(x => `

            <tr>

              <td>
                ${esc(x.pharmacy?.name)}
              </td>

              <td>
                ${esc(x.medicine?.name)}
              </td>

              <td>
                ${x.quantity}
              </td>

              <td>

                ${
                  x.availability === "available"
                    ? '<span class="pill approved">متوفر</span>'
                    : x.availability === "limited"
                      ? '<span class="pill pending">محدود</span>'
                      : '<span class="pill suspended">غير متوفر</span>'
                }

              </td>

              <td>
                ${
                  x.updated_at
                    ? new Date(
                        x.updated_at
                      ).toLocaleString("ar-SD")
                    : "-"
                }
              </td>

            </tr>

          `).join("")}

        </table>

      `
      : "<div>لا توجد بيانات مخزون.</div>";
}

/* قوائم الصفحة الرئيسية */
function homeLists() {

  const p =
    pharmacies
      .filter(x => x.status === "pending")
      .slice(0, 6);

  $("#homePending").innerHTML =
    p.length
      ? p.map(x => `

          <div class="mini">

            <span>
              🏪 ${esc(x.name)}
            </span>

            <button
              class="act ok"
              onclick="setStatus('${x.id}','approved')">
              اعتماد
            </button>

          </div>

        `).join("")
      : "لا توجد طلبات معلقة";

  $("#homeInventory").innerHTML =
    inventory
      .slice(0, 6)
      .map(x => `

        <div class="mini">

          <span>
            ${esc(x.pharmacy?.name)}
            —
            ${esc(x.medicine?.name)}
          </span>

          <small>
            ${esc(x.availability)}
          </small>

        </div>

      `)
      .join("")
      || "لا توجد تحديثات";
}

/* تحديث شامل */
async function refresh() {

  try {

    await Promise.all([
      stats(),
      loadPharmacies(),
      loadMedicines(),
      loadInventory()
    ]);

    homeLists();

  } catch (e) {

    if (e.message.includes("جلسة")) {

      localStorage.removeItem(
        "dawai_admin_token"
      );

      location.reload();

    } else {

      alert(e.message);
    }
  }
}

/* التنقل */
$$(".nav").forEach(x => {

  x.onclick = () => {
    show(x.dataset.view);
  };

});

/* الفلتر */
$("#filter").onchange =
  loadPharmacies;

/* تحديث */
$("#refresh").onclick =
  refresh;

$("#refreshInv").onclick =
  loadInventory;

/* إغلاق النافذة */
$("#close").onclick =
  closeModal;

$("#modal").onclick = e => {

  if (e.target.id === "modal") {
    closeModal();
  }

};

/* تسجيل الخروج */
$("#logout").onclick = () => {

  localStorage.removeItem(
    "dawai_admin_token"
  );

  location.reload();
};

/* تسجيل الدخول */
$("#loginForm").onsubmit =
  async e => {

    e.preventDefault();

    $("#loginMsg").textContent =
      "جاري التحقق...";

    try {

      const d =
        await api(
          "/api/admin/login",
          {
            method: "POST",

            body: JSON.stringify({
              username:
                $("#username").value,

              password:
                $("#password").value
            })
          }
        );

      token = d.token;

      localStorage.setItem(
        "dawai_admin_token",
        token
      );

      $("#login").classList.add(
        "hidden"
      );

      $("#app").classList.remove(
        "hidden"
      );

      $("#adminName").textContent =
        d.username;

      await refresh();

    } catch (err) {

      $("#loginMsg").textContent =
        err.message;
    }
  };

/* استعادة الجلسة */
(async () => {

  if (!token) {
    return;
  }

  try {

    const d =
      await api("/api/admin/me");

    $("#adminName").textContent =
      d.username;

    $("#login").classList.add(
      "hidden"
    );

    $("#app").classList.remove(
      "hidden"
    );

    await refresh();

  } catch {

    localStorage.removeItem(
      "dawai_admin_token"
    );

  }

})();
