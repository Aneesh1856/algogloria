"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { GlassCard as Card } from "@/components/GlassCard";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";


interface PortalSettings {
  eventSchedule: string;
  zoneOperations: string;
  eventScheduleLabel: string;
  zoneOperationsLabel: string;
  targetDate: string;
}

export default function LandingPage() {
  const router = useRouter();
  const { appUser, loading } = useAuth();

  const [portalSettings, setPortalSettings] = useState<PortalSettings>({
    eventSchedule: "Phase 01: April 16th\nFinals: April 17th",
    zoneOperations: "Amity Main Campus\nAuditorium Block",
    eventScheduleLabel: "Event Schedule",
    zoneOperationsLabel: "Zone Operations",
    targetDate: "2026-04-16T09:00:00"
  });

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "settings", "portal"), (snap) => {
      if (snap.exists()) setPortalSettings(snap.data() as PortalSettings);
    });

    const timer = setInterval(() => {
      const target = new Date(portalSettings.targetDate).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, target - now);

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [portalSettings.targetDate]);

  const format = (num: number) => num.toString().padStart(2, '0');

  const handleAction = () => {
    if (appUser) {
      if (appUser.role === "admin") router.push("/admin");
      else if (appUser.role === "evaluator") router.push("/evaluator");
      else router.push("/dashboard");
    } else {
      router.push("/auth");
    }
  };

  return (
    <div
      className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center py-12 px-4 sm:py-20 sm:px-6 w-full max-w-full text-[#333333] font-montserrat relative"
      style={{
        backgroundImage: "url('/bg.png')",
        backgroundAttachment: "fixed",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Faded overlay so text remains legible */}
      <div className="absolute inset-0 bg-[#e8e8e8]/80 pointer-events-none" aria-hidden="true" />
      <div className="relative z-10 max-w-6xl w-full text-center space-y-32">

        {/* Branding Section */}
        <div className="space-y-6">
          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-[120px] font-bold tracking-tighter leading-none text-[#002D62] italic">
            AlgoGLORiA <span className="text-[#FFC300] not-italic">2K26</span>
          </h1>
          <div className="flex items-center justify-center space-x-6">
            <div className="h-[2px] w-20 bg-[#FFC300]"></div>
            <p className="text-sm md:text-2xl font-bold uppercase tracking-[0.5em] text-[#002D62]">
              Amity University Bengaluru
            </p>
            <div className="h-[2px] w-20 bg-[#FFC300]"></div>
          </div>
        </div>

        {/* Tactical Countdown */}
        <div className="flex justify-center flex-wrap gap-0">
          {[
            { label: "Days", val: format(timeLeft.days) },
            { label: "Hours", val: format(timeLeft.hours) },
            { label: "Minutes", val: format(timeLeft.minutes) },
            { label: "Seconds", val: format(timeLeft.seconds), active: true }
          ].map((unit, i) => (
            <div key={i} className={`flex flex-col items-center justify-center w-20 h-20 sm:w-28 sm:h-28 md:w-44 md:h-44 border-r border-white/10 last:border-r-0 transition-all ${unit.active ? 'bg-[#FFC300] text-[#002D62]' : 'bg-[#002D62] text-white'}`}>
              <span className="text-4xl md:text-7xl font-bold tracking-tighter leading-none">{unit.val}</span>
              <span className={`text-[10px] font-bold uppercase tracking-widest mt-2 ${unit.active ? 'text-[#002D62]/60' : 'text-white/40'}`}>{unit.label}</span>
            </div>
          ))}
        </div>

        {/* Theme & Tracks Section */}
        <div id="tracks" className="space-y-12 py-10 scroll-mt-24">
          <div className="space-y-4 max-w-4xl mx-auto">
            <h2 className="text-sm font-bold uppercase tracking-[0.4em] text-[#FFC300]">Conclave Theme</h2>
            <h2 className="text-3xl md:text-5xl font-black uppercase text-[#002D62] leading-tight">
              Humanity Conclave: <br />
              <span className="text-gray-500">“Shaping a Human-Centric AI Future”</span>
            </h2>
            <div className="flex justify-center pt-2">
              <div className="h-1 w-24 bg-[#002D62]"></div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-8 max-w-7xl mx-auto px-4">
            {[
              {
                title: "Transformative Healthcare",
                desc: "AI-driven diagnostics and personalized patient care systems.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                )
              },
              {
                title: "Collaborative Robotics",
                desc: "Seamless human-robot interaction for industrial & domestic use.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                )
              },
              {
                title: "Creative Synthesis",
                desc: "Empowering human expression through Generative AI tools.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                )
              },
              {
                title: "Ethical Governance",
                desc: "Developing transparent, fair, and unbiased AI frameworks.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                )
              },
              {
                title: "Inclusive Design",
                desc: "Accessibility-first AI solutions for diverse human abilities.",
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                )
              }
            ].map((track, i) => (
              <div key={i} className="bg-white border-t-4 border-t-[#002D62] p-8 text-left shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 w-full sm:w-[calc(50%-2rem)] lg:w-[calc(33.333%-2rem)] min-w-[300px]">
                <div className="text-[#FFC300] mb-4">{track.icon}</div>
                <h4 className="text-sm font-black uppercase tracking-widest text-[#002D62] mb-3">{track.title}</h4>
                <p className="text-xs font-medium text-gray-400 leading-relaxed">{track.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Operational Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 max-w-5xl mx-auto border-t-8 border-t-[#FFC300]">
          <div className="bg-white p-12 border-r border-[#e9ecef] flex flex-col items-center text-center group hover:bg-[#f8f9fa] transition-all">
            <div className="bg-[#002D62] p-4 rounded-none text-white mb-8 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
            </div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#002D62] mb-3">{portalSettings.eventScheduleLabel}</h3>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed whitespace-pre-line">{portalSettings.eventSchedule}</p>
          </div>
          <div className="bg-white p-12 border-r border-[#e9ecef] flex flex-col items-center text-center group hover:bg-[#f8f9fa] transition-all">
            <div className="bg-[#002D62] p-4 rounded-none text-white mb-8 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
            </div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[#002D62] mb-3">{portalSettings.zoneOperationsLabel}</h3>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed whitespace-pre-line">{portalSettings.zoneOperations}</p>
          </div>
        </div>

        {/* About Section */}
        <div id="about" className="w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] bg-[#002D62] py-20 px-4 sm:px-8 -mx-4 sm:-mx-6 text-white text-center space-y-12">
          <div className="max-w-4xl mx-auto space-y-4">
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight">
              About <span className="text-[#FFC300]">Us</span>
            </h2>
            <div className="flex justify-center">
              <div className="w-16 h-[2px] bg-[#FFC300]"></div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            {[
              { label: "Hours of Hacking", value: "24" },
            ].map((stat) => (
              <div key={stat.label} className="border border-[#FFC300]/30 bg-[#FFC300]/5 px-10 py-6 min-w-[160px] space-y-1 hover:bg-[#FFC300]/10 transition-all">
                <p className="text-[#FFC300] text-3xl font-black tracking-tight">{stat.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          <div className="max-w-3xl mx-auto space-y-6 text-[14px] font-medium text-gray-300 leading-loose tracking-wide">
            <p>
              With the power of <span className="text-[#FFC300] font-bold">community</span>, we bring forth the opportunity to create a strong network of{" "}
              <span className="text-[#FFC300] font-bold">future tech innovators</span>! AlgoGLORiA 2K26 brings together{" "}
              <span className="text-[#FFC300] font-bold">brilliant minds</span> for an unforgettable 24-hour journey of innovation, learning, and collaboration at{" "}
              <span className="text-[#FFC300] font-bold">Amity University Bengaluru</span>.
            </p>
            <p>
              Our growing digital and physical networks enable{" "}
              <span className="text-[#FFC300] font-bold">everyone</span> involved to learn, grow, and collaborate, providing a thriving environment for all!
            </p>
          </div>
        </div>

        {/* FAQ Section */}
        <div id="faqs" className="w-full max-w-5xl mx-auto text-left space-y-6">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#002D62]">Frequently Asked Questions</p>
          <div className="bg-white border-t-4 border-t-[#FFC300]">
            {[
              {
                q: "How do I register my team?",
                a: (
                  <>
                    Go to the Registration Page, select your Participant Type, and create your team. Your team lead must register first and invite members.{" "}
                    <a href="/AlgoGLORiA_Registration_Guide.pdf" target="_blank" rel="noopener noreferrer" className="text-[#f5a623] font-bold hover:underline">
                      View Registration Guide
                    </a>
                  </>
                ),
              },
              {
                q: "Can I change my team after registering?",
                a: "Team changes are not permitted after the registration deadline. Contact the organising committee before the deadline if correction is needed.",
              },
              {
                q: "Where will the event take place?",
                a: "AlgoGLORiA 2K26 is held at Amity University Bengaluru.",
              },
            ].map((item, i) => (
              <div key={i} className="px-10 py-8 border-b border-[#e9ecef] last:border-b-0">
                <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-[#002D62] mb-2">{item.q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Global Action */}
        <div className="pt-10 pb-20 flex flex-col sm:flex-row justify-center items-center gap-6">
          <Button
            onClick={handleAction}
            className="!px-20 !py-6 !text-lg !rounded-none shadow-nav hover:shadow-amity w-full sm:w-auto"
            disabled={loading}
          >
            {loading ? "INITIALIZING..." : appUser ? "GO TO DASHBOARD" : "Login/SignUp"}
          </Button>
          <a
            href="/AlgoGLORiA_Registration_Guide.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex justify-center items-center px-12 py-6 min-h-[44px] bg-white border-2 border-[#002D62] text-[#002D62] text-sm font-black uppercase tracking-widest hover:bg-[#002D62] hover:text-[#FFC300] transition-all shadow-nav w-full sm:w-auto text-center flex-shrink-0"
          >
            <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Registration Guide
          </a>
        </div>

      </div>
    </div>
  );
}
