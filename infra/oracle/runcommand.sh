#!/usr/bin/env bash
# Run once on the VM (Ubuntu, as a sudo user): bash bootstrap.sh
# Installs Caddy, opens 80/443 in the OS firewall, serves /srv/media. Safe to re-run.
set -euo pipefail

sudo apt-get update -y
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
if [ ! -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg ]; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -y
fi
sudo apt-get install -y caddy

sudo mkdir -p /srv/media /var/log/caddy
sudo chown -R caddy:caddy /srv/media /var/log/caddy
echo "ok" | sudo tee /srv/media/health.txt >/dev/null

# Oracle's Ubuntu image ships iptables rules that block 80/443 even once the VCN allows them.
for p in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$p" -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 5 -p tcp --dport "$p" -j ACCEPT
done
sudo netfilter-persistent save 2>/dev/null || sudo apt-get install -y iptables-persistent

sudo tee /etc/caddy/Caddyfile >/dev/null <<'CADDY'
# Media origin for media.naarad.io. Static files only; Caddy gets and renews the TLS certificate itself.
media.naarad.io {
	root * /srv/media
	file_server {
		precompressed br gzip
	}
	encode zstd gzip
	header {
		Access-Control-Allow-Origin "https://naarad.io"
		Cache-Control "public, max-age=86400"
		X-Content-Type-Options nosniff
		-Server
	}
	@immutable path_regexp \.[0-9a-f]{8,}\.(js|css|mp3|m4a|webp|pmtiles)$
	header @immutable Cache-Control "public, max-age=31536000, immutable"
	log {
		output file /var/log/caddy/access.log {
			roll_size 10mb
			roll_keep 3
		}
	}
}
CADDY
sudo caddy validate --config /etc/caddy/Caddyfile
# validate runs as root and creates the log file; hand it back to the caddy user or the service cannot open it
sudo chown -R caddy:caddy /var/log/caddy
sudo systemctl enable --now caddy
sudo systemctl reload caddy
echo "Done. Check: curl -I https://media.naarad.io/health.txt"
