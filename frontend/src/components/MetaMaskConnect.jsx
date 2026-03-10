import { useEffect, useState } from "react";
import { MetaMaskSDK } from "@metamask/sdk";

// MetaMask connect component (uses env for Infura key; do not hardcode keys)
export default function MetaMaskConnect() {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(true);

  useEffect(() => {
    const sdk = new MetaMaskSDK({
      dappMetadata: {
        name: "EcoChain",
        url: window.location.href,
      },
      infuraAPIKey: import.meta.env.VITE_INFURA_API_KEY,
    });

    const provider = sdk.getProvider();

    const connect = async () => {
      setConnecting(true);
      try {
        const accounts = await provider.request({
          method: "eth_requestAccounts",
        });
        setAccount(accounts?.[0] || null);
        setError("");
      } catch (err) {
        setError(err?.message || "MetaMask connection failed");
        console.error("MetaMask connection failed", err);
      } finally {
        setConnecting(false);
      }
    };

    connect();

    return () => {
      sdk.terminate?.();
    };
  }, []);

  return (
    <div className="text-white bg-white/5 border border-white/10 rounded-xl p-4">
      <h3 className="text-lg font-semibold mb-2">MetaMask Connect</h3>
      {account && (
        <p className="text-sm text-emerald-300 break-all">
          Connected: {account}
        </p>
      )}
      {!account && (
        <p className="text-sm text-gray-400">
          {error || (connecting ? "Connecting..." : "Not connected")}
        </p>
      )}
    </div>
  );
}
