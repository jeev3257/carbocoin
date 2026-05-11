import { useEffect, useMemo, useState, useCallback } from "react";
import {
  BrowserProvider,
  Contract,
  formatUnits,
  parseEther,
  parseUnits,
  id as ethersId,
} from "ethers";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import {
  Loader2,
  Plus,
  Anchor,
  LayoutGrid,
  CheckCircle2,
  ChevronRight,
  Tag,
  Gavel,
  ArrowLeft,
  Clock,
  Verified,
  Activity,
  Download,
  Edit,
  XCircle,
  Database,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

export function Marketplace({
  tokenAddress,
  marketplaceAddress,
  explorerBase,
}) {
  const [decimals, setDecimals] = useState(0);
  const [wallet, setWallet] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeListings, setActiveListings] = useState([]);
  const [fetchingListings, setFetchingListings] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState(null); // The detailed bidding view state
  const [bidInputValue, setBidInputValue] = useState("");
  const [myListings, setMyListings] = useState([]);
  const [loadingMyListings, setLoadingMyListings] = useState(false);
  const [myHistory, setMyHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [auctionEventLogs, setAuctionEventLogs] = useState([]);

  // Sell View State
  const [isCreatingListing, setIsCreatingListing] = useState(false);
  const [sellMode, setSellMode] = useState("fixed"); // 'fixed' | 'auction'
  const [isApproved, setIsApproved] = useState(false);

  // Listing Inputs
  const [listAmount, setListAmount] = useState("");
  const [listPriceEth, setListPriceEth] = useState("");

  const tokenAbi = useMemo(
    () => [
      "function decimals() view returns (uint8)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function balanceOf(address owner) view returns (uint256)",
    ],
    [],
  );

  const marketAbi = useMemo(
    () => [
      "function createListing(uint256 amount, uint256 pricePerTokenWei) returns (uint256)",
      "function cancelListing(uint256 id)",
      "function buyListing(uint256 id, uint256 amount) payable",
      "function createAuction(uint256 amount, uint256 minPriceWei) returns (uint256)",
      "function bid(uint256 id) payable",
      "function finalizeAuction(uint256 id)",
      "function cancelAuction(uint256 id)",
      "function getListing(uint256 id) view returns (tuple(address seller,uint256 amount,uint256 pricePerTokenWei,bool active))",
      "function getAuction(uint256 id) view returns (tuple(address seller,uint256 amount,uint256 minPriceWei,uint64 endTime,address highestBidder,uint256 highestBid,bool settled))",
      "function listingCount() view returns (uint256)",
      "function auctionCount() view returns (uint256)",
    ],
    [],
  );

  const listingDocId = (type, id) => `${type}-${id}`;

  const upsertListingDoc = async (type, id, data) => {
    const ref = doc(db, "marketListings", listingDocId(type, id));
    await setDoc(
      ref,
      {
        type,
        active: true,
        updatedAt: serverTimestamp(),
        createdAt: data?.createdAt || serverTimestamp(),
        ...data,
      },
      { merge: true },
    );
  };

  const markListingInactive = async (type, id) => {
    const ref = doc(db, "marketListings", listingDocId(type, id));
    await updateDoc(ref, { active: false, updatedAt: serverTimestamp() }).catch(
      () => { },
    );
  };

  const fetchListings = useCallback(
    async (provider, dec) => {
      if (!marketplaceAddress) return;
      try {
        setFetchingListings(true);
        const nowSec = Math.floor(Date.now() / 1000);
        const market = new Contract(marketplaceAddress, marketAbi, provider);

        const snap = await getDocs(
          query(collection(db, "marketListings"), where("active", "==", true)),
        );
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const fetched = await Promise.all(
          docs.map(async (row) => {
            const type = row.type || "fixed";
            const id = row.listingId || row.auctionId;
            if (!id) return null;

            let usedChain = false;
            let chainItem = null;
            try {
              if (type === "fixed") {
                const l = await market.getListing(id);
                const activeOnChain = l.active && l.amount > 0n;
                if (!activeOnChain) {
                  markListingInactive(type, id);
                  return null;
                }
                const amountRaw = l.amount;
                const pricePerTokenWei = l.pricePerTokenWei;
                await upsertListingDoc(type, id, {
                  listingId: id,
                  amountRaw: amountRaw.toString(),
                  pricePerTokenWei: pricePerTokenWei.toString(),
                  seller: l.seller,
                  active: activeOnChain,
                });
                chainItem = {
                  id,
                  type,
                  amount: formatUnits(amountRaw, dec),
                  priceEth: formatUnits(pricePerTokenWei * amountRaw, 18),
                  seller: l.seller,
                  active: activeOnChain,
                  endTimeSec: null,
                  highestBidWei: "0",
                  minPriceWei: "0",
                  settled: false,
                  ended: false,
                };
                usedChain = true;
              } else {
                const a = await market.getAuction(id);
                const ended = Number(a.endTime) <= nowSec;
                const activeOnChain = !a.settled && !ended && a.amount > 0n;
                if (a.settled || a.amount === 0n) {
                  markListingInactive(type, id);
                  return null;
                }
                const amountRaw = a.amount;
                const priceWei =
                  a.highestBid > 0n ? a.highestBid : a.minPriceWei;
                await upsertListingDoc(type, id, {
                  auctionId: id,
                  amountRaw: amountRaw.toString(),
                  minPriceWei: a.minPriceWei.toString(),
                  highestBidWei: a.highestBid.toString(),
                  seller: a.seller,
                  endTimeSec: Number(a.endTime),
                  active: activeOnChain,
                  settled: a.settled,
                });
                chainItem = {
                  id,
                  type,
                  amount: formatUnits(amountRaw, dec),
                  priceEth: formatUnits(priceWei, 18),
                  seller: a.seller,
                  active: activeOnChain,
                  endTimeSec: Number(a.endTime),
                  highestBidWei: a.highestBid.toString(),
                  minPriceWei: a.minPriceWei.toString(),
                  settled: a.settled,
                  ended,
                };
                usedChain = true;
              }
            } catch (err) {
              // if chain fails, fall back to cached row
            }

            if (usedChain) return chainItem;

            const amountRaw = row.amountRaw ? BigInt(row.amountRaw) : 0n;
            const endedCached = row.endTimeSec
              ? Number(row.endTimeSec) <= nowSec
              : false;
            const settled = row.settled || false;
            const priceWei = row.pricePerTokenWei
              ? BigInt(row.pricePerTokenWei)
              : row.highestBidWei
                ? BigInt(row.highestBidWei)
                : row.minPriceWei
                  ? BigInt(row.minPriceWei)
                  : 0n;
            return {
              id,
              type,
              ended: endedCached,
              settled,
              amount:
                amountRaw > 0n
                  ? formatUnits(amountRaw, dec)
                  : row.amount || "0",
              priceEth:
                priceWei > 0n
                  ? formatUnits(
                    type === "fixed"
                      ? priceWei * (amountRaw || 1n)
                      : priceWei,
                    18,
                  )
                  : row.priceEth || "0",
              seller: row.seller || "",
              active: row.active !== false && !endedCached && !settled,
              endTimeSec: row.endTimeSec || null,
              highestBidWei: row.highestBidWei || "0",
              minPriceWei: row.minPriceWei || "0",
            };
          }),
        );

        setActiveListings(fetched.filter(Boolean).filter((l) => l.active));
      } catch (err) {
        console.error("Error fetching listings:", err);
      } finally {
        setFetchingListings(false);
      }
    },
    [marketplaceAddress, marketAbi],
  );

  const fetchMyListings = useCallback(
    async (provider, dec, owner) => {
      if (!owner) return;
      try {
        setLoadingMyListings(true);
        const nowSec = Math.floor(Date.now() / 1000);
        const snap = await getDocs(
          query(collection(db, "marketListings"), where("seller", "==", owner)),
        );
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const market = marketplaceAddress
          ? new Contract(marketplaceAddress, marketAbi, provider)
          : null;
        const mine = await Promise.all(
          rows.map(async (row) => {
            const type = row.type || "fixed";
            const id = row.listingId || row.auctionId;
            if (!id) return null;
            let active = row.active !== false;
            let amount = row.amount || "0";
            let priceEth = row.priceEth || "0";
            let settled = row.settled || false;
            let ended = row.endTimeSec ? Number(row.endTimeSec) <= nowSec : false;

            if (market) {
              try {
                if (type === "fixed") {
                  const l = await market.getListing(id);
                  active = l.active && l.amount > 0n;
                  amount = formatUnits(l.amount, dec);
                  priceEth = formatUnits(l.pricePerTokenWei, 18);
                } else {
                  const a = await market.getAuction(id);
                  ended = Number(a.endTime) <= nowSec;
                  settled = a.settled;
                  active = !a.settled && !ended && a.amount > 0n;
                  amount = formatUnits(a.amount, dec);
                  priceEth = formatUnits(
                    a.highestBid > 0n ? a.highestBid : a.minPriceWei,
                    18,
                  );
                  row.endTimeSec = Number(a.endTime);
                  row.highestBidWei = a.highestBid.toString();
                  row.minPriceWei = a.minPriceWei.toString();
                  row.settled = a.settled;
                }
              } catch (e) {
                /* keep cached */
              }
            }

            if (ended || settled) {
              active = false;
            }

            return {
              id,
              type,
              amount,
              priceEth,
              active,
              settled,
              ended,
              endTimeSec: row.endTimeSec || null,
              highestBidWei: row.highestBidWei || "0",
              minPriceWei: row.minPriceWei || "0",
            };
          }),
        );
        setMyListings(mine.filter(Boolean));
      } catch (err) {
        console.error("Error fetching my listings", err);
      } finally {
        setLoadingMyListings(false);
      }
    },
    [marketplaceAddress, marketAbi],
  );

  const fetchMyHistory = useCallback(async (owner) => {
    if (!owner) return;
    try {
      setLoadingHistory(true);
      const q = query(
        collection(db, "marketEvents"),
        where("actor", "==", owner),
        orderBy("createdAt", "desc"),
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMyHistory(rows);
    } catch (err) {
      console.error("Error loading history", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const refreshAccounts = useCallback(async () => {
    if (!window?.ethereum || !tokenAddress) return;
    try {
      const accounts = await window.ethereum
        .request({ method: "eth_accounts" })
        .catch(() => []);
      const addr = accounts?.[0];
      if (!addr) return;
      if (addr.toLowerCase() === wallet?.toLowerCase()) return;

      const provider = new BrowserProvider(window.ethereum);
      const token = new Contract(tokenAddress, tokenAbi, provider);
      const dec = await token.decimals().catch(() => decimals);
      setWallet(addr);
      setDecimals(dec);

      if (marketplaceAddress) {
        const allowance = await token.allowance(addr, marketplaceAddress);
        setIsApproved(allowance > 0n);
      }

      await fetchListings(provider, dec);
      await fetchMyListings(provider, dec, addr);
      await fetchMyHistory(addr);
    } catch (err) {
      console.error("Account refresh failed", err);
    }
  }, [
    tokenAddress,
    tokenAbi,
    marketplaceAddress,
    fetchListings,
    fetchMyListings,
    fetchMyHistory,
    wallet,
    decimals,
  ]);

  // Realtime listener for the active auction's events
  useEffect(() => {
    if (!selectedAuction?.id) {
      setAuctionEventLogs([]);
      return;
    }

    const q = query(
      collection(db, "marketEvents"),
      where("auctionId", "in", [Number(selectedAuction.id), String(selectedAuction.id)]),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const events = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAuctionEventLogs(events);
    }, (err) => {
      console.error("Live Feed Error:", err);
    });

    return () => unsubscribe();
  }, [selectedAuction?.id]);

  useEffect(() => {
    let active = true;
    const init = async () => {
      if (!tokenAddress || !window?.ethereum) return;
      try {
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const token = new Contract(tokenAddress, tokenAbi, provider);
        const dec = await token.decimals().catch(() => 0);
        if (!active) return;
        setDecimals(dec);
        const addr = await signer.getAddress();
        setWallet(addr);

        if (marketplaceAddress) {
          const allowance = await token.allowance(addr, marketplaceAddress);
          setIsApproved(allowance > 0n);
        }

        // Preflight marketplace contract; warn if missing
        try {
          const { warning } = await validateMarketplace(provider);
          if (warning) setStatus(warning);
        } catch (e) {
          setStatus(e.message);
        }

        await fetchListings(provider, dec);
        await fetchMyListings(provider, dec, addr);
        await fetchMyHistory(addr);
      } catch (err) {
        console.error("Marketplace init failed", err);
      }
    };
    init();
    refreshAccounts();
    const handleAccounts = async (accounts) => {
      if (!accounts || accounts.length === 0) return;
      const addr = accounts[0];
      setWallet(addr);
      try {
        const provider = new BrowserProvider(window.ethereum);
        const token = new Contract(tokenAddress, tokenAbi, provider);
        const dec = await token.decimals().catch(() => decimals);
        setDecimals(dec);
        if (marketplaceAddress) {
          const allowance = await token.allowance(addr, marketplaceAddress);
          setIsApproved(allowance > 0n);
        }
        await fetchListings(provider, dec);
        await fetchMyListings(provider, dec, addr);
        await fetchMyHistory(addr);
      } catch (err) {
        console.error("Account change refresh failed", err);
      }
    };
    window?.ethereum?.on?.("accountsChanged", handleAccounts);
    window?.addEventListener("visibilitychange", refreshAccounts);
    return () => {
      active = false;
      window?.ethereum?.removeListener?.("accountsChanged", handleAccounts);
      window?.removeEventListener("visibilitychange", refreshAccounts);
    };
  }, [
    tokenAddress,
    tokenAbi,
    marketplaceAddress,
    fetchListings,
    fetchMyListings,
    fetchMyHistory,
    refreshAccounts,
  ]);

  useEffect(() => {
    const loadMine = async () => {
      if (!wallet || !window?.ethereum) return;
      const provider = new BrowserProvider(window.ethereum);
      await fetchMyListings(provider, decimals, wallet);
      await fetchMyHistory(wallet);
    };
    loadMine();
  }, [wallet, decimals, fetchMyListings, fetchMyHistory]);

  const withStatus = async (fn) => {
    setLoading(true);
    setStatus(null);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      let msg = err?.message || "Action failed";
      const revertMsg = decodeRevert(err?.data);
      if (revertMsg) {
        msg = revertMsg;
      } else if (msg.includes("CALL_EXCEPTION") || msg.includes("require(false")) {
        msg =
          "Contract call failed — check you are on the right network, inputs are valid, and you are the seller where required.";
      }
      setStatus(msg);
    } finally {
      setLoading(false);
    }
  };

  const ensureWallet = async () => {
    if (!window?.ethereum) throw new Error("MetaMask required");
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return { provider, signer };
  };

  const validateMarketplace = async (provider) => {
    if (!marketplaceAddress) throw new Error("Marketplace address missing");
    const code = await provider.getCode(marketplaceAddress);
    if (!code || code === "0x")
      throw new Error("Marketplace address has no contract on this network");
    const market = new Contract(marketplaceAddress, marketAbi, provider);
    try {
      await market.listingCount();
      return { market };
    } catch (e) {
      console.warn("Marketplace health check failed", e);
      return {
        market,
        warning: "Marketplace call failed; verify ABI/network but proceeding.",
      };
    }
  };

  const decodeRevert = (data) => {
    if (!data || typeof data !== "string" || data.length < 10) return null;
    const selector = data.slice(0, 10).toLowerCase();
    const map = {
      [ethersId("NotSeller()").slice(0, 10)]:
        "Only the seller can perform this action (or bids already exist).",
      [ethersId("NotActive()").slice(0, 10)]: "Listing/Auction is not active.",
      [ethersId("AlreadySettled()").slice(0, 10)]: "Auction already settled.",
      [ethersId("AuctionStillRunning()").slice(0, 10)]:
        "Auction is still running; wait for end time.",
      [ethersId("AuctionEnded()").slice(0, 10)]: "Auction has already ended.",
      [ethersId("BidTooLow()").slice(0, 10)]: "Bid too low; bid above current highest.",
      [ethersId("InvalidAmount()").slice(0, 10)]: "Invalid amount specified.",
    };
    return map[selector] || null;
  };

  const logMarketEvent = async (action, payload = {}, actor) => {
    try {
      await addDoc(collection(db, "marketEvents"), {
        action,
        createdAt: serverTimestamp(),
        actor,
        ...payload,
      });
    } catch (err) {
      console.error("Failed to log market event", err);
    }
  };

  const handleApprove = () =>
    withStatus(async () => {
      const { signer } = await ensureWallet();
      const token = new Contract(tokenAddress, tokenAbi, signer);
      // Approve a large amount for UX
      const maxUint = 2n ** 256n - 1n;
      const tx = await token.approve(marketplaceAddress, maxUint);
      await tx.wait();
      setIsApproved(true);
      setStatus("Marketplace approved for trading!");
    });

  const handleCreateListing = () =>
    withStatus(async () => {
      const { signer } = await ensureWallet();
      const provider = new BrowserProvider(window.ethereum);
      const { warning } = await validateMarketplace(provider);
      if (warning) setStatus(warning);
      const market = new Contract(marketplaceAddress, marketAbi, signer);
      const token = new Contract(tokenAddress, tokenAbi, signer);

      const amountRaw = parseUnits(String(listAmount || 0), decimals);
      const priceWei = parseEther(String(listPriceEth || 0));

      if (amountRaw <= 0n) throw new Error("Amount must be > 0");
      if (priceWei <= 0n) throw new Error("Price must be > 0");

      const confirmMsg = `Confirm creating a ${sellMode === "fixed" ? "Fixed Listing" : "Auction"} for ${listAmount} CCT at ${listPriceEth} ETH${sellMode === "fixed" ? " per CCT" : " min bid"}?`;
      if (!window.confirm(confirmMsg)) {
        return;
      }

      // Ensure allowance covers the amount being listed/auctioned
      const allowance = await token.allowance(
        await signer.getAddress(),
        marketplaceAddress,
      );
      if (allowance < amountRaw) {
        throw new Error("Approve tokens first (insufficient allowance)");
      }

      let tx;
      if (sellMode === "fixed") {
        tx = await market.createListing(amountRaw, priceWei);
        const receipt = await tx.wait();
        const id = await market.listingCount();
        const actor = await signer.getAddress();
        await logMarketEvent(
          "createListing",
          {
            listingId: Number(id),
            seller: actor,
            amount: amountRaw.toString(),
            pricePerTokenWei: priceWei.toString(),
            txHash: receipt?.hash || tx.hash,
          },
          actor,
        );
        await upsertListingDoc("fixed", Number(id), {
          listingId: Number(id),
          seller: actor,
          amountRaw: amountRaw.toString(),
          pricePerTokenWei: priceWei.toString(),
          createdAt: serverTimestamp(),
          active: true,
        });
        setStatus("Fixed listing created on marketplace!");
      } else {
        tx = await market.createAuction(amountRaw, priceWei);
        const receipt = await tx.wait();
        const id = await market.auctionCount();
        const actor = await signer.getAddress();
        await logMarketEvent(
          "createAuction",
          {
            auctionId: Number(id),
            seller: actor,
            amount: amountRaw.toString(),
            minPriceWei: priceWei.toString(),
            txHash: receipt?.hash || tx.hash,
          },
          actor,
        );
        await upsertListingDoc("auction", Number(id), {
          auctionId: Number(id),
          seller: actor,
          amountRaw: amountRaw.toString(),
          minPriceWei: priceWei.toString(),
          highestBidWei: "0",
          createdAt: serverTimestamp(),
          active: true,
        });
        setStatus("Auction started on marketplace!");
      }

      setIsCreatingListing(false);
      setListAmount("");
      setListPriceEth("");

      await fetchListings(provider, decimals);
      await fetchMyListings(provider, decimals, await signer.getAddress());
      await fetchMyHistory(await signer.getAddress());
    });

  // Real Buy Action
  const handleBuy = (id, amount, priceEth) =>
    withStatus(async () => {
      const { signer } = await ensureWallet();
      const market = new Contract(marketplaceAddress, marketAbi, signer);

      // Fetch latest listing on-chain for accurate pricing and availability
      const listing = await market.getListing(id);
      if (!listing.active) throw new Error("Listing inactive");

      const amountRaw = parseUnits(amount, decimals);
      if (amountRaw <= 0n || amountRaw > listing.amount) {
        throw new Error("Requested amount exceeds available");
      }

      const totalCost = listing.pricePerTokenWei * amountRaw;
      const tx = await market.buyListing(id, amountRaw, { value: totalCost });
      const receipt = await tx.wait();
      const actor = await signer.getAddress();
      await logMarketEvent(
        "buyListing",
        {
          listingId: id,
          buyer: actor,
          seller: listing.seller,
          amount: amountRaw.toString(),
          totalCostWei: totalCost.toString(),
          txHash: receipt?.hash || tx.hash,
        },
        actor,
      );

      const remaining = listing.amount - amountRaw;
      if (remaining <= 0n) {
        await markListingInactive("fixed", id);
      } else {
        await upsertListingDoc("fixed", id, {
          listingId: id,
          seller: listing.seller,
          amountRaw: remaining.toString(),
          pricePerTokenWei: listing.pricePerTokenWei?.toString?.() || "0",
          active: true,
        });
      }
      setStatus(`Purchase complete for listing #${id}!`);

      const provider = new BrowserProvider(window.ethereum);
      await fetchListings(provider, decimals);
      await fetchMyListings(provider, decimals, await signer.getAddress());
      await fetchMyHistory(await signer.getAddress());
    });

  const handleBid = (id, overrideEth = null) =>
    withStatus(async () => {
      const bidEth = overrideEth || window.prompt("Enter bid in ETH");
      if (!bidEth) throw new Error("Bid cancelled");
      const bidWei = parseEther(String(bidEth));
      const { signer } = await ensureWallet();
      const market = new Contract(marketplaceAddress, marketAbi, signer);
      const tx = await market.bid(id, { value: bidWei });
      const receipt = await tx.wait();
      const actor = await signer.getAddress();
      await logMarketEvent(
        "bidAuction",
        {
          auctionId: id,
          bidder: actor,
          bidWei: bidWei.toString(),
          txHash: receipt?.hash || tx.hash,
        },
        actor,
      );
      await upsertListingDoc("auction", id, {
        auctionId: id,
        highestBidWei: bidWei.toString(),
        active: true,
      });
      setStatus(`Bid placed on auction #${id}`);

      const provider = new BrowserProvider(window.ethereum);
      await fetchListings(provider, decimals);
      await fetchMyListings(provider, decimals, await signer.getAddress());
      await fetchMyHistory(await signer.getAddress());

      // Update local state so view refreshes immediately if looking at it
      setSelectedAuction((prev) => {
        if (prev && prev.id === id) {
          return { ...prev, highestBidWei: bidWei.toString(), priceEth: bidEth };
        }
        return prev;
      });
      setBidInputValue("");
    });

  const handleFinalizeAuction = (id) =>
    withStatus(async () => {
      const { signer } = await ensureWallet();
      const market = new Contract(marketplaceAddress, marketAbi, signer);
      const tx = await market.finalizeAuction(id);
      const receipt = await tx.wait();
      const actor = await signer.getAddress();
      await logMarketEvent(
        "finalizeAuction",
        {
          auctionId: id,
          caller: actor,
          txHash: receipt?.hash || tx.hash,
        },
        actor,
      );
      await markListingInactive("auction", id);
      setStatus(`Auction #${id} finalized`);

      const provider = new BrowserProvider(window.ethereum);
      await fetchListings(provider, decimals);
      await fetchMyListings(provider, decimals, await signer.getAddress());
      await fetchMyHistory(await signer.getAddress());
    });

  const handleCancelAuction = (id) =>
    withStatus(async () => {
      const { signer } = await ensureWallet();
      const market = new Contract(marketplaceAddress, marketAbi, signer);
      const tx = await market.cancelAuction(id);
      const receipt = await tx.wait();
      const actor = await signer.getAddress();
      await logMarketEvent(
        "cancelAuction",
        {
          auctionId: id,
          seller: actor,
          txHash: receipt?.hash || tx.hash,
        },
        actor,
      );
      await markListingInactive("auction", id);
      setStatus(`Auction #${id} canceled`);

      const provider = new BrowserProvider(window.ethereum);
      await fetchListings(provider, decimals);
      await fetchMyListings(provider, decimals, await signer.getAddress());
      await fetchMyHistory(await signer.getAddress());
    });

  const handleCancelListing = (id) =>
    withStatus(async () => {
      const { signer } = await ensureWallet();
      const market = new Contract(marketplaceAddress, marketAbi, signer);
      const tx = await market.cancelListing(id);
      const receipt = await tx.wait();
      const actor = await signer.getAddress();
      await logMarketEvent(
        "cancelListing",
        {
          listingId: id,
          seller: actor,
          txHash: receipt?.hash || tx.hash,
        },
        actor,
      );
      await markListingInactive("fixed", id);
      setStatus(`Listing #${id} canceled`);

      const provider = new BrowserProvider(window.ethereum);
      await fetchListings(provider, decimals);
      await fetchMyListings(provider, decimals, await signer.getAddress());
      await fetchMyHistory(await signer.getAddress());
    });

  const toggleManage = async () => {
    const next = !manageOpen;
    setManageOpen(next);
    if (next && wallet && window?.ethereum) {
      const provider = new BrowserProvider(window.ethereum);
      await fetchMyListings(provider, decimals, wallet);
      await fetchMyHistory(wallet);
    }
  };

  if (isCreatingListing) {
    return (
      <div className="animate-in fade-in duration-300 pb-12">
        {/* The new HTML adapted to React */}
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-6 mt-4">
          <button
            onClick={() => setIsCreatingListing(false)}
            className="hover:text-white transition-colors flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-md mb-1 sm:mb-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Marketplace</span>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          <div className="flex-1 space-y-10">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-3 text-white">Quick Sell Carbon Credits</h2>
              <p className="text-slate-400 text-lg">Choose your listing method and set your terms in seconds.</p>
            </div>

            <div className="bg-[#1C2128]/80 backdrop-blur-md border border-[#2D333B] rounded-2xl p-6 sm:p-8 shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                <label className="relative cursor-pointer group">
                  <input checked={sellMode === "fixed"} onChange={() => setSellMode("fixed")} className="sr-only peer" name="listing_type" type="radio" value="fixed" />
                  <div className={`border-2 rounded-xl p-6 transition-all flex flex-col items-center text-center gap-3 h-full ${sellMode === "fixed" ? "border-emerald-500 bg-emerald-500/5" : "border-[#2D333B] hover:bg-white/5"}`}>
                    <Tag className={`w-8 h-8 ${sellMode === "fixed" ? "text-emerald-400" : "text-slate-400"}`} />
                    <div>
                      <p className={`font-bold text-lg ${sellMode === "fixed" ? "text-emerald-400" : "text-white"}`}>Sell at Fixed Price</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">Instantly available for purchase at your specified price.</p>
                    </div>
                  </div>
                </label>

                <label className="relative cursor-pointer group">
                  <input checked={sellMode === "auction"} onChange={() => setSellMode("auction")} className="sr-only peer" name="listing_type" type="radio" value="auction" />
                  <div className={`border-2 rounded-xl p-6 transition-all flex flex-col items-center text-center gap-3 h-full ${sellMode === "auction" ? "border-amber-500 bg-amber-500/5" : "border-[#2D333B] hover:bg-white/5"}`}>
                    <Gavel className={`w-8 h-8 ${sellMode === "auction" ? "text-amber-400" : "text-slate-400"}`} />
                    <div>
                      <p className={`font-bold text-lg ${sellMode === "auction" ? "text-amber-400" : "text-white"}`}>Auction Your CCT</p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">Let the market decide the value through competitive bidding.</p>
                    </div>
                  </div>
                </label>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-sm font-bold uppercase tracking-wider text-slate-500">Amount to Sell</label>
                    <div className="relative group">
                      <input
                        value={listAmount} onChange={(e) => setListAmount(e.target.value)}
                        className="w-full bg-[#161B22] border-2 border-[#2D333B] rounded-xl px-5 py-4 text-lg font-medium focus:ring-0 focus:border-emerald-500 outline-none transition-all text-white"
                        placeholder="0.00" type="number"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">CCT</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-bold uppercase tracking-wider text-slate-500">{sellMode === "fixed" ? "Unit Price" : "Starting Bid"}</label>
                    <div className="relative group">
                      <input
                        value={listPriceEth} onChange={(e) => setListPriceEth(e.target.value)}
                        className="w-full bg-[#161B22] border-2 border-[#2D333B] rounded-xl px-5 py-4 text-lg font-medium focus:ring-0 focus:border-emerald-500 outline-none transition-all text-white"
                        placeholder="0.00" step="0.001" type="number"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-slate-400 uppercase">ETH</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                  <div className="space-y-3">
                    <label className="text-sm font-bold uppercase tracking-wider text-slate-500">Listing Duration</label>
                    <div className="relative group">
                      <select className="w-full bg-[#161B22] border-2 border-[#2D333B] rounded-xl px-5 py-4 text-lg font-medium focus:ring-0 focus:border-emerald-500 outline-none appearance-none transition-all text-white disabled:opacity-50" disabled>
                        <option>7 Days (Standard)</option>
                      </select>
                    </div>
                    <p className="text-[10px] text-slate-500">Duration configured globally by contract.</p>
                  </div>

                  <div className="bg-emerald-500/5 border-2 border-emerald-500/20 rounded-xl p-5 flex flex-col justify-center h-[76px]">
                    <p className="text-[10px] uppercase font-bold text-emerald-500 tracking-widest mb-1">Total Estimated Value</p>
                    <p className="text-2xl font-black text-emerald-400">{(Number(listAmount || 0) * Number(listPriceEth || 0)).toFixed(4)} ETH</p>
                  </div>
                </div>

                <div className="pt-6">
                  {!isApproved ? (
                    <Button
                      onClick={handleApprove}
                      disabled={loading}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 hover:scale-[1.01] active:scale-[0.99] text-black font-black text-lg py-7 rounded-xl transition-all flex items-center justify-center gap-3 group shadow-xl shadow-emerald-500/20"
                    >
                      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                        <>
                          APPROVE MARKETPLACE
                          <CheckCircle2 className="w-6 h-6 font-bold group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      disabled={loading || !listAmount || !listPriceEth || Number(listAmount) <= 0}
                      onClick={handleCreateListing}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 hover:scale-[1.01] active:scale-[0.99] text-black font-black text-lg py-7 rounded-xl transition-all flex items-center justify-center gap-3 group shadow-xl shadow-emerald-500/20"
                    >
                      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                        <>
                          CONFIRM & LIST FOR SALE
                          <ChevronRight className="w-6 h-6 font-bold group-hover:translate-x-2 transition-transform" />
                        </>
                      )}
                    </Button>
                  )}

                  <div className="flex items-center justify-center gap-2 mt-6 text-slate-500">
                    <CheckCircle2 className="w-4 h-4" />
                    <p className="text-xs">Secure transaction powered by EcoChain Smart Contracts</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:w-96 space-y-8">
            <div className="bg-[#1C2128]/80 backdrop-blur-md border border-[#2D333B] rounded-2xl p-8 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400 mb-8">Market Insights</h3>
              <div className="space-y-8">
                <div>
                  <p className="text-xs text-slate-500 mb-2 font-medium">Floor Price for Similar Credits</p>
                  <div className="flex items-end gap-3">
                    <p className="text-4xl font-black text-white">0.012 ETH</p>
                    <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-xs font-bold mb-1.5 flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      +4.2%
                    </span>
                  </div>
                </div>
                <div className="h-px bg-white/5"></div>
                <div className="space-y-5">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Recent Activity</p>
                  <div className="flex items-center justify-between text-sm group cursor-default">
                    <span className="text-slate-500 group-hover:text-slate-300 transition-colors">2023 Amazon Reforest</span>
                    <span className="font-bold text-slate-300">0.014 ETH</span>
                  </div>
                  <div className="flex items-center justify-between text-sm group cursor-default">
                    <span className="text-slate-500 group-hover:text-slate-300 transition-colors">2022 Congo Basin</span>
                    <span className="font-bold text-slate-300">0.011 ETH</span>
                  </div>
                  <div className="flex items-center justify-between text-sm group cursor-default">
                    <span className="text-slate-500 group-hover:text-slate-300 transition-colors">2023 Solar India</span>
                    <span className="font-bold text-slate-300">0.009 ETH</span>
                  </div>
                </div>

                <div className="bg-[#161B22] border border-[#2D333B] rounded-xl p-5 relative overflow-hidden group">
                  <div className="relative z-10">
                    <p className="text-[10px] text-amber-500 font-black uppercase mb-2 tracking-widest">Strategy Tip</p>
                    <p className="text-sm leading-relaxed text-slate-300">Listing at <span className="text-white font-bold">0.011 ETH</span> could increase sale probability by <span className="text-amber-400 font-bold">65%</span> based on current demand.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => { setIsCreatingListing(false); setManageOpen(true); }} className="flex items-center justify-between p-4 rounded-xl border border-[#2D333B] hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left text-white group bg-[#1C2128]/80 backdrop-blur-md">
                <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">Manage Active Listings</span>
                <ChevronRight className="w-5 h-5 text-emerald-500" />
              </button>
              <button onClick={() => { setIsCreatingListing(false); setManageOpen(true); }} className="flex items-center justify-between p-4 rounded-xl border border-[#2D333B] hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left text-white group bg-[#1C2128]/80 backdrop-blur-md">
                <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">Transaction History</span>
                <Clock className="w-5 h-5 text-emerald-500" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (manageOpen) {
    const activeCount = myListings.filter(l => l.active).length;
    const totalVolume = myListings.reduce((sum, l) => sum + Number(l.amount || 0), 0).toLocaleString();
    const successfulSalesCount = myHistory.filter(h => h.action === "finalizeAuction" || h.action === "buyListing").length;

    // Estimate revenue from history where we were the seller (if applicable) or simple mock sum
    const totalRevenueEth = myHistory
      .filter(h => h.totalCostWei)
      .reduce((sum, h) => sum + Number(formatUnits(h.totalCostWei, 18)), 0).toFixed(4);

    const inactiveListingsHistory = myListings
      .filter((item) => {
        const nowSec = Math.floor(Date.now() / 1000);
        const ended = item.ended === true ? true : item.endTimeSec ? nowSec >= item.endTimeSec : false;
        return !(item.active || (item.type === "auction" && ended && !item.settled));
      })
      .map((item) => ({
        id: `past-${item.id}`,
        action: item.settled ? `Sold / Finalized` : `Ended / Closed`,
        listingId: item.id,
        amount: item.amount,
        pricePerTokenWei: parseEther(item.priceEth).toString(),
        txHash: null,
      }));

    const combinedHistory = [...myHistory];
    for (const h of inactiveListingsHistory) {
      if (!combinedHistory.some(existing => (existing.listingId || existing.auctionId)?.toString() === h.listingId?.toString())) {
        combinedHistory.push(h);
      }
    }

    return (
      <div className="animate-in fade-in duration-300 pb-12 w-full max-w-[1400px] mx-auto space-y-8 mt-4">
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
          <button
            onClick={() => setManageOpen(false)}
            className="hover:text-white transition-colors flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-md"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Marketplace</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-white">Manage Your Listings</h2>
            <p className="text-slate-400 mt-1">Monitor, edit, and optimize your active carbon credit inventory.</p>
          </div>
          <Button
            onClick={() => { setManageOpen(false); setIsCreatingListing(true); }}
            className="bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-6 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all text-md"
          >
            <Plus className="w-5 h-5" />
            Create New Listing
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#1C2128]/80 backdrop-blur-md p-5 rounded-2xl flex flex-col justify-between border border-[#2D333B] hover:border-emerald-500/30 transition-all shadow-lg">
            <div className="flex justify-between items-start">
              <span className="text-emerald-400 bg-emerald-500/10 p-2 rounded-lg"><LayoutGrid className="w-5 h-5" /></span>
            </div>
            <div className="mt-4">
              <p className="text-slate-400 text-sm font-medium">Active Listings</p>
              <p className="text-2xl font-black text-white mt-1">{activeCount}</p>
            </div>
          </div>
          <div className="bg-[#1C2128]/80 backdrop-blur-md p-5 rounded-2xl flex flex-col justify-between border border-[#2D333B] hover:border-emerald-500/30 transition-all shadow-lg">
            <div className="flex justify-between items-start">
              <span className="text-emerald-400 bg-emerald-500/10 p-2 rounded-lg"><Database className="w-5 h-5" /></span>
            </div>
            <div className="mt-4">
              <p className="text-slate-400 text-sm font-medium">Total Volume Listed</p>
              <p className="text-2xl font-black text-white mt-1">{totalVolume} CCT</p>
            </div>
          </div>
          <div className="bg-[#1C2128]/80 backdrop-blur-md p-5 rounded-2xl flex flex-col justify-between border border-[#2D333B] hover:border-emerald-500/30 transition-all shadow-lg">
            <div className="flex justify-between items-start">
              <span className="text-emerald-400 bg-emerald-500/10 p-2 rounded-lg"><Verified className="w-5 h-5" /></span>
            </div>
            <div className="mt-4">
              <p className="text-slate-400 text-sm font-medium">Successful Actions</p>
              <p className="text-2xl font-black text-white mt-1">{combinedHistory.length}</p>
            </div>
          </div>
          <div className="bg-[#1C2128]/80 backdrop-blur-md p-5 rounded-2xl flex flex-col justify-between border border-[#2D333B] hover:border-emerald-500/30 transition-all shadow-lg">
            <div className="flex justify-between items-start">
              <span className="text-emerald-400 bg-emerald-500/10 p-2 rounded-lg"><Activity className="w-5 h-5" /></span>
            </div>
            <div className="mt-4">
              <p className="text-slate-400 text-sm font-medium">Estimated Revenue/Cost</p>
              <p className="text-2xl font-black text-white mt-1">{totalRevenueEth} ETH</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8 border-b border-[#2D333B] px-2">
          <button className="pb-4 text-emerald-400 font-bold border-b-2 border-emerald-400 text-sm flex items-center gap-2">
            Active Listings <span className="bg-emerald-500/20 px-2 py-0.5 rounded text-[10px]">
              {myListings.filter(item => {
                const nowSec = Math.floor(Date.now() / 1000);
                const ended = item.ended === true ? true : item.endTimeSec ? nowSec >= item.endTimeSec : false;
                return item.active || (item.type === "auction" && ended && !item.settled);
              }).length}
            </span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-[#1C2128]/80 backdrop-blur-md border border-[#2D333B] shadow-lg">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-black/20 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Asset ID</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Current Price</th>
                <th className="px-6 py-4">Time Left</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {myListings.filter(item => {
                const nowSec = Math.floor(Date.now() / 1000);
                const ended = item.ended === true ? true : item.endTimeSec ? nowSec >= item.endTimeSec : false;
                return item.active || (item.type === "auction" && ended && !item.settled);
              }).length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">No active listings found for your wallet.</td>
                </tr>
              ) : (
                myListings.filter(item => {
                  const nowSec = Math.floor(Date.now() / 1000);
                  const ended = item.ended === true ? true : item.endTimeSec ? nowSec >= item.endTimeSec : false;
                  return item.active || (item.type === "auction" && ended && !item.settled);
                }).map((item) => {
                  const nowSec = Math.floor(Date.now() / 1000);
                  const ended = item.ended === true ? true : item.endTimeSec ? nowSec >= item.endTimeSec : false;
                  const hasBid = item.highestBidWei && BigInt(item.highestBidWei || "0") > 0n;
                  const statusLabel = item.type === "auction" && ended ? item.settled ? "Settled" : "Ended" : item.active ? "Active" : item.settled ? "Settled" : "Closed";

                  return (
                    <tr key={`${item.type}-${item.id}`} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`size-8 rounded-lg shadow-inner flex items-center justify-center ${item.type === "auction" ? "bg-gradient-to-br from-amber-400 to-amber-600" : "bg-gradient-to-br from-emerald-400 to-emerald-600"}`}>
                            {item.type === "auction" ? <Gavel className="w-4 h-4 text-white" /> : <Tag className="w-4 h-4 text-white" />}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-white">#{item.id}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{item.type} Asset</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium text-slate-300 bg-black/40 border border-white/5 px-2 py-1 rounded capitalize">{item.type}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-white">{item.amount} CCT</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <Activity className="text-emerald-500 w-4 h-4" />
                          <span className="text-sm font-bold text-white">{item.priceEth} ETH</span>
                        </div>
                        {item.type === "auction" && <p className="text-[10px] text-slate-500 font-medium">Bids Optional</p>}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-300">
                        {item.type === "auction" && item.endTimeSec ? (
                          ended ? "00:00:00" : `${Math.floor((item.endTimeSec - nowSec) / 3600)}h ${Math.floor(((item.endTimeSec - nowSec) % 3600) / 60)}m`
                        ) : "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${item.active ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}>
                          {statusLabel.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                          {item.type === "auction" && ended && !item.settled ? (
                            <button
                              disabled={loading}
                              onClick={() => handleFinalizeAuction(item.id)}
                              className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                            >
                              <Gavel className="w-4 h-4" />
                              Finish Auction
                            </button>
                          ) : item.active ? (
                            <button
                              disabled={loading || (item.type === "auction" && (ended || hasBid))}
                              onClick={() => item.type === "auction" ? handleCancelAuction(item.id) : handleCancelListing(item.id)}
                              className="p-2 hover:bg-rose-500/20 rounded-lg text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-50"
                              title={item.type === "auction" && (ended || hasBid) ? "Cannot Cancel" : "Cancel"}
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Recent History</h3>
              <button className="text-slate-400 text-sm font-medium hover:text-emerald-400 transition-colors flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download CSV
              </button>
            </div>

            <div className="bg-[#1C2128]/80 backdrop-blur-md rounded-2xl overflow-hidden border border-[#2D333B] shadow-lg">
              <div className="p-4 bg-black/20 border-b border-white/5 grid grid-cols-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Action / ID</span>
                <span>Status</span>
                <span>Price/Amount</span>
                <span className="text-right">Transaction</span>
              </div>
              <div className="divide-y divide-white/5">
                {combinedHistory.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm">No recent history logs found.</div>
                ) : (
                  combinedHistory.map((row) => (
                    <div key={row.id} className="p-4 grid grid-cols-4 items-center hover:bg-white/5 transition-colors">
                      <div>
                        <span className="text-sm font-bold text-white block capitalize">{row.action?.replace(/([A-Z])/g, ' $1').trim() || "Event"}</span>
                        <span className="text-xs font-mono text-slate-500">ID #{row.listingId || row.auctionId || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-xs font-medium bg-white/5 px-2 py-1 rounded text-slate-300">Logged</span>
                      </div>
                      <div>
                        {row.totalCostWei || row.pricePerTokenWei ? (
                          <p className="text-sm font-bold text-emerald-400">{formatUnits(row.totalCostWei || row.pricePerTokenWei || "0", 18)} ETH</p>
                        ) : <p className="text-sm text-slate-500">-</p>}
                        {row.amount && <p className="text-[10px] text-slate-500">{row.amount} CCT</p>}
                      </div>
                      <div className="text-right">
                        {row.txHash ? (
                          <a
                            href={explorerBase ? `${explorerBase}/tx/${row.txHash}` : "#"}
                            target="_blank" rel="noreferrer"
                            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium border-b border-emerald-400/30 hover:border-emerald-400 pb-0.5"
                          >
                            View Block
                          </a>
                        ) : <span className="text-xs text-slate-500">{String(row.id).startsWith("past-") ? "Completed" : "Pending"}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {status && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5" />
          {status}
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-emerald-400" />
            Active Listings
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Acquire carbon credits from compliant organizations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="h-11 px-5 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 flex items-center gap-2"
            onClick={toggleManage}
          >
            Manage Listings
          </Button>

          <Button
            onClick={() => setIsCreatingListing(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-11 px-6 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all hover:scale-105 flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Sell CCT
          </Button>
        </div>
      </div>


      {/* Modern Grid view of Active Listings OR Bidding View */}
      {selectedAuction ? (
        <div className="animate-in fade-in duration-300 relative bg-[#1C2128]/80 backdrop-blur-md border border-[#2D333B] rounded-2xl overflow-hidden -mx-4 sm:mx-0 shadow-2xl">
          <header className="flex items-center justify-between px-6 py-4 bg-[#1C2128]/90 backdrop-blur-md border-b border-white/5">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <button
                onClick={() => setSelectedAuction(null)}
                className="hover:text-white transition-colors flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md mb-1 sm:mb-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <span className="hidden sm:inline">/</span>
              <span className="text-slate-100 font-medium">Auction #{selectedAuction.id}</span>
            </div>
          </header>

          <div className="p-4 sm:p-8 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Details */}
              <div className="lg:col-span-2 space-y-6">
                <section className="bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
                  <div className="p-6 sm:p-8 border-b border-white/5 bg-amber-500/5">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div>
                        <h1 className="text-2xl sm:text-3xl font-black mb-2 tracking-tight text-white flex items-center gap-3">
                          <Gavel className="w-6 h-6 text-amber-400" />
                          Auction #{selectedAuction.id}
                        </h1>
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                          <Verified className="w-4 h-4" />
                          Verified Carbon Asset
                        </div>
                      </div>
                      <div className="text-left md:text-right bg-black/40 p-4 rounded-xl border border-white/5">
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2">Time Remaining</p>
                        <div className="flex gap-2">
                          {(() => {
                            const now = Math.floor(Date.now() / 1000);
                            const end = selectedAuction.endTimeSec || 0;
                            const diff = Math.max(0, end - now);
                            if (diff === 0) return <div className="text-rose-400 font-bold text-sm">ENDED</div>;
                            const d = Math.floor(diff / 86400);
                            const h = Math.floor((diff % 86400) / 3600);
                            const m = Math.floor((diff % 3600) / 60);
                            const s = diff % 60;
                            return (
                              <>
                                <div className="flex flex-col items-center">
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/5 rounded-lg flex items-center justify-center text-sm sm:text-lg font-black text-amber-400">{d.toString().padStart(2, '0')}</div>
                                  <span className="text-[8px] uppercase font-bold text-slate-500 mt-1">Days</span>
                                </div>
                                <div className="flex flex-col items-center">
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/5 rounded-lg flex items-center justify-center text-sm sm:text-lg font-black text-amber-400">{h.toString().padStart(2, '0')}</div>
                                  <span className="text-[8px] uppercase font-bold text-slate-500 mt-1">Hrs</span>
                                </div>
                                <div className="flex flex-col items-center">
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/5 rounded-lg flex items-center justify-center text-sm sm:text-lg font-black text-amber-400">{m.toString().padStart(2, '0')}</div>
                                  <span className="text-[8px] uppercase font-bold text-slate-500 mt-1">Min</span>
                                </div>
                                <div className="flex flex-col items-center">
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/5 rounded-lg flex items-center justify-center text-sm sm:text-lg font-black text-amber-400">{s.toString().padStart(2, '0')}</div>
                                  <span className="text-[8px] uppercase font-bold text-slate-500 mt-1">Sec</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/5 border-b border-white/5">
                    <div className="p-4 sm:p-6">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Total Amount</p>
                      <p className="text-lg sm:text-xl font-black text-white">{Number(selectedAuction.amount).toLocaleString()} CCT</p>
                    </div>
                    <div className="p-4 sm:p-6">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Min / Floor Price</p>
                      <p className="text-lg sm:text-xl font-black text-white">{formatUnits(selectedAuction.minPriceWei || "0", 18)} ETH</p>
                    </div>
                    <div className="p-4 sm:p-6 bg-emerald-500/5">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Highest Bid</p>
                      <p className="text-lg sm:text-xl font-black text-emerald-400">{selectedAuction.highestBidWei === "0" ? "None" : `${formatUnits(selectedAuction.highestBidWei, 18)} ETH`}</p>
                    </div>
                    <div className="p-4 sm:p-6 flex flex-col justify-center">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Seller Identity</p>
                      <a
                        href={explorerBase ? `${explorerBase}/address/${selectedAuction.seller}` : "#"}
                        target="_blank" rel="noreferrer"
                        className="text-xs sm:text-sm font-mono font-medium text-emerald-400 hover:text-emerald-300 truncate block"
                        title={selectedAuction.seller}
                      >
                        {selectedAuction.seller}
                      </a>
                    </div>
                  </div>
                </section>

                <section className="bg-black/20 rounded-2xl border border-white/5 overflow-hidden p-6">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <Activity className="w-5 h-5 text-indigo-400" />
                      <h3 className="text-sm font-black uppercase tracking-widest text-white">Live Market Feed</h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                      LIVE
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                    </div>
                  </div>

                  {auctionEventLogs.length === 0 ? (
                    <div className="bg-black/40 rounded-xl p-4 sm:p-8 flex items-center justify-center border border-white/5 text-slate-500 text-sm italic min-h-[140px]">
                      Event streaming enabled. No recent bids recorded for this auction.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="text-[10px] font-bold uppercase text-slate-500 tracking-widest border-b border-white/5">
                          <tr>
                            <th className="px-4 py-3">Bidder/Actor</th>
                            <th className="px-4 py-3">Event</th>
                            <th className="px-4 py-3">Time</th>
                            <th className="px-4 py-3">Tx</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {auctionEventLogs.map((log) => {
                            const isMe = log.actor?.toLowerCase() === wallet?.toLowerCase() || log.bidder?.toLowerCase() === wallet?.toLowerCase() || log.caller?.toLowerCase() === wallet?.toLowerCase();
                            const actor = log.bidder || log.actor || log.caller || "?";

                            let eventDesc = "";
                            let eventValue = "";
                            if (log.action === "bidAuction") {
                              eventDesc = "Placed Bid";
                              eventValue = formatUnits(log.bidWei || "0", 18) + " ETH";
                            } else if (log.action === "createAuction") {
                              eventDesc = "Auction Created";
                              eventValue = formatUnits(log.minPriceWei || "0", 18) + " ETH (Min)";
                            } else if (log.action === "finalizeAuction") {
                              eventDesc = "Auction Finalized";
                            } else if (log.action === "cancelAuction") {
                              eventDesc = "Auction Canceled";
                            } else {
                              eventDesc = log.action;
                            }

                            return (
                              <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3 flex items-center gap-3">
                                  {isMe ? (
                                    <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-[8px] font-black text-white">ME</div>
                                  ) : (
                                    <div className="w-6 h-6 bg-indigo-500/20 rounded-full flex items-center justify-center text-[8px] font-black text-indigo-400">0x</div>
                                  )}
                                  <div className="flex flex-col">
                                    <span className={`font-mono text-xs ${isMe ? "text-emerald-400 font-bold" : "text-slate-300"}`}>
                                      {isMe ? "You" : `${actor.slice(0, 6)}...${actor.slice(-4)}`}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-xs font-bold text-white">{eventValue}</div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">{eventDesc}</div>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-400">
                                  {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                                </td>
                                <td className="px-4 py-3">
                                  {log.txHash ? (
                                    <a
                                      className="text-[10px] text-emerald-400 hover:text-emerald-300 hover:underline inline-flex items-center gap-1"
                                      href={explorerBase ? `${explorerBase}/tx/${log.txHash}` : "#"}
                                      target="_blank" rel="noreferrer"
                                    >
                                      View<ChevronRight className="w-3 h-3" />
                                    </a>
                                  ) : (
                                    <span className="text-[10px] text-slate-500">Pending</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>

              {/* Right Column: Bid Action */}
              <div className="lg:col-span-1">
                <div className="sticky top-6 space-y-6">
                  <section className="bg-gradient-to-b from-[#1C2128] to-black/40 rounded-3xl border border-amber-500/20 p-6 sm:p-8 shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-amber-500/5 transition-opacity opacity-0 group-hover:opacity-100 duration-500"></div>
                    <h3 className="text-2xl font-black mb-8 flex items-center gap-3 text-white relative z-10">
                      <Gavel className="text-amber-400 w-7 h-7" />
                      Place Your Bid
                    </h3>

                    <div className="space-y-6 sm:space-y-8 relative z-10">
                      <div>
                        <div className="flex justify-between items-end mb-3">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Bid Amount</label>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">in ETH</span>
                        </div>
                        <div className="relative">
                          <input
                            className="w-full bg-black/40 border-2 border-white/10 focus:border-amber-500/50 focus:ring-0 rounded-2xl py-4 sm:py-6 pl-6 pr-16 text-3xl font-black transition-all outline-none text-white placeholder-white/20"
                            type="number"
                            placeholder="0.00"
                            step="0.001"
                            value={bidInputValue}
                            onChange={(e) => setBidInputValue(e.target.value)}
                          />
                          <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xl">ETH</div>
                        </div>
                        <div className="mt-3 flex justify-between px-1">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            Min Required: {formatUnits(selectedAuction.highestBidWei === "0" ? selectedAuction.minPriceWei : selectedAuction.highestBidWei, 18)} ETH
                          </span>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleBid(selectedAuction.id, bidInputValue)}
                        disabled={loading || !bidInputValue || Number(bidInputValue) <= 0}
                        className="w-full bg-amber-500 hover:bg-amber-400 text-black py-7 sm:py-8 rounded-2xl font-black text-lg transition-all transform hover:scale-[1.02] shadow-xl shadow-amber-500/10 flex items-center justify-center gap-3"
                      >
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "CONFIRM BID"}
                      </Button>

                      <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/10 text-center">
                        <p className="text-[10px] text-amber-500/70 leading-relaxed uppercase tracking-widest font-bold">
                          Transaction executes directly via the smart contract. Gas fees apply.
                        </p>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : fetchingListings ? (
        <div className="flex flex-col items-center justify-center py-20 text-emerald-500/50">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p className="text-sm font-medium">
            Scanning blockchain for listings...
          </p>
        </div>
      ) : activeListings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-[#1C2128]/50 rounded-[24px] border border-dashed border-[#2D333B]">
          <LayoutGrid className="w-10 h-10 mb-4 opacity-50" />
          <p className="text-sm font-medium">
            No active listings found on the marketplace.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeListings.map((listing) => (
            <Card
              key={`${listing.type}-${listing.id}`}
              className="bg-[#1C2128]/80 backdrop-blur-md border-[#2D333B] hover:border-[#3D444D] transition-all group overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${listing.type === "fixed" ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-amber-400"}`}
                  >
                    {listing.type === "fixed" ? (
                      <Tag className="w-4 h-4" />
                    ) : (
                      <Gavel className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">
                      #{listing.id}
                    </p>
                    <p
                      className="text-[10px] font-mono text-slate-500 leading-none mt-1"
                      title={listing.seller}
                    >
                      {`${listing.seller.slice(0, 6)}...${listing.seller.slice(-4)}`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-black/40 border-white/10 text-slate-300">
                    {listing.type}
                  </span>
                </div>
              </div>

              <CardContent className="p-5 flex-1 flex flex-col justify-center">
                <div className="text-center space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-wider mb-1">
                      Bundle Size
                    </p>
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="text-3xl font-bold text-white tracking-tight">
                        {Number(listing.amount).toLocaleString()}
                      </span>
                      <span className="text-sm font-bold text-emerald-400">
                        CCT
                      </span>
                    </div>
                  </div>

                  <div className="w-12 h-px bg-white/10 mx-auto"></div>

                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {listing.type === "fixed" ? "Total Price" : "Current Bid"}
                    </p>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-lg font-bold text-white">
                        {listing.priceEth}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        ETH
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>

              <div className="p-3 bg-black/20 mt-auto border-t border-white/5">
                {listing.seller.toLowerCase() === wallet?.toLowerCase() ? (
                  <Button
                    variant="secondary"
                    className="w-full font-bold bg-white/5 text-slate-400 cursor-not-allowed"
                    disabled
                  >
                    Your Listing
                  </Button>
                ) : (
                  <Button
                    className={`w-full font-bold group-hover:scale-[1.02] transition-transform ${listing.type === "fixed" ? "bg-white/10 hover:bg-white/20 text-white" : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400"}`}
                    onClick={() =>
                      listing.type === "fixed"
                        ? handleBuy(
                          listing.id,
                          listing.amount,
                          listing.priceEth,
                        )
                        : setSelectedAuction(listing)
                    }
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : listing.type === "fixed" ? (
                      "Buy"
                    ) : (
                      "View Auction"
                    )}
                    {!loading && (
                      <ChevronRight className="w-4 h-4 ml-1 opacity-50" />
                    )}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Contract info bar at bottom */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-8 mt-8 border-t border-white/5">
        <span className="font-semibold">Token Contract:</span>{" "}
        <code className="bg-black/40 px-2 py-1 rounded border border-white/5">
          {tokenAddress || "—"}
        </code>
        <span className="font-semibold">Marketplace:</span>{" "}
        <code className="bg-black/40 px-2 py-1 rounded border border-white/5">
          {marketplaceAddress || "—"}
        </code>
      </div>
    </div>
  );
}

export default Marketplace;
