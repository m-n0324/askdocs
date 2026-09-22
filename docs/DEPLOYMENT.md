# Deploying to AWS EC2

One EC2 instance running the same `docker compose` stack you run locally. That's simple, cheap, and plenty for a portfolio project or a small team.

```
Internet ──► EC2 (Security Group: 22 from your IP, 80/443 from anywhere)
               └─ nginx :80/:443 ─► web (Next.js) / api (Express) ─► postgres, redis, worker
```

## 1. Create the instance

1. EC2 → **Launch instance**:
   - **AMI:** Ubuntu Server 24.04 LTS.
   - **Type:** `t3.medium` (2 vCPU, 4 GB). Ingestion and the Next.js build need memory; `t3.small` works with a swap file.
   - **Storage:** 30 GB gp3.
   - **Key pair:** create one and keep the `.pem` safe.
   - **Security group:**
     - SSH (22) from **My IP** only.
     - HTTP (80) and HTTPS (443) from anywhere.
     - Do **not** open 5432, 6379, 8080 or 3000. Those stay inside Docker.
2. Allocate an **Elastic IP** and associate it with the instance, so the address survives reboots.
3. (Optional) Point a domain's `A` record at the Elastic IP.

## 2. Install Docker

```bash
ssh -i askdocs.pem ubuntu@<elastic-ip>

sudo apt-get update && sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && newgrp docker
docker compose version

# Only for small instances: 2 GB of swap so builds don't run out of memory
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 3. Configure

```bash
git clone <your-repo-url> askdocs && cd askdocs

# Compose-level secrets
cp .env.example .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
sed -i "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$(openssl rand -hex 24)/" .env

# App settings
cp backend/.env.example backend/.env
nano backend/.env
```

In `backend/.env` set at least:

| Key | Value |
| --- | --- |
| `JWT_SECRET` | output of `openssl rand -hex 32` |
| `LLM_PROVIDER` | `gemini` (free tier) or `openai` |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | the key for the chosen provider (for OpenAI, also set a monthly budget limit in its dashboard) |
| `CORS_ORIGIN` | `https://your-domain` (or `http://<elastic-ip>`) |
| `MONTHLY_TOKEN_QUOTA` | e.g. `1000000` per workspace |

`DATABASE_URL`, `REDIS_URL`, `NODE_ENV` and `UPLOAD_DIR` in `backend/.env` are ignored in Docker. Compose sets them for the containers.

## 4. Start

```bash
docker compose up -d --build
docker compose ps                 # migrate: Exited (0); api: healthy; others: Up
docker compose logs -f api worker
curl http://localhost/api/health
```

Open `http://<elastic-ip>` in a browser.

## 5. HTTPS (do this before sharing the link)

Without TLS, passwords and tokens travel in plain text. The simplest option is **Let's Encrypt with certbot on the host**, terminating TLS in our nginx:

1. Get a certificate (stop nginx briefly so certbot can use port 80):
   ```bash
   docker compose stop nginx
   sudo apt-get install -y certbot
   sudo certbot certonly --standalone -d your-domain.com
   ```
2. Mount the certificates into the nginx service in `docker-compose.yml`, and publish 443:
   ```yaml
   nginx:
     ports: ["80:80", "443:443"]
     volumes:
       - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
       - /etc/letsencrypt:/etc/letsencrypt:ro
   ```
3. In `nginx/nginx.conf`, add a `server` block for 443 and make port 80 redirect to it:
   ```nginx
   server {
       listen 80;
       return 301 https://$host$request_uri;
   }
   server {
       listen 443 ssl;
       http2 on;
       ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
       add_header Strict-Transport-Security "max-age=31536000" always;
       # ... everything from the existing server block (locations, headers, limits) ...
   }
   ```
4. Run `docker compose up -d nginx`.
5. Renew automatically with a cron job: `sudo certbot renew --pre-hook "docker compose -f /home/ubuntu/askdocs/docker-compose.yml stop nginx" --post-hook "docker compose -f /home/ubuntu/askdocs/docker-compose.yml start nginx"`.

**Alternative:** put an AWS Application Load Balancer with an ACM certificate in front. In that case nginx must trust the ALB's `X-Forwarded-For`, otherwise every user appears to come from the ALB's IP and they all share one rate-limit bucket. Add `set_real_ip_from <vpc-cidr>; real_ip_header X-Forwarded-For;` and forward `$remote_addr`, which will then be the real client.

## 6. Operations

| Task | Command |
| --- | --- |
| Deploy a new version | `git pull && docker compose up -d --build` (migrations run automatically) |
| Logs | `docker compose logs -f api worker` (JSON lines; pipe through `npx pino-pretty` to read) |
| More ingestion throughput | `docker compose up -d --scale worker=3` |
| Database backup | `docker compose exec -T postgres pg_dump -U askdocs askdocs \| gzip > backup-$(date +%F).sql.gz` |
| Restore | `gunzip -c backup.sql.gz \| docker compose exec -T postgres psql -U askdocs askdocs` |
| Retrieval quality check | `docker compose exec api node dist/scripts/eval.js` |

Back up the `uploads` volume as well (or move files to S3; see `backend/src/services/storage.service.ts`). For automatic backups, a daily cron job that copies the `pg_dump` to S3 is enough.

## 7. Production checklist

- [ ] HTTPS on, HTTP redirects to HTTPS.
- [ ] Strong `JWT_SECRET`, `POSTGRES_PASSWORD` and `REDIS_PASSWORD`. None of them committed to git.
- [ ] `LLM_PROVIDER` is `gemini` or `openai`. With `fake` you get canned answers, and the API logs a warning.
- [ ] OpenAI: monthly budget limit set in the dashboard. Gemini free tier: don't upload confidential documents.
- [ ] `MONTHLY_TOKEN_QUOTA`, `MAX_WORKSPACES_PER_USER` and `MAX_SOURCES_PER_WORKSPACE` set to values you can afford.
- [ ] Security group exposes only 22 (your IP), 80 and 443.
- [ ] Backups scheduled.
