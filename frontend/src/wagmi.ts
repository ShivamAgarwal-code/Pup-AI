import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { avalancheFuji } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'TrendPup',
  projectId: 'YOUR_PROJECT_ID', // Replace with your WalletConnect project ID  
  chains: [avalancheFuji],
  ssr: false, // Disable SSR to avoid prerendering issues
});

// Ensure we export the chain for use in contracts
export { avalancheFuji };
