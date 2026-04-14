import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | AlgoGLORiA 2K26",
  description:
    "Read the Privacy Policy for AlgoGLORiA 2K26 — the hackathon hosted by Amity University Bengaluru.",
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="border-l-4 border-[#FFC300] pl-6 space-y-3">
    <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#002D62]">
      {title}
    </h2>
    <div className="text-[13px] leading-loose text-gray-600 space-y-2">
      {children}
    </div>
  </div>
);

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-[#e0e0e0] min-h-[calc(100vh-80px)] py-16 px-4 sm:px-6 w-full max-w-full overflow-hidden">
      <div className="max-w-3xl mx-auto space-y-14 w-full">
        {/* Header */}
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#FFC300]">
            AlgoGLORiA 2K26 &mdash; Amity University Bengaluru
          </p>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-[#002D62] leading-none break-words">
            Privacy<br />
            <span className="text-[#FFC300]">Policy</span>
          </h1>
          <div className="w-16 h-[3px] bg-[#002D62]" />
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            Effective Date: April 1, 2026 &nbsp;|&nbsp; Last Revised: March 2026
          </p>
        </div>

        {/* Intro */}
        <p className="text-[13px] text-gray-600 leading-loose">
          This Privacy Policy explains how <strong className="text-[#002D62]">AlgoGLORiA 2K26</strong>, organised
          by <strong className="text-[#002D62]">Amity University Bengaluru</strong>, collects, uses, and
          protects information provided by participants, evaluators, and visitors through this portal. By using the Portal you agree to the practices described below.
        </p>

        {/* Sections */}
        <div className="space-y-10">
          <Section title="1. Information We Collect">
            <p>
              <strong>Personal Identifiers:</strong> Full name, institutional email address, phone number, and
              team details submitted at registration.
            </p>
            <p>
              <strong>Usage Data:</strong> Pages visited, actions performed inside the Portal (e.g. project
              submissions, score views), device type, browser, and IP address.
            </p>
            <p>
              <strong>Project Content:</strong> Problem statement selections, project descriptions, and
              evaluation scores submitted through the Portal.
            </p>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc list-inside space-y-1">
              <li>Managing participant registration and team formation.</li>
              <li>Communicating event updates, schedule changes, and results.</li>
              <li>Facilitating evaluation workflows between judges and teams.</li>
              <li>Generating anonymised, aggregate reports on event outcomes.</li>
              <li>Improving Portal functionality and user experience.</li>
            </ul>
          </Section>

          <Section title="3. Data Storage & Security">
            <p>
              All data is stored securely in <strong className="text-[#002D62]">Google Firebase</strong> with
              role-based access control. Only authorised personnel (administrators and assigned evaluators) can
              access sensitive team or scoring data. Passwords are never stored — authentication is handled via
              Firebase Authentication.
            </p>
            <p>
              While we implement industry-standard safeguards, no transmission over the internet is 100%
              secure. We encourage participants to use strong, unique passwords.
            </p>
          </Section>

          <Section title="4. Data Sharing">
            <p>
              We do <strong>not</strong> sell, rent, or trade your personal information with third parties.
              Data may be shared only in the following limited circumstances:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>With Amity University Bengaluru administrative staff for event management.</li>
              <li>When required by applicable law or a valid legal process.</li>
              <li>With service providers (e.g. Firebase) bound by their own privacy agreements.</li>
            </ul>
          </Section>

          <Section title="5. Retention">
            <p>
              Registration data and project submissions are retained for <strong>12 months</strong> after the
              event and then securely deleted, unless a longer retention period is required by university
              policy.
            </p>
          </Section>

          <Section title="6. Your Rights">
            <p>
              Participants may request access to, correction of, or deletion of their personal data by
              contacting the organising team. Deletion requests will be honoured within 30 days, except where
              data must be kept for audit or compliance purposes.
            </p>
          </Section>

          <Section title="7. Cookies">
            <p>
              The Portal uses authentication session cookies managed by Firebase. No third-party advertising
              cookies are used.
            </p>
          </Section>

          <Section title="8. Changes to This Policy">
            <p>
              We may update this policy to reflect changes in law or our practices. Material changes will be
              communicated via the Portal. Continued use after an update constitutes acceptance.
            </p>
          </Section>

          <Section title="9. Contact">
            <p>
              For privacy-related enquiries, please reach out through the{" "}
              <Link href="/contact" className="text-[#002D62] font-bold underline hover:text-[#FFC300] transition-colors">
                Contact page
              </Link>
              .
            </p>
          </Section>
        </div>

        {/* Back */}
        <div className="pt-4">
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
