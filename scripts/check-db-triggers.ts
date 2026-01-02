import { Client } from "pg";
import { getDBURLPrimary } from "./helpers/getDBURL";

// NOT USED FOR NOW

const main = async () => {
  const client = new Client({ connectionString: getDBURLPrimary() });

  try {
    await client.connect();

    const { rows } = await client.query(`
        select * from plpgsql_check_function(
          'public.clear_pending_email_on_verified()',
          'public."user"'
        );
      `);

    if (rows.length > 0) {
      console.error("❌ plpgsql_check FAILED:\n");
      for (const r of rows) {
        console.error(Object.values(r)[0]);
      }
      process.exit(1);
    }

    console.log("✅ plpgsql_check OK");
  } finally {
    await client.end().catch(() => {});
  }
};
main();
