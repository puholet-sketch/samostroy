#!/usr/bin/env bash
# Named Cloudflare Tunnel → :8787 (systemd --user)
# Требует TUNNEL_TOKEN (remotely managed) в ~/.config/samostroy/cloudflared.env
# Бинарь: /usr/local/bin/cloudflared
set -euo pipefail

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Нет cloudflared в PATH. С ASUS: scp deploy/server/bin/cloudflared-linux-amd64 sa@host:/tmp/cloudflared"
  echo "  sudo install -m 755 /tmp/cloudflared /usr/local/bin/cloudflared"
  exit 1
fi

ENV_FILE="${HOME}/.config/samostroy/cloudflared.env"
if [[ ! -f "$ENV_FILE" ]] || ! grep -q '^TUNNEL_TOKEN=' "$ENV_FILE"; then
  echo "Создайте $ENV_FILE с строкой:"
  echo "  TUNNEL_TOKEN=<token из dash / API create tunnel>"
  echo "Токен один раз: Cloudflare dashboard → Zero Trust → Networks → Tunnels"
  echo "  или API POST /accounts/{id}/cfd_tunnel (config_src=cloudflare)"
  exit 1
fi

mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/samostroy-tunnel.service" <<'EOF'
[Unit]
Description=Samostroy cloudflared named tunnel to :8787
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=%h/.config/samostroy/cloudflared.env
ExecStart=/usr/local/bin/cloudflared tunnel --no-autoupdate --protocol http2 run --token ${TUNNEL_TOKEN}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now samostroy-tunnel.service
if command -v loginctl >/dev/null 2>&1; then
  sudo loginctl enable-linger "$USER" || true
fi

sleep 3
systemctl --user --no-pager --full status samostroy-tunnel.service | head -20 || true
echo
echo "Named tunnel: systemctl --user status samostroy-tunnel"
echo "Публичный hostname: зона DNS в том же CF-аккаунте → CNAME → <tunnel-id>.cfargotunnel.com"
echo "Временно (без домена): samostroy-quick.service → trycloudflare.com (URL в journal)"
