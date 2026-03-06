import "dotenv/config";

// const url = "http://localhost:3000/api/routines/prune-unused-files";
// const url = "http://localhost:3000/api/routines/prune-errored-files";
// const url = "http://localhost:3000/api/routines/prune-deleted-users";
// const url = "http://localhost:3000/api/routines/prune-inactive-guest-users";
const url = "http://localhost:3000/api/routines/prune-deleted-messages";
const secret = process.env.CRON_SECRET || "dev-secret";
(async () => {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${secret}`,
    },
  });

  const body = await res.text();

  if (!res.ok) {
    console.error(`Cron failed: ${res.status} ${res.statusText}\n${body}`);
    process.exit(1);
  }

  console.log(body);
})();
