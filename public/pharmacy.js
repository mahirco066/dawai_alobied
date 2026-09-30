const $ = (selector) =>
  document.querySelector(selector);

let token =
  localStorage.getItem("dawai_pharmacy_token");

let inventoryRows = [];


/* =========================================
   الرسائل
========================================= */

function msg(selector, text) {
  const element = $(selector);

  if (element) {
    element.textContent = text || "";
  }
}


/* =========================================
   تبديل الواجهات
========================================= */

function show(id) {
  [
    "loginView",
    "registerView",
    "dashboardView"
  ].forEach((viewId) => {
    const element = $("#" + viewId);

    if (element) {
      element.classList.add("hidden");
    }
  });

  const target = $("#" + id);

  if (target) {
    target.classList.remove("hidden");
  }
}


/* =========================================
   الاتصال بالخادم
========================================= */

async function api(url, options = {}) {

  options.headers = {
    ...(options.headers || {}),
    "Content-Type": "application/json"
  };

  if (token) {
    options.headers.Authorization =
      "Bearer " + token;
  }

  const response =
    await fetch(url, options);

  const data =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ||
      "حدث خطأ أثناء تنفيذ العملية."
    );
  }

  return data;
}


/* =========================================
   حماية النصوص
========================================= */

function esc(value) {

  return String(value ?? "")
    .replace(
      /[&<>"']/g,
      (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char])
    );
}


/* =========================================
   تنسيق التاريخ
========================================= */

function formatDate(value) {

  if (!value) {
    return "لم يتم التحديث بعد";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "لم يتم التحديث بعد";
  }

  return date.toLocaleString(
    "ar-SD",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}


/* =========================================
   اسم حالة التوفر
========================================= */

function availabilityLabel(value) {

  switch (value) {

    case "available":
      return "متوفر";

    case "limited":
      return "كمية محدودة";

    default:
      return "غير متوفر";
  }
}


/* =========================================
   CSS class للحالة
========================================= */

function availabilityClass(value) {

  switch (value) {

    case "available":
      return "status-available";

    case "limited":
      return "status-limited";

    default:
      return "status-unavailable";
  }
}


/* =========================================
   تحميل لوحة الصيدلية
========================================= */

async function loadDashboard() {

  try {

    const pharmacy =
      await api("/api/pharmacy/me");

    if ($("#pharmacyName")) {
      $("#pharmacyName").textContent =
        pharmacy.name || "الصيدلية";
    }


    inventoryRows =
      await api("/api/pharmacy/inventory");


    updateStats(
      inventoryRows
    );


    renderInventory(
      inventoryRows
    );


    updateSummary();


  } catch (error) {

    console.error(error);

    /*
      إذا كانت الجلسة غير صالحة
      نعيد المستخدم لصفحة الدخول.
    */

    if (
      error.message.includes("token") ||
      error.message.includes("جلسة") ||
      error.message.includes("غير مصرح") ||
      error.message.includes("الدخول")
    ) {

      localStorage.removeItem(
        "dawai_pharmacy_token"
      );

      token = null;

      show("loginView");

      msg(
        "#loginMsg",
        error.message
      );

      return;
    }


    const list =
      $("#inventoryList");

    if (list) {

      list.innerHTML = `
        <div class="inventory-error">

          <strong>
            تعذر تحميل المخزون
          </strong>

          <p>
            ${esc(error.message)}
          </p>

          <button
            type="button"
            class="primary"
            onclick="loadDashboard()"
          >
            إعادة المحاولة
          </button>

        </div>
      `;
    }
  }
}


/* =========================================
   الإحصائيات
========================================= */

function updateStats(rows) {

  const total =
    rows.length;

  const available =
    rows.filter(
      item =>
        item.availability ===
        "available"
    ).length;

  const limited =
    rows.filter(
      item =>
        item.availability ===
        "limited"
    ).length;

  const unavailable =
    rows.filter(
      item =>
        item.availability ===
        "unavailable"
    ).length;


  if ($("#totalCount")) {
    $("#totalCount").textContent =
      total;
  }

  if ($("#availableCount")) {
    $("#availableCount").textContent =
      available;
  }

  if ($("#limitedCount")) {
    $("#limitedCount").textContent =
      limited;
  }

  if ($("#unavailableCount")) {
    $("#unavailableCount").textContent =
      unavailable;
  }
}


/* =========================================
   عرض المخزون
========================================= */

function renderInventory(rows) {

  const container =
    $("#inventoryList");

  const empty =
    $("#inventoryEmpty");

  const noResults =
    $("#inventoryNoResults");


  if (!container) {
    return;
  }


  if (empty) {
    empty.classList.add("hidden");
  }

  if (noResults) {
    noResults.classList.add("hidden");
  }


  if (!rows.length) {

    container.innerHTML = "";

    if (empty) {
      empty.classList.remove("hidden");
    }

    updateSummary();

    return;
  }


  container.innerHTML =
    rows
      .map(item => {

        const medicine =
          item.medicines || {};


        const medicineId =
          item.medicine_id ||
          medicine.id;


        const availability =
          item.availability ||
          "unavailable";


        const quantity =
          Number(
            item.quantity || 0
          );


        return `

          <div
            class="inventory-card"
            data-medicine-name="${esc(
              medicine.name || ""
            )}"
            data-generic-name="${esc(
              medicine.generic_name || ""
            )}"
            data-strength="${esc(
              medicine.strength || ""
            )}"
            data-form="${esc(
              medicine.form || ""
            )}"
            data-availability="${esc(
              availability
            )}"
          >

            <div class="inventory-info">

              <div class="medicine-title">
                ${esc(
                  medicine.name ||
                  "دواء"
                )}
              </div>


              <div class="medicine-details">

                ${
                  medicine.generic_name
                    ? `
                      <span>
                        ${esc(
                          medicine.generic_name
                        )}
                      </span>
                    `
                    : ""
                }

                ${
                  medicine.strength
                    ? `
                      <span>
                        ${esc(
                          medicine.strength
                        )}
                      </span>
                    `
                    : ""
                }

                ${
                  medicine.form
                    ? `
                      <span>
                        ${esc(
                          medicine.form
                        )}
                      </span>
                    `
                    : ""
                }

              </div>


              <div
                class="current-status ${availabilityClass(
                  availability
                )}"
              >
                ${availabilityLabel(
                  availability
                )}
              </div>


              <div class="updated-time">

                آخر تحديث:
                ${formatDate(
                  item.updated_at
                )}

              </div>

            </div>


            <div class="inventory-controls">

              <label>

                <span>
                  الكمية
                </span>

                <input
                  class="inventory-qty"
                  type="number"
                  min="0"
                  step="1"
                  value="${quantity}"
                  id="q_${esc(
                    medicineId
                  )}"
                >

              </label>


              <label>

                <span>
                  حالة التوفر
                </span>

                <select
                  class="inventory-status"
                  id="s_${esc(
                    medicineId
                  )}"
                >

                  <option
                    value="available"
                    ${
                      availability ===
                      "available"
                        ? "selected"
                        : ""
                    }
                  >
                    🟢 متوفر
                  </option>

                  <option
                    value="limited"
                    ${
                      availability ===
                      "limited"
                        ? "selected"
                        : ""
                    }
                  >
                    🟡 كمية محدودة
                  </option>

                  <option
                    value="unavailable"
                    ${
                      availability ===
                      "unavailable"
                        ? "selected"
                        : ""
                    }
                  >
                    🔴 غير متوفر
                  </option>

                </select>

              </label>


              <button
                type="button"
                class="save inventory-save"
                onclick="saveItem(
                  '${esc(medicineId)}',
                  this
                )"
              >
                حفظ
              </button>

            </div>

          </div>

        `;
      })
      .join("");


  updateSummary();
}


/* =========================================
   تحديث ملخص النتائج
========================================= */

function updateSummary() {

  const summary =
    $("#inventorySummary");

  if (!summary) {
    return;
  }


  const searchInput =
    $("#inventorySearch");

  const filterSelect =
    $("#inventoryFilter");


  const search =
    searchInput
      ? String(
          searchInput.value || ""
        )
          .trim()
          .toLowerCase()
      : "";


  const filter =
    filterSelect
      ? filterSelect.value
      : "all";


  let visible =
    inventoryRows.filter(
      item => {

        const medicine =
          item.medicines || {};


        const name =
          String(
            medicine.name || ""
          ).toLowerCase();


        const generic =
          String(
            medicine.generic_name || ""
          ).toLowerCase();


        const strength =
          String(
            medicine.strength || ""
          ).toLowerCase();


        const form =
          String(
            medicine.form || ""
          ).toLowerCase();


        const matchesSearch =
          !search ||
          name.includes(search) ||
          generic.includes(search) ||
          strength.includes(search) ||
          form.includes(search);


        const matchesFilter =
          filter === "all" ||
          item.availability ===
            filter;


        return (
          matchesSearch &&
          matchesFilter
        );
      }
    ).length;


  summary.textContent =
    `عرض ${visible} من ${inventoryRows.length} دواء`;
}


/* =========================================
   البحث والفلترة
========================================= */

function filterInventory() {

  const searchInput =
    $("#inventorySearch");

  const filterSelect =
    $("#inventoryFilter");


  const search =
    searchInput
      ? String(
          searchInput.value || ""
        )
          .trim()
          .toLowerCase()
      : "";


  const filter =
    filterSelect
      ? filterSelect.value
      : "all";


  const cards =
    document.querySelectorAll(
      ".inventory-card"
    );


  let visible =
    0;


  cards.forEach(card => {

    const name =
      (
        card.dataset
          .medicineName ||
        ""
      ).toLowerCase();


    const generic =
      (
        card.dataset
          .genericName ||
        ""
      ).toLowerCase();


    const strength =
      (
        card.dataset
          .strength ||
        ""
      ).toLowerCase();


    const form =
      (
        card.dataset
          .form ||
        ""
      ).toLowerCase();


    const availability =
      card.dataset
        .availability ||
      "";


    const matchesSearch =
      !search ||
      name.includes(search) ||
      generic.includes(search) ||
      strength.includes(search) ||
      form.includes(search);


    const matchesFilter =
      filter === "all" ||
      availability ===
        filter;


    const showCard =
      matchesSearch &&
      matchesFilter;


    card.style.display =
      showCard
        ? ""
        : "none";


    if (showCard) {
      visible++;
    }

  });


  const noResults =
    $("#inventoryNoResults");


  const empty =
    $("#inventoryEmpty");


  if (empty) {
    empty.classList.add("hidden");
  }


  if (noResults) {

    noResults.classList.toggle(
      "hidden",
      visible !== 0
    );
  }


  updateSummary();
}


/* =========================================
   حفظ دواء
========================================= */

window.saveItem =
  async function(
    medicineId,
    button
  ) {

    const quantityInput =
      document.getElementById(
        "q_" + medicineId
      );


    const statusInput =
      document.getElementById(
        "s_" + medicineId
      );


    if (
      !quantityInput ||
      !statusInput
    ) {
      return;
    }


    let quantity =
      Number(
        quantityInput.value
      );


    if (
      !Number.isFinite(quantity) ||
      quantity < 0
    ) {
      quantity = 0;
    }


    quantity =
      Math.floor(quantity);


    const availability =
      statusInput.value;


    const originalText =
      button
        ? button.textContent
        : "حفظ";


    try {

      if (button) {

        button.disabled =
          true;

        button.textContent =
          "جاري الحفظ...";
      }


      await api(
        "/api/pharmacy/inventory/" +
          encodeURIComponent(
            medicineId
          ),
        {
          method: "PUT",

          body:
            JSON.stringify({
              quantity,
              availability
            })
        }
      );


      /*
        تحديث البيانات محليًا
        قبل إعادة تحميل القائمة.
      */

      const item =
        inventoryRows.find(
          row =>
            String(
              row.medicine_id
            ) ===
            String(medicineId)
        );


      if (item) {

        item.quantity =
          quantity;

        item.availability =
          availability;

        item.updated_at =
          new Date().toISOString();
      }


      if (button) {

        button.textContent =
          "✓ تم الحفظ";

        button.classList.add(
          "saved"
        );
      }


      /*
        نعيد تحميل البيانات من الخادم
        للتأكد من أن كل شيء محفوظ.
      */

      await loadDashboard();


      setTimeout(() => {

        if (button) {

          button.classList.remove(
            "saved"
          );

          button.textContent =
            originalText;

          button.disabled =
            false;
        }

      }, 1600);


    } catch (error) {

      console.error(error);


      if (button) {

        button.disabled =
          false;

        button.textContent =
          originalText;
      }


      alert(
        error.message
      );
    }
  };


/* =========================================
   تسجيل الدخول
========================================= */

const loginForm =
  $("#loginForm");


if (loginForm) {

  loginForm.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      msg(
        "#loginMsg",
        "جاري تسجيل الدخول..."
      );


      try {

        const data =
          await api(
            "/api/pharmacy/login",
            {
              method: "POST",

              body:
                JSON.stringify({

                  email:
                    $("#email")
                      .value
                      .trim(),

                  password:
                    $("#password")
                      .value

                })
            }
          );


        token =
          data.token;


        localStorage.setItem(
          "dawai_pharmacy_token",
          token
        );


        show(
          "dashboardView"
        );


        await loadDashboard();


      } catch (error) {

        msg(
          "#loginMsg",
          error.message
        );
      }
    }
  );
}


/* =========================================
   تسجيل صيدلية جديدة
========================================= */

const registerForm =
  $("#registerForm");


if (registerForm) {

  registerForm.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      msg(
        "#registerMsg",
        "جاري إرسال الطلب..."
      );


      try {

        const data =
          await api(
            "/api/pharmacy/register",
            {
              method: "POST",

              body:
                JSON.stringify({

                  name:
                    $("#rName")
                      .value
                      .trim(),

                  phone:
                    $("#rPhone")
                      .value
                      .trim(),

                  email:
                    $("#rEmail")
                      .value
                      .trim(),

                  password:
                    $("#rPassword")
                      .value,

                  address:
                    $("#rAddress")
                      .value
                      .trim(),

                  delivery:
                    $("#rDelivery")
                      .checked

                })
            }
          );


        msg(
          "#registerMsg",
          data.message ||
          "تم إرسال طلب التسجيل بنجاح."
        );


        event.target.reset();


      } catch (error) {

        msg(
          "#registerMsg",
          error.message
        );
      }
    }
  );
}


/* =========================================
   الانتقال إلى التسجيل
========================================= */

const showRegister =
  $("#showRegister");


if (showRegister) {

  showRegister.onclick =
    () => {

      show(
        "registerView"
      );

      msg(
        "#registerMsg",
        ""
      );
    };
}


/* =========================================
   العودة للدخول
========================================= */

const showLogin =
  $("#showLogin");


if (showLogin) {

  showLogin.onclick =
    () => {

      show(
        "loginView"
      );

      msg(
        "#loginMsg",
        ""
      );
    };
}


/* =========================================
   زر التحديث
========================================= */

const refreshBtn =
  $("#refreshBtn");


if (refreshBtn) {

  refreshBtn.onclick =
    async () => {

      const original =
        refreshBtn.textContent;


      try {

        refreshBtn.disabled =
          true;

        refreshBtn.textContent =
          "⏳ جاري التحديث...";


        await loadDashboard();


      } finally {

        refreshBtn.disabled =
          false;

        refreshBtn.textContent =
          original;
      }
    };
}


/* =========================================
   تسجيل الخروج
========================================= */

const logoutBtn =
  $("#logoutBtn");


if (logoutBtn) {

  logoutBtn.onclick =
    () => {

      localStorage.removeItem(
        "dawai_pharmacy_token"
      );

      token = null;

      inventoryRows = [];

      show(
        "loginView"
      );

      msg(
        "#loginMsg",
        ""
      );
    };
}


/* =========================================
   البحث
========================================= */

const inventorySearch =
  $("#inventorySearch");


if (inventorySearch) {

  inventorySearch.addEventListener(
    "input",
    filterInventory
  );
}


/* =========================================
   الفلترة
========================================= */

const inventoryFilter =
  $("#inventoryFilter");


if (inventoryFilter) {

  inventoryFilter.addEventListener(
    "change",
    filterInventory
  );
}


/* =========================================
   بدء التطبيق
========================================= */

if (token) {

  show(
    "dashboardView"
  );

  loadDashboard();

} else {

  show(
    "loginView"
  );
}
