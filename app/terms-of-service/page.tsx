import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service | AlgoGLORiA 2K26",
  description:
    "Review the Terms of Service governing participation in AlgoGLORiA 2K26 at Amity University Bengaluru.",
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

export default function TermsOfServicePage() {
  return (
    <div className="bg-[#e0e0e0] min-h-[calc(100vh-80px)] py-16 px-4 sm:px-6 w-full max-w-full overflow-hidden">
      <div className="max-w-3xl mx-auto space-y-14 w-full">
        {/* Header */}
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#FFC300]">
            AlgoGLORiA 2K26 &mdash; Amity University Bengaluru
          </p>
          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-[#002D62] leading-none break-words">
            Terms of<br />
            <span className="text-[#FFC300]">Service</span>
          </h1>
          <div className="w-16 h-[3px] bg-[#002D62]" />
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            Effective Date: April 1, 2026 &nbsp;|&nbsp; Last Revised: March 2026
          </p>
        </div>

        {/* Intro */}
        <p className="text-[13px] text-gray-600 leading-loose">
          These Terms of Service ("Terms") govern your access to and use of the{" "}
          <strong className="text-[#002D62]">AlgoGLORiA 2K26</strong> hackathon portal operated by{" "}
          <strong className="text-[#002D62]">Amity University Bengaluru</strong>. By registering, logging in,
          or otherwise using the Portal, you confirm that you have read, understood, and agreed to be bound by
          these Terms.
        </p>

        {/* Sections */}
        <div className="space-y-10">
          <Section title="1. Eligibility">
            <p>
              Open to undergraduate and postgraduate students from any recognized college or university.
            </p>
          </Section>

          <Section title="2. Team Participation">
            <ul className="list-disc list-inside space-y-1">
              <li>Teams must consist of <strong>2 to 4 members</strong>.</li>
              <li>Each participant may belong to only one team.</li>
              <li>Team composition may not be changed after the registration deadline.</li>
              <li>
                One member must accept the role of <strong>Team Lead</strong> and is responsible for
                all official communications with organisers.
              </li>
            </ul>
          </Section>

          <Section title="3. Code of Conduct">
            <p>
              All participants, evaluators, and attendees are expected to maintain a respectful, inclusive, and
              professional environment throughout the event. The following are strictly prohibited:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Harassment, discrimination, or intimidation of any kind.</li>
              <li>Plagiarism or submission of pre-built solutions.</li>
              <li>Tampering with the Portal, evaluation system, or other teams&apos; data.</li>
              <li>Sharing login credentials with unauthorised persons.</li>
            </ul>
            <p>
              Violations may result in disqualification and/or disciplinary action under university policy.
            </p>
          </Section>

          <Section title="4. Intellectual Property">
            <p>
              Participants retain all intellectual property rights over their original work. By submitting a
              project, you grant Amity University Bengaluru a <strong>non-exclusive, royalty-free licence</strong> to
              showcase the project in promotional materials, social media, and academic publications, with
              appropriate attribution.
            </p>
          </Section>

          <Section title="5. Judging & Scoring">
            <p>
              Projects will be evaluated by assigned judges across defined criteria. The average of all
              evaluator scores constitutes the final score. Scores are final once the event officially closes.
              Disputes must be raised in writing within 24 hours of results being announced.
            </p>
          </Section>

          <Section title="6. Prizes">
            <p>
              Prize details will be announced on the event day. Prizes are non-transferable. Disqualified teams
              forfeit any prizes awarded. Amity University Bengaluru reserves the right to withhold prizes if
              the event criteria have not been met to a satisfactory standard.
            </p>
          </Section>

          <Section title="7. Portal Usage">
            <p>
              The Portal is provided &ldquo;as is&rdquo; for the duration of the event. While we strive for
              high uptime, we do not guarantee uninterrupted access. Misuse of the Portal (e.g. scripted
              attacks, unauthorised data access) will result in immediate account suspension.
            </p>
          </Section>

          <Section title="8. Limitation of Liability">
            <p>
              Amity University Bengaluru and the AlgoGLORiA organising committee shall not be liable for any
              indirect, incidental, or consequential damages arising from participation in the event or use of
              the Portal.
            </p>
          </Section>

          <Section title="9. Amendments">
            <p>
              Organisers reserve the right to amend these Terms at any time. Changes will be communicated via
              the Portal. Continued participation after an amendment constitutes acceptance.
            </p>
          </Section>

          <Section title="10. Governing Law">
            <p>
              These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive
              jurisdiction of the courts of Bengaluru, Karnataka.
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
