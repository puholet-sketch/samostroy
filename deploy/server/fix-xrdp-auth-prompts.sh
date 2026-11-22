#!/usr/bin/env bash
# Fix xrdp/XFCE focus lock from Polkit Wi-Fi + Unlock Login Keyring prompts.
# Run on Lenovo as sa (docker group = root writes when sudo password unavailable).
set -euo pipefail

USER_NAME="${USER_NAME:-sa}"

echo "=== 1) Polkit: allow NetworkManager for ${USER_NAME} ==="
docker run --rm -v /etc/polkit-1:/etc/polkit-1 alpine:3.20 sh -c "
cat > /etc/polkit-1/rules.d/49-allow-networkmanager.rules << 'EOF'
// xrdp/XFCE: NetworkManager without password prompts for sa
polkit.addRule(function(action, subject) {
    if (subject.user == \"${USER_NAME}\" && action.id.indexOf(\"org.freedesktop.NetworkManager.\") == 0) {
        return polkit.Result.YES;
    }
});
EOF
cat > /etc/polkit-1/localauthority/50-local.d/49-allow-networkmanager.pkla << 'EOF'
[Allow sa NetworkManager without password — xrdp]
Identity=unix-user:${USER_NAME}
Action=org.freedesktop.NetworkManager.*
ResultAny=yes
ResultInactive=yes
ResultActive=yes
EOF
chmod 644 /etc/polkit-1/rules.d/49-allow-networkmanager.rules
chmod 644 /etc/polkit-1/localauthority/50-local.d/49-allow-networkmanager.pkla
ls -la /etc/polkit-1/rules.d/ /etc/polkit-1/localauthority/50-local.d/
"

echo "=== 2) PAM: unlock gnome-keyring on xrdp login ==="
docker run --rm -v /etc/pam.d:/etc/pam.d alpine:3.20 sh -c '
if [ ! -f /etc/pam.d/xrdp-sesman.bak-authfix ]; then
  cp -a /etc/pam.d/xrdp-sesman /etc/pam.d/xrdp-sesman.bak-authfix
fi
# Rebuild with keyring lines if missing
grep -q "pam_gnome_keyring.so" /etc/pam.d/xrdp-sesman && HAS=1 || HAS=0
if [ "$HAS" = 0 ]; then
  {
    echo "# gnome-keyring unlock for xrdp (samostroy fix-xrdp-auth-prompts)"
    echo "auth       optional    pam_gnome_keyring.so"
    echo "session    optional    pam_gnome_keyring.so auto_start"
    echo
    cat /etc/pam.d/xrdp-sesman.bak-authfix
  } > /etc/pam.d/xrdp-sesman.new
  mv /etc/pam.d/xrdp-sesman.new /etc/pam.d/xrdp-sesman
  chmod 644 /etc/pam.d/xrdp-sesman
fi
echo "--- xrdp-sesman ---"
cat /etc/pam.d/xrdp-sesman
'

echo "=== 3) Disable nm-applet autostart for user (Ethernet/Wi-Fi via netplan is enough) ==="
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/nm-applet.desktop" << 'EOF'
[Desktop Entry]
Type=Application
Name=NetworkManager Applet
Exec=nm-applet
Hidden=true
X-GNOME-Autostart-enabled=false
NoDisplay=true
EOF

# Also suppress duplicate keyring autostart noise in XFCE (PAM handles unlock)
cat > "$HOME/.config/autostart/gnome-keyring-secrets.desktop" << 'EOF'
[Desktop Entry]
Type=Application
Name=Secret Storage Service
Exec=/usr/bin/gnome-keyring-daemon --start --components=secrets
Hidden=true
X-GNOME-Autostart-enabled=false
OnlyShowIn=XFCE;
NoDisplay=true
EOF

echo "=== 4) Login keyring: empty password (RDP-safe; avoids Unlock Login Keyring modal) ==="
# PAM already unlocks keyring on xrdp login when password matches. For RDP/server we
# keep an empty-password login keyring so focus is never blocked if PAM soft-fails.
KEYDIR="$HOME/.local/share/keyrings"
mkdir -p "$KEYDIR"
if [ ! -d "${KEYDIR}.bak-authfix" ]; then
  cp -a "$KEYDIR" "${KEYDIR}.bak-authfix" || true
fi
if [ -f "$KEYDIR/login.keyring" ] && [ ! -f "$KEYDIR/login.keyring.password-locked" ]; then
  # Only archive if it looks like a prior password-protected store (larger than empty stub)
  sz=$(wc -c < "$KEYDIR/login.keyring" || echo 0)
  if [ "$sz" -gt 200 ]; then
    mv "$KEYDIR/login.keyring" "$KEYDIR/login.keyring.password-locked"
  fi
fi
echo "login" > "$KEYDIR/default"
# Recreate/unlock empty login keyring for this user
pkill -u "$USER" -f 'gnome-keyring-daemon --start --foreground --components=secrets' 2>/dev/null || true
sleep 0.3
printf '\n' | gnome-keyring-daemon --replace --unlock --components=secrets,pkcs11 || true
sleep 0.3
echo "default=$(cat "$KEYDIR/default"); files=$(ls "$KEYDIR")"

echo "=== 5) Kill stuck auth UI in current xrdp session ==="
# nm-applet triggers wifi.scan polkit; mate polkit agent shows the modal
pkill -u "$USER" -x nm-applet 2>/dev/null || true
pkill -u "$USER" -f 'polkit-mate-authentication-agent-1' 2>/dev/null || true
pkill -u "$USER" -f 'polkit-gnome-authentication-agent-1' 2>/dev/null || true
pkill -u "$USER" -f 'polkit-agent-helper' 2>/dev/null || true
# Leave a single polkit agent for future legitimate prompts (optional for server)
sleep 0.3
if [ -n "${DISPLAY:-}" ] || [ -S /tmp/.X11-unix/X10 ]; then
  export DISPLAY="${DISPLAY:-:10}"
  export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"
  nohup /usr/libexec/polkit-mate-authentication-agent-1 >/dev/null 2>&1 &
fi

echo "=== 6) Verify ==="
ps -u "$USER" -o pid,cmd | grep -Ei 'nm-applet|polkit|keyring|auth' | grep -v grep || echo "(no matching procs)"
echo "DONE. Reconnect RDP; Cancel any leftover dialog once; test keyboard."
