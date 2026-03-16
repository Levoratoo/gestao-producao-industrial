import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ProductionSimulationProvider } from "@/hooks/use-production-simulation";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Rosa Maria Industrial",
  description:
    "MVP demonstrativo para monitoramento e gestão da produção industrial têxtil da Rosa Maria.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} antialiased`}
      >
        <Script src="/runtime-config.js" strategy="beforeInteractive" />
        <ProductionSimulationProvider>{children}</ProductionSimulationProvider>
      </body>
    </html>
  );
}
