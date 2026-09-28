const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_THIS_SECRET_BEFORE_PRODUCTION";

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = url && key
  ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

function requireDB(res) {
  if (!supabase) {
    res.status(503).json({ error: "قاعدة البيانات غير مهيأة. أضف إعدادات Supabase في Render." });
    return false;
  }
  return true;
}

function signPharmacyToken(account) {
  return jwt.sign(
    { sub: account.id, pharmacy_id: account.pharmacy_id, role: "pharmacy" },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function requirePharmacy(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "تسجيل الدخول مطلوب." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "pharmacy" || !payload.pharmacy_id) throw new Error("invalid");
    req.pharmacy = payload;
    next();
  } catch {
    return res.status(401).json({ error: "جلسة الدخول غير صالحة أو منتهية." });
  }
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    database: supabase ? "supabase" : "not_configured",
    app: "dawai-alobied",
    pharmacyPortal: true
  });
});

app.get("/api/pharmacies", async (req, res) => {
  if (!requireDB(res)) return;
  const { data, error } = await supabase
    .from("pharmacies")
    .select("*")
    .eq("status", "approved")
    .order("name");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get("/api/medicines/search", async (req, res) => {
  if (!requireDB(res)) return;
  const q = String(req.query.q || "").trim();
  if (!q) return res.json([]);

  const { data, error } = await supabase
    .from("pharmacy_inventory")
    .select(`
      id, quantity, availability, updated_at,
      pharmacies!inner(id,name,phone,address,latitude,longitude,status),
      medicines!inner(id,name,generic_name,strength,form,active)
    `)
    .in("availability", ["available", "limited"])
    .eq("pharmacies.status", "approved")
    .eq("medicines.active", true)
    .or(`name.ilike.%${q}%,generic_name.ilike.%${q}%`, { foreignTable: "medicines" });

  if (error) return res.status(500).json({ error: error.message });

  res.json((data || []).map(x => ({
    inventoryId: x.id,
    quantity: x.quantity,
    availability: x.availability,
    updatedAt: x.updated_at,
    pharmacy: x.pharmacies,
    medicine: x.medicines
  })));
});

app.get("/api/medicines", async (req, res) => {
  if (!requireDB(res)) return;
  const { data, error } = await supabase
    .from("medicines")
    .select("*")
    .eq("active", true)
    .order("name")
    .limit(500);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get("/api/pharmacies/:id", async (req, res) => {
  if (!requireDB(res)) return;
  const { data, error } = await supabase
    .from("pharmacies")
    .select("*")
    .eq("id", req.params.id)
    .single();
  if (error) return res.status(404).json({ error: "الصيدلية غير موجودة." });
  res.json(data);
});

/* Pharmacy registration */
app.post("/api/pharmacy/register", async (req, res) => {
  if (!requireDB(res)) return;

  const { name, phone, email, password, address, latitude, longitude, delivery } = req.body || {};
  if (!name || !phone || !email || !password) {
    return res.status(400).json({ error: "الاسم والهاتف والبريد وكلمة المرور مطلوبة." });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const { data: existing } = await supabase
    .from("pharmacy_accounts")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existing) return res.status(409).json({ error: "هذا البريد مستخدم بالفعل." });

  const password_hash = await bcrypt.hash(password, 12);

  const { data: pharmacy, error: pharmacyError } = await supabase
    .from("pharmacies")
    .insert({
      name: String(name).trim(),
      phone: String(phone).trim(),
      address: address ? String(address).trim() : null,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      delivery: Boolean(delivery),
      status: "pending"
    })
    .select()
    .single();

  if (pharmacyError) return res.status(500).json({ error: pharmacyError.message });

  const { error: accountError } = await supabase
    .from("pharmacy_accounts")
    .insert({
      pharmacy_id: pharmacy.id,
      email: normalizedEmail,
      password_hash,
      active: true
    });

  if (accountError) {
    await supabase.from("pharmacies").delete().eq("id", pharmacy.id);
    return res.status(500).json({ error: accountError.message });
  }

  res.status(201).json({
    ok: true,
    message: "تم إرسال طلب التسجيل. بعد اعتماد الصيدلية من الإدارة يمكن تسجيل الدخول."
  });
});

/* Pharmacy login */
app.post("/api/pharmacy/login", async (req, res) => {
  if (!requireDB(res)) return;

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "البريد وكلمة المرور مطلوبان." });

  const { data: account, error } = await supabase
    .from("pharmacy_accounts")
    .select("id,email,password_hash,active,pharmacy_id,pharmacies!inner(id,name,status)")
    .eq("email", String(email).trim().toLowerCase())
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!account || !account.active) return res.status(401).json({ error: "بيانات الدخول غير صحيحة." });

  const ok = await bcrypt.compare(password, account.password_hash);
  if (!ok) return res.status(401).json({ error: "بيانات الدخول غير صحيحة." });

  if (account.pharmacies.status !== "approved") {
    return res.status(403).json({
      error: "الحساب موجود، لكن الصيدلية لم تعتمد من الإدارة بعد.",
      status: account.pharmacies.status
    });
  }

  res.json({
    token: signPharmacyToken(account),
    pharmacy: account.pharmacies
  });
});

app.get("/api/pharmacy/me", requirePharmacy, async (req, res) => {
  if (!requireDB(res)) return;

  const { data, error } = await supabase
    .from("pharmacies")
    .select("*")
    .eq("id", req.pharmacy.pharmacy_id)
    .single();

  if (error) return res.status(404).json({ error: "بيانات الصيدلية غير موجودة." });
  res.json(data);
});

app.get("/api/pharmacy/inventory", requirePharmacy, async (req, res) => {
  if (!requireDB(res)) return;

  const { data, error } = await supabase
    .from("pharmacy_inventory")
    .select(`
      id, quantity, availability, updated_at,
      medicines!inner(id,name,generic_name,strength,form,active)
    `)
    .eq("pharmacy_id", req.pharmacy.pharmacy_id)
    .order("updated_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.put("/api/pharmacy/inventory/:id", requirePharmacy, async (req, res) => {
  if (!requireDB(res)) return;

  const { quantity, availability } = req.body || {};
  const allowed = ["available", "limited", "unavailable"];
  if (!allowed.includes(availability)) {
    return res.status(400).json({ error: "حالة التوفر غير صحيحة." });
  }

  const qty = Math.max(0, Number(quantity || 0));

  const { data, error } = await supabase
    .from("pharmacy_inventory")
    .update({ quantity: qty, availability, updated_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .eq("pharmacy_id", req.pharmacy.pharmacy_id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "السجل غير موجود." });

  res.json({ ok: true, item: data });
});

app.post("/api/pharmacy/inventory", requirePharmacy, async (req, res) => {
  if (!requireDB(res)) return;

  const { medicine_id, quantity, availability } = req.body || {};
  if (!medicine_id) return res.status(400).json({ error: "اختر الدواء." });

  const allowed = ["available", "limited", "unavailable"];
  const av = allowed.includes(availability) ? availability : "available";

  const { data, error } = await supabase
    .from("pharmacy_inventory")
    .upsert({
      pharmacy_id: req.pharmacy.pharmacy_id,
      medicine_id,
      quantity: Math.max(0, Number(quantity || 0)),
      availability: av,
      updated_at: new Date().toISOString()
    }, { onConflict: "pharmacy_id,medicine_id" })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Dawai Alobied running on port ${PORT}`));
