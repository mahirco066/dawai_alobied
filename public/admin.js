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
    options.headers.Authorization = "Bearer " + token;
  }

  return fetch(url, options).then(async r => {
    const data = await r.json().catch(() => ({}));

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
  const d = await api(
    "/api/admin/stats"
  );

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

  pharmacies = await api(
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

window.viewPharmacy = id => {

  const p =
    pharmacies.find(x => x.id === id);

  if(!p) return;

  const a =
    p.pharmacy_accounts?.[0] || {};

  openModal(`

<h3>إدارة الصيدلية</h3>

<div class="form-grid">

  <div>
    <label>اسم الصيدلية</label>
    <input
      id="pharmacyName"
      value="${esc(p.name || "")}"
      placeholder="اسم الصيدلية"
    >
  </div>

  <div>
    <label>رقم الهاتف</label>
    <input
      id="pharmacyPhone"
      value="${esc(p.phone || "")}"
      placeholder="رقم الهاتف"
    >
  </div>

  <div>
    <label>البريد الإلكتروني</label>
    <input
      id="pharmacyEmail"
      type="email"
      value="${esc(a.email || "")}"
      placeholder="البريد الإلكتروني"
    >
  </div>

  <div>
    <label>العنوان</label>
    <input
      id="pharmacyAddress"
      value="${esc(p.address || "")}"
      placeholder="عنوان الصيدلية"
    >
  </div>

  <div>
    <label>ساعات العمل</label>
    <input
      id="pharmacyHours"
      value="${esc(p.opening_hours || "")}"
      placeholder="مثال: 8 صباحًا - 11 مساءً"
    >
  </div>

  <div>
    <label>حالة الصيدلية</label>
    <select id="pharmacyStatus">
      <option value="pending" ${p.status === "pending" ? "selected" : ""}>قيد المراجعة</option>
      <option value="approved" ${p.status === "approved" ? "selected" : ""}>معتمدة</option>
      <option value="suspended" ${p.status === "suspended" ? "selected" : ""}>موقوفة</option>
    </select>
  </div>

</div>

<label class="checkbox-row">
  <input
    id="pharmacyDelivery"
    type="checkbox"
    ${p.delivery ? "checked" : ""}
  >
  <span>الصيدلية توفر خدمة التوصيل</span>
</label>

<div class="modal-actions">

  <button
    class="primary"
    onclick="updatePharmacy('${p.id}')"
  >
    حفظ بيانات الصيدلية
  </button>

  <button
    class="ghost"
    onclick="updatePharmacyEmail('${p.id}')"
  >
    تحديث البريد فقط
  </button>

</div>

<div class="reset-password-box">

  <div class="reset-password-title">
    🔑 تغيير كلمة المرور
  </div>

  <p>
    تعيين كلمة مرور جديدة لحساب الصيدلية.
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

<div class="danger-zone">

  <div>
    <strong>منطقة الخطر</strong>
    <p>حذف الصيدلية يؤدي إلى حذف بيانات المخزون والحساب المرتبط بها.</p>
  </div>

  <button
    class="act stop"
    onclick="deletePharmacy('${p.id}')"
  >
    حذف الصيدلية
  </button>

</div>

`);

};

window.updatePharmacy =
  async id => {

    const p =
      pharmacies.find(x => x.id === id);

    if(!p) return;

    const name =
      $("#pharmacyName")?.value?.trim() || "";

    const phone =
      $("#pharmacyPhone")?.value?.trim() || "";

    const address =
      $("#pharmacyAddress")?.value?.trim() || "";

    const opening_hours =
      $("#pharmacyHours")?.value?.trim() || "";

    const delivery =
      Boolean($("#pharmacyDelivery")?.checked);

    const status =
      $("#pharmacyStatus")?.value || p.status;

    if(!name){
      alert("اسم الصيدلية مطلوب.");
      return;
    }

    if(!["pending","approved","suspended"].includes(status)){
      alert("حالة الصيدلية غير صحيحة.");
      return;
    }

    if(!confirm(`هل تريد حفظ تعديلات الصيدلية: ${name}؟`)){
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

      if(status !== p.status){
        await api(
          `/api/admin/pharmacies/${id}/status`,
          {
            method:"PATCH",
            body:JSON.stringify({status})
          }
        );
      }

      alert("تم حفظ بيانات الصيدلية بنجاح.");

      closeModal();
      await refreshAll();

    }catch(e){
      alert(e.message || "تعذر تحديث بيانات الصيدلية.");
    }
  };

window.deletePharmacy =
  async id => {

    const p =
      pharmacies.find(x => x.id === id);

    if(!p) return;

    const answer =
      prompt(
        `لحذف الصيدلية «${p.name}» نهائيًا، اكتب كلمة حذف:`
      );

    if(answer !== "حذف"){
      return;
    }

    if(!confirm(`تأكيد نهائي: حذف الصيدلية «${p.name}»؟`)){
      return;
    }

    try{

      await api(
        `/api/admin/pharmacies/${id}`,
        {
          method:"DELETE"
        }
      );

      alert("تم حذف الصيدلية بنجاح.");

      closeModal();
      await refreshAll();

    }catch(e){
      alert(e.message || "تعذر حذف الصيدلية.");
    }
  };

window.resetPharmacyPassword =
  async id => {

    const input =
      $("#resetPassword");

    const password =
      input?.value || "";

    if(password.length < 8){

      alert(
        "كلمة المرور يجب أن تكون 8 أحرف على الأقل."
      );

      return;
    }

    const p =
      pharmacies.find(
        x => x.id === id
      );

    if(!p) return;

    if(
      !confirm(
        `هل تريد تعيين كلمة مرور جديدة لحساب ${p.name}؟`
      )
    ){
      return;
    }

    try{

      const d =
        await api(
          `/api/admin/pharmacies/${id}/password`,
          {
            method:"PATCH",
            body:JSON.stringify({
              password
            })
          }
        );

      alert(
        `تم تحديث كلمة المرور بنجاح للصيدلية: ${p.name}\nالبريد: ${d.email}`
      );

      closeModal();

    }catch(e){

      alert(e.message);

    }
  };

window.updatePharmacyEmail =
  async id => {

    const input =
      $("#pharmacyEmail");

    const email =
      input?.value
        ?.trim()
        ?.toLowerCase() || "";

    if(!email){

      alert(
        "البريد الإلكتروني مطلوب."
      );

      return;
    }

    const pattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if(!pattern.test(email)){

      alert(
        "صيغة البريد الإلكتروني غير صحيحة."
      );

      return;
    }

    const p =
      pharmacies.find(
        x => x.id === id
      );

    if(!p) return;

    if(
      !confirm(
        `هل تريد تحديث البريد الإلكتروني لحساب ${p.name}؟`
      )
    ){
      return;
    }

    try{

      const d =
        await api(
          `/api/admin/pharmacies/${id}/email`,
          {
            method:"PATCH",
            body:JSON.stringify({
              email
            })
          }
        );

      alert(
        d.message ||
        "تم تحديث البريد الإلكتروني بنجاح."
      );

      closeModal();

      await loadPharmacies();

    }catch(e){

      alert(e.message);

    }
  };

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
<label>اسم الدواء</label>

<input
  id="medName"
  value="${esc(m.name || "")}"
  placeholder="اسم الدواء"
>
</div>

<div>
<label>الاسم العلمي</label>

<input
  id="medGeneric"
  value="${esc(m.generic_name || "")}"
  placeholder="الاسم العلمي"
>
</div>

<div>
<label>التركيز</label>

<input
  id="medStrength"
  value="${esc(m.strength || "")}"
  placeholder="مثال: 500 mg"
>
</div>

<div>
<label>الشكل الدوائي</label>

<input
  id="medForm"
  value="${esc(m.form || "")}"
  placeholder="أقراص / كبسولات / شراب"
>
</div>

<div>
<label>الحالة</label>

<select id="medActive">

<option value="true"
  ${m.active !== false ? "selected" : ""}>
  فعال
</option>

<option value="false"
  ${m.active === false ? "selected" : ""}>
  غير فعال
</option>

</select>
</div>

</div>

<div class="modal-actions">

<button
  class="primary"
  onclick="saveMedicine()"
>
  حفظ الدواء
</button>

</div>

`;
}

window.saveMedicine =
  async () => {

    const name =
      $("#medName")?.value?.trim() || "";

    const generic_name =
      $("#medGeneric")?.value?.trim() || "";

    const strength =
      $("#medStrength")?.value?.trim() || "";

    const form =
      $("#medForm")?.value?.trim() || "";

    const active =
      $("#medActive")?.value !== "false";

    if(!name){

      alert("اسم الدواء مطلوب.");

      return;
    }

    try{

      if(window._editingMedicine){

        await api(
          `/api/admin/medicines/${window._editingMedicine}`,
          {
            method:"PATCH",
            body:JSON.stringify({
              name,
              generic_name,
              strength,
              form,
              active
            })
          }
        );

      }else{

        await api(
          "/api/admin/medicines",
          {
            method:"POST",
            body:JSON.stringify({
              name,
              generic_name,
              strength,
              form,
              active
            })
          }
        );
      }

      closeModal();

      await loadMedicines();
      await loadStats();

    }catch(e){

      alert(e.message);

    }
  };

function renderMedicines(){

  const q =
    ($("#medicineSearch")?.value || "")
      .trim()
      .toLowerCase();

  const filter =
    $("#medicineFilter")?.value || "all";

  const list =
    medicines.filter(m => {

      if(
        filter === "active" &&
        m.active === false
      ){
        return false;
      }

      if(
        filter === "inactive" &&
        m.active !== false
      ){
        return false;
      }

      if(!q) return true;

      return [
        m.name,
        m.generic_name,
        m.strength,
        m.form
      ].some(v =>
        String(v || "")
          .toLowerCase()
          .includes(q)
      );

    });

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
<th>الإجراءات</th>
</tr>
</thead>

<tbody>

${list.map(m => `

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
  m.active !== false
    ? '<span class="pill approved">فعال</span>'
    : '<span class="pill suspended">غير فعال</span>'
}
</td>

<td>

<button
  class="act warn"
  onclick="editMedicine('${m.id}')"
>
تعديل
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

    window._editingMedicine = id;

    openModal(`
      <h3>تعديل الدواء</h3>
      ${medicineForm(m)}
    `);
  };

async function loadInventory(){

  inventory =
    await api(
      "/api/admin/inventory"
    );

  renderInventory();
  renderHomeInventory();
}

function renderInventory(){

  const q =
    ($("#inventorySearch")?.value || "")
      .trim()
      .toLowerCase();

  const filter =
    $("#inventoryFilter")?.value || "all";

  const list =
    inventory.filter(x => {

      if(
        filter !== "all" &&
        x.availability !== filter
      ){
        return false;
      }

      if(!q) return true;

      return [
        x.pharmacy_name,
        x.medicine_name,
        x.generic_name
      ].some(v =>
        String(v || "")
          .toLowerCase()
          .includes(q)
      );

    });

  if($("#inventorySummary")){

    $("#inventorySummary").textContent =
      `عرض ${list.length} من ${inventory.length} سجل`;

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
<th>التوفر</th>
<th>آخر تحديث</th>
</tr>
</thead>

<tbody>

${list.map(x => `

<tr>

<td>
<b>${esc(x.pharmacy_name || "-")}</b>
</td>

<td>
${esc(x.medicine_name || "-")}
<br>
<small>${esc(x.strength || "")}</small>
</td>

<td>
${esc(x.quantity ?? 0)}
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
لا توجد سجلات مخزون.
</div>
`;

}

function renderAccounts(){

  const q =
    ($("#accountSearch")?.value || "")
      .trim()
      .toLowerCase();

  const filter =
    $("#accountFilter")?.value || "all";

  const rows = [];

  pharmacies.forEach(p => {

    const list =
      p.pharmacy_accounts || [];

    list.forEach(a => {

      rows.push({
        ...a,
        pharmacy_name:p.name,
        pharmacy_status:p.status
      });

    });

  });

  const list =
    rows.filter(a => {

      if(
        filter === "active" &&
        !a.active
      ){
        return false;
      }

      if(
        filter === "inactive" &&
        a.active
      ){
        return false;
      }

      if(!q) return true;

      return [
        a.email,
        a.pharmacy_name
      ].some(v =>
        String(v || "")
          .toLowerCase()
          .includes(q)
      );

    });

  if($("#accountSummary")){

    $("#accountSummary").textContent =
      `عرض ${list.length} من ${rows.length} حساب`;

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
<th>البريد الإلكتروني</th>
<th>الحالة</th>
<th>حالة الصيدلية</th>
</tr>
</thead>

<tbody>

${list.map(a => `

<tr>

<td>
<b>${esc(a.pharmacy_name || "-")}</b>
</td>

<td>
${esc(a.email || "-")}
</td>

<td>
${accountPill(a.active)}
</td>

<td>
${statusPill(a.pharmacy_status)}
</td>

</tr>

`).join("")}

</tbody>

</table>
`
      : `
<div class="empty">
لا توجد حسابات.
</div>
`;

}

function renderHomePending(){

  if(!$("#homePending")){
    return;
  }

  const list =
    pharmacies
      .filter(p => p.status === "pending")
      .slice(0,5);

  $("#homePending").innerHTML =
    list.length
      ? list.map(p => `

<div class="mini-row">

<div>

<b>${esc(p.name)}</b>

<small>
${esc(p.phone || "بدون هاتف")}
</small>

</div>

<button
  class="act ok"
  onclick="setPharmacyStatus('${p.id}','approved')"
>
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

  if(!$("#homeInventory")){
    return;
  }

  const list =
    inventory
      .slice()
      .sort(
        (a,b) =>
          new Date(b.updated_at || 0) -
          new Date(a.updated_at || 0)
      )
      .slice(0,5);

  $("#homeInventory").innerHTML =
    list.length
      ? list.map(x => `

<div class="mini-row">

<div>

<b>
${esc(x.medicine_name || "-")}
</b>

<small>
${esc(x.pharmacy_name || "-")}
</small>

</div>

${inventoryPill(x.availability)}

</div>

`).join("")
      : `
<div class="empty">
لا توجد تحديثات مخزون.
</div>
`;

}

async function refreshAll(){

  try{

    await Promise.all([
      loadStats(),
      loadPharmacies(),
      loadMedicines(),
      loadInventory()
    ]);

  }catch(e){

    console.error(e);

    if(
      e.message &&
      /token|unauthorized|غير مصرح|جلسة/i.test(
        e.message
      )
    ){

      localStorage.removeItem(
        "dawai_admin_token"
      );

      token = null;

      location.reload();

      return;
    }

    alert(
      e.message ||
      "تعذر تحديث بيانات لوحة الإدارة."
    );

  }

}

function initAdmin(){

  /* التنقل */

  document.addEventListener(
    "click",
    function(event){

      const nav =
        event.target.closest(".nav");

      if(!nav) return;

      event.preventDefault();

      const view =
        nav.dataset.view;

      if(view){
        show(view);
      }

    }
  );


  $("#filter")?.addEventListener(
    "change",
    loadPharmacies
  );

  $("#pharmacySearch")?.addEventListener(
    "input",
    renderPharmacies
  );

  $("#medicineSearch")?.addEventListener(
    "input",
    renderMedicines
  );

  $("#medicineFilter")?.addEventListener(
    "change",
    renderMedicines
  );

  $("#inventorySearch")?.addEventListener(
    "input",
    renderInventory
  );

  $("#inventoryFilter")?.addEventListener(
    "change",
    renderInventory
  );

  $("#accountSearch")?.addEventListener(
    "input",
    renderAccounts
  );

  $("#accountFilter")?.addEventListener(
    "change",
    renderAccounts
  );

  $("#refresh")?.addEventListener(
    "click",
    refreshAll
  );

  $("#refreshPh")?.addEventListener(
    "click",
    loadPharmacies
  );

  $("#refreshInv")?.addEventListener(
    "click",
    loadInventory
  );

  $("#refreshAccounts")?.addEventListener(
    "click",
    renderAccounts
  );

  $("#close")?.addEventListener(
    "click",
    closeModal
  );

  $("#modal")?.addEventListener(
    "click",
    function(e){

      if(e.target.id === "modal"){
        closeModal();
      }

    }
  );

  $("#logout")?.addEventListener(
    "click",
    function(){

      localStorage.removeItem(
        "dawai_admin_token"
      );

      token = null;

      location.reload();

    }
  );


  $("#addMedicine")?.addEventListener(
    "click",
    function(){

      window._editingMedicine = null;

      openModal(`
        <h3>إضافة دواء جديد</h3>
        ${medicineForm()}
      `);

    }
  );


  /* تسجيل دخول الإدارة */

  const loginForm =
    document.querySelector("#loginForm");

  if(loginForm){

    loginForm.addEventListener(
      "submit",
      async function(e){

        e.preventDefault();

        const loginMsg =
          document.querySelector("#loginMsg");

        const loginButton =
          loginForm.querySelector(
            'button[type="submit"]'
          );

        const username =
          document.querySelector(
            "#username"
          )?.value?.trim() || "";

        const password =
          document.querySelector(
            "#password"
          )?.value || "";

        if(loginMsg){
          loginMsg.textContent =
            "جاري التحقق...";
        }

        if(loginButton){

          loginButton.disabled = true;

          loginButton.dataset.oldText =
            loginButton.textContent;

          loginButton.textContent =
            "جاري الدخول...";

        }

        try{

          const d =
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

          token = d.token;

          localStorage.setItem(
            "dawai_admin_token",
            token
          );

          $("#login")?.classList.add(
            "hidden"
          );

          $("#app")?.classList.remove(
            "hidden"
          );

          if($("#adminName")){
            $("#adminName").textContent =
              d.username || username;
          }

          if(loginMsg){
            loginMsg.textContent = "";
          }

          await refreshAll();

        }catch(err){

          console.error(
            "Admin login error:",
            err
          );

          if(loginMsg){

            loginMsg.textContent =
              err.message ||
              "فشل تسجيل الدخول.";

          }else{

            alert(
              err.message ||
              "فشل تسجيل الدخول."
            );

          }

        }finally{

          if(loginButton){

            loginButton.disabled = false;

            loginButton.textContent =
              loginButton.dataset.oldText ||
              "دخول لوحة التحكم";

          }

        }

      }
    );

  }else{

    console.error(
      "لم يتم العثور على #loginForm بعد تحميل الصفحة."
    );

  }


  /* استعادة جلسة الإدارة */

  if(token){

    (async function(){

      try{

        const d =
          await api(
            "/api/admin/me"
          );

        $("#login")?.classList.add(
          "hidden"
        );

        $("#app")?.classList.remove(
          "hidden"
        );

        if($("#adminName")){

          $("#adminName").textContent =
            d.username || "admin";

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

  }

}

if(
  document.readyState === "loading"
){

  document.addEventListener(
    "DOMContentLoaded",
    initAdmin,
    {once:true}
  );

}else{

  initAdmin();

}
