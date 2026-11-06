# Сервер СамоСтрой (Lenovo V15-IIL)

Постоянный бэкенд домашнего сервера: **Postgres + API (+ Telegram notify)** в Docker.  
Фронт — лёгкая статика на **GitHub Pages**; браузер ходит в API через **ngrok**.

| | |
|---|---|
| Хост | Lenovo V15-IIL (`i5lenovo`), Ubuntu Server 24.04 |
| Пользователь | `sa` · LAN `192.168.1.39` (DHCP Wi‑Fi `wlp0s20f3`) |
| Репо на диске | `/home/sa/samostroy` |
| API | `http://127.0.0.1:8787` · с LAN `http://192.168.1.39:8787` |
| Health | `GET /health` → `{"ok":true,"store":"postgres",…}` |
| Postgres | только с хоста `127.0.0.1:5433` → контейнер `:5432` |
| Туннель | systemd user: `samostroy-tunnel` (**cloudflared**). ngrok с IP РФ → `ERR_NGROK_9040`, не использовать |
| UI | https://puholet-sketch.github.io/samostroy/ |

## Архитектура

```text
[GitHub Pages — React/Vite]
        │  HTTPS (VITE_FEEDBACK_API_URL)
        ▼
[ngrok] ──► [Lenovo :8787 api] ──► [Postgres volume]
                 │
                 └── Telegram notify (если TELEGRAM_* в .env)
```

Корень `/` API отвечает `{"error":"not found"}` — это ожидаемо; смотрите `/health`.

## Как поднимали (хронология)

1. USB Ubuntu Server 24.04.5 (Rufus DD) → Lenovo UEFI.
2. Установка на NVMe Samsung; OpenSSH; пользователь `sa`.
3. Wi‑Fi netplan (`/etc/netplan/99-wifi.yaml`, SSID локальной сети).
4. SSH-ключ с ASUS → `~/.ssh/authorized_keys` (через флешку `samostroy-bootstrap`).
5. Docker Engine; `docker compose up -d` (postgres + api).
6. Docker compose (postgres + api); sleep/suspend замаскированы; linger для user systemd.
7. Публичный HTTPS: **Cloudflare named tunnel** (`cloudflared tunnel login` → create → run).  
   Quick tunnel (`trycloudflare.com`) с этой сети нестабилен (QUIC timeout / error 1033).  
   ngrok агент с IP провайдера блокируется (`ERR_NGROK_9040`).

Скрипты: `deploy/server/`.

## Повседневные команды (на Lenovo)

```bash
cd ~/samostroy
docker compose ps
curl -s http://127.0.0.1:8787/health

systemctl --user status samostroy-tunnel
journalctl --user -u samostroy-tunnel -n 30 --no-pager
```

Рестарт стека:

```bash
cd ~/samostroy && docker compose up -d --build
systemctl --user restart samostroy-tunnel
```

## Секреты (не в git)

| Файл | Назначение |
|---|---|
| `/home/sa/samostroy/.env` | `FEEDBACK_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| `~/.config/samostroy/cloudflared.env` | `TUNNEL_TOKEN` (remotely managed) |
| ASUS `.env.production` | `VITE_FEEDBACK_API_URL`, `VITE_FEEDBACK_API_TOKEN`, Web3Forms |

Токен API в бандле Pages и в `.env` сервера **должен совпадать**.  
С GitHub Pages (HTTPS) нельзя звать `http://192.168.1.39:8787` (mixed content) — нужен HTTPS-туннель.

## Cloudflare Tunnel (факт на аккаунте)

| | |
|---|---|
| Account | `0d00d169f3cd37ff6d03bfd6e2803b05` |
| Named tunnel | `samostroy` / `ab87fe84-9ecf-4e30-9d72-239959d7eb3e` |
| Connector | systemd user `samostroy-tunnel` → `cloudflared tunnel run --token …` |
| Ingress | `http://127.0.0.1:8787` (remote config) |
| Статус | healthy (colo dme*) |

**Стабильный публичный hostname** требует зону DNS **в этом же** CF-аккаунте: CNAME `api.<домен>` → `ab87fe84-9ecf-4e30-9d72-239959d7eb3e.cfargotunnel.com`, затем hostname в ingress. Без домена CF Zero Trust Free также просит карту при активации — named tunnel при этом уже работает.

**Временно без домена:** `samostroy-quick.service` (trycloudflare.com). URL в `journalctl --user -u samostroy-quick` — при рестарте меняется; обновить `.env.production` и пересобрать Pages.

```bash
# переустановка named unit
bash deploy/server/install-cloudflared-systemd.sh
```

Затем на ASUS: `.env.production` → `VITE_FEEDBACK_API_URL=https://…` → `GITHUB_PAGES=1 npm run build` → `npx gh-pages -d dist`.

## Sleep / крышка

`deploy/server/disable-sleep.sh` — mask suspend + `HandleLidSwitch=ignore`.  
Ноут лучше держать на питании, крышку можно закрывать после скрипта.

## Синхронизация кода с ASUS

С рабочей машины (PowerShell), в одной LAN:

```powershell
cd D:\projects\samostroy
tar --exclude=node_modules --exclude=.git --exclude=deploy/usb-kit/downloads -cf - . |
  ssh sa@192.168.1.39 "cd ~/samostroy && tar xf -"
ssh sa@192.168.1.39 "cd ~/samostroy && docker compose up -d --build"
```

Либо `git pull` на сервере, если клон с GitHub настроен.

## Проверка с ASUS

```powershell
Invoke-RestMethod http://192.168.1.39:8787/health
Invoke-RestMethod "https://<ngrok-host>/health" -Headers @{ "ngrok-skip-browser-warning"="1" }
```

В CRM: Безопасность → Замечания / API — Base URL = публичный ngrok, токен = `FEEDBACK_TOKEN`.

## Telegram

Пока `TELEGRAM_*` пусты — notify в логе пропускается, email/Web3Forms может работать отдельно.  
Добавить токены в `/home/sa/samostroy/.env` → `docker compose up -d`.

## См. также

- `docker-compose.yml`
- `docs/modules/pro-local-ngrok.md` (исторически про туннель с Windows)
- `bots/feedback-bot/README.md`
- `docs/architecture.md`
