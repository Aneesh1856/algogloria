"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface NavbarProps {
  pageTitle?: string;
}

const Navbar: React.FC<NavbarProps> = ({ pageTitle = "AlgoGLORiA PORTAL" }) => {
  const { appUser, logout, loading } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/auth");
  };

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "About", href: "/#about" },
    { name: "Tracks", href: "/#tracks" },
    { name: "FAQs", href: "/#faqs" },
    { name: "Contact", href: "/contact" },
  ];

  const displayName = appUser
    ? (appUser.firstName && appUser.lastName
      ? `${appUser.firstName} ${appUser.lastName}`
      : (appUser.name || appUser.enrollment_no))
    : "";

  return (
    <nav className="bg-[#002D62] text-white h-20 flex items-center justify-between px-8 shadow-nav relative z-50">
      {/* Left: Logo */}
      <div className="flex items-center min-w-0 max-w-[60%] flex-shrink">
        <Link href="/" className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
          <div className="relative w-48 h-12">
            <Image
              src="/amity-logo.png"
              alt="Amity University Logo"
              fill
              className="object-contain object-left"
            />
          </div>
        </Link>
      </div>

      {/* Center: Page Title (Classic Style) */}
      <Link href="/" className="absolute left-1/2 -translate-x-1/2 hidden lg:block cursor-pointer hover:opacity-80 transition-opacity">
        <div className="flex items-center space-x-6">
          <div className="w-[2px] h-8 bg-[#FFC300]"></div>
          <h1 className="text-[28px] font-bold tracking-tight leading-none text-white">
            AlgoGLOR<span className="lowercase">i</span>A PORTAL
          </h1>
          <div className="w-[2px] h-8 bg-[#FFC300]"></div>
        </div>
      </Link>


      {/* Right: User + Menu Toggle */}
      <div className="flex items-center justify-end space-x-6 flex-shrink-0">

        {/* User Info (Legacy Style) */}
        {!loading && appUser && (
          <div className="hidden sm:flex items-center space-x-2 text-[12px] font-bold uppercase tracking-widest text-[#FFC300]">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            <span>{displayName}</span>
          </div>
        )}

        {/* Tactical Hamburger Trigger */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="w-10 h-10 flex flex-col items-center justify-center space-y-1.5 hover:bg-white/10 transition-all rounded-sm border border-white/10"
        >
          <div className={`w-5 h-[2px] bg-white transition-all ${isMenuOpen ? 'rotate-45 translate-y-[7px]' : ''}`}></div>
          <div className={`w-5 h-[2px] bg-white transition-all ${isMenuOpen ? 'opacity-0' : ''}`}></div>
          <div className={`w-5 h-[2px] bg-white transition-all ${isMenuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`}></div>
        </button>

        {!loading && !appUser && (
          <button
            onClick={() => router.push("/auth")}
            className="hidden md:block bg-[#FFC300] text-[#002D62] px-6 py-2.5 rounded-none font-bold text-[12px] uppercase tracking-[0.2em] shadow-lg border-b-2 border-[#cc9d00]"
          >
            Login
          </button>
        )}
      </div>

      {/* DROP DOWN MENU OVERLAY */}
      <div className={`absolute top-20 right-0 w-full max-w-[320px] bg-[#002D62] border-l border-b border-white/10 shadow- amity transition-all duration-500 overflow-hidden z-40 ${isMenuOpen ? 'max-h-[800px] opacity-100 py-8' : 'max-h-0 opacity-0'}`}>
        <div className="flex flex-col space-y-1 px-8">


          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FFC300] mb-4">Command Nodes</h4>
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => setIsMenuOpen(false)}
              className="py-3 min-h-[44px] w-full text-left text-xs font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-white hover:translate-x-2 transition-all flex items-center justify-between group border-b border-white/5 last:border-0"
            >
              <span>{link.name}</span>
              <span className="opacity-0 group-hover:opacity-100 text-[#FFC300] tracking-tighter">&gt;&gt;</span>
            </Link>
          ))}

          <div className="pt-4 flex flex-col space-y-1">
            {appUser?.role === 'admin' && (
              <Link
                href="/admin"
                onClick={() => setIsMenuOpen(false)}
                className="py-3 min-h-[44px] w-full block text-left text-xs font-black uppercase tracking-[0.2em] text-[#FFC300] hover:text-white transition-all"
              >
                Admin Console
              </Link>
            )}

            <Link
              href="/dashboard"
              onClick={() => setIsMenuOpen(false)}
              className="py-3 min-h-[44px] w-full block text-left text-xs font-black uppercase tracking-[0.2em] text-white hover:text-[#FFC300] transition-all"
            >
              Dashboard
            </Link>
          </div>

          <div className="pt-8 mt-4 border-t border-white/10">
            {!appUser ? (
              <button
                onClick={() => { router.push("/auth"); setIsMenuOpen(false); }}
                className="w-full min-h-[44px] bg-[#FFC300] text-[#002D62] py-4 font-black uppercase tracking-widest text-xs"
              >
                Initiate Login
              </button>
            ) : (
              <button
                onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                className="w-full min-h-[44px] bg-red-600 text-white py-4 font-black uppercase tracking-widest text-xs"
              >
                Terminate Session
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
