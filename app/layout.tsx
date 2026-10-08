import type { Metadata, Viewport } from "next";
import "@fontsource/roboto-mono/400.css";
import "@fontsource/roboto-mono/500.css";
import "@fontsource/roboto-mono/700.css";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/sw-register";

export const metadata: Metadata = {
  title: "System",
  description: "A personal daily-accomplishment tracker.",
  manifest: "/manifest.json",
  icons: {
    // SVG first for browsers that support it; the PNG is a real fallback,
    // not just belt-and-suspenders — older Safari (the iPhone 7 this app
    // targets) has patchy SVG-favicon support and would otherwise show no
    // favicon at all.
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "System",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-mono antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
