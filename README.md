# test-svebble-neon

Prerequisites:

- Node (tested on v22.17.1)
- Docker Desktop (tested on v4.46.0)

Setup process (dev):

- Install npm dependencies `npm i` or `npm ci`
- Copy env variables from `.env.sample` to `.env` or set your own
- Run Docker containers `npm run docker-run`
- Run Postgres migrations `npm run db:m`
- Run Next.js `npm run dev`
