# Codetrail — deploy notes (P0)

Brand: Codetrail. Domain: `codetrail.dipgle.com`.
This app lives inside `tfl5/data/default/codetrail/` and serves in tfl5 STATIC mode.

## Local dev

Set `TFL5_REPO` to wherever your tfl5 checkout lives — this repo makes no
assumption about the layout around it.

```bash
cd "${TFL5_REPO:?set TFL5_REPO to your tfl5 checkout}"
TFL5_STATIC_APP=codetrail \
TFL5_DEV=1 \
TFL5_BIND=127.0.0.1:8091 \
./target/release/tfl5
# open http://127.0.0.1:8091
```

`TFL5_DEV=1` rebuilds Tera templates per request — safe to edit `.html`
without restart. CSS/JS picked up automatically (raw bytes, no cache).

## Production deploy on qvt server

Codetrail runs as a **third tfl5 process** alongside the two existing
SaaS cells (default:35000, cell-b:35001). Keep them separate — codetrail
is static, cells are full mode.

1. **Copy this app folder** to the production data dir:
   ```bash
   rsync -av data/default/codetrail/ qvt:/path/to/tfl5/data/default/codetrail/
   ```

2. **systemd unit** `/etc/systemd/system/tfl5-codetrail.service`:
   ```ini
   [Unit]
   Description=tfl5 static — codetrail
   After=network.target

   [Service]
   ExecStart=/usr/local/bin/tfl5
   Environment=TFL5_STATIC_APP=codetrail
   Environment=TFL5_DATA_ROOT=/path/to/tfl5/data
   Environment=TFL5_BIND=127.0.0.1:35200
   Restart=always
   User=tfl5

   [Install]
   WantedBy=multi-user.target
   ```
   `systemctl enable --now tfl5-codetrail`.

3. **Caddyfile** — append snippet (Caddy already terminates TLS for
   `*.dipgle.com` via existing wildcard cert or on-demand):
   ```caddyfile
   codetrail.dipgle.com {
       encode zstd gzip
       reverse_proxy 127.0.0.1:35200
   }
   ```
   Then `caddy reload`.

4. **DNS** — point `codetrail.dipgle.com` A record at the server IP.

5. **Smoke after deploy**:
   ```bash
   curl -sSI https://codetrail.dipgle.com/         # 200 text/html
   curl -sSI https://codetrail.dipgle.com/styles.css   # 200 text/css
   curl -sSI https://codetrail.dipgle.com/viewer.html  # 200 text/html
   ```

## Update flow

Edit files in `data/default/codetrail/`, commit, push to server, restart
the systemd unit (or `TFL5_DEV=1` for hot-reload during local iteration).

No DB. No migrations. No state. Pure static + Tera includes.

## Waitlist

The `mailto:` stub is gone. The form now POSTs to the tfl5 public-form
endpoint: `public/index.html#waitForm` carries `data-app-tid` +
`data-form-id`, and `public/script.js#initWaitlist` maps `public_form_*`
error codes to bilingual messages, falling back to `localStorage` when the
network fails so an address is never dropped silently.

The form schema is registered by `scripts/set-public-form-config.mjs`
(idempotent upsert). It reads everything from the environment — nothing
about the target is baked into the repo:

```bash
TFL5_HOST=https://<your-cpanel-host> \
TFL5_USER=<designer-or-above> \
TFL5_PASS=<password> \
APP_TID=<app tid> \
node scripts/set-public-form-config.mjs
```

Defaults if unset: `FORM_ID=waitlist`, and a schema of one required email
field capped at 256 chars, rate-limited to 5 submissions per IP per hour.
