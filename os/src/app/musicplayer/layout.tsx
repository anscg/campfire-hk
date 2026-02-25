import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Campfire Music Player",
};

export default function MusicPlayerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
