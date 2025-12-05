"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2,
  Unlink,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  Instagram,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Account = {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  profilePicture?: string;
  connected: boolean;
  lastSync?: string;
};

export default function ConnectSocials() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/social/accounts?platform=instagram");
      if (!response.ok) throw new Error("Failed to fetch accounts");
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast.error("Failed to load connected accounts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch("/api/social/connect?platform=instagram");
      if (!response.ok) throw new Error("Failed to get connection URL");
      const data = await response.json();

      if (data.url) {
        // Open OAuth URL in a new window/tab
        const authWindow = window.open(
          data.url,
          "Instagram Connect",
          "width=600,height=700,scrollbars=yes,popup=yes"
        );

        // Show instructions toast
        toast.info("Complete the authorization, then close the popup window when you see the success message.", {
          duration: 8000,
        });

        // Poll for successful connection AND window close
        const pollTimer = setInterval(async () => {
          // Check if connection was successful by polling accounts
          try {
            const accountsRes = await fetch("/api/social/accounts?platform=instagram");
            if (accountsRes.ok) {
              const accountsData = await accountsRes.json();
              const igAccounts = (accountsData.accounts || []).filter(
                (a: Account) => a.platform === "instagram"
              );

              // If we found a connected account, close popup and refresh
              if (igAccounts.length > 0) {
                clearInterval(pollTimer);
                if (authWindow && !authWindow.closed) {
                  authWindow.close();
                }
                setIsConnecting(false);
                setAccounts(igAccounts);
                toast.success("Instagram account connected successfully!");
                return;
              }
            }
          } catch (e) {
            // Ignore polling errors
          }

          // Also check if window was closed manually
          if (authWindow?.closed) {
            clearInterval(pollTimer);
            setIsConnecting(false);
            // Final check for accounts
            await new Promise(resolve => setTimeout(resolve, 1000));
            fetchAccounts();
          }
        }, 2000);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(pollTimer);
          setIsConnecting(false);
        }, 300000);
      } else {
        toast.error("No connection URL received");
        setIsConnecting(false);
      }
    } catch (error) {
      console.error("Error connecting:", error);
      toast.error("Failed to initiate connection");
      setIsConnecting(false);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchAccounts();
    toast.success("Account list refreshed");
  };

  const handleDisconnect = async (accountId: string) => {
    setDisconnectingId(accountId);
    try {
      const response = await fetch(
        `/api/social/accounts?accountId=${accountId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to disconnect account");

      setAccounts((prev) => prev.filter((a) => a._id !== accountId));
      toast.success("Account disconnected successfully");
    } catch (error) {
      console.error("Error disconnecting:", error);
      toast.error("Failed to disconnect account");
    } finally {
      setDisconnectingId(null);
    }
  };

  const instagramAccounts = accounts.filter((a) => a.platform === "instagram");

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-white mb-2">Connect Socials</h1>
        <p className="text-neutral-400">
          Manage your social media account connections.
        </p>
      </motion.div>

      {/* Instagram Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-neutral-900/30 border border-neutral-800 rounded-3xl overflow-hidden backdrop-blur-sm shadow-xl"
      >
        <div className="p-6 border-b border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 rounded-xl flex items-center justify-center">
                <Instagram className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Instagram</h2>
                <p className="text-sm text-neutral-400">
                  Connect your Instagram Business or Creator account
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all bg-white/5 border border-white/10 text-white hover:bg-white/10"
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                Refresh
              </button>
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all",
                  isConnecting
                    ? "bg-neutral-800 text-neutral-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white hover:shadow-lg hover:shadow-pink-500/20"
                )}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4" />
                    Connect Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
            </div>
          ) : instagramAccounts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-neutral-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Instagram className="w-8 h-8 text-neutral-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                No Instagram accounts connected
              </h3>
              <p className="text-neutral-400 text-sm max-w-md mx-auto mb-4">
                Connect your Instagram Business or Creator account to start
                scheduling posts, reels, and stories.
              </p>
              <p className="text-neutral-500 text-xs max-w-md mx-auto">
                Already completed the login? Click the Refresh button above to check for your connected account.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {instagramAccounts.map((account) => (
                  <motion.div
                    key={account._id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-neutral-950/50 border border-neutral-800 rounded-2xl p-5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <Instagram className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">
                          {account.displayName || account.username || "Instagram Account"}
                        </h3>
                        {account.username && (
                          <p className="text-sm text-neutral-400">
                            @{account.username}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-xs font-medium text-green-500">
                            Connected
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDisconnect(account._id)}
                        disabled={disconnectingId === account._id}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all border",
                          disconnectingId === account._id
                            ? "bg-neutral-800 border-neutral-700 text-neutral-400 cursor-not-allowed"
                            : "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                        )}
                      >
                        {disconnectingId === account._id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Disconnecting...
                          </>
                        ) : (
                          <>
                            <Unlink className="w-4 h-4" />
                            Disconnect
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>

      {/* Troubleshooting Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-3xl p-6"
      >
        <div className="flex gap-4">
          <div className="p-3 bg-purple-500/10 rounded-xl h-fit">
            <AlertCircle className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">
              Connection Steps
            </h3>
            <ul className="space-y-2 text-sm text-neutral-400">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <span>Click "Connect Account" - a popup window will open</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <span>Log in with Facebook and select your Facebook Page</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <span>Grant all requested permissions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                <span><strong className="text-white">Close the popup</strong> when you see "Connection Successful"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
                <span>Your account will automatically appear here</span>
              </li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Info Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-neutral-900/30 border border-neutral-800 rounded-3xl p-6"
      >
        <div className="flex gap-4">
          <div className="p-3 bg-blue-500/10 rounded-xl h-fit">
            <AlertCircle className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white mb-2">
              Requirements for Instagram Connection
            </h3>
            <ul className="space-y-2 text-sm text-neutral-400">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">1.</span>
                <span>
                  Your Instagram account must be a{" "}
                  <strong className="text-white">Business</strong> or{" "}
                  <strong className="text-white">Creator</strong> account
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">2.</span>
                <span>
                  Your Instagram account must be connected to a{" "}
                  <strong className="text-white">Facebook Page</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">3.</span>
                <span>
                  You must have admin access to the connected Facebook Page
                </span>
              </li>
            </ul>
            <a
              href="https://help.instagram.com/502981923235522"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 mt-4 transition-colors"
            >
              Learn how to convert to a Business account
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

