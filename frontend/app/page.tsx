"use client";

import { useEffect, useState } from "react";
import { verifyAuthorization } from "viem/utils";
import type { SignAuthorizationReturnType } from "viem";
import { walletClient } from "./utils/client";
import { owner } from "./owner";
import { signUserAuth, sendUserOperation } from "./utils/sign-user-op";

const EXPLORER_BASE = "https://sepolia.etherscan.io/tx/";

export default function Home() {
  const [authorization, setAuthorization] = useState<SignAuthorizationReturnType | null>(null);
  const [userOpTxnHash, setUserOpTxnHash] = useState<string>("");
  const [amount, setAmount] = useState<string>("0.001");
  const [toAddress, setToAddress] = useState<`0x${string}` | "">("");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const eoa = owner;

  useEffect(() => {
    const fetchAuth = async () => {
      const auth = await signUserAuth();
      setAuthorization(auth);
    };
    fetchAuth();
  }, []);

  const verifyAuth = async (authorization: SignAuthorizationReturnType) => {
    const valid = await verifyAuthorization({
      address: eoa.address,
      authorization,
    });
    return valid;
  };

  const handleAuth = async () => {
    try {
      setIsVerifying(true);
      const auth = await signUserAuth();
      setAuthorization(auth);

      const result = await verifyAuth(auth);
      if (result) {
        console.log("Authorization verified successfully.");
      } else {
        console.log("Authorization signature not valid, sending fallback tx...");
        await walletClient.sendTransaction({
          authorizationList: [auth],
          data: "0x",
          to: eoa.address,
        });
      }
    } catch (error) {
      console.error("Failed to sign authorization:", error);
    } finally {
      setIsVerifying(false);
    }
  };

  const fetchUserOpTxnHash = async () => {
    if (!authorization || !toAddress) return;

    try {
      setIsSending(true);
      const hash = await sendUserOperation(amount, toAddress as `0x${string}`, authorization);
      setUserOpTxnHash(hash);
    } catch (error) {
      console.error("Failed to send UserOperation:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0C10] text-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#1F2833] rounded-2xl p-8 shadow-xl border border-[#45A29E]/20">
        <h1 className="text-2xl font-semibold text-center mb-6 text-[#66FCF1]">
          EIP-7702 Authorization
        </h1>

        {!authorization ? (
          <div className="flex flex-col items-center space-y-4">
            <p className="text-gray-400 text-sm text-center">
              Sign an authorization to enable your smart account.
            </p>
            <button
              onClick={handleAuth}
              disabled={isVerifying}
              className="w-full py-2.5 bg-[#45A29E] hover:bg-[#3a8f8c] text-white rounded-md font-medium transition disabled:opacity-60"
            >
              {isVerifying ? "Signing Authorization..." : "Sign EIP-7702 Authorization"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col space-y-5">
            <div>
              <p className="text-sm text-gray-400 mb-2">Recipient Address</p>
              <input
                type="text"
                placeholder="0xRecipientAddress"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value as `0x${string}`)}
                className="w-full px-3 py-2 bg-[#0B0C10] border border-gray-700 rounded-md text-sm focus:outline-none focus:border-[#66FCF1] transition"
              />
            </div>

            <div>
              <p className="text-sm text-gray-400 mb-2">Amount (USDC)</p>
              <input
                type="text"
                placeholder="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0C10] border border-gray-700 rounded-md text-sm focus:outline-none focus:border-[#66FCF1] transition"
              />
            </div>

            <button
              onClick={fetchUserOpTxnHash}
              disabled={isSending}
              className="w-full py-2.5 bg-[#66FCF1] hover:bg-[#45A29E] text-black rounded-md font-semibold transition disabled:opacity-60"
            >
              {isSending ? "Sending..." : "Send UserOperation"}
            </button>
          </div>
        )}

        {userOpTxnHash && (
          <div className="mt-8 border-t border-gray-800 pt-5">
            <p className="text-sm text-gray-400 mb-1">Transaction Hash:</p>
            <p className="text-sm break-all text-[#C5C6C7] mb-3">{userOpTxnHash}</p>
            <a
              href={`${EXPLORER_BASE}${userOpTxnHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full text-center py-2 bg-[#1F2833] border border-[#45A29E]/40 rounded-md text-[#66FCF1] hover:bg-[#162025] transition"
            >
              View on Sepolia Explorer
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
