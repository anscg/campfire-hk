import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Campfire Auction Display",
};

export default function AuctionDisplayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
