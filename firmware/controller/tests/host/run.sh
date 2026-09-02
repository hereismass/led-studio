#!/bin/sh
set -eu

script_directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
controller_directory=$(CDPATH= cd -- "$script_directory/../.." && pwd)
build_directory=$(mktemp -d)
compiler=${LED_STUDIO_CC:-cc}

cleanup() {
  rm -rf -- "$build_directory"
}
trap cleanup EXIT HUP INT TERM

"$compiler" \
  -std=c11 \
  -Wall \
  -Wextra \
  -Werror \
  -pedantic \
  -I"$controller_directory/include" \
  "$controller_directory/src/controller_runtime.c" \
  "$script_directory/test_controller_runtime.c" \
  -o "$build_directory/controller-runtime-tests"

"$build_directory/controller-runtime-tests"
