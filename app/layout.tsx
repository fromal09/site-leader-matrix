import type { Metadata } from "next";
import { Oswald, IBM_Plex_Sans, IBM_Plex_Mono, Caveat } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { LoginModal } from "@/components/LoginModal";
import { Gate } from "@/components/Gate";
import { Header } from "@/components/Header";
import { GlobalStickyLayer } from "@/components/GlobalStickyLayer";
import { NotebookSpiral } from "@/components/NotebookSpiral";

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Sports Directors Reference Guide",
  description: "Internal tools for evaluating and developing site leadership.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${oswald.variable} ${plexSans.variable} ${plexMono.variable} ${caveat.variable} h-full`}
    >
      <body className="min-h-full pl-8">
        <NotebookSpiral />
        <AuthProvider>
          <Gate>
            <GlobalStickyLayer>
              <Header />
              {children}
            </GlobalStickyLayer>
          </Gate>
          <LoginModal />
        </AuthProvider>
      </body>
    </html>
  );
}
