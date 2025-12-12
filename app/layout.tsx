import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({ 
  weight: ['400', '500', '600', '700', '800'],
  subsets: ["latin"],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "🌍 Worldle - Guess the Country!",
  description: "Test your geography skills! Guess countries and get hot or cold feedback based on distance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${poppins.className} antialiased`}>{children}</body>
    </html>
  );
}
