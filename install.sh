#!/bin/sh
# Thingport quick install: curl -fsSL https://thingport.net/install.sh | sh
#
# Installs into ./thingport, or pass a directory:  curl -fsSL https://thingport.net/install.sh | sh -s -- ~/thingport
# Use another port than 80 with:                   curl -fsSL https://thingport.net/install.sh | WEB_PORT=8080 sh
#
# Downloads the published docker-compose.deploy.yml and .env.example from the repo, fills .env
# with a random AUTH_SECRET and database password, and starts the stack with Docker Compose.
set -eu

RAW_URL="https://raw.githubusercontent.com/TautvydasDerzinskas/Thingport/main"

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

random_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    od -An -tx1 -N"$1" /dev/urandom | tr -d ' \n'
  fi
}

main() {
  [ "$#" -le 1 ] || fail "Usage: sh install.sh [directory]"

  for dependency in curl docker; do
    command -v "$dependency" >/dev/null 2>&1 || fail "Install $dependency before running this script."
  done
  docker compose version >/dev/null 2>&1 || fail "Install the Docker Compose plugin before running this script."
  docker info >/dev/null 2>&1 || fail "Docker is not reachable. Start Docker and check that your user can access it."

  install_dir=${1:-./thingport}
  mkdir -p -- "$install_dir"
  cd -- "$install_dir"
  for existing in compose.yaml compose.yml docker-compose.yaml docker-compose.yml .env; do
    if [ -e "$existing" ] || [ -L "$existing" ]; then
      fail "Found $existing in $PWD. Use a new directory, or manage the existing installation with Docker Compose."
    fi
  done

  compose_tmp=$(mktemp ./thingport-compose.XXXXXX)
  env_tmp=$(mktemp ./thingport-env.XXXXXX)
  trap 'rm -f -- "$compose_tmp" "$env_tmp"' EXIT
  trap 'exit 1' HUP INT TERM

  printf '%s\n' "Downloading Thingport compose file..."
  curl -fsSL "$RAW_URL/docker-compose.deploy.yml" -o "$compose_tmp"
  curl -fsSL "$RAW_URL/.env.example" |
    awk -v secret="$(random_hex 32)" -v password="$(random_hex 24)" -v port="${WEB_PORT:-}" '
      /^AUTH_SECRET=/ { print "AUTH_SECRET=" secret; next }
      /^POSTGRES_PASSWORD=/ { print "POSTGRES_PASSWORD=" password; next }
      /^WEB_PORT=/ && port != "" { print "WEB_PORT=" port; next }
      { print }
    ' >"$env_tmp"
  chmod 644 "$compose_tmp"
  chmod 600 "$env_tmp"
  docker compose -f "$compose_tmp" --env-file "$env_tmp" config --quiet

  mv -- "$compose_tmp" docker-compose.yml
  mv -- "$env_tmp" .env
  trap - EXIT HUP INT TERM

  printf '%s\n' "Starting Thingport..."
  docker compose up -d

  port=$(sed -n 's/^WEB_PORT=//p' .env)
  port=${port:-80}
  if [ "$port" = "80" ]; then address="http://localhost"; else address="http://localhost:$port"; fi
  printf '\nThingport is starting. Open %s (or this machine'"'"'s address from another device).\n' "$address"
  printf '%s\n' "The first account you register becomes the admin."
  printf 'Installation directory: %s\n' "$PWD"
  printf '%s\n' "Your secrets are in .env there. Keep it; the database password is needed to start Thingport again."
  printf '%s\n' "Update later with: docker compose pull && docker compose up -d"
  printf '%s\n' "If the page does not load after a minute, check the logs:"
  printf '  cd "%s" && docker compose logs backend\n' "$PWD"
}

main "$@"
