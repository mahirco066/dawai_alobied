const $=s=>document.querySelector(s);
let token=localStorage.getItem("dawai_pharmacy_token");

function msg(el,text){$(el).textContent=text||""}

function show(id){
 ["loginView","registerView","dashboardView"].forEach(x=>$("#"+x).classList.add("hidden"));
 $("#"+id).classList.remove("hidden");
}

async function api(url,opts={}){
 opts.headers={...(opts.headers||{}),"Content-Type":"application/json"};
 if(token)opts.headers.Authorization="Bearer "+token;
 const r=await fetch(url,opts);
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(d.error||"حدث خطأ");
 return d;
}

async function loadDashboard(){
 try{
  const p=await api("/api/pharmacy/me");
  $("#pharmacyName").textContent=p.name;
  const rows=await api("/api/pharmacy/inventory");
  $("#totalCount").textContent=rows.length;
  $("#availableCount").textContent=rows.filter(x=>x.availability==="available").length;
  $("#limitedCount").textContent=rows.filter(x=>x.availability==="limited").length;
  $("#inventoryList").innerHTML=rows.length?rows.map(x=>{
    const m=x.medicines||{};
    return `<div class="inventory">
      <div><div class="medicine-name">${esc(m.name||"دواء")}</div>
      <div class="medicine-meta">${esc(m.generic_name||"")} ${esc(m.strength||"")}</div></div>
      <div class="status-row">
        <input class="qty" type="number" min="0" value="${Number(x.quantity||0)}" id="q_${x.id}">
        <select class="status-select" id="s_${x.id}">
          <option value="available" ${x.availability==="available"?"selected":""}>متوفر</option>
          <option value="limited" ${x.availability==="limited"?"selected":""}>كمية محدودة</option>
          <option value="unavailable" ${x.availability==="unavailable"?"selected":""}>غير متوفر</option>
        </select>
        <button class="save" onclick="saveItem('${x.id}')">حفظ</button>
      </div>
    </div>`;
  }).join(""):"<p>لا توجد أدوية مسجلة للصيدلية بعد.</p>";
 }catch(e){
  localStorage.removeItem("dawai_pharmacy_token");token=null;show("loginView");msg("#loginMsg",e.message);
 }
}

window.saveItem=async id=>{
 try{
  await api("/api/pharmacy/inventory/"+id,{method:"PUT",body:JSON.stringify({
   quantity:Number($("#q_"+id).value||0),availability:$("#s_"+id).value
  })});
  await loadDashboard();
 }catch(e){alert(e.message)}
};

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

$("#loginForm").addEventListener("submit",async e=>{
 e.preventDefault();msg("#loginMsg","جاري الدخول...");
 try{
  const d=await api("/api/pharmacy/login",{method:"POST",body:JSON.stringify({email:$("#email").value,password:$("#password").value})});
  token=d.token;localStorage.setItem("dawai_pharmacy_token",token);show("dashboardView");loadDashboard();
 }catch(err){msg("#loginMsg",err.message)}
});

$("#registerForm").addEventListener("submit",async e=>{
 e.preventDefault();msg("#registerMsg","جاري إرسال الطلب...");
 try{
  const d=await api("/api/pharmacy/register",{method:"POST",body:JSON.stringify({
   name:$("#rName").value,phone:$("#rPhone").value,email:$("#rEmail").value,
   password:$("#rPassword").value,address:$("#rAddress").value,delivery:$("#rDelivery").checked
  })});
  msg("#registerMsg",d.message);e.target.reset();
 }catch(err){msg("#registerMsg",err.message)}
});

$("#showRegister").onclick=()=>show("registerView");
$("#showLogin").onclick=()=>show("loginView");
$("#refreshBtn").onclick=loadDashboard;
$("#logoutBtn").onclick=()=>{localStorage.removeItem("dawai_pharmacy_token");token=null;show("loginView")};

if(token){show("dashboardView");loadDashboard()}else show("loginView");
