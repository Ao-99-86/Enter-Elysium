import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Entering Elysium Chess",
  description: "An ambient online chess game set on a reflective interstellar sea."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090c10"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
