"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function ContactPage() {
  const [copied, setCopied] = useState(false);

  const copyEmail = () => {
    navigator.clipboard.writeText("aigloriaofficial@gmail.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const contacts = [
    {
      role: "General Enquiries",
      name: "AlgoGLORiA Organising Committee",
      email: "aigloriaofficial@gmail.com",
      phone: null,
      note: "For registration, schedule, or general event questions.",
    },
    {
      role: "Technical Lead",
      name: "Aneesh Prakash Dhavade",
      email: "aneeshdhavade18@gmail.com",
      phone: null,
      note: "Portal bugs, account issues, or technical help.",
    },
  ];

  const faqs = [
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
      a: "AlgoGLORiA 2K26 is held at Amity University Bengaluru",
    },
  ];

  return (
    <div className="bg-[#e0e0e0] min-h-[calc(100vh-80px)] py-16 px-4 sm:px-6 w-full max-w-full overflow-hidden">
      <div className="max-w-3xl mx-auto space-y-16 w-full">
        {/* Header */}
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#FFC300]">
            AlgoGLORiA 2K26 &mdash; Amity University Bengaluru
          </p>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-[#002D62] leading-none break-words">
            Get in<br />
            <span className="text-[#FFC300]">Touch</span>
          </h1>
          <div className="w-16 h-[3px] bg-[#002D62]" />
          <p className="text-[13px] text-gray-600 leading-loose">
            Have a question or need help? Find the right contact below or check our FAQs.
          </p>
        </div>

        {/* Contact Cards */}
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#002D62]">
            Contact Directory
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t-4 border-t-[#FFC300]">
            {contacts.map((c, i) => (
              <div
                key={i}
                className="bg-white p-8 border-r border-b border-[#e9ecef] last:border-r-0 group hover:bg-[#f8f9fa] transition-all space-y-3"
              >
                <div className="space-y-0.5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#FFC300]">{c.role}</p>
                  <p className="text-sm font-bold text-[#002D62]">{c.name}</p>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">{c.note}</p>
                <a
                  href={`mailto:${c.email}`}
                  className="inline-flex items-center gap-2 text-[11px] font-bold text-[#002D62] hover:text-[#FFC300] transition-colors break-all"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {c.email}
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Copy */}
        {/* <div className="bg-[#002D62] p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#FFC300]">Quick Contact</p>
            <p className="text-white text-sm font-bold">aigloriaofficial@gmail.com</p>
            <p className="text-white/40 text-[11px]">Click to copy email address to clipboard</p>
          </div>
          <button
            onClick={copyEmail}
            className="shrink-0 bg-[#FFC300] text-[#002D62] text-[11px] font-black uppercase tracking-widest px-6 py-3 hover:bg-white transition-colors"
          >
            {copied ? "✓ Copied!" : "Copy Email"}
          </button>
        </div> */}

        {/* Location */}
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#002D62]">
            Event Location
          </p>
          <div className="bg-white border-l-4 border-[#FFC300] p-8 space-y-2">
            <p className="text-sm font-bold text-[#002D62]">Amity University Bengaluru</p>
            <p className="text-[12px] text-gray-500 leading-loose">
              NH-207,<br />
              Opposite to the office of Deputy Commissioner,<br />
              Devanahalli, Doddaballapura,<br />
              Bengaluru, Karnataka 562110.
            </p>
          </div>
        </div>

        {/* FAQs */}
        <div className="space-y-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#002D62]">
            Frequently Asked Questions
          </p>
          <div className="space-y-0">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-white border-b border-[#e9ecef] p-6 space-y-2 hover:bg-[#f8f9fa] transition-colors"
              >
                <p className="text-[12px] font-bold text-[#002D62] uppercase tracking-wide">{faq.q}</p>
                <p className="text-[12px] text-gray-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Back */}
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#002D62] hover:text-[#FFC300] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
