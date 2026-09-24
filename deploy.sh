#!/usr/bin/env bash
#
# 平衡工作台 · 一键发布脚本
#
#   ./deploy.sh                 构建前后端 → 上传 → 重启服务 → 自检
#   ./deploy.sh --no-build      用现有 dist/ 与 dist-server/ 产物直接发布
#   ./deploy.sh --only backend  只发后端（改动了 server/ 时最快）
#   ./deploy.sh --only frontend 只发前端
#   ./deploy.sh --skip-verify   跳过后置自检
#   ./deploy.sh --dry-run       只打印将要执行的命令，不做任何改动
#   ./deploy.sh --help          查看帮助
#
# 可用环境变量覆盖目标与路径：
#   DEPLOY_HOST(114.214.241.56) DEPLOY_PORT(683) DEPLOY_USER(root)
#   PUBLIC_URL(http://$DEPLOY_HOST) WEB_ROOT(/var/www/work-life-balance/dist)
#   API_DIR(/opt/work-life-balance) SERVICE(work-life-balance-api)
#
# ⚠️ 前端与后端必须一起发布！
# 历史故障：586cc27 只发了前端、后端产物仍是上一版，导致 /api/auth/me 返回 404，
# 前端启动时 getCurrentUser() 抛错并 clearToken()，用户一刷新页面就被强制登出。
# 本脚本第 3 步会显式校验后端产物包含该路由，避免再次发生。
#
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-114.214.241.56}"
DEPLOY_PORT="${DEPLOY_PORT:-683}"
DEPLOY_USER="${DEPLOY_USER:-root}"
PUBLIC_URL="${PUBLIC_URL:-http://${DEPLOY_HOST}}"
WEB_ROOT="${WEB_ROOT:-/var/www/work-life-balance/dist}"
API_DIR="${API_DIR:-/opt/work-life-balance}"
SERVICE="${SERVICE:-work-life-balance-api}"
TARGET="${DEPLOY_USER}@${DEPLOY_HOST}"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10 -p "${DEPLOY_PORT}")
SCP_OPTS=(-o BatchMode=yes -o ConnectTimeout=10 -P "${DEPLOY_PORT}")
WEB_PARENT="$(dirname "${WEB_ROOT}")"
WEB_NAME="$(basename "${WEB_ROOT}")"
STAMP="$(date +%Y%m%d-%H%M%S)"

DO_BUILD=1
DO_VERIFY=1
DRY_RUN=0
ONLY=all

info()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m  !\033[0m %s\n' "$*"; }
die()   { printf '\033[1;31m  ✗ %s\033[0m\n' "$*" >&2; exit 1; }

usage() { sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'; exit 0; }

run() {
  if [ "${DRY_RUN}" = 1 ]; then
    printf '\033[0;36m  [dry-run]\033[0m %s\n' "$*"
  else
    "$@"
  fi
}

remote() { run ssh "${SSH_OPTS[@]}" "${TARGET}" "$@"; }

md5of() {
  if command -v md5 >/dev/null 2>&1; then md5 -q "$1"; else md5sum "$1" | awk '{print $1}'; fi
}

md5pipe() {
  if command -v md5 >/dev/null 2>&1; then md5 -q; else md5sum | awk '{print $1}'; fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    --no-build)    DO_BUILD=0 ;;
    --skip-verify) DO_VERIFY=0 ;;
    --dry-run)     DRY_RUN=1 ;;
    --only)        ONLY="${2:-}"; shift
                   [ "${ONLY}" = "frontend" ] || [ "${ONLY}" = "backend" ] || die "--only 只支持 frontend 或 backend" ;;
    -h|--help)     usage ;;
    *)             die "未知参数：$1（用 --help 查看用法）" ;;
  esac
  shift
done

cd "$(dirname "$0")"

# ---------- 0. 前置检查 ----------
info "目标 ${TARGET}:${DEPLOY_PORT} · 站点 ${PUBLIC_URL} · 服务 ${SERVICE}"
if [ -d .git ]; then
  info "本地版本 $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    warn "工作区存在未提交改动，这些改动同样会被发布上线"
  fi
fi

info "步骤 0/5 检查 SSH 免密登录"
if [ "${DRY_RUN}" = 0 ]; then
  ssh "${SSH_OPTS[@]}" "${TARGET}" true 2>/dev/null \
    || die "SSH 登录失败。请先执行：ssh-copy-id -i ~/.ssh/id_ed25519.pub -p ${DEPLOY_PORT} ${TARGET}"
  ok "SSH 免密登录正常"
  ssh "${SSH_OPTS[@]}" "${TARGET}" "test -f ${API_DIR}/.env && command -v node >/dev/null && systemctl list-unit-files '${SERVICE}.service' | grep -q ${SERVICE}" \
    || die "服务器缺少 .env / node / systemd 单元 ${SERVICE}"
  ok "服务器 .env、node、${SERVICE}.service 均就绪"
else
  printf '\033[0;36m  [dry-run]\033[0m ssh %s true\n' "${TARGET}"
fi

# ---------- 1. 构建 ----------
if [ "${DO_BUILD}" = 1 ]; then
  info "步骤 1/5 构建产物"
  [ "${ONLY}" != "backend" ]  && run npm run build
  [ "${ONLY}" != "frontend" ] && run npm run server:build
else
  warn "步骤 1/5 跳过构建（--no-build），直接使用现有产物"
fi

if [ "${DRY_RUN}" = 0 ]; then
  if [ "${ONLY}" != "backend" ]; then
    [ -f dist/index.html ] || die "缺少 dist/index.html，请去掉 --no-build 或先执行 npm run build"
    find dist -name '.DS_Store' -delete 2>/dev/null || true
    ASSET_JS="$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' dist/index.html | head -1 || true)"
    [ -n "${ASSET_JS}" ] || die "无法从 dist/index.html 解析出 JS 产物名"
    ok "前端产物 ${ASSET_JS}"
  fi
  if [ "${ONLY}" != "frontend" ]; then
    [ -f dist-server/index.js ] || die "缺少 dist-server/index.js，请先执行 npm run server:build"
    grep -q 'api/auth/me' dist-server/index.js \
      || die "后端产物缺少 /api/auth/me，请重新构建（npm run server:build）—— 前端刷新会被强制登出"
    ok "后端产物 dist-server/index.js（含 /api/auth/me）"
  fi
fi

# ---------- 2. 发布前端（远端目录原子切换，保留上一版可回滚） ----------
if [ "${ONLY}" != "backend" ]; then
  info "步骤 2/5 发布前端 → ${WEB_ROOT}"
  remote "rm -rf ${WEB_ROOT}-next && mkdir -p ${WEB_ROOT}-next"
  run scp "${SCP_OPTS[@]}" -r dist/. "${TARGET}:${WEB_ROOT}-next/"
  remote "cd ${WEB_PARENT} && rm -rf ${WEB_NAME}-prev && { [ -d ${WEB_NAME} ] && mv ${WEB_NAME} ${WEB_NAME}-prev || true; } && mv ${WEB_NAME}-next ${WEB_NAME} && ls -la ${WEB_NAME}"
  ok "前端已切换，上一版保留在 ${WEB_ROOT}-prev"
fi

# ---------- 3. 发布后端（先备份，再校验 md5） ----------
if [ "${ONLY}" != "frontend" ]; then
  info "步骤 3/5 发布后端 → ${API_DIR}/server/index.js"
  remote "cp -p ${API_DIR}/server/index.js ${API_DIR}/server/index.js.bak-${STAMP}"
  ok "已备份线上产物 → server/index.js.bak-${STAMP}"
  remote "ls -1t ${API_DIR}/server/index.js.bak-* 2>/dev/null | tail -n +6 | xargs -r rm -f; ls -1t ${API_DIR}/server/index.js.bak-* 2>/dev/null | wc -l"
  ok "备份清理完成（只保留最近 5 份）"
  run scp "${SCP_OPTS[@]}" dist-server/index.js "${TARGET}:${API_DIR}/server/index.js"
  if [ "${DRY_RUN}" = 0 ]; then
    LOCAL_MD5="$(md5of dist-server/index.js)"
    REMOTE_MD5="$(ssh "${SSH_OPTS[@]}" "${TARGET}" "md5sum ${API_DIR}/server/index.js" | awk '{print $1}')"
    [ "${LOCAL_MD5}" = "${REMOTE_MD5}" ] || die "后端产物 md5 不一致（本地 ${LOCAL_MD5} / 线上 ${REMOTE_MD5}）"
    ok "后端产物 md5 校验通过（${LOCAL_MD5}）"
  fi
fi

# ---------- 4. 重启服务 ----------
info "步骤 4/5 重启 ${SERVICE}"
remote "systemctl restart ${SERVICE} && sleep 2 && systemctl is-active ${SERVICE} && systemctl is-enabled ${SERVICE}"

# ---------- 5. 线上自检 ----------
if [ "${DO_VERIFY}" = 1 ] && [ "${DRY_RUN}" = 0 ]; then
  info "步骤 5/5 线上自检"
  HEALTH="$(curl -fsS -m 10 "${PUBLIC_URL}/api/health" || true)"
  case "${HEALTH}" in
    *'"ok":true'*) ok "/api/health → ${HEALTH}" ;;
    *) die "/api/health 异常：${HEALTH:-无响应}" ;;
  esac
  ME_CODE="$(curl -s -o /dev/null -m 10 -w '%{http_code}' "${PUBLIC_URL}/api/auth/me" || true)"
  case "${ME_CODE}" in
    401) ok "/api/auth/me → 401（路由存在且鉴权生效，前端刷新不会再被登出）" ;;
    404) die "/api/auth/me → 404：线上后端仍是旧版本，请确认第 3 步上传与第 4 步重启是否成功" ;;
    *)   warn "/api/auth/me 预期 401，实际 ${ME_CODE}" ;;
  esac
  if [ "${ONLY}" != "backend" ]; then
    REMOTE_MD5="$(curl -fsS -m 20 "${PUBLIC_URL}/${ASSET_JS}" | md5pipe || true)"
    [ "${REMOTE_MD5}" = "$(md5of "dist/${ASSET_JS}")" ] || die "线上 JS 与本地不一致（${ASSET_JS}）"
    curl -fsS -m 10 "${PUBLIC_URL}/" | grep -q "${ASSET_JS}" || die "线上 index.html 未引用新产物"
    ok "线上前端与本地构建完全一致（${ASSET_JS}）"
  fi
  ssh "${SSH_OPTS[@]}" "${TARGET}" "systemctl is-active ${SERVICE}; journalctl -u ${SERVICE} -n 5 --no-pager | tail -5"
else
  warn "步骤 5/5 已跳过线上自检"
fi

# ---------- 汇总 ----------
printf '\n'
info "发布完成 ✅  ${PUBLIC_URL}"
printf '  回滚后端： ssh -p %s %s "cp -p %s/server/index.js.bak-%s %s/server/index.js && systemctl restart %s"\n' \
  "${DEPLOY_PORT}" "${TARGET}" "${API_DIR}" "${STAMP}" "${API_DIR}" "${SERVICE}"
printf '  回滚前端： ssh -p %s %s "cd %s && rm -rf %s && mv %s-prev %s"\n' \
  "${DEPLOY_PORT}" "${TARGET}" "${WEB_PARENT}" "${WEB_NAME}" "${WEB_NAME}" "${WEB_NAME}"

