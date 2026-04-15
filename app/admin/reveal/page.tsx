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
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

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

  // Hold to reveal logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (holding && !isReleased) {
      interval = setInterval(() => {
        setHoldProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            executeReveal();
            return 100;
          }
          return prev + 2; // Takes about 1.5 seconds to reach 100
        });
      }, 30);
    } else if (!holding) {
      setHoldProgress(0);
    }
    return () => clearInterval(interval);
  }, [holding, isReleased]);

  const executeReveal = async () => {
    setIsRevealing(true);
    try {
      const field = activeTab === "internal" ? "internalStatementsReleased" : "externalStatementsReleased";
      await updateDoc(doc(db, "settings", "portal"), {
        [field]: true
      });
      // Vibrate if available on mobile
      if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([200, 100, 200, 100, 500]);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to initialize reveal sequence.");
    } finally {
      setIsRevealing(false);
      setHolding(false);
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
    } catch(err) {
      console.error(err);
    } finally {
      setIsRevealing(false);
    }
  };

  if (loading || !user || appUser?.role !== "admin" || !portalSettings) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-gray-800 border-t-[#FFC300] rounded-full animate-spin"></div>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest animate-pulse">
           {!user || appUser?.role !== "admin" ? "Verifying Credentials..." : "Initializing Panel..."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-outfit overflow-hidden relative">
      <div className="absolute inset-0 bg-[#002D62] opacity-[0.03] pattern-grid-lg pointer-events-none"></div>
      
      {/* Dynamic Background Glow */}
      <div 
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[600px] max-h-[600px] rounded-full blur-[100px] transition-all duration-1000 ${
          isReleased ? 'bg-green-500/20 scale-150' : holding ? 'bg-[#FFC300]/20 scale-125' : 'bg-[#002D62]/30 scale-100'
        }`}
      ></div>

      {/* Header */}
      <div className="pt-12 pb-6 px-6 relative z-10 flex flex-col items-center">
        <div className="w-16 h-1 bg-[#FFC300] mb-6"></div>
        <h1 className="text-3xl font-black uppercase tracking-[0.2em] text-center mb-2 text-white">
          Operation<span className="text-gray-500">_</span>
        </h1>
        <h2 className="text-xl font-bold text-gray-400 tracking-wider">REVEAL</h2>
      </div>

      {/* Tabs */}
      <div className="flex px-6 space-x-4 mb-auto relative z-10 mx-auto w-full max-w-sm">
        <button 
          onClick={() => { setActiveTab("internal"); setHoldProgress(0); }}
          className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === "internal" ? "border-[#FFC300] text-white" : "border-gray-800 text-gray-600"
          }`}
        >
          Internal
        </button>
        <button 
          onClick={() => { setActiveTab("external"); setHoldProgress(0); }}
          className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
            activeTab === "external" ? "border-[#FFC300] text-white" : "border-gray-800 text-gray-600"
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
              className="px-6 py-2 border border-gray-700 text-gray-400 text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-colors"
            >
              Revert / Hide
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mb-8">
              Press & Hold to Authorize
            </p>
            
            <button
              onMouseDown={() => setHolding(true)}
              onMouseUp={() => setHolding(false)}
              onMouseLeave={() => setHolding(false)}
              onTouchStart={(e) => { e.preventDefault(); setHolding(true); }}
              onTouchEnd={() => setHolding(false)}
              disabled={isRevealing}
              className={`relative group w-48 h-48 rounded-full flex items-center justify-center outline-none transition-transform duration-300 ${
                holding ? 'scale-95' : 'scale-100 hover:scale-105'
              }`}
            >
              {/* Outer Ring */}
              <div className="absolute inset-0 border-[3px] border-gray-800 rounded-full"></div>
              
              {/* Progress Ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                <circle 
                  cx="96" cy="96" r="94" 
                  fill="none" 
                  stroke="#FFC300" strokeWidth="4" 
                  strokeDasharray="590"
                  strokeDashoffset={590 - (590 * holdProgress) / 100}
                  className="transition-all duration-75 easelinear" 
                />
              </svg>

              {/* Inner Button */}
              <div className={`absolute inset-4 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ${
                holding ? 'bg-gradient-to-br from-[#FFC300] to-orange-500 shadow-[0_0_40px_rgba(255,195,0,0.6)]' : 'bg-[#111]'
              }`}>
                <span className={`font-black uppercase tracking-widest text-lg transition-colors ${
                  holding ? 'text-[#002D62]' : 'text-gray-300'
                }`}>
                  {holding ? 'INITIATING...' : 'REVEAL'}
                </span>
              </div>
            </button>
            <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mt-12 mb-2">Target Phase</p>
            <p className="text-sm text-gray-300 font-bold uppercase tracking-[0.3em]">
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
