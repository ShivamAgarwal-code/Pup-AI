const fs = require('fs');
const path = require('path');

// Copy Coinbase HeartbeatWorker.js to public/ for Next.js build workaround
const coinbaseWorker = './node_modules/@coinbase/wallet-sdk/dist/sign/walletlink/relay/connection/HeartbeatWorker.js';
const publicWorker = './public/HeartbeatWorker.js';

if (fs.existsSync(coinbaseWorker)) {
  // Read the original file
  let content = fs.readFileSync(coinbaseWorker, 'utf8');
  
  // Remove the export statement that causes build issues
  const cleanedContent = content.replace(/export\s*\{\s*\};\s*\/\/# sourceMappingURL=HeartbeatWorker\.js\.map/, '//# sourceMappingURL=HeartbeatWorker.js.map');
  
  // Write the modified content to public directory
  fs.writeFileSync(publicWorker, cleanedContent);
  console.log('Copied HeartbeatWorker.js to public/ (with export statement removed)');
  
  // Also directly modify the original file in node_modules to prevent build issues
  fs.writeFileSync(coinbaseWorker, cleanedContent);
  console.log('Modified original HeartbeatWorker.js in node_modules (with export statement removed)');
} else {
  console.error('Coinbase HeartbeatWorker.js not found!');
  process.exit(1);
}
