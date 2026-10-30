#!/usr/bin/env bash
# =============================================================================
#  nz-proxy-azure.sh
#  Tạo 1 máy ảo Azure ở New Zealand (Auckland) có nhiều IP public.
#  Mỗi IP public = 1 proxy riêng (HTTP + SOCKS5, có user/mật khẩu).
#
#  CÁCH CHẠY (trong Azure Cloud Shell - Bash):
#      bash nz-proxy-azure.sh
#
#  TÙY CHỈNH (ghi trước lệnh bash), ví dụ:
#      N_IPS=5 bash nz-proxy-azure.sh                     # 5 IP (mặc định 10)
#      ALLOW_FROM=113.161.10.20 bash nz-proxy-azure.sh    # chỉ IP nhà bạn được dùng proxy
#
#  XÓA TOÀN BỘ (ngừng tính tiền):
#      az group delete -n nz-proxy-rg --yes
# =============================================================================
set -euo pipefail

# ------------------------------- Cấu hình ------------------------------------
RG="${RG:-nz-proxy-rg}"                       # tên nhóm tài nguyên
LOCATION="${LOCATION:-newzealandnorth}"       # Auckland, New Zealand
N_IPS="${N_IPS:-10}"                          # số IP = số proxy
VM_NAME="${VM_NAME:-nz-proxy-vm}"
VM_SIZE="${VM_SIZE:-Standard_D2als_v6}"      # tự đổi sang cỡ khác nếu hết chỗ
PROXY_USER="${PROXY_USER:-nzproxy}"
PROXY_PASS="${PROXY_PASS:-}"                  # để trống = tự tạo mật khẩu ngẫu nhiên
HTTP_BASE="${HTTP_BASE:-8000}"                # cổng HTTP:   8001, 8002, ...
SOCKS_BASE="${SOCKS_BASE:-1080}"              # cổng SOCKS5: 1081, 1082, ...
ALLOW_FROM="${ALLOW_FROM:-*}"                 # * = mọi nơi (vẫn cần mật khẩu)
THREEPROXY_TAG="${THREEPROXY_TAG:-0.9.9.0}"   # bản LTS của 3proxy
SUBNET_PREFIX="${SUBNET_PREFIX:-10.10.1}"
OUT_FILE="${OUT_FILE:-$HOME/nz-proxies.txt}"
IMAGE="Canonical:ubuntu-24_04-lts:server:latest"
FALLBACK_SIZES=(Standard_D2als_v6 Standard_D2ls_v6 Standard_D2als_v7 Standard_B2ats_v2 Standard_B1s)

# ------------------------------- Tiện ích ------------------------------------
log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*" >&2; }
die()  { printf '\033[1;31m[LỖI] %s\033[0m\n' "$*" >&2; exit 1; }

# Chạy lệnh az, nếu Azure báo bận (lỗi tạm thời) thì đợi rồi thử lại (tối đa 6 lần).
az_retry() {
  local n
  for n in 1 2 3 4 5 6; do
    if az "$@"; then return 0; fi
    ((n < 6)) || break
    warn "Azure đang bận, thử lại sau $((n * 10)) giây... (lần $n)"
    sleep $((n * 10))
  done
  return 1
}

# IP private thứ i: 1 -> .10 (IP chính), 2 -> .11, 3 -> .12 ...
private_ip() { echo "${SUBNET_PREFIX}.$((9 + $1))"; }

all_private_ips() {
  local i ips=()
  for ((i = 1; i <= N_IPS; i++)); do ips+=("$(private_ip "$i")"); done
  echo "${ips[*]}"
}

# port_range BASE N -> "BASE+1-BASE+N" (hoặc 1 cổng nếu N=1)
port_range() {
  local base=$1 n=$2
  if ((n == 1)); then echo "$((base + 1))"; else echo "$((base + 1))-$((base + n))"; fi
}

validate_config() {
  if ! [[ "$N_IPS" =~ ^[1-9][0-9]*$ ]] || ((N_IPS > 50)); then
    die "N_IPS phải là số từ 1 đến 50."
  fi
  [[ "$PROXY_USER" =~ ^[A-Za-z0-9_]{3,32}$ ]] || die "PROXY_USER chỉ gồm chữ, số, dấu _ (3-32 ký tự)."
  [[ "$PROXY_PASS" =~ ^[A-Za-z0-9_]{8,64}$ ]] || die "PROXY_PASS chỉ gồm chữ, số, dấu _ (ít nhất 8 ký tự)."
  if ! [[ "$HTTP_BASE" =~ ^[1-9][0-9]*$ && "$SOCKS_BASE" =~ ^[1-9][0-9]*$ ]]; then
    die "HTTP_BASE/SOCKS_BASE phải là số."
  fi
  if ! ((HTTP_BASE >= 1024 && SOCKS_BASE >= 1024 && HTTP_BASE + N_IPS <= 65535 && SOCKS_BASE + N_IPS <= 65535)); then
    die "Cổng phải nằm trong khoảng 1025-65535."
  fi
  if ! ((HTTP_BASE + N_IPS < SOCKS_BASE + 1 || SOCKS_BASE + N_IPS < HTTP_BASE + 1)); then
    die "Dải cổng HTTP và SOCKS5 bị trùng nhau."
  fi
}

# ------------------------ Nội dung cài lên máy ảo ----------------------------
# (Các file cài lên máy ảo chỉ dùng ký tự ASCII.)
# Cấu hình 3proxy: mỗi cặp cổng (HTTP + SOCKS5) đi ra internet bằng 1 IP riêng.
# $1 = 1: chặn truy cập vào mạng nội bộ/metadata của Azure (mặc định).
gen_3proxy_cfg() {
  local deny_private="${1:-1}" i ip
  cat <<EOF
# 3proxy - tao tu dong boi nz-proxy-azure.sh
nserver 168.63.129.16
nscache 65536
timeouts 1 5 30 60 180 1800 15 60
maxconn 200
log
auth strong
users ${PROXY_USER}:CL:${PROXY_PASS}
EOF
  if [[ "$deny_private" == 1 ]]; then
    echo "deny * * 127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.0.0/16,168.63.129.16/32"
  fi
  echo "allow ${PROXY_USER}"
  for ((i = 1; i <= N_IPS; i++)); do
    ip="$(private_ip "$i")"
    echo "proxy -a -p$((HTTP_BASE + i)) -e${ip}"
    echo "socks -p$((SOCKS_BASE + i)) -e${ip}"
  done
}

gen_unit() {
  cat <<'EOF'
[Unit]
Description=3proxy - NZ multi-IP proxy
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=proxy
Group=proxy
ExecStart=/usr/local/bin/3proxy /etc/3proxy/3proxy.cfg
Restart=always
RestartSec=3
LimitNOFILE=65535
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
}

# Script chạy trên máy ảo ở lần khởi động đầu (qua cloud-init).
gen_setup_script() {
  printf '#!/bin/bash\n'
  printf '# Cai dat proxy tren VM (cloud-init tu chay o lan khoi dong dau)\n'
  printf 'IPS=(%s)\n' "$(all_private_ips)"
  printf 'TAG=%q\n' "$THREEPROXY_TAG"
  cat <<'EOF'
set -euxo pipefail
exec >>/var/log/nzproxy-setup.log 2>&1

IFACE="$(ip -4 route show default | awk '{print $5; exit}')"
IFACE="${IFACE:-eth0}"

# 1) Dam bao cac IP private da gan vao card mang (thuong cloud-init da tu lam)
missing=()
for addr in "${IPS[@]}"; do
  ip -4 -o addr show dev "$IFACE" | grep -q " inet ${addr}/" || missing+=("$addr")
done
if [ "${#missing[@]}" -gt 0 ]; then
  {
    echo "network:"
    echo "  version: 2"
    echo "  ethernets:"
    echo "    ${IFACE}:"
    echo "      addresses:"
    for addr in "${missing[@]}"; do echo "        - ${addr}/24"; done
  } >/etc/netplan/60-nzproxy-ips.yaml
  chmod 600 /etc/netplan/60-nzproxy-ips.yaml
  netplan apply
  sleep 5
fi

# 2) Build 3proxy tu ma nguon chinh thuc (ban LTS)
for _ in 1 2 3; do
  rm -rf /opt/3proxy-src
  git clone --depth 1 --branch "$TAG" https://github.com/3proxy/3proxy.git /opt/3proxy-src && break
  sleep 10
done
make -C /opt/3proxy-src -f Makefile.Linux -j"$(nproc)" \
  OPENSSL_CHECK=false WOLFSSL_CHECK=false PCRE_CHECK=false PAM_CHECK=false
install -m 0755 /opt/3proxy-src/bin/3proxy /usr/local/bin/3proxy

# 3) Quyen file cau hinh + bat service
chown root:proxy /etc/3proxy/3proxy.cfg
chmod 640 /etc/3proxy/3proxy.cfg
systemctl daemon-reload
systemctl enable --now 3proxy.service
sleep 3
systemctl is-active --quiet 3proxy.service
touch /var/lib/nzproxy.done
echo "NZPROXY SETUP OK"
EOF
}

# Script tự kiểm tra: mỗi cổng phải đi ra internet bằng đúng IP của nó.
gen_selftest_script() {
  printf '#!/bin/bash\n'
  printf '# Kiem tra tung proxy: moi cong phai di ra internet bang dung IP cua no\n'
  printf 'U=%q\nP=%q\nHB=%q\nSB=%q\n' "$PROXY_USER" "$PROXY_PASS" "$HTTP_BASE" "$SOCKS_BASE"
  printf 'IPS=(%s)\n' "$(all_private_ips)"
  cat <<'EOF'
i=0
for addr in "${IPS[@]}"; do
  i=$((i + 1)); hp=$((HB + i)); sp=$((SB + i))
  h=$(curl -fsS --max-time 20 -x "http://${U}:${P}@127.0.0.1:${hp}" https://api.ipify.org 2>/dev/null) || h=FAIL
  s=$(curl -fsS --max-time 20 --socks5-hostname "127.0.0.1:${sp}" --proxy-user "${U}:${P}" https://api.ipify.org 2>/dev/null) || s=FAIL
  c=$(curl -fsS --max-time 20 -x "http://${U}:${P}@127.0.0.1:${hp}" https://ipinfo.io/country 2>/dev/null | tr -d '[:space:]')
  echo "RESULT ${i} ${addr} ${hp} ${sp} ${h:-FAIL} ${s:-FAIL} ${c:-?}"
done
EOF
}

indent6() { sed 's/^/      /'; }

gen_cloud_init() {
  cat <<EOF
#cloud-config
package_update: true
packages:
  - build-essential
  - git
  - curl
write_files:
  - path: /etc/3proxy/3proxy.cfg
    permissions: '0640'
    content: |
$(gen_3proxy_cfg 1 | indent6)
  - path: /etc/systemd/system/3proxy.service
    permissions: '0644'
    content: |
$(gen_unit | indent6)
  - path: /usr/local/sbin/nzproxy-setup.sh
    permissions: '0755'
    content: |
$(gen_setup_script | indent6)
  - path: /usr/local/sbin/nzproxy-selftest
    permissions: '0700'
    content: |
$(gen_selftest_script | indent6)
runcmd:
  - [bash, /usr/local/sbin/nzproxy-setup.sh]
EOF
}

# ------------------------------- Azure ---------------------------------------
# Chọn cỡ máy ảo còn chỗ và còn quota vCPU ở region.
pick_vm_size() {
  local usage totfree famfree s fam vcpu tried=" "
  local -a info
  usage="$(az vm list-usage -l "$LOCATION" --query "[].[name.value, limit, currentValue]" -o tsv 2>/dev/null || true)"
  totfree="$(awk 'tolower($1)=="cores"{print $2-$3}' <<<"$usage")"
  for s in "$VM_SIZE" "${FALLBACK_SIZES[@]}"; do
    [[ "$tried" == *" $s "* ]] && continue
    tried+="$s "
    # Kết quả TSV: dòng 1 = family, dòng 2 = số vCPU (hoặc "None" nếu cỡ này không dùng được)
    info=()
    mapfile -t info < <(az vm list-skus -l "$LOCATION" --resource-type virtualMachines --size "$s" \
      --query "[?name=='$s' && length(restrictions[?type=='Location'])==\`0\`] | [0].[family, capabilities[?name=='vCPUs'].value | [0]]" \
      -o tsv 2>/dev/null || true)
    fam="${info[0]:-}"; vcpu="${info[1]:-}"
    if [[ -z "$fam" || "$fam" == None || ! "$vcpu" =~ ^[0-9]+$ ]]; then
      warn "Cỡ $s không có ở $LOCATION với tài khoản này, thử cỡ khác..."
      continue
    fi
    famfree="$(awk -v f="$fam" 'tolower($1)==tolower(f){print $2-$3}' <<<"$usage")"
    if [[ -n "$famfree" && "$famfree" -lt "$vcpu" ]] || [[ -n "$totfree" && "$totfree" -lt "$vcpu" ]]; then
      warn "Hết quota vCPU cho $s, thử cỡ khác..."
      continue
    fi
    echo "$s"
    return 0
  done
  return 1
}

CREATING=0
STEP=""
TMPD=""
on_exit() {
  local rc=$?
  [[ -n "$TMPD" ]] && rm -rf "$TMPD"
  if ((rc != 0)) && [[ "$CREATING" == 1 ]]; then
    warn "Có lỗi khi tạo tài nguyên. Đang xóa nhóm '$RG' để không bị tính tiền..."
    az group delete -n "$RG" --yes --no-wait -o none 2>/dev/null || true
    warn "Đã gửi lệnh xóa. Đọc lỗi ở trên, sửa rồi chạy lại script."
    if [[ "$STEP" == vm ]]; then
      warn "Nếu lỗi do hết chỗ/hết quota máy ảo, đợi 2-3 phút (cho lệnh xóa chạy xong) rồi thử cỡ khác:"
      warn "    VM_SIZE=Standard_B1s bash nz-proxy-azure.sh"
    fi
  fi
}

# In bảng kết quả + danh sách proxy. Dùng: write_report "<output tự kiểm tra>"
N_OK=0
write_report() {
  local st_out="$1" i line status
  local -a f
  N_OK=0
  echo "=================================================================="
  echo " PROXY NEW ZEALAND - Azure ($LOCATION)"
  echo " User: $PROXY_USER    Mật khẩu: $PROXY_PASS"
  echo "=================================================================="
  printf ' %-3s %-16s %-6s %-7s %s\n' "#" "IP public" "HTTP" "SOCKS5" "Tự kiểm tra"
  for ((i = 1; i <= N_IPS; i++)); do
    line="$(grep -E "^RESULT $i " <<<"$st_out" | head -n 1 || true)"
    if [[ -z "$line" ]]; then
      status="chưa có kết quả"
    else
      read -r -a f <<<"$line" # RESULT i private http socks egress_http egress_socks country
      if [[ "${f[5]}" == "${PUBS[i]}" && "${f[6]}" == "${PUBS[i]}" ]]; then
        status="OK - ra đúng IP, quốc gia: ${f[7]}"
        N_OK=$((N_OK + 1))
      elif [[ "${f[5]}" == FAIL || "${f[6]}" == FAIL ]]; then
        status="LỖI - proxy không kết nối được"
      else
        status="SAI IP (ra ${f[5]})"
      fi
    fi
    printf ' %-3s %-16s %-6s %-7s %s\n' "$i" "${PUBS[i]}" "$((HTTP_BASE + i))" "$((SOCKS_BASE + i))" "$status"
  done
  echo "------------------------------------------------------------------"
  echo "Định dạng IP:PORT:USER:PASS"
  echo "HTTP:"
  for ((i = 1; i <= N_IPS; i++)); do echo "${PUBS[i]}:$((HTTP_BASE + i)):$PROXY_USER:$PROXY_PASS"; done
  echo "SOCKS5:"
  for ((i = 1; i <= N_IPS; i++)); do echo "${PUBS[i]}:$((SOCKS_BASE + i)):$PROXY_USER:$PROXY_PASS"; done
  echo "------------------------------------------------------------------"
  echo "Thử trên máy bạn:"
  echo "  curl -x http://$PROXY_USER:$PROXY_PASS@${PUBS[1]}:$((HTTP_BASE + 1)) https://ipinfo.io"
  echo "Xóa toàn bộ (ngừng tính tiền):"
  echo "  az group delete -n $RG --yes"
  echo "=================================================================="
}

main() {
  command -v az >/dev/null || die "Không thấy Azure CLI. Hãy chạy trong Azure Cloud Shell (Bash)."
  [[ -n "$PROXY_PASS" ]] || PROXY_PASS="$(openssl rand -hex 12)"
  validate_config
  az account show -o none 2>/dev/null || die "Chưa đăng nhập Azure. Chạy: az login"

  TMPD="$(mktemp -d)"
  trap on_exit EXIT

  log "Subscription: $(az account show --query name -o tsv) | Region: $LOCATION | Số proxy: $N_IPS"
  if [[ "$(az group exists -n "$RG" -o tsv)" =~ ^[Tt]rue$ ]]; then
    if [[ "$(az group show -n "$RG" --query properties.provisioningState -o tsv 2>/dev/null)" == Deleting ]]; then
      log "Nhóm '$RG' của lần chạy trước đang được xóa, đợi xóa xong (1-5 phút)..."
      az group wait --deleted -n "$RG" --timeout 1200 || die "Chờ xóa quá lâu. Thử lại sau vài phút."
    else
      die "Nhóm '$RG' đã tồn tại. Xóa bằng: az group delete -n $RG --yes   (hoặc chạy với RG=ten-khac)"
    fi
  fi

  log "1/7 Đăng ký dịch vụ Compute/Network (lần đầu có thể mất 1-2 phút)"
  local rp
  for rp in Microsoft.Network Microsoft.Compute; do
    az provider register -n "$rp" --wait -o none 2>/dev/null || warn "Không đăng ký được $rp (bỏ qua)"
  done

  log "2/7 Chọn cỡ máy ảo còn chỗ ở $LOCATION"
  VM_SIZE="$(pick_vm_size)" || die "Không còn cỡ máy ảo phù hợp ở $LOCATION (hết quota hoặc hết chỗ). Thử lại sau."
  echo "    Dùng cỡ: $VM_SIZE"

  CREATING=1
  log "3/7 Tạo nhóm tài nguyên + mạng ảo + tường lửa"
  az group create -n "$RG" -l "$LOCATION" --only-show-errors -o none
  az_retry network vnet create -g "$RG" -n nzproxy-vnet --address-prefixes 10.10.0.0/16 \
    --subnet-name default --subnet-prefixes "${SUBNET_PREFIX}.0/24" --only-show-errors -o none
  az_retry network nsg create -g "$RG" -n nzproxy-nsg --only-show-errors -o none
  az_retry network nsg rule create -g "$RG" --nsg-name nzproxy-nsg -n allow-proxy-ports \
    --priority 100 --direction Inbound --access Allow --protocol Tcp \
    --source-address-prefixes "$ALLOW_FROM" --source-port-ranges '*' \
    --destination-address-prefixes '*' \
    --destination-port-ranges "$(port_range "$HTTP_BASE" "$N_IPS")" "$(port_range "$SOCKS_BASE" "$N_IPS")" --only-show-errors -o none

  log "4/7 Tạo $N_IPS IP public tĩnh"
  local i
  for ((i = 1; i <= N_IPS; i++)); do
    az_retry network public-ip create -g "$RG" -n "nzproxy-ip$i" --sku Standard \
      --allocation-method Static --version IPv4 --only-show-errors -o none ||
      die "Không tạo được IP thứ $i. Có thể đã hết quota IP public: vào Quotas > Networking > New Zealand North > 'Public IP Addresses - Standard' xin tăng rồi chạy lại."
  done

  log "5/7 Tạo card mạng với $N_IPS IP"
  az_retry network nic create -g "$RG" -n nzproxy-nic --vnet-name nzproxy-vnet --subnet default \
    --network-security-group nzproxy-nsg --private-ip-address "$(private_ip 1)" \
    --public-ip-address nzproxy-ip1 --only-show-errors -o none
  for ((i = 2; i <= N_IPS; i++)); do
    az_retry network nic ip-config create -g "$RG" --nic-name nzproxy-nic -n "ipconfig$i" \
      --private-ip-address "$(private_ip "$i")" --public-ip-address "nzproxy-ip$i" --only-show-errors -o none
  done

  log "6/7 Tạo máy ảo $VM_NAME (Ubuntu 24.04, $VM_SIZE)"
  STEP=vm
  gen_cloud_init >"$TMPD/cloud-init.yaml"
  az vm create -g "$RG" -n "$VM_NAME" --image "$IMAGE" --size "$VM_SIZE" --nics nzproxy-nic \
    --admin-username azureuser --generate-ssh-keys --storage-sku StandardSSD_LRS \
    --custom-data "$TMPD/cloud-init.yaml" --only-show-errors -o none
  CREATING=0
  STEP=""

  log "7/7 Chờ máy ảo tự cài proxy và tự kiểm tra (khoảng 3-6 phút)..."
  local selftest
  selftest="$(az vm run-command invoke -g "$RG" -n "$VM_NAME" --command-id RunShellScript \
    --scripts "cloud-init status --wait >/dev/null 2>&1 || true; if [ -f /var/lib/nzproxy.done ]; then /usr/local/sbin/nzproxy-selftest; else echo SETUP_FAILED; tail -n 60 /var/log/nzproxy-setup.log; fi" \
    --query 'value[0].message' -o tsv 2>&1)" || true

  PUBS=()
  for ((i = 1; i <= N_IPS; i++)); do
    PUBS[i]="$(az network public-ip show -g "$RG" -n "nzproxy-ip$i" --query ipAddress -o tsv)"
  done

  write_report "$selftest" >"$OUT_FILE"
  echo
  cat "$OUT_FILE"

  if ((N_OK == N_IPS)); then
    log "XONG! $N_OK/$N_IPS proxy chạy đúng. Danh sách đã lưu ở $OUT_FILE (hãy copy ra chỗ khác)."
  else
    warn "Chỉ $N_OK/$N_IPS proxy qua kiểm tra. Kết quả thô từ máy ảo:"
    echo "$selftest"
    warn "Nếu máy ảo còn đang cài, đợi vài phút rồi kiểm tra lại bằng lệnh:"
    echo "  az vm run-command invoke -g $RG -n $VM_NAME --command-id RunShellScript --scripts /usr/local/sbin/nzproxy-selftest --query 'value[0].message' -o tsv"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
