import fs from "fs";
import path from "node:path";
import pgPromise from "pg-promise";

const pgp = pgPromise();
const filePath = "./sql-test/q.json";

const absolutePath = path.resolve(filePath);
const input = JSON.parse(fs.readFileSync(absolutePath, "utf8"));

const sql = input.sql || input.query || input.text;
const params = input.params || input.values;

if (!sql) {
  throw new Error("No sql/query provided");
}

if (!Array.isArray(params)) {
  throw new Error("Expected params/values to be an array");
}

const inlinedSql = pgp.as.format(sql, params);

console.log("RESULT:\n\n", inlinedSql);
