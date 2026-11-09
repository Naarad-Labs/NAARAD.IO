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

## Status (2026-11-09)
- Live: `https://media.naarad.io/health.txt` on VM `naarad-media-origin` (152.70.76.230, Hyderabad). Built with cloud-init from `runcommand.sh`.
- The first VM (`naarad-web-prod`) was deleted: Oracle cannot add an SSH key to a running instance, and its Run Command agent never picked up jobs.
- Gotcha fixed in the scripts: `caddy validate` as root creates `/var/log/caddy/access.log` owned by root, so the service failed to load the config until the log was chowned to `caddy`.
- DNS must point at the VM before Caddy can get its certificate.
- The temporary SSH rule for Cloud Shell (152.67.178.91/32) was removed. To get back in: add TCP 22 from your current IP, then `ssh -i ~/.ssh/naarad_vm ubuntu@152.70.76.230` from Cloud Shell (key is in Cloud Shell home).
- Cloudflare (Free plan) is set up for naarad.io. Nameservers at Hostinger changed to bryce.ns.cloudflare.com and surina.ns.cloudflare.com on 2026-11-09 (propagation pending at the time). All records are DNS-only except `media` (proxied). SSL mode: Full. Apex and `www` stay DNS-only until GitHub issues its certificate, per docs/ops/cloudflare.md.
