#!/usr/bin/env bash
set -euo pipefail
# Desktop test engine only. Requires C compiler, make, Tcl, OpenSSL development headers.
# Nothing is installed globally or packaged into the application.
engine_dir=$(mktemp -d "${TMPDIR:-/tmp}/finanzas-sqlcipher-4.20.XXXXXX")
source_sha=355d4db92d3404e71faa8088d071a71d767807f4
curl --fail --location --silent --show-error "https://codeload.github.com/sqlcipher/sqlcipher/tar.gz/$source_sha" --output "$engine_dir/source.tar.gz"
printf '%s  %s\n' fc5394c916beeabb1f43e2ac97d0827f36e8917f6675a00cca54537c32cb36a2 "$engine_dir/source.tar.gz" | sha256sum --check --status
tar -xzf "$engine_dir/source.tar.gz" -C "$engine_dir"
cd "$engine_dir/sqlcipher-$source_sha"
CFLAGS='-DSQLITE_HAS_CODEC -DSQLCIPHER_CRYPTO_OPENSSL -O1' LDFLAGS='-lcrypto' ./configure --with-tempstore=yes > "$engine_dir/configure.log" 2>&1
make -j1 sqlite3.c > "$engine_dir/make.log" 2>&1
cc -shared -fPIC -O1 -DSQLITE_HAS_CODEC -DSQLCIPHER_CRYPTO_OPENSSL -DSQLITE_EXTRA_INIT=sqlcipher_extra_init -DSQLITE_EXTRA_SHUTDOWN=sqlcipher_extra_shutdown -DSQLITE_TEMP_STORE=2 -DSQLITE_THREADSAFE=1 -o libsqlcipher.so sqlite3.c -lcrypto -ldl -lpthread -lm
printf 'SQLCIPHER_LIBRARY=%s/libsqlcipher.so\n' "$PWD"
printf 'Test-only engine directory retained for inspection: %s\n' "$engine_dir"
