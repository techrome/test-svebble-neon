import "dotenv/config";
import { seedUsers } from "../src/server/trpc/routines";

(async () => {
  console.time("b");
  await seedUsers();
  console.timeEnd("b");
  process.exit(0);
})();
