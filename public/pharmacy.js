const $ = (selector) =>
  document.querySelector(selector);

let token =
  localStorage.getItem(
    "dawai_pharmacy_token"
  );

let inventoryRows = [];


/* =========================================================
   الرسائل
========================================================= */

function msg(
  selector,
  text
) {
  const el = $(selector);

  if (el) {
    el.textContent =
      text || "";
  }
}


/* =========================================================
   تبديل الواجهات
========================================================= */

function show(id) {
  [
    "loginView",
    "registerView",
    "dashboardView"
  ].forEach((x) => {
    const el = $("#" + x);

    if (el) {
      el.classList.add(
        "hidden"
      );
    }
  });

  const target =
    $("#" + id);

  if (target) {
    target.classList.remove(
      "hidden"
    );
  }
}


/* =========================================================
   الاتصال بالـ API
========================================================= */

async function api(
  url,
  options = {}
) {
  options.headers = {
    ...(options.headers || {}),
    "Content-Type":
      "application/json"
  };

  if (token) {
    options.headers.Authorization =
      "Bearer " + token;
  }

  const response =
    await fetch(
      url,
      options
    );

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


/* =========================================================
   حماية النصوص
========================================================= */

function esc(value) {
  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    (char) => ({
      "&":
        "&amp;",
      "<":
        "&lt;",
      ">":
        "&gt;",
      '"':
        "&quot;",
      "'":
        "&#39;"
    }[char])
  );
}


/* =========================================================
   تنسيق التاريخ
========================================================= */

function formatDate(
  value
) {
  if (!value) {
    return "لم يتم التحديث بعد";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
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


/* =========================================================
   اسم حالة التوفر
========================================================= */

function availabilityLabel(
  value
) {
  switch (value) {
    case "available":
      return "متوفر";

    case "limited":
      return "كمية محدودة";

    default:
      return "غير متوفر";
  }
}


/* =========================================================
   تحميل بيانات لوحة الصيدلية
========================================================= */

async function loadDashboard() {
  try {

    const pharmacy =
      await api(
        "/api/pharmacy/me"
      );

    $("#pharmacyName")
      .textContent =
      pharmacy.name ||
      "الصيدلية";


    inventoryRows =
      await api(
        "/api/pharmacy/inventory"
      );


    updateStats(
      inventoryRows
    );

    renderInventory(
      inventoryRows
    );

  } catch (error) {

    /*
      إذا انتهت الجلسة
      نعيد المستخدم للدخول.
    */

    if (
      error.message.includes(
        "جلسة"
      ) ||
      error.message.includes(
        "تسجيل الدخول"
      )
    ) {

      localStorage.removeItem(
        "dawai_pharmacy_token"
      );

      token = null;

      show(
        "loginView"
      );

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
          <strong>تعذر تحميل المخزون</strong>
          <p>${esc(error.message)}</p>
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


/* =========================================================
   الإحصائيات
========================================================= */

function updateStats(
  rows
) {
  const total =
    rows.length;

  const available =
    rows.filter(
      (x) =>
        x.availability ===
        "available"
    ).length;

  const limited =
    rows.filter(
      (x) =>
        x.availability ===
        "limited"
    ).length;


  if ($("#totalCount")) {
    $("#totalCount")
      .textContent =
      total;
  }

  if (
    $("#availableCount")
  ) {
    $("#availableCount")
      .textContent =
      available;
  }

  if (
    $("#limitedCount")
  ) {
    $("#limitedCount")
      .textContent =
      limited;
  }
}


/* =========================================================
   عرض المخزون
========================================================= */

function renderInventory(
  rows
) {
  const container =
    $("#inventoryList");

  if (!container) {
    return;
  }

  if (!rows.length) {

    container.innerHTML = `
      <div class="empty-inventory">
        <div class="empty-icon">💊</div>

        <h3>
          لا توجد أدوية مسجلة
        </h3>

        <p>
          لم تتم إضافة أدوية إلى النظام بعد.
        </p>
      </div>
    `;

    return;
  }


  container.innerHTML =
    rows
      .map(
        (item) => {

          const medicine =
            item.medicines ||
            {};

          const availability =
            item.availability ||
            "unavailable";


          const statusClass =
            availability ===
            "available"
              ? "status-available"
              : availability ===
                "limited"
              ? "status-limited"
              : "status-unavailable";


          return `
            <div
              class="inventory-card"
              data-medicine-name="${esc(
                medicine.name
              )}"
              data-generic-name="${esc(
                medicine.generic_name || ""
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
                  class="current-status ${statusClass}"
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
                    value="${Number(
                      item.quantity || 0
                    )}"
                    id="q_${esc(
                      medicine.id
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
                      medicine.id
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
                      متوفر
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
                      كمية محدودة
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
                      غير متوفر
                    </option>

                  </select>
                </label>


                <button
                  type="button"
                  class="save inventory-save"
                  onclick="saveItem('${esc(
                    medicine.id
                  )}', this)"
                >
                  حفظ
                </button>

              </div>

            </div>
          `;
        }
      )
      .join("");
}


/* =========================================================
   حفظ دواء
========================================================= */

window.saveItem =
  async function (
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


    const quantity =
      Math.max(
        0,
        Number(
          quantityInput.value || 0
        )
      );

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


      if (button) {
        button.textContent =
          "✓ تم الحفظ";

        button.classList.add(
          "saved"
        );
      }


      /*
        نعيد تحميل البيانات
        حتى يظهر وقت آخر تحديث
        والحالة الجديدة.
      */

      await loadDashboard();


      setTimeout(
        () => {

          if (button) {
            button.classList.remove(
              "saved"
            );

            button.textContent =
              originalText;
          }

        },
        1800
      );

    } catch (error) {

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


/* =========================================================
   البحث في المخزون
========================================================= */

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


  cards.forEach(
    (card) => {

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

      const availability =
        card.dataset
          .availability ||
        "";


      const matchesSearch =
        !search ||
        name.includes(search) ||
        generic.includes(search);


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
          : "grid";


      if (
        !showCard
      ) {
        card.style.display =
          "none";
      }


      if (showCard) {
        visible++;
      }
    }
  );


  const noResults =
    $("#inventoryNoResults");


  if (noResults) {

    noResults.classList.toggle(
      "hidden",
      visible !== 0
    );
  }
}


/* =========================================================
   إنشاء أدوات البحث
========================================================= */

function setupInventoryTools() {

  const panel =
    $("#inventoryList");

  if (!panel) {
    return;
  }


  /*
    لا نكرر الأدوات إذا كانت
    موجودة بالفعل.
  */

  if (
    $("#inventoryTools")
  ) {
    return;
  }


  const tools =
    document.createElement(
      "div"
    );

  tools.id =
    "inventoryTools";

  tools.className =
    "inventory-tools";


  tools.innerHTML = `
    <div class="inventory-search">

      <span class="search-icon">
        🔎
      </span>

      <input
        id="inventorySearch"
        type="search"
        placeholder="ابحث باسم الدواء أو الاسم العلمي..."
        autocomplete="off"
      >

    </div>


    <select
      id="inventoryFilter"
      class="inventory-filter"
    >

      <option value="all">
        كل الأدوية
      </option>

      <option value="available">
        المتوفرة
      </option>

      <option value="limited">
        الكمية المحدودة
      </option>

      <option value="unavailable">
        غير المتوفرة
      </option>

    </select>
  `;


  panel.parentNode.insertBefore(
    tools,
    panel
  );


  const noResults =
    document.createElement(
      "div"
    );

  noResults.id =
    "inventoryNoResults";

  noResults.className =
    "inventory-no-results hidden";


  noResults.innerHTML = `
    <div>
      🔎
    </div>

    <strong>
      لا توجد نتائج
    </strong>

    <p>
      جرّب اسمًا آخر أو غيّر فلتر الحالة.
    </p>
  `;


  panel.parentNode.insertBefore(
    noResults,
    panel.nextSibling
  );


  $("#inventorySearch")
    .addEventListener(
      "input",
      filterInventory
    );


  $("#inventoryFilter")
    .addEventListener(
      "change",
      filterInventory
    );
}


/* =========================================================
   تسجيل الدخول
========================================================= */

$("#loginForm")
  .addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      msg(
        "#loginMsg",
        "جاري الدخول..."
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
                      .value,

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


        setupInventoryTools();

        await loadDashboard();


      } catch (error) {

        msg(
          "#loginMsg",
          error.message
        );
      }
    }
  );


/* =========================================================
   تسجيل صيدلية جديدة
========================================================= */

$("#registerForm")
  .addEventListener(
    "submit",
    async (event) => {

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
                      .value,

                  phone:
                    $("#rPhone")
                      .value,

                  email:
                    $("#rEmail")
                      .value,

                  password:
                    $("#rPassword")
                      .value,

                  address:
                    $("#rAddress")
                      .value,

                  delivery:
                    $("#rDelivery")
                      .checked

                })
            }
          );


        msg(
          "#registerMsg",
          data.message
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


/* =========================================================
   الانتقال إلى التسجيل
========================================================= */

$("#showRegister")
  .onclick = () => {

    show(
      "registerView"
    );

    msg(
      "#registerMsg",
      ""
    );
  };


/* =========================================================
   العودة للدخول
========================================================= */

$("#showLogin")
  .onclick = () => {

    show(
      "loginView"
    );

    msg(
      "#loginMsg",
      ""
    );
  };


/* =========================================================
   تحديث المخزون
========================================================= */

$("#refreshBtn")
  .onclick = async () => {

    const button =
      $("#refreshBtn");

    const original =
      button
        ? button.textContent
        : "تحديث";


    try {

      if (button) {
        button.disabled =
          true;

        button.textContent =
          "جاري التحديث...";
      }


      await loadDashboard();


    } finally {

      if (button) {

        button.disabled =
          false;

        button.textContent =
          original;
      }
    }
  };


/* =========================================================
   تسجيل الخروج
========================================================= */

$("#logoutBtn")
  .onclick = () => {

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


/* =========================================================
   بدء التطبيق
========================================================= */

if (token) {

  show(
    "dashboardView"
  );

  setupInventoryTools();

  loadDashboard();

} else {

  show(
    "loginView"
  );
}
