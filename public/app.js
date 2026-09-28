const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function renderResults(term,rows){
 const list=$("#resultsList"),empty=$("#resultsEmpty");
 $("#resultsTitle").textContent=term?`نتائج البحث عن: ${term}`:"الصيدليات التي يتوفر فيها الدواء";
 list.innerHTML="";
 if(!term||!rows.length){
  empty.style.display="block";
  empty.innerHTML=term?`<div>🔎</div><h3>لم نجد الدواء حاليًا</h3><p>جرّب اسمًا آخر أو تأكد من الاسم.</p>`:
  `<div>💊</div><h3>ابدأ بالبحث عن دواء</h3><p>ستظهر هنا الصيدليات التي أعلنت توفر الدواء.</p>`;
  return;
 }
 empty.style.display="none";
 list.innerHTML=rows.map(x=>{
  const p=x.pharmacy||{},m=x.medicine||{};
  const av=x.availability==="limited"?"متوفر بكمية محدودة":"متوفر";
  const updated=x.updatedAt?new Date(x.updatedAt).toLocaleString("ar-SD",{dateStyle:"short",timeStyle:"short"}):"غير محدد";
  const map=p.latitude&&p.longitude?`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`:"#";
  return `<article class="pharmacy-card"><div class="pharmacy-main">
  <div class="pharmacy-logo">🏪</div><div><h3>${esc(p.name)}</h3>
  <span class="availability">● ${esc(av)}</span>
  <div class="pharmacy-meta">💊 ${esc(m.name||"الدواء")}<br>📍 ${esc(p.address||"مدينة الأبيض")}<br>🕒 آخر تحديث: ${esc(updated)}</div>
  </div></div><div class="pharmacy-actions">
  ${p.phone?`<a class="action-btn primary" href="tel:${esc(p.phone)}">📞 اتصال</a>`:""}
  ${p.latitude&&p.longitude?`<a class="action-btn" target="_blank" rel="noopener" href="${map}">🗺️ الخريطة</a>`:""}
  </div></article>`;
 }).join("");
}

async function searchMedicine(term){
 const q=term.trim();
 if(!q){renderResults("",[]);return;}
 $("#resultsEmpty").style.display="block";
 $("#resultsEmpty").innerHTML=`<div>⏳</div><h3>جاري البحث...</h3><p>نبحث في الصيدليات المسجلة.</p>`;
 try{
  const r=await fetch(`/api/medicines/search?q=${encodeURIComponent(q)}`);
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||"تعذر الاتصال بقاعدة البيانات");
  renderResults(q,data);
 }catch(e){
  $("#resultsEmpty").innerHTML=`<div>⚠️</div><h3>قاعدة البيانات غير متصلة</h3><p>${esc(e.message)}</p>`;
 }
}

$("#searchForm").addEventListener("submit",e=>{
 e.preventDefault();searchMedicine($("#medicineInput").value);
 $("#resultsSection").scrollIntoView({behavior:"smooth"});
});
$("#clearBtn").addEventListener("click",()=>{$("#medicineInput").value="";renderResults("",[])});
$("#prescriptionBtn").addEventListener("click",()=>showModal(`<h3>📷 تصوير الروشتة</h3><p>تم تجهيز الواجهة. سنضيف تحليل الروشتة في المرحلة التالية.</p><button class="full-btn" onclick="closeModal()">حسنًا</button>`));
$("#mapBtn").addEventListener("click",()=>showModal(`<h3>🗺️ خريطة الصيدليات</h3><p>سيتم عرض الصيدليات وإحداثياتها على الخريطة في المرحلة التالية.</p><button class="full-btn" onclick="closeModal()">حسنًا</button>`));
$("#locationBtn").addEventListener("click",()=>navigator.geolocation?navigator.geolocation.getCurrentPosition(
()=>showModal(`<h3>📍 تم تحديد موقعك</h3><p>سنستخدم الموقع لاحقًا لحساب أقرب الصيدليات.</p><button class="full-btn" onclick="closeModal()">حسنًا</button>`),
()=>showModal(`<h3>📍 لم يتم تحديد الموقع</h3><p>اسمح للتطبيق باستخدام الموقع.</p><button class="full-btn" onclick="closeModal()">حسنًا</button>`)
):showModal(`<h3>📍 الموقع</h3><p>المتصفح لا يدعم تحديد الموقع.</p><button class="full-btn" onclick="closeModal()">حسنًا</button>`));

$$(".quick-card").forEach(b=>b.addEventListener("click",()=>{
 if(b.dataset.action==="search"){$("#medicineInput").focus();$("#resultsSection").scrollIntoView({behavior:"smooth"})}
 if(b.dataset.action==="prescription")$("#prescriptionBtn").click();
 if(b.dataset.action==="nearby")$("#mapBtn").click();
 if(b.dataset.action==="pharmacy")showModal(`<h3>🏪 تسجيل صيدلية</h3><p>سيتم إنشاء حساب الصيدلية وربط المخزون في المرحلة القادمة.</p><button class="full-btn" onclick="closeModal()">حسنًا</button>`);
}));

$$(".bottom-nav button").forEach(b=>b.addEventListener("click",()=>{
 $$(".bottom-nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");
 if(b.dataset.nav==="home")scrollTo({top:0,behavior:"smooth"});
 if(b.dataset.nav==="search")$("#medicineInput").focus();
 if(b.dataset.nav==="map")$("#mapBtn").click();
 if(b.dataset.nav==="account")showModal(`<h3>👤 حسابي</h3><p>حساب المستخدم سيضاف في المرحلة التالية.</p><button class="full-btn" onclick="closeModal()">حسنًا</button>`);
}));

function showModal(html){$("#modalContent").innerHTML=html;$("#modal").classList.add("show")}
function closeModal(){$("#modal").classList.remove("show")}
window.closeModal=closeModal;
$("#modalClose").addEventListener("click",closeModal);
$("#modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});
renderResults("",[]);
