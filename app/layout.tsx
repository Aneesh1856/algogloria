import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "AlgoGLORiA Management Portal",
  description: "Internal College Hackathon Qualifiers",
  icons: {
    icon: "/favicon.ico",
  },
};

import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${montserrat.variable} font-montserrat antialiased bg-[#e0e0e0] text-[#333333] min-h-screen`}>
        <AuthProvider>
          <Navbar />
          <main>
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}


