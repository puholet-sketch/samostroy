#!/usr/bin/env bash
# Установка ngrok + systemd unit → постоянный туннель на :8787
# Usage: NGROK_AUTHTOKEN=... bash deploy/server/install-ngrok-systemd.sh
# Нужен sudo (пароль один раз).
set -euo pipefail

TOKEN="${NGROK_AUTHTOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  echo "Задайте NGROK_AUTHTOKEN"
  exit 1
fi

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) NGROK_ARCH=amd64 ;;
  aarch64|arm64) NGROK_ARCH=arm64 ;;
  *) echo "Unsupported arch: $ARCH"; exit 1 ;;
esac

TMP="$(mktemp -d)"
cd "$TMP"
curl -fsSL "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-${NGROK_ARCH}.tgz" -o ngrok.tgz
tar xzf ngrok.tgz
sudo install -m 755 ngrok /usr/local/bin/ngrok
rm -rf "$TMP"

mkdir -p "$HOME/.config/ngrok"
cat > "$HOME/.config/ngrok/ngrok.yml" <<EOF
version: "2"
authtoken: ${TOKEN}
EOF
chmod 600 "$HOME/.config/ngrok/ngrok.yml"

# User systemd — без root после первой установки бинарника
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/samostroy-ngrok.service" <<'EOF'
[Unit]
Description=СамоСтрой ngrok tunnel → localhost:8787
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/ngrok http 127.0.0.1:8787 --log=stdout
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now samostroy-ngrok.service

# linger so user services survive logout
if command -v loginctl >/dev/null 2>&1; then
  sudo loginctl enable-linger "$USER" || true
fi

echo "Ждём URL…"
sleep 4
curl -s http://127.0.0.1:4040/api/tunnels | head -c 2000 || true
echo
echo "Готово. Публичный URL: curl -s http://127.0.0.1:4040/api/tunnels"
