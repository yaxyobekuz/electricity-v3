import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Elektr energiyasi analitik platformasi",
    template: "%s | Elektr energiyasi analitik platformasi",
  },
  description:
    "Elektr tarmog'i bo'yicha iste'mol, yo'qotish va hisoblagich ko'rsatkichlarini tahlil qilish tizimi.",
};

export const viewport: Viewport = { themeColor: "#f3f3f3" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uz" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
