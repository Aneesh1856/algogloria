"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";

interface PortalSettings {
  internalStatementsReleased?: boolean;
  externalStatementsReleased?: boolean;
}

export default function RevealPage() {
  const router = useRouter();
  const { user, appUser, loading } = useAuth();
  const [portalSettings, setPortalSettings] = useState<PortalSettings | null>(null);
  const [activeTab, setActiveTab] = useState<"internal" | "external">("internal");
  const [isRevealing, setIsRevealing] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user || appUser?.role !== "admin") {
        router.push("/auth");
        return;
      }
      const unsub = onSnapshot(doc(db, "settings", "portal"), (docSnap) => {
        if (docSnap.exists()) {
          setPortalSettings(docSnap.data() as PortalSettings);
        }
      });
      return () => unsub();
    }
  }, [loading, user, appUser, router]);

  const isReleased = activeTab === "internal"
    ? portalSettings?.internalStatementsReleased
    : portalSettings?.externalStatementsReleased;


  const executeReveal = async () => {
    setIsRevealing(true);
    try {
      const field = activeTab === "internal" ? "internalStatementsReleased" : "externalStatementsReleased";
      
      const updateData: any = {
        [field]: true
      };

      // Set the start time only if it hasn't been set yet (first reveal)
      if (!portalSettings?.internalStatementsReleased && !portalSettings?.externalStatementsReleased) {
        updateData.hackathonStartTime = Date.now();
      }

      await updateDoc(doc(db, "settings", "portal"), updateData);
      // Vibrate if available on mobile
      if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([200, 100, 200, 100, 500]);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to initialize reveal sequence.");
    } finally {
      setIsRevealing(false);
    }
  };

  const executeHide = async () => {
    if (!confirm(`Are you sure you want to hide the problem statements for ${activeTab.toUpperCase()}?`)) return;
    setIsRevealing(true);
    try {
      const field = activeTab === "internal" ? "internalStatementsReleased" : "externalStatementsReleased";
      await updateDoc(doc(db, "settings", "portal"), {
        [field]: false
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsRevealing(false);
    }
  };

  if (loading || !user || appUser?.role !== "admin" || !portalSettings) {
    return (
      <div className="min-h-screen bg-[#f4f7f6] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-[#002D62] rounded-full animate-spin"></div>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest animate-pulse">
          {!user || appUser?.role !== "admin" ? "Verifying Credentials..." : "Initializing Panel..."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-[#002D62] flex flex-col font-outfit overflow-hidden relative">
      <div className="absolute inset-0 bg-[#002D62] opacity-[0.03] pattern-grid-lg pointer-events-none"></div>

      {/* Dynamic Background Glow */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[600px] max-h-[600px] rounded-full blur-[100px] transition-all duration-1000 ${isReleased ? 'bg-green-400/40 scale-150' : 'bg-[#FFC300]/30 scale-100'
          }`}
      ></div>

      {/* Header */}
      <div className="pt-12 pb-6 px-6 relative z-10 flex flex-col items-center">
        <div className="w-16 h-1 bg-[#FFC300] mb-6"></div>
        <h1 className="text-3xl font-black uppercase tracking-[0.2em] text-center mb-2 text-[#002D62]">
          PROBLEM STATEMENT<span className="text-gray-400"> </span>
        </h1>
        <h2 className="text-xl font-bold text-gray-500 tracking-wider">REVEAL</h2>
      </div>

      {/* Tabs */}
      <div className="flex px-6 space-x-4 mb-auto relative z-10 mx-auto w-full max-w-sm">
        <button
          onClick={() => setActiveTab("internal")}
          className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === "internal" ? "border-[#FFC300] text-[#002D62]" : "border-gray-300 text-gray-400"
            }`}
        >
          Internal
        </button>
        <button
          onClick={() => setActiveTab("external")}
          className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === "external" ? "border-[#FFC300] text-[#002D62]" : "border-gray-300 text-gray-400"
            }`}
        >
          External
        </button>
      </div>

      {/* Centerpiece Button */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 pb-20">

        {isReleased ? (
          <div className="text-center animate-in fade-in zoom-in duration-500">
            <div className="w-32 h-32 mx-auto bg-green-500/10 border-2 border-green-500/50 rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(34,197,94,0.3)]">
              <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-green-300 to-green-600 uppercase tracking-widest mb-2 font-mono">
              UNLOCKED
            </h3>
            <p className="text-xs text-green-400 font-bold uppercase tracking-[0.2em] mb-12">
              {activeTab} statements are live
            </p>

            <button
              onClick={executeHide}
              className="px-6 py-2 border border-gray-300 text-gray-500 text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-colors"
            >
              Revert / Hide
            </button>
          </div>
        ) : (
          <div className="text-center flex flex-col items-center justify-center">
            <button
              onClick={executeReveal}
              disabled={isRevealing}
              className="relative group w-48 h-48 rounded-full flex items-center justify-center outline-none transition-transform duration-300 hover:scale-105 active:scale-95 mx-auto"
            >
              {/* Outer Ring */}
              <div className="absolute inset-0 border-4 border-[#002D62] rounded-full opacity-10"></div>

              {/* Inner Button */}
              <div className="absolute inset-4 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 bg-gradient-to-br from-[#FFC300] to-orange-400">
                <span className="font-black uppercase tracking-widest text-xl text-[#002D62]">
                  REVEAL
                </span>
              </div>
            </button>
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-12 mb-2">Target Phase</p>
            <p className="text-sm text-[#002D62] font-bold uppercase tracking-[0.3em]">
              {activeTab} Hackathon
            </p>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 left-0 right-0 flex justify-center">
        <button
          onClick={() => router.push("/admin")}
          className="text-[10px] text-gray-500 font-bold uppercase tracking-widest hover:text-white transition-colors flex items-center gap-2"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Return to HQ
        </button>
      </div>
    </div>
  );
}
