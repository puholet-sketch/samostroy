#!/usr/bin/env bash
# Temporary public HTTPS via localhost.run → :8787 (systemd --user)
# Use when Cloudflare quick tunnel (trycloudflare) returns 1033 from this network.
# URL in: journalctl --user -u samostroy-lhr | grep lhr.life
set -euo pipefail

mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/samostroy-lhr.service" <<'EOF'
[Unit]
Description=Samostroy localhost.run tunnel to :8787
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes -R 80:127.0.0.1:8787 nokey@localhost.run
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now samostroy-lhr.service
if command -v loginctl >/dev/null 2>&1; then
  sudo loginctl enable-linger "$USER" || true
fi

sleep 8
systemctl --user --no-pager --full status samostroy-lhr.service | head -20 || true
echo
echo "URL: journalctl --user -u samostroy-lhr -n 40 --no-pager | grep -oE 'https://[a-z0-9]+\\.lhr\\.life'"
echo "Health: curl -sS \"\$(that-url)/health\""
echo "Then update ASUS .env.production VITE_FEEDBACK_API_URL and rebuild Pages."
