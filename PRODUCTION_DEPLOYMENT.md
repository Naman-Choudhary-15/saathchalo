# SAATHCHALO — Production Deployment & Operations Guide
## High-Availability & Zero-Downtime Architecture

This guide covers deploying and operating **SAATHCHALO** in production environments while safeguarding live commuter data, maintaining strict zero-downtime deployments, and ensuring high reliability.

---

### 1. Production Architecture Overview

```
                                  [ Internet / Mobile App ]
                                             │
                                      HTTPS / TLS 1.3
                                             ▼
                             [ Reverse Proxy: Nginx / Caddy ]
                                  (SSL Termination + Cache)
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       │                                           │
                       ▼                                           ▼
             [ Node.js Instance 1 ]                      [ Node.js Instance 2 ]
                 (Port: 8085)                                (Port: 8086)
                       │                                           │
                       └─────────────────────┬─────────────────────┘
                                             │
                                             ▼
                              [ Persistent Database Engine ]
                              • Atomic Write (.tmp -> rename)
                              • Automated Snapshots (/backup)
                              • Dedicated Cloud Volume
```

---

### 2. Environment Variables Specification

Configure the production environment via `.env` or system environment variables:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | Listening HTTP port | `8085` |
| `NODE_ENV` | Runtime environment | `production` |
| `SAATH_DB_PATH` | Path to persistent database JSON | `/var/data/saathchalo/saath-db.json` |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps Platform API key | `AIzaSy...` |
| `VITE_SUPABASE_URL` | Supabase URL (if hybrid sync enabled) | `https://xyz.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase Anon Key | `eyJhbGci...` |

> [!IMPORTANT]
> Always set `SAATH_DB_PATH` to a location **outside** the git working tree (e.g. `/var/data/saathchalo/saath-db.json` or an attached AWS EBS / GCP Persistent Disk). This guarantees `git pull` or automated CI deployments will never overwrite production data.

---

### 3. Automated Backup Routine

Before any server upgrade or schema update, execute the automated backup script:

```bash
npm run backup
```

This generates a timestamped snapshot in `backup/saath-db-backup-<timestamp>.json` with complete cryptographic checksum verification.

To set up an automated hourly cron backup on Linux:
```bash
0 * * * * cd /opt/saathchalo && npm run backup >> /var/log/saathchalo-backup.log 2>&1
```

---

### 4. Zero-Downtime Deployment with PM2

Install and configure PM2 for cluster mode and graceful reloads:

```bash
# 1. Install PM2 globally
npm install -g pm2

# 2. Start SAATHCHALO with PM2
pm2 start serve.js --name "saathchalo" --env production

# 3. Save process list to resurrect on system reboot
pm2 save
pm2 startup
```

When deploying code updates:
```bash
# Pull new release code
git pull origin main

# Perform zero-downtime graceful reload
pm2 reload saathchalo --update-env
```

---

### 5. Production Reverse Proxy (Nginx Configuration)

```nginx
server {
    listen 80;
    server_name ride.saathchalo.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ride.saathchalo.com;

    ssl_certificate /etc/letsencrypt/live/ride.saathchalo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ride.saathchalo.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Static assets caching
    location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff2)$ {
        root /opt/saathchalo;
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }

    # Real-Time SSE Endpoint (Server-Sent Events)
    location /api/events {
        proxy_pass http://127.0.0.1:8085;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Disable buffering for real-time SSE stream
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # API & Application Root
    location / {
        proxy_pass http://127.0.0.1:8085;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### 6. Health & Liveness Monitoring

The `/health` endpoint provides comprehensive real-time status:

```bash
curl -s http://127.0.0.1:8085/health | jq .
```

Expected response:
```json
{
  "status": "healthy",
  "service": "saathchalo-live-server",
  "version": "2.4.0-zero-downtime",
  "uptime_seconds": 12450,
  "usersCount": 24,
  "bookingsCount": 47,
  "messagesCount": 18,
  "votesCount": 51,
  "database": {
    "connected": true,
    "storage": "atomic_persistent_file"
  },
  "realtime": {
    "sseClientsCount": 4,
    "activeConnectedUsersCount": 3
  }
}
```
