'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { ACCESS_FEE_CONTRACT, FEE_AMOUNT } from '../config/contract';
import { FaLock, FaSpinner, FaCheckCircle, FaWallet } from 'react-icons/fa';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Image from 'next/image';

interface AccessControlProps {
  children: React.ReactNode;
}

export default function AccessControl({ children }: AccessControlProps) {
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  // Check if user has paid access fee
  const { data: hasAccess, isLoading: isCheckingAccess, refetch: refetchAccess } = useReadContract({
    ...ACCESS_FEE_CONTRACT,
    functionName: 'hasPaid',
    args: address ? [address] : undefined,
  });

  // Write contract for payment
  const { writeContract, data: paymentHash, isPending: isPaymentPending } = useWriteContract();

  // Wait for payment confirmation
  const { isLoading: isConfirming, isSuccess: isPaymentConfirmed } = useWaitForTransactionReceipt({
    hash: paymentHash,
  });

  // Handle payment success
  useEffect(() => {
    if (isPaymentConfirmed) {
      setIsLoading(false);
      setError(null);
      setShowPayment(false);
      // Refetch access status
      refetchAccess();
    }
  }, [isPaymentConfirmed, refetchAccess]);

  const handlePayment = async () => {
    if (!address) return;
    
    setIsLoading(true);
    setError(null);

    try {
      writeContract({
        ...ACCESS_FEE_CONTRACT,
        functionName: 'pay',
        value: BigInt(FEE_AMOUNT),
      });
    } catch (err) {
      console.error('Payment error:', err);
      setError('Failed to process payment. Please try again.');
      setIsLoading(false);
    }
  };

  // Show loading state while checking access
  if (isCheckingAccess) {
    return (
      <div className="min-h-screen dashboard-bg flex items-center justify-center">
        <div className="bg-white/95 rounded-3xl shadow-2xl border border-trendpup-brown/10 p-8 max-w-md w-full text-center">
          <FaSpinner className="animate-spin text-4xl text-trendpup-orange mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-trendpup-dark mb-2">Checking Access...</h2>
          <p className="text-gray-600">Please wait while we verify your access status.</p>
        </div>
      </div>
    );
  }

  // Show wallet connection requirement
  if (!isConnected) {
    return (
      <div className="min-h-screen dashboard-bg flex items-center justify-center">
        <div className="bg-white/95 rounded-3xl shadow-2xl border border-trendpup-brown/10 p-8 md:p-12 max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <Image 
              src="/trendpup-logo.png" 
              alt="TrendPup Logo" 
              width={150} 
              height={150}
              priority
              className="rounded-full"
            />
          </div>
          
          <h1 className="text-3xl font-bold text-trendpup-dark mb-2">TrendPup AI</h1>
          <p className="text-gray-600 mb-6 text-sm">
            Connect your wallet to access TrendPup's premium memecoin intelligence.
          </p>
          
          <div className="flex items-center justify-center mb-6">
            <FaWallet className="text-trendpup-orange mr-2" />
            <span className="text-trendpup-dark font-medium">Wallet Connection Required</span>
          </div>

          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  // Show payment requirement if user hasn't paid
  if (!hasAccess && !showPayment) {
    return (
      <div className="min-h-screen dashboard-bg flex items-center justify-center">
        <div className="bg-white/95 rounded-3xl shadow-2xl border border-trendpup-brown/10 p-8 md:p-12 max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <Image 
              src="/trendpup-logo.png" 
              alt="TrendPup Logo" 
              width={150} 
              height={150}
              priority
              className="rounded-full"
            />
          </div>
          
          <h1 className="text-3xl font-bold text-trendpup-dark mb-2">Premium Access Required</h1>
          <p className="text-gray-600 mb-6 text-sm">
            TrendPup is a premium service that requires a one-time access fee to prevent spam and ensure quality.
          </p>
          
          <div className="bg-gradient-to-br from-trendpup-beige/50 to-trendpup-beige p-6 rounded-xl mb-6">
            <div className="flex items-center justify-center mb-4">
              <FaLock className="text-trendpup-orange mr-2 text-2xl" />
              <span className="text-xl font-bold text-trendpup-dark">0.2 AVAX</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">One-time access fee on Avalanche Fuji Testnet</p>
            <div className="text-xs text-gray-500 space-y-1">
              <p>✓ Lifetime access to TrendPup AI</p>
              <p>✓ Real-time memecoin tracking</p>
              <p>✓ AI-powered trend analysis</p>
              <p>✓ Premium dashboard features</p>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setShowPayment(true)}
              className="w-full px-6 py-3 bg-trendpup-orange hover:bg-trendpup-orange/90 text-white rounded-lg font-semibold transition-colors shadow-lg"
            >
              Pay Access Fee
            </button>
            
            <p className="text-xs text-gray-500">
              This payment is processed on the Avalanche Fuji testnet. Make sure you have sufficient AVAX for the transaction.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show payment confirmation screen
  if (!hasAccess && showPayment) {
    return (
      <div className="min-h-screen dashboard-bg flex items-center justify-center">
        <div className="bg-white/95 rounded-3xl shadow-2xl border border-trendpup-brown/10 p-8 md:p-12 max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <Image 
              src="/trendpup-logo.png" 
              alt="TrendPup Logo" 
              width={150} 
              height={150}
              priority
              className="rounded-full"
            />
          </div>
          
          <h1 className="text-3xl font-bold text-trendpup-dark mb-2">Confirm Payment</h1>
          <p className="text-gray-600 mb-6 text-sm">
            You're about to pay 0.2 AVAX to gain lifetime access to TrendPup AI.
          </p>
          
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 p-6 rounded-xl mb-6">
            <div className="flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-orange-600">0.2 AVAX</span>
            </div>
            <p className="text-sm text-orange-700 mb-2">One-time access fee</p>
            <div className="text-xs text-orange-600 space-y-1">
              <p>✓ Secure blockchain payment</p>
              <p>✓ Lifetime access guaranteed</p>
              <p>✓ No recurring charges</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handlePayment}
              disabled={isLoading || isPaymentPending || isConfirming}
              className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors shadow-lg flex items-center justify-center"
            >
              {(isLoading || isPaymentPending || isConfirming) ? (
                <>
                  <FaSpinner className="animate-spin mr-2" />
                  {isPaymentPending ? 'Confirming Payment...' : isConfirming ? 'Processing...' : 'Preparing...'}
                </>
              ) : (
                <>
                  <FaCheckCircle className="mr-2" />
                  Pay 0.2 AVAX
                </>
              )}
            </button>
            
            <button
              onClick={() => setShowPayment(false)}
              disabled={isLoading || isPaymentPending || isConfirming}
              className="w-full px-6 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              Back
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Your wallet will prompt you to confirm this transaction. The payment will be processed on the blockchain.
          </p>
        </div>
      </div>
    );
  }

  // User has access, render the main app
  if (hasAccess) {
    return <>{children}</>;
  }

  // Fallback loading state
  return (
    <div className="min-h-screen dashboard-bg flex items-center justify-center">
      <div className="bg-white/95 rounded-3xl shadow-2xl border border-trendpup-brown/10 p-8 max-w-md w-full text-center">
        <FaSpinner className="animate-spin text-4xl text-trendpup-orange mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-trendpup-dark mb-2">Loading...</h2>
        <p className="text-gray-600">Please wait while we load your dashboard.</p>
      </div>
    </div>
  );
}
