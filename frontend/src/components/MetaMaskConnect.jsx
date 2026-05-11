import { useEffect, useState } from "react";
import { MetaMaskSDK } from "@metamask/sdk";

// MetaMask connect component (uses env for Infura key; do not hardcode keys)
export default function MetaMaskConnect() {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(true);
  const [addStatus, setAddStatus] = useState("");

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
      {account && (
        <div className="mt-3">
          <button
            onClick={async () => {
              setAddStatus("adding");
              try {
                const tokenAddress = import.meta.env.VITE_CARBON_TOKEN_ADDRESS;
                if (!window.ethereum) throw new Error("MetaMask not available");
                const added = await window.ethereum.request({
                  method: "wallet_watchAsset",
                  params: {
                    type: "ERC20",
                    options: {
                      address: tokenAddress,
                      symbol: "CCT",
                      decimals: 18,
                      image: "",
                    },
                  },
                });
                setAddStatus(added ? "added" : "rejected");
              } catch (err) {
                setError(err?.message || "Failed to add token");
                setAddStatus("error");
              }
            }}
            className="px-3 py-1 bg-emerald-500 rounded-md text-black text-sm"
          >
            Add CCT to MetaMask
          </button>
          {addStatus === "adding" && (
            <p className="text-xs text-gray-300 mt-2">Adding token…</p>
          )}
          {addStatus === "added" && (
            <p className="text-xs text-emerald-300 mt-2">Token added</p>
          )}
          {addStatus === "rejected" && (
            <p className="text-xs text-yellow-300 mt-2">Request rejected</p>
          )}
        </div>
      )}
    </div>
  );
}
