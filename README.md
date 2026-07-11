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

## CDN Worker

File attachments are served through a separate Cloudflare Worker backed by
Backblaze B2:

https://github.com/techrome/cloudflare-b2

The Worker repository contains its own deployment instructions and required
environment variables.
