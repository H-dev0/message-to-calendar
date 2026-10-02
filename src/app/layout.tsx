import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Message to Calendar",
  description: "Turn one university or work message into a calendar event you can review and download.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body>{children}</body></html>;
}
