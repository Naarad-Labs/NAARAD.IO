# Oracle media origin

VM `naarad-web-prod` (Hyderabad, E2.1.Micro, 1 GB) serves static media at `media.naarad.io`.
DNS: A record `media` -> 140.245.207.20 at Hostinger (added 2026-11-09).

## One-time steps (owner)
1. OCI console > Networking > VCN > Security List: add ingress TCP 80 and 443 from 0.0.0.0/0.
2. Copy this folder to the VM and run `bash bootstrap.sh`.
3. `curl -I https://media.naarad.io/health.txt` returns 200.
4. Then follow docs/ops/cloudflare.md to put Cloudflare in front (needs the nameserver move or a proxied CNAME).

## Limits
- 1 GB RAM: Caddy only. Do not run Umami or listmonk here without more memory.
- Port 22 stays closed to the world; use an SSH key and restrict the source IP.
