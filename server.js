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
   DATABASE
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
  return pool.query(
    sql,
    params
  );
}


/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/api/health",
  async (req, res) => {
    if (!requireDB(res)) {
      return;
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
      res.status(500).json({
        ok: false,
        database: "neon",
        error: error.message
      });
    }
  }
);


/* =========================================================
   PHARMACY AUTHENTICATION
========================================================= */

function signPharmacyToken(
  account
) {
  return jwt.sign(
    {
      role: "pharmacy",

      account_id:
        account.id,

      pharmacy_id:
        account.pharmacy_id,

      email:
        account.email
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
  try {
    const header =
      req.headers.authorization ||
      "";

    if (
      !header.startsWith(
        "Bearer "
      )
    ) {
      return res.status(401).json({
        error:
          "غير مصرح. يرجى تسجيل الدخول."
      });
    }

    const token =
      header.slice(7);

    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );

    if (
      decoded.role !==
      "pharmacy"
    ) {
      return res.status(401).json({
        error:
          "رمز الدخول غير صالح."
      });
    }

    req.pharmacy =
      decoded;

    next();

  } catch (error) {
    return res.status(401).json({
      error:
        "جلسة الدخول غير صالحة أو منتهية."
    });
  }
}


/* =========================================================
   PUBLIC PHARMACIES
========================================================= */

app.get(
  "/api/pharmacies",
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    try {
      const {
        rows
      } = await dbQuery(
        `
        SELECT
          id,
          name,
          phone,
          address,
          latitude,
          longitude,
          status,
          opening_hours,
          delivery,
          created_at,
          updated_at

        FROM pharmacies

        WHERE status = 'approved'

        ORDER BY name ASC
        `
      );

      res.json(rows);

    } catch (error) {
      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* =========================================================
   MEDICINE SEARCH
========================================================= */

app.get(
  "/api/medicines/search",
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    const q =
      String(
        req.query.q || ""
      ).trim();

    if (!q) {
      return res.json([]);
    }

    try {
      const {
        rows
      } = await dbQuery(
        `
        SELECT
          m.id,
          m.name,
          m.generic_name,
          m.strength,
          m.form,

          p.id AS pharmacy_id,
          p.name AS pharmacy_name,
          p.phone AS pharmacy_phone,
          p.address AS pharmacy_address,
          p.latitude AS pharmacy_latitude,
          p.longitude AS pharmacy_longitude,
          p.opening_hours,
          p.delivery,

          pi.quantity,
          pi.availability,
          pi.updated_at

        FROM medicines m

        JOIN pharmacy_inventory pi
          ON pi.medicine_id = m.id

        JOIN pharmacies p
          ON p.id = pi.pharmacy_id

        WHERE
          m.active = TRUE

          AND p.status = 'approved'

          AND pi.availability IN
            (
              'available',
              'limited'
            )

          AND (
            m.name ILIKE $1
            OR
            m.generic_name ILIKE $1
          )

        ORDER BY
          m.name ASC,
          p.name ASC
        `,

        [`%${q}%`]
      );

      res.json(rows);

    } catch (error) {
      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* =========================================================
   ALL ACTIVE MEDICINES
========================================================= */

app.get(
  "/api/medicines",
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    try {
      const {
        rows
      } = await dbQuery(
        `
        SELECT
          id,
          name,
          generic_name,
          strength,
          form,
          active,
          created_at

        FROM medicines

        WHERE active = TRUE

        ORDER BY
          name ASC
        `
      );

      res.json(rows);

    } catch (error) {
      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* =========================================================
   SINGLE PHARMACY
========================================================= */

app.get(
  "/api/pharmacies/:id",
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    try {
      const {
        rows
      } = await dbQuery(
        `
        SELECT
          id,
          name,
          phone,
          address,
          latitude,
          longitude,
          status,
          opening_hours,
          delivery,
          created_at,
          updated_at

        FROM pharmacies

        WHERE
          id = $1

          AND status = 'approved'

        LIMIT 1
        `,

        [
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
   PHARMACY REGISTRATION
========================================================= */

app.post(
  "/api/pharmacy/register",
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    const {
      name,
      phone,
      address,
      latitude,
      longitude,
      opening_hours,
      delivery,
      email,
      password
    } = req.body || {};

    if (!name) {
      return res.status(400).json({
        error:
          "اسم الصيدلية مطلوب."
      });
    }

    if (!email) {
      return res.status(400).json({
        error:
          "البريد الإلكتروني مطلوب."
      });
    }

    if (
      !password ||
      String(password).length < 8
    ) {
      return res.status(400).json({
        error:
          "كلمة المرور يجب أن تكون 8 أحرف على الأقل."
      });
    }

    try {
      const existingAccount =
        await dbQuery(
          `
          SELECT id
          FROM pharmacy_accounts
          WHERE LOWER(email) = LOWER($1)
          LIMIT 1
          `,
          [email]
        );

      if (
        existingAccount.rows[0]
      ) {
        return res.status(409).json({
          error:
            "البريد الإلكتروني مستخدم بالفعل."
        });
      }

      const passwordHash =
        await bcrypt.hash(
          String(password),
          12
        );

      const pharmacyResult =
        await dbQuery(
          `
          INSERT INTO pharmacies
          (
            name,
            phone,
            address,
            latitude,
            longitude,
            status,
            opening_hours,
            delivery,
            created_at,
            updated_at
          )

          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            'pending',
            $6,
            $7,
            NOW(),
            NOW()
          )

          RETURNING *
          `,
          [
            name,
            phone || null,
            address || null,
            latitude ||
              null,
            longitude ||
              null,
            opening_hours ||
              null,
            Boolean(
              delivery
            )
          ]
        );

      const pharmacy =
        pharmacyResult.rows[0];

      await dbQuery(
        `
        INSERT INTO pharmacy_accounts
        (
          pharmacy_id,
          email,
          password_hash,
          active,
          created_at
        )

        VALUES
        (
          $1,
          $2,
          $3,
          TRUE,
          NOW()
        )
        `,
        [
          pharmacy.id,
          email,
          passwordHash
        ]
      );

      res.status(201).json({
        ok: true,

        pharmacy: {
          id:
            pharmacy.id,

          name:
            pharmacy.name,

          status:
            pharmacy.status
        },

        message:
          "تم تسجيل الصيدلية بنجاح، وهي الآن بانتظار اعتماد الإدارة."
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
   PHARMACY LOGIN
========================================================= */

app.post(
  "/api/pharmacy/login",
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    const {
      email,
      password
    } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error:
          "البريد الإلكتروني وكلمة المرور مطلوبان."
      });
    }

    try {
      const {
        rows
      } = await dbQuery(
        `
        SELECT
          pa.id,
          pa.pharmacy_id,
          pa.email,
          pa.password_hash,
          pa.active,

          p.name AS pharmacy_name,
          p.status AS pharmacy_status

        FROM pharmacy_accounts pa

        JOIN pharmacies p
          ON p.id = pa.pharmacy_id

        WHERE
          LOWER(pa.email) =
          LOWER($1)

        LIMIT 1
        `,
        [email]
      );

      const account =
        rows[0];

      if (!account) {
        return res.status(401).json({
          error:
            "بيانات الدخول غير صحيحة."
        });
      }

      if (
        !account.active
      ) {
        return res.status(403).json({
          error:
            "حساب الصيدلية غير مفعل."
        });
      }

      if (
        account.pharmacy_status !==
        "approved"
      ) {
        return res.status(403).json({
          error:
            "الصيدلية لم يتم اعتمادها من الإدارة بعد."
        });
      }

      const valid =
        await bcrypt.compare(
          String(password),
          account.password_hash
        );

      if (!valid) {
        return res.status(401).json({
          error:
            "بيانات الدخول غير صحيحة."
        });
      }

      const token =
        signPharmacyToken(
          account
        );

      res.json({
        ok: true,

        token,

        pharmacy: {
          id:
            account.pharmacy_id,

          name:
            account.pharmacy_name,

          email:
            account.email,

          status:
            account.pharmacy_status
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
   PHARMACY ME
========================================================= */

app.get(
  "/api/pharmacy/me",
  requirePharmacy,
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    try {
      const {
        rows
      } = await dbQuery(
        `
        SELECT
          p.id,
          p.name,
          p.phone,
          p.address,
          p.latitude,
          p.longitude,
          p.status,
          p.opening_hours,
          p.delivery,
          p.created_at,
          p.updated_at,

          pa.email

        FROM pharmacies p

        LEFT JOIN pharmacy_accounts pa
          ON pa.pharmacy_id = p.id

        WHERE p.id = $1

        LIMIT 1
        `,
        [
          req.pharmacy.pharmacy_id
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
   PHARMACY INVENTORY
========================================================= */

app.get(
  "/api/pharmacy/inventory",
  requirePharmacy,
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    try {
      const {
        rows
      } = await dbQuery(
        `
        SELECT
          pi.id,
          pi.quantity,
          pi.availability,
          pi.updated_at,

          m.id AS medicine_id,
          m.name AS medicine_name,
          m.generic_name,
          m.strength,
          m.form,
          m.active

        FROM pharmacy_inventory pi

        JOIN medicines m
          ON m.id = pi.medicine_id

        WHERE
          pi.pharmacy_id = $1

        ORDER BY
          pi.updated_at DESC
        `,
        [
          req.pharmacy.pharmacy_id
        ]
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
      res.status(500).json({
        error:
          error.message
      });
    }
  }
);/* =========================================================
   UPDATE PHARMACY INVENTORY
========================================================= */

app.put(
  "/api/pharmacy/inventory/:id",
  requirePharmacy,
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    const {
      quantity,
      availability
    } = req.body || {};

    const allowed = [
      "available",
      "limited",
      "unavailable"
    ];

    if (!allowed.includes(availability)) {
      return res.status(400).json({
        error:
          "حالة التوفر غير صحيحة."
      });
    }

    try {
      const {
        rows
      } = await dbQuery(
        `
        UPDATE pharmacy_inventory

        SET
          quantity = $1,
          availability = $2,
          updated_at = NOW()

        WHERE
          id = $3

          AND pharmacy_id = $4

        RETURNING *
        `,
        [
          Math.max(
            0,
            Number(
              quantity || 0
            )
          ),

          availability,

          req.params.id,

          req.pharmacy.pharmacy_id
        ]
      );

      if (!rows[0]) {
        return res.status(404).json({
          error:
            "السجل غير موجود."
        });
      }

      res.json({
        ok: true,

        item:
          rows[0]
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
   ADD / UPDATE PHARMACY INVENTORY
========================================================= */

app.post(
  "/api/pharmacy/inventory",
  requirePharmacy,
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

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
        : "available";

    try {
      const {
        rows
      } = await dbQuery(
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
          req.pharmacy.pharmacy_id,

          medicine_id,

          Math.max(
            0,
            Number(
              quantity || 0
            )
          ),

          av
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


/* =========================================================
   ADMIN AUTHENTICATION
========================================================= */

const ADMIN_USERNAME =
  process.env.ADMIN_USERNAME ||
  "admin";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ||
  "Admin@12345";


function signAdminToken() {
  return jwt.sign(
    {
      role: "admin"
    },

    JWT_SECRET,

    {
      expiresIn: "12h"
    }
  );
}


function requireAdmin(
  req,
  res,
  next
) {
  try {
    const header =
      req.headers.authorization ||
      "";

    if (
      !header.startsWith(
        "Bearer "
      )
    ) {
      return res.status(401).json({
        error:
          "غير مصرح. يرجى تسجيل الدخول."
      });
    }

    const token =
      header.slice(7);

    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );

    if (
      decoded.role !==
      "admin"
    ) {
      return res.status(401).json({
        error:
          "رمز دخول الإدارة غير صالح."
      });
    }

    req.admin =
      decoded;

    next();

  } catch (error) {
    return res.status(401).json({
      error:
        "جلسة الإدارة غير صالحة أو منتهية."
    });
  }
}


/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post(
  "/api/admin/login",
  async (req, res) => {
    const {
      username,
      password
    } = req.body || {};

    if (
      username !==
        ADMIN_USERNAME ||
      password !==
        ADMIN_PASSWORD
    ) {
      return res.status(401).json({
        error:
          "اسم المستخدم أو كلمة المرور غير صحيحة."
      });
    }

    const token =
      signAdminToken();

    res.json({
      ok: true,

      token,

      admin: {
        username:
          ADMIN_USERNAME
      }
    });
  }
);


/* =========================================================
   ADMIN ME
========================================================= */

app.get(
  "/api/admin/me",
  requireAdmin,
  async (req, res) => {
    res.json({
      ok: true,

      admin: {
        username:
          ADMIN_USERNAME
      }
    });
  }
);


/* =========================================================
   ADMIN STATISTICS
========================================================= */

app.get(
  "/api/admin/stats",
  requireAdmin,
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    try {
      const pharmacies =
        await dbQuery(
          `
          SELECT
            COUNT(*)::int AS total,

            COUNT(*) FILTER (
              WHERE status = 'pending'
            )::int AS pending,

            COUNT(*) FILTER (
              WHERE status = 'approved'
            )::int AS approved,

            COUNT(*) FILTER (
              WHERE status = 'suspended'
            )::int AS suspended

          FROM pharmacies
          `
        );

      const medicines =
        await dbQuery(
          `
          SELECT
            COUNT(*)::int AS total

          FROM medicines
          `
        );

      const inventory =
        await dbQuery(
          `
          SELECT
            COUNT(*)::int AS total

          FROM pharmacy_inventory
          `
        );

      const accounts =
        await dbQuery(
          `
          SELECT
            COUNT(*)::int AS total

          FROM pharmacy_accounts
          `
        );

      res.json({
        pharmacies:
          pharmacies.rows[0],

        medicines:
          medicines.rows[0].total,

        inventory:
          inventory.rows[0].total,

        accounts:
          accounts.rows[0].total
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
   ADMIN — LIST PHARMACIES
========================================================= */

app.get(
  "/api/admin/pharmacies",
  requireAdmin,
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    const status =
      String(
        req.query.status ||
          "all"
      ).trim();

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
        params.push(status);

        where =
          "WHERE p.status = $1";
      }

      const {
        rows
      } = await dbQuery(
        `
        SELECT
          p.id,
          p.name,
          p.phone,
          p.address,
          p.latitude,
          p.longitude,
          p.status,
          p.opening_hours,
          p.delivery,
          p.created_at,
          p.updated_at,

          COALESCE(
            json_agg(
              json_build_object(
                'id',
                pa.id,

                'email',
                pa.email,

                'active',
                pa.active,

                'created_at',
                pa.created_at
              )
            )
            FILTER (
              WHERE pa.id IS NOT NULL
            ),

            '[]'::json
          )
          AS pharmacy_accounts

        FROM pharmacies p

        LEFT JOIN pharmacy_accounts pa
          ON pa.pharmacy_id =
             p.id

        ${where}

        GROUP BY
          p.id

        ORDER BY
          p.created_at DESC
        `,

        params
      );

      res.json(rows);

    } catch (error) {
      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* =========================================================
   ADMIN — CHANGE PHARMACY STATUS
========================================================= */

app.patch(
  "/api/admin/pharmacies/:id/status",
  requireAdmin,
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    const status =
      String(
        req.body?.status ||
          ""
      ).trim();

    const allowed = [
      "pending",
      "approved",
      "suspended"
    ];

    if (
      !allowed.includes(
        status
      )
    ) {
      return res.status(400).json({
        error:
          "حالة الصيدلية غير صحيحة."
      });
    }

    try {
      const {
        rows
      } = await dbQuery(
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

      res.json({
        ok: true,

        pharmacy:
          rows[0]
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
   ADMIN — RESET PHARMACY PASSWORD
========================================================= */

app.patch(
  "/api/admin/pharmacies/:id/password",
  requireAdmin,
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    const password =
      String(
        req.body?.password ||
          ""
      );

    if (
      password.length < 8
    ) {
      return res.status(400).json({
        error:
          "كلمة المرور يجب أن تكون 8 أحرف على الأقل."
      });
    }

    try {
      const pharmacy =
        await dbQuery(
          `
          SELECT
            id,
            name

          FROM pharmacies

          WHERE id = $1

          LIMIT 1
          `,
          [
            req.params.id
          ]
        );

      if (
        !pharmacy.rows[0]
      ) {
        return res.status(404).json({
          error:
            "الصيدلية غير موجودة."
        });
      }

      const account =
        await dbQuery(
          `
          SELECT
            id,
            email

          FROM pharmacy_accounts

          WHERE pharmacy_id = $1

          LIMIT 1
          `,
          [
            req.params.id
          ]
        );

      if (
        !account.rows[0]
      ) {
        return res.status(404).json({
          error:
            "لا يوجد حساب دخول مرتبط بهذه الصيدلية."
        });
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      await dbQuery(
        `
        UPDATE pharmacy_accounts

        SET
          password_hash = $1,
          active = true

        WHERE id = $2
        `,
        [
          passwordHash,

          account.rows[0].id
        ]
      );

      res.json({
        ok: true,

        pharmacy_id:
          pharmacy.rows[0].id,

        pharmacy_name:
          pharmacy.rows[0].name,

        email:
          account.rows[0].email,

        message:
          "تم تحديث كلمة المرور بنجاح."
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
   ADMIN — DELETE PHARMACY
========================================================= */

app.delete(
  "/api/admin/pharmacies/:id",
  requireAdmin,
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    try {
      const {
        rows
      } = await dbQuery(
        `
        DELETE FROM pharmacies

        WHERE id = $1

        RETURNING *
        `,
        [
          req.params.id
        ]
      );

      if (!rows[0]) {
        return res.status(404).json({
          error:
            "الصيدلية غير موجودة."
        });
      }

      res.json({
        ok: true,

        message:
          "تم حذف الصيدلية بنجاح.",

        pharmacy:
          rows[0]
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
   ADMIN — LIST MEDICINES
========================================================= */

app.get(
  "/api/admin/medicines",
  requireAdmin,
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    try {
      const {
        rows
      } = await dbQuery(
        `
        SELECT
          id,
          name,
          generic_name,
          strength,
          form,
          active,
          created_at

        FROM medicines

        ORDER BY
          name ASC
        `
      );

      res.json(rows);

    } catch (error) {
      res.status(500).json({
        error:
          error.message
      });
    }
  }
);


/* =========================================================
   ADMIN — ADD MEDICINE
========================================================= */

app.post(
  "/api/admin/medicines",
  requireAdmin,
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    const {
      name,
      generic_name,
      strength,
      form,
      active
    } = req.body || {};

    if (!name) {
      return res.status(400).json({
        error:
          "اسم الدواء مطلوب."
      });
    }

    try {
      const {
        rows
      } = await dbQuery(
        `
        INSERT INTO medicines
        (
          name,
          generic_name,
          strength,
          form,
          active,
          created_at
        )

        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          NOW()
        )

        RETURNING *
        `,
        [
          name,
          generic_name ||
            null,
          strength ||
            null,
          form ||
            null,
          active !== false
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


/* =========================================================
   ADMIN — UPDATE MEDICINE
========================================================= */

app.patch(
  "/api/admin/medicines/:id",
  requireAdmin,
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    const {
      name,
      generic_name,
      strength,
      form,
      active
    } = req.body || {};

    try {
      const {
        rows
      } = await dbQuery(
        `
        UPDATE medicines

        SET
          name =
            COALESCE(
              $1,
              name
            ),

          generic_name =
            COALESCE(
              $2,
              generic_name
            ),

          strength =
            COALESCE(
              $3,
              strength
            ),

          form =
            COALESCE(
              $4,
              form
            ),

          active =
            COALESCE(
              $5,
              active
            )

        WHERE id = $6

        RETURNING *
        `,
        [
          name ??
            null,

          generic_name ??
            null,

          strength ??
            null,

          form ??
            null,

          typeof active ===
          "boolean"
            ? active
            : null,

          req.params.id
        ]
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
);/* =========================================================
   ADMIN — INVENTORY
========================================================= */

app.get(
  "/api/admin/inventory",
  requireAdmin,
  async (req, res) => {
    if (!requireDB(res)) {
      return;
    }

    try {
      const {
        rows
      } = await dbQuery(
        `
        SELECT
          pi.id,
          pi.quantity,
          pi.availability,
          pi.updated_at,

          p.id AS pharmacy_id,
          p.name AS pharmacy_name,
          p.phone AS pharmacy_phone,
          p.address AS pharmacy_address,
          p.status AS pharmacy_status,

          m.id AS medicine_id,
          m.name AS medicine_name,
          m.generic_name,
          m.strength,
          m.form,
          m.active AS medicine_active

        FROM pharmacy_inventory pi

        JOIN pharmacies p
          ON p.id = pi.pharmacy_id

        JOIN medicines m
          ON m.id = pi.medicine_id

        ORDER BY
          pi.updated_at DESC
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

            pharmacies: {
              id:
                x.pharmacy_id,

              name:
                x.pharmacy_name,

              phone:
                x.pharmacy_phone,

              address:
                x.pharmacy_address,

              status:
                x.pharmacy_status
            },

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
                x.medicine_active
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
   FALLBACK — SERVE MAIN PAGE
========================================================= */

app.use(
  (req, res, next) => {
    if (
      req.method !== "GET" ||
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
   START SERVER
========================================================= */

app.listen(
  PORT,
  () => {
    console.log(
      `Dawai Alobied running on port ${PORT}`
    );
  }
);
