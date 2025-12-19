import Database from "better-sqlite3";
const db = new Database("gcab.db");

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table'")
  .all();

console.log("Tables:", tables);

for (const t of tables) {
  const name = t.name;
  const rows = db.prepare(`SELECT COUNT(*) as c FROM ${name}`).get();
  console.log(name, rows.c);
}
