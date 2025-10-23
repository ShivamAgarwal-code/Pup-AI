@echo off
REM Copy Coinbase HeartbeatWorker.js to public/ for Next.js build workaround
setlocal

set "COINBASE_WORKER=./node_modules/.pnpm/@coinbase+wallet-sdk@4.3.3/node_modules/@coinbase/wallet-sdk/dist/sign/walletlink/relay/connection/HeartbeatWorker.js"
set "PUBLIC_WORKER=./public/HeartbeatWorker.js"

if exist "%COINBASE_WORKER%" (
    copy "%COINBASE_WORKER%" "%PUBLIC_WORKER%"
    echo Copied HeartbeatWorker.js to public/
) else (
    echo Coinbase HeartbeatWorker.js not found!
    exit /b 1
)
