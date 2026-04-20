"use client";

import React from "react";
import Link from "next/link";

const Footer = () => {
  return (
    <footer className="bg-[#002D62] text-white py-8 px-4 sm:px-8 border-t border-white/10 w-full overflow-hidden">
      <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-center md:text-left">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] whitespace-nowrap">
            &copy; 2026 Amity University Bengaluru. ALL RIGHTS RESERVED.
          </p>
          <div className="hidden md:block w-[1px] h-3 bg-white/10"></div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">
            Built by <span className="text-[#FFC300]">Aneesh Prakash Dhavade</span>, Technical Lead
          </p>
        </div>

        <div className="flex flex-row items-center gap-4 sm:gap-6 md:gap-8 text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest">
          <Link href="/privacy-policy" className="hover:text-[#FFC300] min-h-[44px] md:min-h-0 flex items-center transition-colors whitespace-nowrap">Privacy Policy</Link>
          <Link href="/terms-of-service" className="hover:text-[#FFC300] min-h-[44px] md:min-h-0 flex items-center transition-colors whitespace-nowrap">Terms of Service</Link>
          <Link href="/contact" className="hover:text-[#FFC300] min-h-[44px] md:min-h-0 flex items-center transition-colors whitespace-nowrap">Contact</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
