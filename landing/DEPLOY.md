# Codetrail — deploy notes (P0)

Brand: Codetrail. Domain: `codetrail.dipgle.com`.
This app lives inside `tfl5/data/default/codetrail/` and serves in tfl5 STATIC mode.

## Local dev

```bash
cd ~/Documents/projects/AI/tfl5
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

## Waitlist (P0 stub → P1 real)

Current form posts via `mailto:hello@codetrail.dipgle.com` AND stores to
`localStorage` for a snapshot. Replace `<form action>` and the JS handler
in `public/script.js#initWaitlist` once a real endpoint exists.

Recommended P1 endpoints:
- Formspree / Getform (zero-code, free 50/mo)
- Custom tfl5 API route in full-mode cell
- Buttondown / ConvertKit (newsletter-ready)
