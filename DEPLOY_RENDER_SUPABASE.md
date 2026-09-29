# نشر دوائي الأبيض على Supabase + Render

## 1) Supabase
1. افتح مشروع Supabase.
2. افتح SQL Editor.
3. نفّذ محتوى `supabase_schema.sql` بالكامل.
4. ثم نفّذ محتوى `pharmacy_schema.sql` بالكامل.
5. من Project Settings > API انسخ:
   - Project URL
   - `service_role` key (احتفظ به سريًا ولا تضعه داخل ملفات `public`).

## 2) Render
أنشئ Web Service من مستودع GitHub لهذا المشروع.
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

أضف Environment Variables:
- `SUPABASE_URL` = Project URL
- `SUPABASE_SERVICE_ROLE_KEY` = service_role key
- `JWT_SECRET` = قيمة سرية طويلة عشوائية
- `ADMIN_USERNAME` = اسم مستخدم الإدارة
- `ADMIN_PASSWORD` = كلمة مرور قوية

## 3) بعد Deploy
افتح `/api/health` ويجب أن يظهر:
`"database":"supabase"`

ثم افتح `/admin.html` وسجل دخول الإدارة.

## ملاحظة
لا تضع `SUPABASE_SERVICE_ROLE_KEY` في أي ملف JavaScript داخل `public` ولا ترسلها لأي شخص.
