#!/usr/bin/env bash
# Install СамоСтрой host watchdog (Docker + LHR) as systemd --user timer.
# Run on Lenovo: bash deploy/server/install-watchdog-systemd.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT="$ROOT/deploy/server/watchdog-samostroy.sh"
UNIT_DIR="$HOME/.config/systemd/user"
SERVICE="samostroy-watchdog.service"
TIMER="samostroy-watchdog.timer"

chmod +x "$SCRIPT"
mkdir -p "$UNIT_DIR" "$HOME/.config/samostroy"

cat >"$UNIT_DIR/$SERVICE" <<EOF
[Unit]
Description=Samostroy watchdog (Docker API + LHR tunnel)
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
Environment=SAMOSTROY_ROOT=$ROOT
ExecStart=$SCRIPT
Nice=10
EOF

cat >"$UNIT_DIR/$TIMER" <<'EOF'
[Unit]
Description=Run Samostroy watchdog every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
AccuracySec=30s
Persistent=true
Unit=samostroy-watchdog.service

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "$TIMER"
if command -v loginctl >/dev/null 2>&1; then
  sudo loginctl enable-linger "$USER" || true
fi

# First run now (non-fatal if tunnel still warming)
systemctl --user start "$SERVICE" || true

echo
systemctl --user --no-pager status "$TIMER" | head -15 || true
echo
echo "Log:   ~/samostroy-watchdog.log"
echo "URL:   ~/.config/samostroy/public_api_url"
echo "Manual: systemctl --user start samostroy-watchdog.service"
echo "Timer:  systemctl --user list-timers samostroy-watchdog.timer"
