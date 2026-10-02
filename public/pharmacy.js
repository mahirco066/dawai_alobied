const API = "";
let token = localStorage.getItem("dawai_pharmacy_token");
let pharmacy = null;
let inventory = [];
let medicines = [];

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function esc(value){
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

async function api(url, options = {}){
  const headers = {
    ...(options.headers || {}),
    "Content-Type":"application/json"
  };

  if(token){
    headers.Authorization = "Bearer " + token;
  }

  const response = await fetch(API + url,{
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if(!response.ok){
    throw new Error(data.error || "حدث خطأ أثناء تنفيذ العملية.");
  }

  return data;
}

function showView(id){
  $$(".view").forEach(v => v.classList.add("hidden"));
  $("#" + id)?.classList.remove("hidden");

  $$(".nav").forEach(n =>
    n.classList.toggle("active", n.dataset.view === id)
  );

  if(id === "inventory"){
    renderInventory();
  }

  window.scrollTo({top:0,behavior:"smooth"});
}

function statusLabel(status){
  if(status === "available"){
    return '<span class="status approved">متوفر</span>';
  }

  if(status === "limited"){
    return '<span class="status limited">كمية محدودة</span>';
  }

  return '<span class="status unavailable">غير متوفر</span>';
}

function dateText(value){
  if(!value) return "-";

  const d = new Date(value);

  if(Number.isNaN(d.getTime())) return "-";

  return d.toLocaleString("ar-SD",{
    dateStyle:"medium",
    timeStyle:"short"
  });
}

function saveToken(){
  if(token){
    localStorage.setItem("dawai_pharmacy_token",token);
  }
}

function clearSession(){
  localStorage.removeItem("dawai_pharmacy_token");
  token = null;
}

function showApp(){
  $("#loginView")?.classList.add("hidden");
  $("#appView")?.classList.remove("hidden");
}

function showLogin(){
  $("#appView")?.classList.add("hidden");
  $("#loginView")?.classList.remove("hidden");
}

async function login(email,password){

  const data = await api("/api/pharmacy/login",{
    method:"POST",
    body:JSON.stringify({
      email,
      password
    })
  });

  token = data.token;
  pharmacy = data.pharmacy;

  saveToken();

  showApp();

  await loadAll();
}

async function loadProfile(){

  pharmacy =
    await api("/api/pharmacy/me");

  const name =
    pharmacy.name || "الصيدلية";

  $("#topPharmacyName").textContent = name;
  $("#welcomeName").textContent = name;

  $("#profileName").textContent =
    pharmacy.name || "-";

  $("#profilePhone").textContent =
    pharmacy.phone || "-";

  $("#profileEmail").textContent =
    pharmacy.email || "-";

  $("#profileAddress").textContent =
    pharmacy.address || "-";

  $("#profilePageName").textContent =
    pharmacy.name || "-";

  $("#pagePhone").textContent =
    pharmacy.phone || "-";

  $("#pageEmail").textContent =
    pharmacy.email || "-";

  $("#pageAddress").textContent =
    pharmacy.address || "-";

  $("#pageHours").textContent =
    pharmacy.opening_hours || "-";

  $("#pageDelivery").textContent =
    pharmacy.delivery
      ? "متاح"
      : "غير متاح";

  const status =
    $("#profileStatus");

  if(status){
    status.className = "status " +
      (
        pharmacy.status === "approved"
          ? "approved"
          : "unavailable"
      );

    status.textContent =
      pharmacy.status === "approved"
        ? "معتمدة"
        : pharmacy.status === "pending"
          ? "قيد المراجعة"
          : "موقوفة";
  }
}

async function loadInventory(){

  inventory =
    await api("/api/pharmacy/inventory");

  renderInventory();
  renderStats();
  renderRecent();
}

async function loadMedicines(){

  medicines =
    await api("/api/medicines");
}

async function loadAll(){

  try{

    await Promise.all([
      loadProfile(),
      loadInventory(),
      loadMedicines()
    ]);

  }catch(error){

    if(
      error.message.includes("جلسة") ||
      error.message.includes("تسجيل الدخول") ||
      error.message.includes("401")
    ){
      clearSession();
      showLogin();
      return;
    }

    throw error;
  }
}

function renderStats(){

  const total = inventory.length;

  const available =
    inventory.filter(
      x => x.availability === "available"
    ).length;

  const limited =
    inventory.filter(
      x => x.availability === "limited"
    ).length;

  const unavailable =
    inventory.filter(
      x => x.availability === "unavailable"
    ).length;

  $("#statTotal").textContent = total;
  $("#statAvailable").textContent = available;
  $("#statLimited").textContent = limited;
  $("#statUnavailable").textContent = unavailable;
}

function renderRecent(){

  const list =
    inventory
      .slice()
      .sort(
        (a,b) =>
          new Date(b.updated_at || 0) -
          new Date(a.updated_at || 0)
      )
      .slice(0,6);

  const box = $("#recentList");

  if(!box) return;

  if(!list.length){

    box.innerHTML = `
      <div class="empty">
        لم تتم إضافة أدوية إلى مخزون الصيدلية بعد.
      </div>
    `;

    return;
  }

  box.innerHTML =
    list.map(item => {

      const m =
        item.medicines || {};

      return `
        <div class="recent-item">

          <div class="recent-main">

            <div class="medicine-icon">
              💊
            </div>

            <div>
              <strong>${esc(m.name || "-")}</strong>
              <small>
                ${esc(m.strength || "")}
                ${m.form ? " • " + esc(m.form) : ""}
              </small>
            </div>

          </div>

          <div>
            ${statusLabel(item.availability)}
          </div>

        </div>
      `;

    }).join("");
}

function filteredInventory(){

  const q =
    ($("#inventorySearch")?.value || "")
      .trim()
      .toLowerCase();

  const filter =
    $("#inventoryFilter")?.value || "all";

  return inventory.filter(item => {

    if(
      filter !== "all" &&
      item.availability !== filter
    ){
      return false;
    }

    if(!q) return true;

    const m =
      item.medicines || {};

    return [
      m.name,
      m.generic_name,
      m.strength,
      m.form
    ].some(value =>
      String(value || "")
        .toLowerCase()
        .includes(q)
    );
  });
}

function renderInventory(){

  const list =
    filteredInventory();

  $("#inventorySummary").textContent =
    `عرض ${list.length} من ${inventory.length} دواء`;

  if(!list.length){

    $("#inventoryTable").innerHTML = `
      <div class="empty">
        لا توجد أدوية مطابقة.
        <br>
        استخدم «إضافة دواء» لإضافة أول دواء إلى مخزون الصيدلية.
      </div>
    `;

    return;
  }

  $("#inventoryTable").innerHTML = `

    <table class="data">

      <thead>
        <tr>
          <th>الدواء</th>
          <th>الاسم العلمي</th>
          <th>الكمية</th>
          <th>الحالة</th>
          <th>آخر تحديث</th>
          <th>الإجراء</th>
        </tr>
      </thead>

      <tbody>

        ${list.map(item => {

          const m =
            item.medicines || {};

          return `
            <tr>

              <td>
                <b>${esc(m.name || "-")}</b>
                <br>
                <small>
                  ${esc(m.form || "")}
                </small>
              </td>

              <td>
                ${esc(m.generic_name || "-")}
              </td>

              <td>
                ${esc(item.quantity ?? 0)}
              </td>

              <td>
                ${statusLabel(item.availability)}
              </td>

              <td>
                ${dateText(item.updated_at)}
              </td>

              <td>

                <div class="action-group">

                  <button
                    class="act act-edit"
                    onclick="editInventory('${item.id}')"
                  >
                    تعديل
                  </button>

                </div>

              </td>

            </tr>
          `;

        }).join("")}

      </tbody>

    </table>
  `;
}

function medicineOptions(selectedId = ""){

  return medicines
    .map(m => `
      <option
        value="${esc(m.id)}"
        ${m.id === selectedId ? "selected" : ""}
      >
        ${esc(m.name)}
        ${m.strength ? " — " + esc(m.strength) : ""}
        ${m.form ? " — " + esc(m.form) : ""}
      </option>
    `)
    .join("");
}

function openModal(html){
  $("#modalBody").innerHTML = html;
  $("#modal").classList.remove("hidden");
}

function closeModal(){
  $("#modal").classList.add("hidden");
}

function addMedicine(){

  openModal(`

    <h3>إضافة دواء إلى المخزون</h3>

    <label>
      اختر الدواء

      <select id="modalMedicine">
        <option value="">اختر الدواء</option>
        ${medicineOptions()}
      </select>
    </label>

    <label>
      الكمية

      <input
        id="modalQuantity"
        type="number"
        min="0"
        value="0"
        placeholder="الكمية"
      >
    </label>

    <label>
      حالة التوفر

      <select id="modalAvailability">

        <option value="available">
          متوفر
        </option>

        <option value="limited">
          كمية محدودة
        </option>

        <option value="unavailable">
          غير متوفر
        </option>

      </select>

    </label>

    <div class="modal-actions">

      <button
        class="primary"
        onclick="saveInventory()"
      >
        حفظ
      </button>

      <button
        class="ghost"
        onclick="closeModal()"
      >
        إلغاء
      </button>

    </div>

  `);
}

function editInventory(id){

  const item =
    inventory.find(
      x => x.id === id
    );

  if(!item) return;

  const m =
    item.medicines || {};

  openModal(`

    <h3>تعديل مخزون الدواء</h3>

    <div class="notice">
      <strong>${esc(m.name || "-")}</strong>
      <br>
      ${esc(m.generic_name || "")}
      ${m.strength ? " • " + esc(m.strength) : ""}
      ${m.form ? " • " + esc(m.form) : ""}
    </div>

    <label>
      الكمية

      <input
        id="modalQuantity"
        type="number"
        min="0"
        value="${esc(item.quantity ?? 0)}"
      >
    </label>

    <label>
      حالة التوفر

      <select id="modalAvailability">

        <option
          value="available"
          ${item.availability === "available" ? "selected" : ""}
        >
          متوفر
        </option>

        <option
          value="limited"
          ${item.availability === "limited" ? "selected" : ""}
        >
          كمية محدودة
        </option>

        <option
          value="unavailable"
          ${item.availability === "unavailable" ? "selected" : ""}
        >
          غير متوفر
        </option>

      </select>

    </label>

    <div class="modal-actions">

      <button
        class="primary"
        onclick="updateInventory('${item.id}')"
      >
        حفظ التعديل
      </button>

      <button
        class="ghost"
        onclick="closeModal()"
      >
        إلغاء
      </button>

    </div>

  `);
}

async function saveInventory(){

  const medicine_id =
    $("#modalMedicine")?.value || "";

  const quantity =
    Math.max(
      0,
      Number($("#modalQuantity")?.value || 0)
    );

  const availability =
    $("#modalAvailability")?.value || "available";

  if(!medicine_id){

    alert("يرجى اختيار الدواء.");

    return;
  }

  try{

    await api(
      "/api/pharmacy/inventory",
      {
        method:"POST",
        body:JSON.stringify({
          medicine_id,
          quantity,
          availability
        })
      }
    );

    closeModal();

    await loadInventory();

    alert("تم حفظ الدواء في مخزون الصيدلية.");

  }catch(error){

    alert(
      error.message ||
      "تعذر حفظ الدواء."
    );
  }
}

async function updateInventory(id){

  const quantity =
    Math.max(
      0,
      Number($("#modalQuantity")?.value || 0)
    );

  const availability =
    $("#modalAvailability")?.value || "available";

  try{

    await api(
      `/api/pharmacy/inventory/${id}`,
      {
        method:"PUT",
        body:JSON.stringify({
          quantity,
          availability
        })
      }
    );

    closeModal();

    await loadInventory();

    alert("تم تحديث المخزون بنجاح.");

  }catch(error){

    alert(
      error.message ||
      "تعذر تحديث المخزون."
    );
  }
}

async function initialize(){

  if(!token){

    showLogin();

    return;
  }

  try{

    await loadAll();

    showApp();

  }catch(error){

    console.error(error);

    clearSession();

    showLogin();

  }
}

$("#loginForm")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const email =
      $("#loginEmail").value.trim();

    const password =
      $("#loginPassword").value;

    const msg =
      $("#loginMsg");

    const button =
      $("#loginBtn");

    msg.textContent =
      "جاري التحقق...";

    button.disabled = true;
    button.textContent = "جاري الدخول...";

    try{

      await login(email,password);

      msg.textContent = "";

    }catch(error){

      console.error(error);

      msg.textContent =
        error.message ||
        "فشل تسجيل الدخول.";

    }finally{

      button.disabled = false;
      button.textContent = "تسجيل الدخول";

    }
  }
);

$$(".nav").forEach(button => {

  button.addEventListener(
    "click",
    () => showView(button.dataset.view)
  );

});

$("#inventorySearch")?.addEventListener(
  "input",
  renderInventory
);

$("#inventoryFilter")?.addEventListener(
  "change",
  renderInventory
);

$("#refreshBtn")?.addEventListener(
  "click",
  async () => {

    try{

      await loadInventory();

    }catch(error){

      alert(error.message);

    }

  }
);

$("#addMedicineBtn")?.addEventListener(
  "click",
  addMedicine
);

$("#closeModal")?.addEventListener(
  "click",
  closeModal
);

$("#modal")?.addEventListener(
  "click",
  event => {

    if(event.target.id === "modal"){
      closeModal();
    }

  }
);

$("#logoutBtn")?.addEventListener(
  "click",
  () => {

    clearSession();

    location.reload();

  }
);

window.showView = showView;
window.editInventory = editInventory;
window.updateInventory = updateInventory;
window.saveInventory = saveInventory;
window.closeModal = closeModal;

initialize();
