'use client';

import { useAccount, useReadContract } from 'wagmi';
import { ACCESS_FEE_CONTRACT } from '../config/contract';
import { FaCheckCircle, FaInfoCircle } from 'react-icons/fa';

export default function AccessStatus() {
  const { address } = useAccount();

  // Check if user has paid access fee
  const { data: hasAccess } = useReadContract({
    ...ACCESS_FEE_CONTRACT,
    functionName: 'hasPaid',
    args: address ? [address] : undefined,
  });

  if (!address || !hasAccess) return null;

  return (
    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-center">
      <FaCheckCircle className="mr-2 text-green-600" />
      <div className="flex-1">
        <p className="font-medium">Premium Access Active</p>
        <p className="text-sm text-green-600">You have lifetime access to Pup AI features</p>
      </div>
      <div className="ml-2">
        <FaInfoCircle className="text-green-600" title="Access verified on blockchain" />
      </div>
    </div>
  );
}
