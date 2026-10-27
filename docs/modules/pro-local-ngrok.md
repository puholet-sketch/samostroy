# Pro: локальный API + туннель (ежедневный рестарт)

GitHub Pages — статика. Общая БД замечаний/отчётов живёт на этом ПК: Docker API `:8787`. Снаружи сайт достучится только через туннель.

## Текущий публичный URL (сессия)

`https://ester-representational-luana.ngrok-free.dev`  
(обновлять здесь и в gitignored `.env.production` при смене hostname)

## Разовый setup (ngrok)

1. CLI: `winget install Ngrok.Ngrok` или `%LOCALAPPDATA%\Microsoft\WinGet\Links\ngrok.exe`. Агент **≥ 3.20** (иначе `ERR_NGROK_121`); при старой версии: `ngrok update`.
2. Authtoken (один раз) с https://dashboard.ngrok.com/get-started/your-authtoken — **логин на сайте ≠ CLI**:

```powershell
ngrok config add-authtoken ВАШ_ТОКЕН
```

Не коммитить authtoken в git. Хранится в `%LOCALAPPDATA%\ngrok\ngrok.yml`.

3. В CRM / сборке: `VITE_FEEDBACK_API_URL=https://….ngrok-free.dev` (или `.ngrok-free.app`), `VITE_FEEDBACK_API_TOKEN=local-dev-token` (тот же, что `FEEDBACK_TOKEN` в compose).

## Запасной туннель (cloudflared)

```powershell
& "$env:LOCALAPPDATA\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:8787 --protocol http2
```

URL вида `https://….trycloudflare.com` — в логе. Free hostname меняется при каждом рестарте. Перед стартом ngrok остановите cloudflared, если он уже слушает `:8787`.

## Каждый день (или после сна ПК)

```powershell
cd D:\projects\samostroy
docker compose up -d
# проверка: http://127.0.0.1:8787/health → ok

# предпочтительно ngrok (окно открытым или фон):
ngrok http 8787
# либо cloudflared (см. выше)
```

Публичный URL ngrok: `http://127.0.0.1:4040/api/tunnels` → `public_url`.

Если туннель выдал **новый** hostname — обновить URL в «Безопасность → Замечания / API» или пересобрать Pages с новым `VITE_FEEDBACK_API_URL`.

## Проверка связи

```powershell
$url = "https://ester-representational-luana.ngrok-free.dev"
Invoke-RestMethod "$url/health" -Headers @{ "ngrok-skip-browser-warning" = "1" }
Invoke-RestMethod "$url/api/feedback" -Headers @{
  "X-Feedback-Token" = "local-dev-token"
  "ngrok-skip-browser-warning" = "1"
}
```

CORS: API отдаёт `Access-Control-Allow-Origin: *` и разрешает `ngrok-skip-browser-warning`. CRM с Pages шлёт его на каждый fetch.

## Важно

- ПК не должен засыпать; Docker + туннель должны быть запущены, пока нужен общий API с Pages.
- Токен `local-dev-token` — для локального pro; на VPS смените.
- См. также: `docker-compose.yml`, `bots/feedback-bot/README.md`.
