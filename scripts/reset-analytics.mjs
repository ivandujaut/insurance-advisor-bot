// Vacía las tablas de analytics (events y leads) del Postgres apuntado por
// DATABASE_URL. Sirve para arrancar el funnel de la demo "limpio" antes de
// mostrarlo. Requiere una URL con permiso de escritura (la externa del proveedor).
//
//   DATABASE_URL=... DATABASE_SSL=true node scripts/reset-analytics.mjs
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Falta DATABASE_URL.");
  process.exit(1);
}

const needsSsl =
  process.env.DATABASE_SSL === "true" || /[?&]sslmode=require/.test(connectionString);
const pool = new Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

await pool.query("TRUNCATE events, leads RESTART IDENTITY");
console.log("Funnel reseteado: tablas events y leads vaciadas.");
await pool.end();
