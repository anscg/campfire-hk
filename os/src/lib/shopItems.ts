// ============================================================
// Shop & Auction items — edit this file to manage inventory
// ============================================================

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  icon: string;
}

export interface AuctionItem {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: "shop-1",
    name: "Campfire Sticker Pack",
    description: "A set of exclusive Campfire HK stickers.",
    price: 100,
    category: "Merch",
    icon: "🎁",
  },
  {
    id: "shop-2",
    name: "Extra Submission Slot",
    description: "Submit one additional project to the showcase.",
    price: 250,
    category: "Power-up",
    icon: "➕",
  },
  {
    id: "shop-3",
    name: "Snack Voucher",
    description: "Redeem for a snack at the food station.",
    price: 75,
    category: "Food",
    icon: "🍕",
  },
  {
    id: "shop-4",
    name: "Campfire Tote Bag",
    description: "Limited-edition tote bag with the Campfire HK logo.",
    price: 300,
    category: "Merch",
    icon: "👜",
  },
  {
    id: "shop-5",
    name: "Mentor Session",
    description: "15-minute 1-on-1 session with a Campfire mentor.",
    price: 500,
    category: "Power-up",
    icon: "💡",
  },
  {
    id: "shop-6",
    name: "Bubble Tea",
    description: "A cup of bubble tea from the drinks counter.",
    price: 150,
    category: "Food",
    icon: "🧋",
  },
];

export const AUCTION_ITEMS: AuctionItem[] = [
  {
    id: "auction-1",
    name: "Mystery Grand Prize",
    description: "A surprise reward — only the highest bidder finds out what it is.",
    icon: "🎁",
  },
  {
    id: "auction-2",
    name: "VIP Showcase Slot",
    description: "Prime presentation slot at the closing showcase. Maximum visibility.",
    icon: "⭐",
  },
  {
    id: "auction-3",
    name: "Campfire Hoodie",
    description: "Exclusive hoodie, limited run. One goes to the top bidder.",
    icon: "👕",
  },
];
