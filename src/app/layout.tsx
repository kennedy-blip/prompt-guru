import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { SettingsProvider } from "@/context/settings-provider";
import { WorkspaceProvider } from "@/context/workspace-provider";

export const metadata: Metadata = {
  title: "PromptGuru — AI Tech Research & Multimodal Workspace",
  description:
    "Multimodal AI research, software engineering and education workspace. Analyze codebases, parse documents, render diagrams, solve math from camera, and work hands-free with voice.",
  applicationName: "PromptGuru",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "PromptGuru — AI Tech Research & Multimodal Workspace",
    description:
      "Research, scaffold, diagram, solve and reason across text, files, code, images and voice — powered by your own TransJules endpoint.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "PromptGuru" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PromptGuru",
    description: "AI tech research & multimodal workspace",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#090A0F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-obsidian font-sans text-slate-100 antialiased">
        <SettingsProvider>
          <WorkspaceProvider>
            <AppShell>{children}</AppShell>
          </WorkspaceProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
