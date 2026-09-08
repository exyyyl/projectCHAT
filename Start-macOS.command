#!/bin/zsh
cd -- "${0:A:h}"
if ! command -v node >/dev/null 2>&1; then
  echo 'Нужен Node.js 22 или новее: https://nodejs.org'
  read '?Нажмите Enter для выхода.'
  exit 1
fi
node server/index.mjs
