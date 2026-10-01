const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let token = localStorage.getItem("dawai_admin_token");
let pharmacies = [];
let medicines = [];
let inventory = [];
let accounts = [];

function esc(value){
  return String(value ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[c])
  );
}

function api(url, options = {}){
  options.headers = {
    ...(options.headers || {}),
    "Content-Type":"application/json"
  };

  if(token){
    options.headers.Authorization =
      "Bearer " + token;
  }

  return fetch(url, options).then(async r => {

    const data =
      await r.json().catch(() => ({}));

    if(!r.ok){

      throw new Error(
        data.error ||
        "حدث خطأ أثناء تنفيذ العملية."
      );

    }

    return data;
  });
}

function statusPill(s){

  if(s === "approved"){
    return '<span class="pill approved">معتمدة</span>';
  }

  if(s === "suspended"){
    return '<span class="pill suspended">موقوفة</span>';
  }

  return '<span class="pill pending">قيد المراجعة</span>';
}

function inventoryPill(s){

  if(s === "available"){
    return '<span class="pill approved">متوفر</span>';
  }

  if(s === "limited"){
    return '<span class="pill pending">كمية محدودة</span>';
  }

  return '<span class="pill suspended">غير متوفر</span>';
}

function accountPill(active){

  return active
    ? '<span class="pill approved">نشط</span>'
    : '<span class="pill suspended">معطل</span>';
}

function dateText(value){

  if(!value) return "-";

  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleString(
        "ar-SD",
        {
          dateStyle:"medium",
          timeStyle:"short"
        }
      );
}

function show(id){

  $$(".view").forEach(x =>
    x.classList.add("hidden")
  );

  $("#" + id)?.classList.remove("hidden");

  $$(".nav").forEach(x =>
    x.classList.toggle(
      "active",
      x.dataset.view === id
    )
  );

  if(id === "pharmacies"){
    renderPharmacies();
  }

  if(id === "medicines"){
    renderMedicines();
  }

  if(id === "inventory"){
    renderInventory();
  }

  if(id === "accounts"){
    renderAccounts();
  }

  window.scrollTo({
    top:0,
    behavior:"smooth"
  });
}

function openModal(html){

  const body = $("#modalBody");
  const modal = $("#modal");

  if(body){
    body.innerHTML = html;
  }

  if(modal){
    modal.classList.add("show");
  }
}

function closeModal(){

  $("#modal")?.classList.remove("show");

}

async function loadStats(){

  const d =
    await api("/api/admin/stats");

  if($("#nPh")){
    $("#nPh").textContent =
      d.pharmacies ?? 0;
  }

  if($("#nPe")){
    $("#nPe").textContent =
      d.pending ?? 0;
  }

  if($("#nAp")){
    $("#nAp").textContent =
      d.approved ?? 0;
  }

  if($("#nSu")){
    $("#nSu").textContent =
      d.suspended ?? 0;
  }

  if($("#nMe")){
    $("#nMe").textContent =
      d.medicines ?? 0;
  }

  if($("#nIn")){
    $("#nIn").textContent =
      d.inventory ?? 0;
  }

  if($("#pending")){
    $("#pending").textContent =
      d.pending ?? 0;
  }
}

async function loadPharmacies(){

  const status =
    $("#filter")?.value || "";

  pharmacies =
    await api(
      "/api/admin/pharmacies?status=" +
      encodeURIComponent(status)
    );

  renderPharmacies();
  renderAccounts();
  renderHomePending();
}

function filteredPharmacies(){

  const q =
    ($("#pharmacySearch")?.value || "")
      .trim()
      .toLowerCase();

  return pharmacies.filter(p => {

    if(!q) return true;

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

function renderPharmacies(){

  const list =
    filteredPharmacies();

  if($("#pharmacySummary")){

    $("#pharmacySummary").textContent =
      `عرض ${list.length} من ${pharmacies.length} صيدلية`;

  }

  if(!$("#pharmacyTable")){
    return;
  }

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

${list.map(p => {

  const email =
    p.pharmacy_accounts?.[0]?.email || "";

  return `
<tr>

<td>

<b>${esc(p.name)}</b>

<br>

<small>
${esc(email)}
</small>

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
  onclick="setPharmacyStatus('${p.id}','approved')">
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
  onclick="setPharmacyStatus('${p.id}','suspended')">
  إيقاف
</button>
`
    : `
<button
  class="act warn"
  onclick="setPharmacyStatus('${p.id}','pending')">
  إعادة للمراجعة
</button>
`
}

<button
  class="act warn"
  onclick="viewPharmacy('${p.id}')">
  تفاصيل
</button>

</td>

</tr>
`;

}).join("")}

</tbody>

</table>
`
      : `
<div class="empty">
لا توجد صيدليات مطابقة.
</div>
`;
}

window.setPharmacyStatus =
  async (id,status) => {

    const labels = {
      approved:"اعتماد",
      suspended:"إيقاف",
      pending:"إعادة للمراجعة"
    };

    if(
      !confirm(
        `هل تريد ${labels[status]} هذه الصيدلية؟`
      )
    ){
      return;
    }

    try{

      await api(
        `/api/admin/pharmacies/${id}/status`,
        {
          method:"PATCH",
          body:JSON.stringify({status})
        }
      );

      await refreshAll();

    }catch(e){

      alert(e.message);

    }
  };

/* ==================================================
   الإدارة الكاملة للصيدلية
================================================== */

window.viewPharmacy = id => {

  const p =
    pharmacies.find(
      x => x.id === id
    );

  if(!p) return;

  const a =
    p.pharmacy_accounts?.[0] || {};

  const status =
    p.status || "pending";

  openModal(`

<h3>إدارة الصيدلية</h3>

<div class="info-box">

<strong>
${esc(p.name)}
</strong>

<br>

<span>
حساب الدخول:
${
  a.active === false
    ? "معطل"
    : "نشط"
}
</span>

</div>

<div class="form-grid">

<div>

<label>
اسم الصيدلية
</label>

<input
  id="pharmacyName"
  type="text"
  value="${esc(p.name || "")}"
  placeholder="اسم الصيدلية"
>

</div>

<div>

<label>
رقم الهاتف
</label>

<input
  id="pharmacyPhone"
  type="text"
  value="${esc(p.phone || "")}"
  placeholder="رقم الهاتف"
>

</div>

<div>

<label>
البريد الإلكتروني
</label>

<input
  id="pharmacyEmail"
  type="email"
  value="${esc(a.email || "")}"
  placeholder="البريد الإلكتروني"
>

</div>

<div>

<label>
ساعات العمل
</label>

<input
  id="pharmacyHours"
  type="text"
  value="${esc(p.opening_hours || "")}"
  placeholder="مثال: 8 صباحًا - 10 مساءً"
>

</div>

</div>

<div>

<label>
عنوان الصيدلية
</label>

<textarea
  id="pharmacyAddress"
  rows="3"
  placeholder="عنوان الصيدلية"
>${esc(p.address || "")}</textarea>

</div>

<label class="check-row">

<input
  id="pharmacyDelivery"
  type="checkbox"
  ${p.delivery ? "checked" : ""}
>

<span>
خدمة التوصيل متاحة
</span>

</label>

<div>

<label>
حالة الصيدلية
</label>

<select id="pharmacyStatus">

<option
  value="pending"
  ${status === "pending" ? "selected" : ""}
>
قيد المراجعة
</option>

<option
  value="approved"
  ${status === "approved" ? "selected" : ""}
>
معتمدة
</option>

<option
  value="suspended"
  ${status === "suspended" ? "selected" : ""}
>
موقوفة
</option>

</select>

</div>

<button
  class="primary wide"
  onclick="savePharmacy('${p.id}')">
  💾 حفظ جميع التعديلات
</button>

<hr>

<div class="reset-password-box">

<div class="reset-password-title">
🔑 تغيير كلمة المرور
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
  onclick="resetPharmacyPassword('${p.id}')">
  تحديث كلمة المرور
</button>

</div>

<hr>

<button
  class="act stop wide"
  onclick="deletePharmacy('${p.id}')">
  🗑️ حذف الصيدلية نهائيًا
</button>

`);

};

window.savePharmacy =
  async id => {

    const p =
      pharmacies.find(
        x => x.id === id
      );

    if(!p) return;

    const name =
      $("#pharmacyName")?.value
        ?.trim() || "";

    const phone =
      $("#pharmacyPhone")?.value
        ?.trim() || "";

    const email =
      $("#pharmacyEmail")?.value
        ?.trim()
        ?.toLowerCase() || "";

    const address =
      $("#pharmacyAddress")?.value
        ?.trim() || "";

    const opening_hours =
      $("#pharmacyHours")?.value
        ?.trim() || "";

    const delivery =
      $("#pharmacyDelivery")?.checked === true;

    const status =
      $("#pharmacyStatus")?.value ||
      "pending";

    if(!name){

      alert(
        "اسم الصيدلية مطلوب."
      );

      return;
    }

    if(!phone){

      alert(
        "رقم الهاتف مطلوب."
      );

      return;
    }

    if(!email){

      alert(
        "البريد الإلكتروني مطلوب."
      );

      return;
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if(!emailPattern.test(email)){

      alert(
        "صيغة البريد الإلكتروني غير صحيحة."
      );

      return;
    }

    if(
      !confirm(
        `هل تريد حفظ تعديلات الصيدلية ${p.name}؟`
      )
    ){
      return;
    }

    try{

      await api(
        `/api/admin/pharmacies/${id}`,
        {
          method:"PATCH",

          body:JSON.stringify({
            name,
            phone,
            address,
            opening_hours,
            delivery
          })
        }
      );

      const oldEmail =
        String(
          p.pharmacy_accounts?.[0]?.email || ""
        )
        .trim()
        .toLowerCase();

      if(email !== oldEmail){

        await api(
          `/api/admin/pharmacies/${id}/email`,
          {
            method:"PATCH",

            body:JSON.stringify({
              email
            })
          }
        );
      }

      if(status !== p.status){

        await api(
          `/api/admin/pharmacies/${id}/status`,
          {
            method:"PATCH",

            body:JSON.stringify({
              status
            })
          }
        );
      }

      alert(
        "تم حفظ جميع تعديلات الصيدلية بنجاح."
      );

      closeModal();

      await refreshAll();

    }catch(e){

      alert(e.message);

    }
  };

window.deletePharmacy =
  async id => {

    const p =
      pharmacies.find(
        x => x.id === id
      );

    if(!p) return;

    if(
      !confirm(
        `⚠️ هل أنت متأكد من حذف الصيدلية "${p.name}" نهائيًا؟\n\nسيتم حذف الصيدلية والحساب والمخزون المرتبط بها.`
      )
    ){
      return;
    }

    if(
      !confirm(
        "تأكيد أخير: هل تريد الحذف النهائي؟"
      )
    ){
      return;
    }

    try{

      await api(
        `/api/admin/pharmacies/${id}`,
        {
          method:"DELETE"
        }
      );

      alert(
        "تم حذف الصيدلية بنجاح."
      );

      closeModal();

      await refreshAll();

    }catch(e){

      alert(e.message);

    }
  };/* ==================================================
   الأدوية
================================================== */

async function loadMedicines(){

  medicines =
    await api(
      "/api/admin/medicines"
    );

  renderMedicines();
}

function medicineForm(m = {}){

  return `

<div class="form-grid">

<div>

<label>
اسم الدواء
</label>

<input
  id="medName"
  value="${esc(m.name || "")}"
  placeholder="اسم الدواء"
>

</div>

<div>

<label>
الاسم العلمي
</label>

<input
  id="medGeneric"
  value="${esc(m.generic_name || "")}"
  placeholder="الاسم العلمي"
>

</div>

<div>

<label>
التركيز
</label>

<input
  id="medStrength"
  value="${esc(m.strength || "")}"
  placeholder="مثال: 500 mg"
>

</div>

<div>

<label>
الشكل الدوائي
</label>

<input
  id="medForm"
  value="${esc(m.form || "")}"
  placeholder="أقراص / كبسولات / شراب"
>

</div>

</div>

<label class="check-row">

<input
  id="medActive"
  type="checkbox"
  ${m.active !== false ? "checked" : ""}
>

<span>
الدواء فعال في النظام
</span>

</label>

<button
  class="primary wide"
  onclick="saveMedicine()">
  حفظ الدواء
</button>

`;
}

function filteredMedicines(){

  const q =
    ($("#medicineSearch")?.value || "")
      .trim()
      .toLowerCase();

  const f =
    $("#medicineFilter")?.value ||
    "all";

  return medicines.filter(m => {

    const text = [
      m.name,
      m.generic_name,
      m.strength,
      m.form
    ]
      .map(v =>
        String(v || "")
          .toLowerCase()
      )
      .join(" ");

    return (
      (!q || text.includes(q)) &&
      (
        f === "all" ||
        (f === "active" && m.active) ||
        (f === "inactive" && !m.active)
      )
    );

  });
}

function renderMedicines(){

  const list =
    filteredMedicines();

  if($("#medicineSummary")){

    $("#medicineSummary").textContent =
      `عرض ${list.length} من ${medicines.length} دواء`;

  }

  if(!$("#medicineTable")){
    return;
  }

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
<th>الإجراء</th>
</tr>

</thead>

<tbody>

${list.map(m => `

<tr>

<td>
<b>
${esc(m.name)}
</b>
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
  onclick="editMedicine('${m.id}')">
  تعديل
</button>

<button
  class="act ${
    m.active
      ? "stop"
      : "ok"
  }"
  onclick="toggleMedicine('${m.id}')">

${
  m.active
    ? "تعطيل"
    : "تفعيل"
}

</button>

</td>

</tr>

`).join("")}

</tbody>

</table>

`
      : `
<div class="empty">
لا توجد أدوية مطابقة.
</div>
`;
}

window.editMedicine =
  id => {

    const m =
      medicines.find(
        x => x.id === id
      );

    if(!m) return;

    window._editingMedicine = m;

    openModal(`

<h3>
تعديل الدواء
</h3>

${medicineForm(m)}

`);

  };

window.saveMedicine =
  async () => {

    const name =
      $("#medName")?.value
        ?.trim() || "";

    const generic_name =
      $("#medGeneric")?.value
        ?.trim() || "";

    const strength =
      $("#medStrength")?.value
        ?.trim() || "";

    const form =
      $("#medForm")?.value
        ?.trim() || "";

    const active =
      $("#medActive")?.checked !== false;

    if(!name){

      alert(
        "يرجى إدخال اسم الدواء."
      );

      return;
    }

    const editing =
      window._editingMedicine;

    try{

      const url =
        editing
          ? `/api/admin/medicines/${editing.id}`
          : "/api/admin/medicines";

      const method =
        editing
          ? "PATCH"
          : "POST";

      await api(
        url,
        {
          method,

          body:JSON.stringify({
            name,
            generic_name,
            strength,
            form,
            active
          })
        }
      );

      alert(
        editing
          ? "تم تحديث الدواء بنجاح."
          : "تمت إضافة الدواء بنجاح."
      );

      window._editingMedicine =
        null;

      closeModal();

      await Promise.all([
        loadMedicines(),
        loadStats()
      ]);

    }catch(e){

      alert(e.message);

    }
  };

window.toggleMedicine =
  async id => {

    const m =
      medicines.find(
        x => x.id === id
      );

    if(!m) return;

    const action =
      m.active
        ? "تعطيل"
        : "تفعيل";

    if(
      !confirm(
        `هل تريد ${action} الدواء ${m.name}؟`
      )
    ){
      return;
    }

    try{

      await api(
        `/api/admin/medicines/${id}`,
        {
          method:"PATCH",

          body:JSON.stringify({
            active:!m.active
          })
        }
      );

      await Promise.all([
        loadMedicines(),
        loadStats()
      ]);

    }catch(e){

      alert(e.message);

    }
  };


/* ==================================================
   المخزون
================================================== */

async function loadInventory(){

  inventory =
    await api(
      "/api/admin/inventory"
    );

  renderInventory();
  renderHomeInventory();
}

function filteredInventory(){

  const q =
    ($("#inventorySearch")?.value || "")
      .trim()
      .toLowerCase();

  const f =
    $("#inventoryFilter")?.value ||
    "all";

  return inventory.filter(x => {

    const text = [
      x.pharmacy?.name,
      x.medicine?.name,
      x.medicine?.generic_name
    ]
      .map(v =>
        String(v || "")
          .toLowerCase()
      )
      .join(" ");

    return (
      (!q || text.includes(q)) &&
      (
        f === "all" ||
        x.availability === f
      )
    );

  });
}

function renderInventory(){

  const list =
    filteredInventory();

  if($("#inventorySummary")){

    $("#inventorySummary").textContent =
      `عرض ${list.length} من ${inventory.length} سجل مخزون`;

  }

  if(!$("#inventoryTable")){
    return;
  }

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

${list.map(x => `

<tr>

<td>

<b>
${esc(x.pharmacy?.name || "-")}
</b>

<br>

<small>
${esc(x.pharmacy?.status || "")}
</small>

</td>

<td>

<b>
${esc(x.medicine?.name || "-")}
</b>

<br>

<small>
${esc(x.medicine?.generic_name || "")}
${esc(x.medicine?.strength || "")}
</small>

</td>

<td>

<b>
${Number(x.quantity || 0)}
</b>

</td>

<td>
${inventoryPill(x.availability)}
</td>

<td>
${dateText(x.updated_at)}
</td>

</tr>

`).join("")}

</tbody>

</table>

`
      : `
<div class="empty">
لا توجد سجلات مخزون مطابقة.
</div>
`;
}


/* ==================================================
   حسابات الصيدليات
================================================== */

function loadAccounts(){

  renderAccounts();

}

function filteredAccounts(){

  const q =
    ($("#accountSearch")?.value || "")
      .trim()
      .toLowerCase();

  const f =
    $("#accountFilter")?.value ||
    "all";

  return pharmacies.filter(p => {

    const a =
      p.pharmacy_accounts?.[0] ||
      {};

    const text = [
      a.email,
      p.name,
      p.phone
    ]
      .map(v =>
        String(v || "")
          .toLowerCase()
      )
      .join(" ");

    return (
      (!q || text.includes(q)) &&
      (
        f === "all" ||
        (f === "active" && a.active) ||
        (f === "inactive" && !a.active)
      )
    );

  });
}

function renderAccounts(){

  const list =
    filteredAccounts();

  if($("#accountSummary")){

    $("#accountSummary").textContent =
      `عرض ${list.length} من ${pharmacies.length} حساب`;

  }

  if(!$("#accountTable")){
    return;
  }

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

${list.map(p => {

  const a =
    p.pharmacy_accounts?.[0] ||
    {};

  return `

<tr>

<td>

<b>
${esc(p.name)}
</b>

<br>

<small>
${esc(p.phone || "")}
</small>

</td>

<td>
${esc(a.email || "-")}
</td>

<td>
${statusPill(p.status)}
</td>

<td>
${accountPill(a.active !== false)}
</td>

<td>

<button
  class="act warn"
  onclick="viewPharmacy('${p.id}')">
  🔑 إدارة الحساب
</button>

</td>

</tr>

`;

}).join("")}

</tbody>

</table>

`
      : `
<div class="empty">
لا توجد حسابات مطابقة.
</div>
`;
}


/* ==================================================
   الصفحة الرئيسية للوحة الإدارة
================================================== */

function renderHomePending(){

  const p =
    pharmacies
      .filter(x =>
        x.status === "pending"
      )
      .slice(0,6);

  if(!$("#homePending")){
    return;
  }

  $("#homePending").innerHTML =
    p.length
      ? p.map(x => `

<div class="mini">

<span>
🏪 ${esc(x.name)}
</span>

<button
  class="act ok"
  onclick="setPharmacyStatus('${x.id}','approved')">
  اعتماد
</button>

</div>

`).join("")
      : `
<div class="empty">
لا توجد طلبات معلقة حاليًا.
</div>
`;
}

function renderHomeInventory(){

  const list =
    inventory.slice(0,6);

  if(!$("#homeInventory")){
    return;
  }

  $("#homeInventory").innerHTML =
    list.length
      ? list.map(x => `

<div class="mini">

<span>
💊 ${esc(x.medicine?.name)}
—
${esc(x.pharmacy?.name)}
</span>

${inventoryPill(
  x.availability
)}

</div>

`).join("")
      : `
<div class="empty">
لا توجد تحديثات مخزون.
</div>
`;
}


/* ==================================================
   تحديث جميع بيانات لوحة الإدارة
================================================== */

async function refreshAll(){

  try{

    await Promise.all([
      loadStats(),
      loadPharmacies(),
      loadMedicines(),
      loadInventory()
    ]);

    renderHomePending();
    renderHomeInventory();

  }catch(e){

    if(
      e.message.includes("جلسة الإدارة") ||
      e.message.includes("تسجيل دخول الإدارة")
    ){

      localStorage.removeItem(
        "dawai_admin_token"
      );

      token = null;

      location.reload();

    }else{

      console.error(e);

      alert(e.message);

    }

  }
}/* ==================================================
   تحديث البريد الإلكتروني — توافق إضافي
================================================== */

window.updatePharmacyEmail =
  async id => {

    const p =
      pharmacies.find(
        x => x.id === id
      );

    if(!p) return;

    const account =
      p.pharmacy_accounts?.[0] ||
      {};

    const currentEmail =
      account.email || "";

    const email =
      prompt(
        "أدخل البريد الإلكتروني الجديد:",
        currentEmail
      );

    if(email === null){
      return;
    }

    const value =
      email.trim().toLowerCase();

    if(!value){
      alert(
        "البريد الإلكتروني مطلوب."
      );
      return;
    }

    try{

      await api(
        `/api/admin/pharmacies/${id}/email`,
        {
          method:"PATCH",

          body:JSON.stringify({
            email:value
          })
        }
      );

      alert(
        "تم تحديث البريد الإلكتروني بنجاح."
      );

      await refreshAll();

      if(
        document.querySelector(
          ".modal-backdrop"
        )
      ){
        closeModal();
      }

    }catch(e){

      alert(e.message);

    }
  };


/* ==================================================
   أدوات البحث والتصفية
================================================== */

const pharmacySearch =
  $("#pharmacySearch");

if(pharmacySearch){

  pharmacySearch.addEventListener(
    "input",
    () => renderPharmacies()
  );

}

const pharmacyFilter =
  $("#pharmacyFilter");

if(pharmacyFilter){

  pharmacyFilter.addEventListener(
    "change",
    () => renderPharmacies()
  );

}

const medicineSearch =
  $("#medicineSearch");

if(medicineSearch){

  medicineSearch.addEventListener(
    "input",
    () => renderMedicines()
  );

}

const medicineFilter =
  $("#medicineFilter");

if(medicineFilter){

  medicineFilter.addEventListener(
    "change",
    () => renderMedicines()
  );

}

const inventorySearch =
  $("#inventorySearch");

if(inventorySearch){

  inventorySearch.addEventListener(
    "input",
    () => renderInventory()
  );

}

const inventoryFilter =
  $("#inventoryFilter");

if(inventoryFilter){

  inventoryFilter.addEventListener(
    "change",
    () => renderInventory()
  );

}

const accountSearch =
  $("#accountSearch");

if(accountSearch){

  accountSearch.addEventListener(
    "input",
    () => renderAccounts()
  );

}

const accountFilter =
  $("#accountFilter");

if(accountFilter){

  accountFilter.addEventListener(
    "change",
    () => renderAccounts()
  );

}


/* ==================================================
   التبويبات
================================================== */

document
  .querySelectorAll(".nav")
  .forEach(btn => {

    btn.addEventListener(
      "click",
      () => {

        const target =
          btn.dataset.target ||
          btn.dataset.section;

        if(!target){
          return;
        }

        document
          .querySelectorAll(".nav")
          .forEach(x =>
            x.classList.remove("active")
          );

        btn.classList.add("active");

        document
          .querySelectorAll(".section")
          .forEach(section =>
            section.classList.add("hidden")
          );

        const section =
          document.getElementById(target);

        if(section){
          section.classList.remove("hidden");
        }

      }
    );

  });


/* ==================================================
   إضافة دواء
================================================== */

const addMedicineBtn =
  $("#addMedicineBtn");

if(addMedicineBtn){

  addMedicineBtn.addEventListener(
    "click",
    () => {

      window._editingMedicine =
        null;

      openModal(`

<h3>
إضافة دواء جديد
</h3>

${medicineForm({})}

`);

    }
  );

}


/* ==================================================
   إغلاق النوافذ المنبثقة
================================================== */

document.addEventListener(
  "click",
  event => {

    const target =
      event.target;

    if(
      target.matches(
        "[data-close-modal]"
      )
    ){

      closeModal();

    }

  }
);


/* ==================================================
   تسجيل خروج الإدارة
================================================== */

const logoutBtn =
  $("#logoutBtn");

if(logoutBtn){

  logoutBtn.addEventListener(
    "click",
    () => {

      localStorage.removeItem(
        "dawai_admin_token"
      );

      token = null;

      location.reload();

    }
  );

}


/* ==================================================
   تسجيل دخول الإدارة
================================================== */

const loginForm =
  document.querySelector(
    "#loginForm"
  );

if(loginForm){

  loginForm.addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const loginMsg =
        document.querySelector(
          "#loginMsg"
        );

      const loginButton =
        loginForm.querySelector(
          'button[type="submit"]'
        );

      const username =
        document.querySelector(
          "#username"
        )?.value
          ?.trim() || "";

      const password =
        document.querySelector(
          "#password"
        )?.value || "";

      if(!username || !password){

        if(loginMsg){

          loginMsg.textContent =
            "يرجى إدخال اسم المستخدم وكلمة المرور.";

        }

        return;
      }

      if(loginMsg){

        loginMsg.textContent =
          "جاري التحقق...";

      }

      if(loginButton){

        loginButton.disabled =
          true;

        loginButton.dataset.oldText =
          loginButton.textContent;

        loginButton.textContent =
          "جاري الدخول...";

      }

      try{

        const data =
          await api(
            "/api/admin/login",
            {
              method:"POST",

              body:JSON.stringify({
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

        const login =
          document.querySelector(
            "#login"
          );

        const app =
          document.querySelector(
            "#app"
          );

        if(login){
          login.classList.add(
            "hidden"
          );
        }

        if(app){
          app.classList.remove(
            "hidden"
          );
        }

        const adminName =
          document.querySelector(
            "#adminName"
          );

        if(adminName){

          adminName.textContent =
            data.username ||
            username;

        }

        if(loginMsg){
          loginMsg.textContent = "";
        }

        await refreshAll();

      }catch(error){

        console.error(
          "Admin login error:",
          error
        );

        if(loginMsg){

          loginMsg.textContent =
            error.message ||
            "فشل تسجيل الدخول.";

        }else{

          alert(
            error.message ||
            "فشل تسجيل الدخول."
          );

        }

      }finally{

        if(loginButton){

          loginButton.disabled =
            false;

          loginButton.textContent =
            loginButton.dataset.oldText ||
            "دخول لوحة التحكم";

        }

      }

    }
  );

}


/* ==================================================
   استعادة جلسة الإدارة
================================================== */

(async () => {

  if(!token){
    return;
  }

  try{

    const data =
      await api(
        "/api/admin/me"
      );

    const login =
      document.querySelector(
        "#login"
      );

    const app =
      document.querySelector(
        "#app"
      );

    if(login){

      login.classList.add(
        "hidden"
      );

    }

    if(app){

      app.classList.remove(
        "hidden"
      );

    }

    const adminName =
      document.querySelector(
        "#adminName"
      );

    if(adminName){

      adminName.textContent =
        data.username ||
        "admin";

    }

    await refreshAll();

  }catch(error){

    console.error(
      "Admin session error:",
      error
    );

    localStorage.removeItem(
      "dawai_admin_token"
    );

    token = null;

  }

})();


/* ==================================================
   تحديث تلقائي بسيط
================================================== */

window.addEventListener(
  "focus",
  async () => {

    if(!token){
      return;
    }

    try{

      await refreshAll();

    }catch(error){

      console.error(
        "Auto refresh error:",
        error
      );

    }

  }
);


/* ==================================================
   نهاية ملف admin.js
================================================== */
