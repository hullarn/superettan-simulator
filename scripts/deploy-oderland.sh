#!/usr/bin/env bash

set -Eeuo pipefail

readonly APP_DIR='/home/psdnahem/apps/slutspurten'
readonly RELEASES_DIR="$APP_DIR/.releases"
readonly CURRENT_LINK="$APP_DIR/.current"
readonly PUBLIC_URL='https://slutspurten.se'
readonly EXPECTED_SHA="${1:-}"
readonly RELEASE_ID="${2:-}"

if [[ ! "$EXPECTED_SHA" =~ ^[a-f0-9]{40}$ ]]; then
  echo 'Expected a full Git commit SHA as the first argument.' >&2
  exit 1
fi
if [[ ! "$RELEASE_ID" =~ ^[a-f0-9]{40}-[A-Za-z0-9_-]+$ ]]; then
  echo 'Invalid release identifier.' >&2
  exit 1
fi
if [[ "$PWD" != "$APP_DIR" ]]; then
  echo "Deployment must run from $APP_DIR." >&2
  exit 1
fi
if [[ "$(git rev-parse HEAD)" != "$EXPECTED_SHA" ]]; then
  echo "The checkout does not match $EXPECTED_SHA." >&2
  exit 1
fi

mkdir -p "$RELEASES_DIR" "$APP_DIR/tmp"

active_release="$APP_DIR"
if [[ -e "$CURRENT_LINK" ]]; then
  active_release="$(realpath "$CURRENT_LINK")"
fi
case "$active_release" in
  "$APP_DIR"|"$RELEASES_DIR"/*) ;;
  *)
    echo "Refusing unexpected active release path: $active_release" >&2
    exit 1
    ;;
esac

build_directory="$(mktemp -d "$RELEASES_DIR/.building-$RELEASE_ID.XXXXXX")"
previous_asset_list=''
temporary_asset_list=''
health_html=''
health_assets=''
next_link=''
rollback_link=''
activated='false'
deployment_verified='false'

cleanup() {
  if [[ "$activated" == 'true' && "$deployment_verified" != 'true' ]]; then
    echo "Release verification failed; restoring $active_release." >&2
    rollback_link="$APP_DIR/.current.rollback.$RELEASE_ID"
    if [[ "$active_release" == "$APP_DIR" ]]; then
      rm -f -- "$CURRENT_LINK"
    else
      ln -s "$active_release" "$rollback_link"
      mv -Tf -- "$rollback_link" "$CURRENT_LINK"
    fi
    touch "$APP_DIR/tmp/restart.txt"
  fi
  if [[ -n "$build_directory" && -d "$build_directory" ]]; then
    rm -rf -- "$build_directory"
  fi
  if [[ -n "$temporary_asset_list" && -f "$temporary_asset_list" ]]; then
    rm -f -- "$temporary_asset_list"
  fi
  if [[ -n "$health_html" && -f "$health_html" ]]; then
    rm -f -- "$health_html"
  fi
  if [[ -n "$health_assets" && -f "$health_assets" ]]; then
    rm -f -- "$health_assets"
  fi
  if [[ -n "$next_link" && -L "$next_link" ]]; then
    rm -f -- "$next_link"
  fi
  if [[ -n "$rollback_link" && -L "$rollback_link" ]]; then
    rm -f -- "$rollback_link"
  fi
}
trap cleanup EXIT

git archive "$EXPECTED_SHA" | tar -xf - -C "$build_directory"
printf '%s\n' "$EXPECTED_SHA" > "$build_directory/.release-sha"

(
  cd "$build_directory"
  export NEXT_DEPLOYMENT_ID="$EXPECTED_SHA"
  corepack pnpm install --frozen-lockfile
  corepack pnpm build
  find .next/static -type f -printf '%P\n' | LC_ALL=C sort > .release-assets
  test -s .release-assets
)

target_release="$RELEASES_DIR/$RELEASE_ID"
if [[ -e "$target_release" ]]; then
  echo "Release directory already exists: $target_release" >&2
  exit 1
fi
mv -- "$build_directory" "$target_release"
build_directory=''

copy_listed_assets() {
  local source_release="$1"
  local target_release_directory="$2"
  local asset_list="$3"
  local asset=''

  while IFS= read -r asset; do
    case "$asset" in
      ''|/*|../*|*/../*|*/..)
        echo "Invalid static asset path: $asset" >&2
        return 1
        ;;
    esac
    mkdir -p "$(dirname "$target_release_directory/.next/static/$asset")"
    cp -p -n -- \
      "$source_release/.next/static/$asset" \
      "$target_release_directory/.next/static/$asset"
  done < "$asset_list"
}

# Passenger may still serve HTML from the previous process while a browser starts
# loading the new page (or vice versa). Keep both adjacent builds' immutable,
# content-hashed assets available in both release directories during that window.
if [[ -d "$active_release/.next/static" ]]; then
  if [[ -s "$active_release/.release-assets" ]]; then
    previous_asset_list="$active_release/.release-assets"
  else
    temporary_asset_list="$(mktemp "$RELEASES_DIR/.legacy-assets.XXXXXX")"
    previous_asset_list="$temporary_asset_list"
    find "$active_release/.next/static" -type f -printf '%P\n' \
      | LC_ALL=C sort > "$previous_asset_list"
  fi
  copy_listed_assets "$active_release" "$target_release" "$previous_asset_list"
  copy_listed_assets "$target_release" "$active_release" "$target_release/.release-assets"
fi

next_link="$APP_DIR/.current.$RELEASE_ID"
ln -s "$target_release" "$next_link"
mv -Tf -- "$next_link" "$CURRENT_LINK"
touch "$APP_DIR/tmp/restart.txt"
activated='true'

new_release_ready='false'
for attempt in {1..45}; do
  health_response="$(
    curl --fail --silent --show-error \
      --connect-timeout 10 \
      --max-time 20 \
      --header 'Cache-Control: no-cache' \
      "$PUBLIC_URL/api/health?release=$EXPECTED_SHA&attempt=$attempt" \
      2>/dev/null || true
  )"
  if [[ "$health_response" == *"\"release\":\"$EXPECTED_SHA\""* ]]; then
    new_release_ready='true'
    break
  fi
  sleep 2
done

if [[ "$new_release_ready" != 'true' ]]; then
  echo "Passenger did not start release $EXPECTED_SHA." >&2
  exit 1
fi

health_html="$(mktemp "$RELEASES_DIR/.health-page.XXXXXX")"
health_assets="$(mktemp "$RELEASES_DIR/.health-assets.XXXXXX")"
curl --fail --silent --show-error \
  --retry 3 \
  --connect-timeout 10 \
  --max-time 30 \
  --header 'Cache-Control: no-cache' \
  --user-agent 'SlutspurtenDeploymentHealth/1.0' \
  "$PUBLIC_URL/?deployment-health=$EXPECTED_SHA" \
  > "$health_html"

grep -Fq "data-dpl-id=\"$EXPECTED_SHA\"" "$health_html"
grep -oE '(src|href)="/_next/static/[^"]+\.(css|js)(\?[^\"]*)?"' "$health_html" \
  | sed -E 's/^(src|href)="//; s/"$//' \
  | LC_ALL=C sort -u > "$health_assets"

grep -Eq '\.css(\?|$)' "$health_assets"
grep -Eq '\.js(\?|$)' "$health_assets"

while IFS= read -r asset; do
  result="$(
    curl --silent --show-error \
      --retry 3 \
      --connect-timeout 10 \
      --max-time 30 \
      --output /dev/null \
      --write-out '%{http_code} %{content_type}' \
      "$PUBLIC_URL$asset"
  )"
  status="${result%% *}"
  content_type="${result#* }"
  if [[ "$status" != '200' ]]; then
    echo "Static asset returned HTTP $status: $asset" >&2
    exit 1
  fi
  case "$asset" in
    *.css*) [[ "$content_type" == text/css* ]] ;;
    *.js*) [[ "$content_type" == *javascript* ]] ;;
  esac
done < "$health_assets"

deployment_verified='true'

# Keep the current release and several rollback candidates. Only release
# directories with the strictly validated naming format can be removed.
mapfile -t releases_by_age < <(
  find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d \
    -regextype posix-extended \
    -regex ".*/[a-f0-9]{40}-[A-Za-z0-9_-]+" \
    -printf '%T@ %p\n' \
    | sort -rn \
    | cut -d' ' -f2-
)
for ((index = 5; index < ${#releases_by_age[@]}; index += 1)); do
  stale_release="${releases_by_age[$index]}"
  if [[ "$stale_release" != "$target_release" ]]; then
    rm -rf -- "$stale_release"
  fi
done

echo "Release $EXPECTED_SHA is active and its page, CSS and JavaScript passed the health check."
