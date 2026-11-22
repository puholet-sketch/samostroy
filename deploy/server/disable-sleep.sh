#!/usr/bin/env bash
# Отключить sleep/suspend на сервере (нужен sudo).
set -euo pipefail
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
sudo systemctl mask systemd-suspend.service systemd-hibernate.service 2>/dev/null || true
# Для ноутбука: не гасить по крышке (если есть logind)
if [[ -f /etc/systemd/logind.conf ]]; then
  sudo sed -i 's/^#\?HandleLidSwitch=.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
  sudo sed -i 's/^#\?HandleLidSwitchExternalPower=.*/HandleLidSwitchExternalPower=ignore/' /etc/systemd/logind.conf
  sudo systemctl restart systemd-logind.service || true
fi
echo "Sleep/suspend замаскированы."
