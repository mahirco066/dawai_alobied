const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 10000;

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "CHANGE_THIS_SECRET_BEFORE_PRODUCTION";

app.use(cors());

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

const DATABASE_URL =
  process.env.DATABASE_URL || "";

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    })
  : null;


/* =========================================================
   أدوات قاعدة البيانات
========================================================= */

function requireDB(res) {
  if (!pool) {
    res.status(503).json({
      error:
        "قاعدة البيانات غير مهيأة. أضف DATABASE_URL في Render."
    });

    return false;
  }

  return true;
}


async function dbQuery(
  sql,
  params = []
) {
  return pool.query(sql, params);
}


/* =========================================================
   الصحة
========================================================= */

app.get(
  "/api/health",
  async (req, res) => {
    if (!pool) {
      return res.json({
        ok: true,
        database: "not_configured",
        app: "dawai-alobied",
        pharmacyPortal: true
      });
    }

    try {
      await dbQuery("SELECT 1");

      res.json({
        ok: true,
        database: "neon",
        app: "dawai-alobied",
        pharmacyPortal: true
      });

    } catch (error) {

      res.status(503).json({
        ok: false,
        database: "neon_error",
        error: error.message
      });
    }
  }
);


/* =========================================================
   أدوات دخول الصيدلية
========================================================= */

function signPharmacyToken(
  account
) {
  return jwt.sign(
    {
      sub: account.id,
      pharmacy_id:
        account.pharmacy_id,
      role: "pharmacy"
    },
    JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
}


function requirePharmacy(
  req,
  res,
  next
) {
  const header =
    req.headers.authorization || "";

  const token =
    header.startsWith("Bearer ")
      ? header.slice(7)
      : "";

  if (!token) {
    return res.status(401).json({
      error:
        "تسجيل الدخول مطلوب."
    });
  }

  try {

    const payload =
      jwt.verify(
        token,
        JWT_SECRET
      );

    if (
      payload.role !==
        "pharmacy" ||
      !payload.pharmacy_id
    ) {
      throw new Error(
        "invalid"
      );
    }

    req.pharmacy =
      payload;

    next();

  } catch {

    return res.status(401).json({
      error:
        "جلسة الدخول غير صالحة أو منتهية."
    });
  }
}


/* =========================================================
   البحث العام
========================================================= */

app.get(
  "/api/pharmacies",
  async (req, res) => {

    if (!requireDB(res))
      return;

    try {

      const { rows } =
        await dbQuery(`
          SELECT *
          FROM pharmacies
          WHERE status = 'approved'
          ORDER BY name
        `);

      res.json(rows);

    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


app.get(
  "/api/medicines/search",
  async (req, res) => {

    if (!requireDB(res))
      return;

    const q =
      String(
        req.query.q || ""
      ).trim();

    if (!q)
      return res.json([]);

    try {

      const pattern =
        `%${q}%`;

      const { rows } =
        await dbQuery(
          `
          SELECT
            pi.id AS inventory_id,
            pi.quantity,
            pi.availability,
            pi.updated_at,

            p.id AS pharmacy_id,
            p.name AS pharmacy_name,
            p.phone AS pharmacy_phone,
            p.address AS pharmacy_address,
            p.latitude AS pharmacy_latitude,
            p.longitude AS pharmacy_longitude,
            p.status AS pharmacy_status,

            m.id AS medicine_id,
            m.name AS medicine_name,
            m.generic_name,
            m.strength,
            m.form,
            m.active

          FROM pharmacy_inventory pi

          JOIN pharmacies p
            ON p.id = pi.pharmacy_id

          JOIN medicines m
            ON m.id = pi.medicine_id

          WHERE pi.availability IN
            ('available', 'limited')

            AND p.status = 'approved'

            AND m.active = true

            AND (
              m.name ILIKE $1

              OR COALESCE(
                m.generic_name,
                ''
              ) ILIKE $1
            )

          ORDER BY
            m.name,
            p.name
          `,
          [pattern]
        );

      res.json(
        rows.map(
          (x) => ({
            inventoryId:
              x.inventory_id,

            quantity:
              x.quantity,

            availability:
              x.availability,

            updatedAt:
              x.updated_at,

            pharmacy: {
              id:
                x.pharmacy_id,

              name:
                x.pharmacy_name,

              phone:
                x.pharmacy_phone,

              address:
                x.pharmacy_address,

              latitude:
                x.pharmacy_latitude,

              longitude:
                x.pharmacy_longitude,

              status:
                x.pharmacy_status
            },

            medicine: {
              id:
                x.medicine_id,

              name:
                x.medicine_name,

              generic_name:
                x.generic_name,

              strength:
                x.strength,

              form:
                x.form,

              active:
                x.active
            }
          })
        )
      );

    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


app.get(
  "/api/medicines",
  async (req, res) => {

    if (!requireDB(res))
      return;

    try {

      const { rows } =
        await dbQuery(`
          SELECT *
          FROM medicines
          WHERE active = true
          ORDER BY name
          LIMIT 500
        `);

      res.json(rows);

    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


app.get(
  "/api/pharmacies/:id",
  async (req, res) => {

    if (!requireDB(res))
      return;

    try {

      const { rows } =
        await dbQuery(
          `
          SELECT *
          FROM pharmacies
          WHERE id = $1
          LIMIT 1
          `,
          [req.params.id]
        );

      if (!rows[0]) {

        return res.status(404).json({
          error:
            "الصيدلية غير موجودة."
        });
      }

      res.json(
        rows[0]
      );

    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* =========================================================
   تسجيل الصيدلية
========================================================= */

app.post(
  "/api/pharmacy/register",
  async (req, res) => {

    if (!requireDB(res))
      return;

    const {
      name,
      phone,
      email,
      password,
      address,
      latitude,
      longitude,
      delivery
    } = req.body || {};

    if (
      !name ||
      !phone ||
      !email ||
      !password
    ) {

      return res.status(400).json({
        error:
          "الاسم والهاتف والبريد وكلمة المرور مطلوبة."
      });
    }

    if (
      String(password).length <
      8
    ) {

      return res.status(400).json({
        error:
          "كلمة المرور يجب أن تكون 8 أحرف على الأقل."
      });
    }

    const normalizedEmail =
      String(email)
        .trim()
        .toLowerCase();

    try {

      const existing =
        await dbQuery(
          `
          SELECT id
          FROM pharmacy_accounts
          WHERE email = $1
          LIMIT 1
          `,
          [normalizedEmail]
        );

      if (existing.rows[0]) {

        return res.status(409).json({
          error:
            "هذا البريد مستخدم بالفعل."
        });
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      const client =
        await pool.connect();

      try {

        await client.query(
          "BEGIN"
        );

        const pharmacyResult =
          await client.query(
            `
            INSERT INTO pharmacies
            (
              name,
              phone,
              address,
              latitude,
              longitude,
              delivery,
              status
            )

            VALUES
            (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              'pending'
            )

            RETURNING *
            `,
            [
              String(name)
                .trim(),

              String(phone)
                .trim(),

              address
                ? String(
                    address
                  ).trim()
                : null,

              latitude !==
                undefined &&
              latitude !== ""
                ? Number(
                    latitude
                  )
                : null,

              longitude !==
                undefined &&
              longitude !== ""
                ? Number(
                    longitude
                  )
                : null,

              Boolean(
                delivery
              )
            ]
          );

        const pharmacy =
          pharmacyResult
            .rows[0];

        await client.query(
          `
          INSERT INTO pharmacy_accounts
          (
            pharmacy_id,
            email,
            password_hash,
            active
          )

          VALUES
          (
            $1,
            $2,
            $3,
            true
          )
          `,
          [
            pharmacy.id,
            normalizedEmail,
            passwordHash
          ]
        );

        await client.query(
          "COMMIT"
        );

        res.status(201).json({
          ok: true,

          message:
            "تم إرسال طلب التسجيل. بعد اعتماد الصيدلية من الإدارة يمكن تسجيل الدخول."
        });

      } catch (error) {

        await client.query(
          "ROLLBACK"
        );

        res.status(500).json({
          error:
            error.message
        });

      } finally {

        client.release();
      }

    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* =========================================================
   دخول الصيدلية
========================================================= */

app.post(
  "/api/pharmacy/login",
  async (req, res) => {

    if (!requireDB(res))
      return;

    const {
      email,
      password
    } = req.body || {};

    if (
      !email ||
      !password
    ) {

      return res.status(400).json({
        error:
          "البريد وكلمة المرور مطلوبان."
      });
    }

    try {

      const { rows } =
        await dbQuery(
          `
          SELECT
            a.id,
            a.email,
            a.password_hash,
            a.active,
            a.pharmacy_id,

            p.id AS p_id,
            p.name AS p_name,
            p.status AS p_status

          FROM pharmacy_accounts a

          JOIN pharmacies p
            ON p.id = a.pharmacy_id

          WHERE a.email = $1

          LIMIT 1
          `,
          [
            String(email)
              .trim()
              .toLowerCase()
          ]
        );

      const account =
        rows[0];

      if (
        !account ||
        !account.active
      ) {

        return res.status(401).json({
          error:
            "بيانات الدخول غير صحيحة."
        });
      }

      const passwordOK =
        await bcrypt.compare(
          password,
          account.password_hash
        );

      if (!passwordOK) {

        return res.status(401).json({
          error:
            "بيانات الدخول غير صحيحة."
        });
      }

      if (
        account.p_status !==
        "approved"
      ) {

        return res.status(403).json({
          error:
            "الحساب موجود، لكن الصيدلية لم تعتمد من الإدارة بعد.",

          status:
            account.p_status
        });
      }

      res.json({
        token:
          signPharmacyToken(
            account
          ),

        pharmacy: {
          id:
            account.p_id,

          name:
            account.p_name,

          status:
            account.p_status
        }
      });

    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* =========================================================
   حساب الصيدلية
========================================================= */

app.get(
  "/api/pharmacy/me",
  requirePharmacy,
  async (req, res) => {

    if (!requireDB(res))
      return;

    try {

      const { rows } =
        await dbQuery(
          `
          SELECT *
          FROM pharmacies
          WHERE id = $1
          LIMIT 1
          `,
          [
            req.pharmacy
              .pharmacy_id
          ]
        );

      if (!rows[0]) {

        return res.status(404).json({
          error:
            "بيانات الصيدلية غير موجودة."
        });
      }

      res.json(
        rows[0]
      );

    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* =========================================================
   مخزون الصيدلية
========================================================= */

/*
  يعرض جميع الأدوية النشطة.

  إذا لم يكن للدواء سجل في مخزون الصيدلية،
  يظهر تلقائيًا بكمية 0 وحالة "غير متوفر".
*/

app.get(
  "/api/pharmacy/inventory",
  requirePharmacy,
  async (req, res) => {

    if (!requireDB(res))
      return;

    try {

      const { rows } =
        await dbQuery(
          `
          SELECT

            pi.id,

            COALESCE(
              pi.quantity,
              0
            ) AS quantity,

            COALESCE(
              pi.availability,
              'unavailable'
            ) AS availability,

            pi.updated_at,

            m.id AS medicine_id,
            m.name AS medicine_name,
            m.generic_name,
            m.strength,
            m.form,
            m.active

          FROM medicines m

          LEFT JOIN pharmacy_inventory pi

            ON pi.medicine_id =
              m.id

            AND pi.pharmacy_id =
              $1

          WHERE
            m.active = true

          ORDER BY
            m.name ASC
          `,
          [
            req.pharmacy
              .pharmacy_id
          ]
        );

      res.json(
        rows.map(
          (x) => ({
            id:
              x.id,

            medicine_id:
              x.medicine_id,

            quantity:
              Number(
                x.quantity || 0
              ),

            availability:
              x.availability ||
              "unavailable",

            updated_at:
              x.updated_at,

            medicines: {
              id:
                x.medicine_id,

              name:
                x.medicine_name,

              generic_name:
                x.generic_name,

              strength:
                x.strength,

              form:
                x.form,

              active:
                x.active
            }
          })
        )
      );

    } catch (error) {

      console.error(
        "GET pharmacy inventory error:",
        error
      );

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/*
  حفظ مخزون دواء.

  نستخدم medicine_id بدل inventory id.

  إذا لم يوجد سجل:
    يتم إنشاؤه.

  إذا كان موجودًا:
    يتم تحديثه.
*/

app.put(
  "/api/pharmacy/inventory/:medicine_id",
  requirePharmacy,
  async (req, res) => {

    if (!requireDB(res))
      return;

    const {
      quantity,
      availability
    } = req.body || {};

    const allowed = [
      "available",
      "limited",
      "unavailable"
    ];

    if (
      !allowed.includes(
        availability
      )
    ) {

      return res.status(400).json({
        error:
          "حالة التوفر غير صحيحة."
      });
    }

    const medicineId =
      String(
        req.params
          .medicine_id || ""
      ).trim();

    if (!medicineId) {

      return res.status(400).json({
        error:
          "معرف الدواء مطلوب."
      });
    }

    const numericQuantity =
      Number(quantity);

    const safeQuantity =
      Math.max(
        0,
        Number.isFinite(
          numericQuantity
        )
          ? numericQuantity
          : 0
      );

    try {

      /* التأكد من وجود الدواء */

      const medicineResult =
        await dbQuery(
          `
          SELECT id
          FROM medicines
          WHERE id = $1
            AND active = true
          LIMIT 1
          `,
          [medicineId]
        );

      if (
        !medicineResult.rows[0]
      ) {

        return res.status(404).json({
          error:
            "الدواء غير موجود أو غير نشط."
        });
      }


      /* إضافة أو تحديث المخزون */

      const { rows } =
        await dbQuery(
          `
          INSERT INTO pharmacy_inventory
          (
            pharmacy_id,
            medicine_id,
            quantity,
            availability,
            updated_at
          )

          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            NOW()
          )

          ON CONFLICT
          (
            pharmacy_id,
            medicine_id
          )

          DO UPDATE SET

            quantity =
              EXCLUDED.quantity,

            availability =
              EXCLUDED.availability,

            updated_at =
              NOW()

          RETURNING *
          `,
          [
            req.pharmacy
              .pharmacy_id,

            medicineId,

            safeQuantity,

            availability
          ]
        );

      res.json({
        ok: true,
        item:
          rows[0]
      });

    } catch (error) {

      console.error(
        "PUT pharmacy inventory error:",
        error
      );

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/*
  إضافة دواء إلى مخزون الصيدلية.
*/

app.post(
  "/api/pharmacy/inventory",
  requirePharmacy,
  async (req, res) => {

    if (!requireDB(res))
      return;

    const {
      medicine_id,
      quantity,
      availability
    } = req.body || {};

    if (!medicine_id) {

      return res.status(400).json({
        error:
          "اختر الدواء."
      });
    }

    const allowed = [
      "available",
      "limited",
      "unavailable"
    ];

    const av =
      allowed.includes(
        availability
      )
        ? availability
        : "unavailable";

    const numericQuantity =
      Number(quantity);

    const safeQuantity =
      Math.max(
        0,
        Number.isFinite(
          numericQuantity
        )
          ? numericQuantity
          : 0
      );

    try {

      const medicineResult =
        await dbQuery(
          `
          SELECT id
          FROM medicines
          WHERE id = $1
            AND active = true
          LIMIT 1
          `,
          [medicine_id]
        );

      if (
        !medicineResult.rows[0]
      ) {

        return res.status(404).json({
          error:
            "الدواء غير موجود أو غير نشط."
        });
      }

      const { rows } =
        await dbQuery(
          `
          INSERT INTO pharmacy_inventory
          (
            pharmacy_id,
            medicine_id,
            quantity,
            availability,
            updated_at
          )

          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            NOW()
          )

          ON CONFLICT
          (
            pharmacy_id,
            medicine_id
          )

          DO UPDATE SET

            quantity =
              EXCLUDED.quantity,

            availability =
              EXCLUDED.availability,

            updated_at =
              NOW()

          RETURNING *
          `,
          [
            req.pharmacy
              .pharmacy_id,

            medicine_id,

            safeQuantity,

            av
          ]
        );

      res.status(201).json({
        ok: true,
        item:
          rows[0]
      });

    } catch (error) {

      console.error(
        "POST pharmacy inventory error:",
        error
      );

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* =========================================================
   لوحة الإدارة
========================================================= */

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME ||
  "admin";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ||
  "Admin@12345";


function requireAdmin(
  req,
  res,
  next
) {

  const header =
    req.headers.authorization || "";

  const token =
    header.startsWith("Bearer ")
      ? header.slice(7)
      : "";

  if (!token) {

    return res.status(401).json({
      error:
        "تسجيل دخول الإدارة مطلوب."
    });
  }

  try {

    const payload =
      jwt.verify(
        token,
        JWT_SECRET
      );

    if (
      payload.role !==
      "admin"
    ) {
      throw new Error(
        "invalid"
      );
    }

    req.admin =
      payload;

    next();

  } catch {

    res.status(401).json({
      error:
        "جلسة الإدارة غير صالحة."
    });
  }
}


/* دخول الإدارة */

app.post(
  "/api/admin/login",
  (req, res) => {

    const {
      username,
      password
    } = req.body || {};

    if (
      String(
        username || ""
      ) !==
        ADMIN_USERNAME ||

      String(
        password || ""
      ) !==
        ADMIN_PASSWORD
    ) {

      return res.status(401).json({
        error:
          "اسم المستخدم أو كلمة المرور غير صحيحة."
      });
    }

    res.json({
      token:
        jwt.sign(
          {
            role: "admin",
            username:
              ADMIN_USERNAME
          },

          JWT_SECRET,

          {
            expiresIn:
              "7d"
          }
        ),

      username:
        ADMIN_USERNAME
    });
  }
);


/* حساب الإدارة */

app.get(
  "/api/admin/me",
  requireAdmin,
  (req, res) => {

    res.json({
      ok: true,

      username:
        req.admin.username
    });
  }
);


/* إحصائيات الإدارة */

app.get(
  "/api/admin/stats",
  requireAdmin,
  async (req, res) => {

    if (!requireDB(res))
      return;

    try {

      const pharmacies =
        await dbQuery(
          `
          SELECT
            id,
            status
          FROM pharmacies
          `
        );

      const medicines =
        await dbQuery(
          `
          SELECT
            COUNT(*)::int AS count

          FROM medicines

          WHERE active = true
          `
        );

      const inventory =
        await dbQuery(
          `
          SELECT
            COUNT(*)::int AS count

          FROM pharmacy_inventory
          `
        );

      const accounts =
        await dbQuery(
          `
          SELECT
            COUNT(*)::int AS count

          FROM pharmacy_accounts
          `
        );

      const rows =
        pharmacies.rows;

      res.json({

        pharmacies:
          rows.length,

        pending:
          rows.filter(
            (x) =>
              x.status ===
              "pending"
          ).length,

        approved:
          rows.filter(
            (x) =>
              x.status ===
              "approved"
          ).length,

        suspended:
          rows.filter(
            (x) =>
              x.status ===
              "suspended"
          ).length,

        medicines:
          medicines
            .rows[0]
            .count,

        inventory:
          inventory
            .rows[0]
            .count,

        accounts:
          accounts
            .rows[0]
            .count
      });

    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* =========================================================
   الصيدليات في لوحة الإدارة
========================================================= */

app.get(
  "/api/admin/pharmacies",
  requireAdmin,
  async (req, res) => {

    if (!requireDB(res))
      return;

    const status =
      String(
        req.query.status || ""
      );

    try {

      const params = [];

      let where = "";

      if (
        [
          "pending",
          "approved",
          "suspended"
        ].includes(status)
      ) {

        params.push(
          status
        );

        where =
          "WHERE p.status = $1";
      }

      const { rows } =
        await dbQuery(
          `
          SELECT

            p.*,

            a.id AS account_id,
            a.email AS account_email,
            a.active AS account_active

          FROM pharmacies p

          LEFT JOIN pharmacy_accounts a

            ON a.pharmacy_id =
              p.id

          ${where}

          ORDER BY
            p.created_at DESC
          `,
          params
        );

      res.json(
        rows.map(
          (x) => ({
            ...x,

            pharmacy_accounts:
              x.account_id
                ? [
                    {
                      id:
                        x.account_id,

                      email:
                        x.account_email,

                      active:
                        x.account_active
                    }
                  ]
                : []
          })
        )
      );

    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* =========================================================
   تغيير حالة الصيدلية
========================================================= */

app.patch(
  "/api/admin/pharmacies/:id/status",
  requireAdmin,
  async (req, res) => {

    if (!requireDB(res))
      return;

    const status =
      String(
        req.body?.status || ""
      );

    if (
      ![
        "pending",
        "approved",
        "suspended"
      ].includes(status)
    ) {

      return res.status(400).json({
        error:
          "حالة غير صحيحة."
      });
    }

    try {

      const { rows } =
        await dbQuery(
          `
          UPDATE pharmacies

          SET
            status = $1,
            updated_at = NOW()

          WHERE id = $2

          RETURNING *
          `,
          [
            status,
            req.params.id
          ]
        );

      if (!rows[0]) {

        return res.status(404).json({
          error:
            "الصيدلية غير موجودة."
        });
      }

      res.json(
        rows[0]
      );

    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* =========================================================
   حذف الصيدلية
========================================================= */

app.delete(
  "/api/admin/pharmacies/:id",
  requireAdmin,
  async (req, res) => {

    if (!requireDB(res))
      return;

    try {

      const result =
        await dbQuery(
          `
          DELETE FROM pharmacies
          WHERE id = $1
          `,
          [
            req.params.id
          ]
        );

      if (!result.rowCount) {

        return res.status(404).json({
          error:
            "الصيدلية غير موجودة."
        });
      }

      res.json({
        ok: true
      });

    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* =========================================================
   إدارة الأدوية
========================================================= */

app.get(
  "/api/admin/medicines",
  requireAdmin,
  async (req, res) => {

    if (!requireDB(res))
      return;

    try {

      const { rows } =
        await dbQuery(
          `
          SELECT *
          FROM medicines
          ORDER BY name
          `
        );

      res.json(
        rows
      );

    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* إضافة دواء */

app.post(
  "/api/admin/medicines",
  requireAdmin,
  async (req, res) => {

    if (!requireDB(res))
      return;

    const {
      name,
      generic_name,
      strength,
      form
    } = req.body || {};

    if (!name) {

      return res.status(400).json({
        error:
          "اسم الدواء مطلوب."
      });
    }

    try {

      const { rows } =
        await dbQuery(
          `
          INSERT INTO medicines
          (
            name,
            generic_name,
            strength,
            form,
            active
          )

          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            true
          )

          RETURNING *
          `,
          [
            String(name)
              .trim(),

            generic_name
              ? String(
                  generic_name
                ).trim()
              : null,

            strength
              ? String(
                  strength
                ).trim()
              : null,

            form
              ? String(
                  form
                ).trim()
              : null
          ]
        );

      res.status(201).json(
        rows[0]
      );

    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* تعديل دواء */

app.patch(
  "/api/admin/medicines/:id",
  requireAdmin,
  async (req, res) => {

    if (!requireDB(res))
      return;

    const allowed = [
      "name",
      "generic_name",
      "strength",
      "form"
    ];

    const sets = [];

    const params = [];

    for (
      const key of allowed
    ) {

      if (
        req.body?.[key] !==
        undefined
      ) {

        params.push(
          req.body[key]
            ? String(
                req.body[key]
              ).trim()
            : null
        );

        sets.push(
          `${key} = $${params.length}`
        );
      }
    }

    if (
      req.body?.active !==
      undefined
    ) {

      params.push(
        Boolean(
          req.body.active
        )
      );

      sets.push(
        `active = $${params.length}`
      );
    }

    if (!sets.length) {

      return res.status(400).json({
        error:
          "لا توجد بيانات للتعديل."
      });
    }

    params.push(
      req.params.id
    );

    try {

      const { rows } =
        await dbQuery(
          `
          UPDATE medicines

          SET
            ${sets.join(", ")}

          WHERE id =
            $${params.length}

          RETURNING *
          `,
          params
        );

      if (!rows[0]) {

        return res.status(404).json({
          error:
            "الدواء غير موجود."
        });
      }

      res.json(
        rows[0]
      );

    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* =========================================================
   إدارة مخزون الصيدليات من لوحة الإدارة
========================================================= */

app.get(
  "/api/admin/inventory",
  requireAdmin,
  async (req, res) => {

    if (!requireDB(res))
      return;

    try {

      const { rows } =
        await dbQuery(
          `
          SELECT

            pi.id,
            pi.quantity,
            pi.availability,
            pi.updated_at,

            p.id AS pharmacy_id,
            p.name AS pharmacy_name,
            p.status AS pharmacy_status,

            m.id AS medicine_id,
            m.name AS medicine_name,
            m.generic_name,
            m.strength,
            m.form

          FROM pharmacy_inventory pi

          JOIN pharmacies p
            ON p.id =
              pi.pharmacy_id

          JOIN medicines m
            ON m.id =
              pi.medicine_id

          ORDER BY
            pi.updated_at DESC

          LIMIT 2000
          `
        );

      res.json(
        rows.map(
          (x) => ({
            id:
              x.id,

            quantity:
              x.quantity,

            availability:
              x.availability,

            updated_at:
              x.updated_at,

            pharmacy: {
              id:
                x.pharmacy_id,

              name:
                x.pharmacy_name,

              status:
                x.pharmacy_status
            },

            medicine: {
              id:
                x.medicine_id,

              name:
                x.medicine_name,

              generic_name:
                x.generic_name,

              strength:
                x.strength,

              form:
                x.form
            }
          })
        )
      );

    } catch (error) {

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* =========================================================
   الواجهة
========================================================= */

app.use(
  (req, res, next) => {

    if (
      req.method !==
        "GET" ||

      req.path.startsWith(
        "/api/"
      )
    ) {

      return next();
    }

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);


/* =========================================================
   تشغيل الخادم
========================================================= */

app.listen(
  PORT,
  () => {

    console.log(
      `Dawai Alobied running on port ${PORT}`
    );
  }
);
