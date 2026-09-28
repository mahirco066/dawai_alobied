# دوائي الأبيض — النسخة الثالثة

تمت إضافة بوابة الصيدلية.

## الجديد
- تسجيل صيدلية جديدة.
- تسجيل دخول الصيدلية.
- حالة الصيدلية pending/approved/suspended.
- لوحة صيدلية.
- عرض مخزون الأدوية.
- تحديث الكمية وحالة التوفر.
- API محمي بجلسة JWT.
- تخزين كلمات المرور بشكل مشفر bcrypt.

## الإعداد
1. نفّذ `supabase_schema.sql` ثم `pharmacy_schema.sql` في Supabase.
2. في Render أضف:
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   JWT_SECRET
3. Build Command: `npm install`
4. Start Command: `npm start`

## صفحات مهمة
- الموقع العام: `/`
- بوابة الصيدلية: `/pharmacy.html`

مهم: لا تضع service_role key داخل public، ولا تستخدم JWT_SECRET الافتراضي في الإنتاج.
