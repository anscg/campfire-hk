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
  /** Optional stock limit. null = unlimited. */
  stock: number | null;
  /** Tag shown alongside price (e.g. "Ship", "TBC"). null = none. */
  tag: string | null;
}

export interface AuctionItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** URL of item image for auction display. null = show icon only. */
  imageUrl: string | null;
}

export const SHOP_ITEMS: ShopItem[] = [
  // ── Merch ────────────────────────────────────────────────────────────────────
  {
    id: "shop-sticker",
    name: "1x Sticker",
    description: "One exclusive Campfire HK sticker.",
    price: 100,
    category: "Merch",
    icon: "🎁",
    stock: null,
    tag: "Ship",
  },
  {
    id: "shop-keychain",
    name: "Keychain",
    description: "Limited-run Campfire keychain.",
    price: 500,
    category: "Merch",
    icon: "🔑",
    stock: null,
    tag: "Ship",
  },
  {
    id: "shop-sticker-bundle",
    name: "Sticker Bundle",
    description: "Full set of Campfire HK stickers.",
    price: 500,
    category: "Merch",
    icon: "📦",
    stock: null,
    tag: "Ship",
  },

  // ── Physical items ───────────────────────────────────────────────────────────
  {
    id: "shop-rubber-duck",
    name: "Rubber Duck",
    description: "A classic rubber duck for debugging sessions.",
    price: 150,
    category: "Merch",
    icon: "🦆",
    stock: null,
    tag: null,
  },
  {
    id: "shop-banana",
    name: "Banana",
    description: "A real banana. Potassium included.",
    price: 400,
    category: "Food",
    icon: "🍌",
    stock: null,
    tag: null,
  },

  // ── Food ─────────────────────────────────────────────────────────────────────
  {
    id: "shop-sweet-potato",
    name: "Sweet Potato Stick from Muji",
    description: "Muji's iconic sweet potato sticks.",
    price: 0,
    category: "Food",
    icon: "🍠",
    stock: null,
    tag: "TBC",
  },
  {
    id: "shop-potato-stick-muji",
    name: "Potato Stick from Muji",
    description: "Muji's classic potato stick snack.",
    price: 600,
    category: "Food",
    icon: "🥔",
    stock: null,
    tag: null,
  },
  {
    id: "shop-cake",
    name: "Cake",
    description: "A slice of cake. You've earned it.",
    price: 700,
    category: "Food",
    icon: "🍰",
    stock: null,
    tag: null,
  },
  {
    id: "shop-donut",
    name: "Donut",
    description: "A Mister Donut donut.",
    price: 660,
    category: "Food",
    icon: "🍩",
    stock: null,
    tag: null,
  },
  {
    id: "shop-boba",
    name: "Boba",
    description: "Bubble tea, the true hacker fuel.",
    price: 750,
    category: "Food",
    icon: "🧋",
    stock: null,
    tag: null,
  },

  // ── Experiences ──────────────────────────────────────────────────────────────
  {
    id: "shop-handshake",
    name: "Handshake with Anson Chung",
    description: "A rare, coveted handshake. Only 1 available.",
    price: 1700,
    category: "Experience",
    icon: "🤝",
    stock: 1,
    tag: null,
  },

  // ── Plushies ─────────────────────────────────────────────────────────────────
  {
    id: "shop-small-otter",
    name: "Small Otter",
    description: "A small otter plushie.",
    price: 1870,
    category: "Prize",
    icon: "🦦",
    stock: 1,
    tag: null,
  },
  {
    id: "shop-small-blahaj",
    name: "Small Blahaj",
    description: "The beloved IKEA shark, small size.",
    price: 2000,
    category: "Prize",
    icon: "🦈",
    stock: 2,
    tag: null,
  },
  {
    id: "shop-ikea-bee",
    name: "IKEA Bee Plush",
    description: "The IKEA Blavingad bee plushie.",
    price: 2200,
    category: "Prize",
    icon: "🐝",
    stock: 2,
    tag: null,
  },
  {
    id: "shop-ikea-polar-bear",
    name: "IKEA Polar Bear Plush",
    description: "The IKEA Blavingad polar bear plushie.",
    price: 2500,
    category: "Prize",
    icon: "🐻‍❄️",
    stock: 2,
    tag: null,
  },
  {
    id: "shop-large-otter",
    name: "Large Otter",
    description: "A large otter plushie.",
    price: 2900,
    category: "Prize",
    icon: "🦦",
    stock: 1,
    tag: null,
  },
  {
    id: "shop-power-bank",
    name: "Power Bank",
    description: "A portable power bank.",
    price: 2900,
    category: "Prize",
    icon: "🔋",
    stock: null,
    tag: "?",
  },
  {
    id: "shop-large-blahaj",
    name: "Large Blahaj",
    description: "The beloved IKEA shark, large size.",
    price: 3400,
    category: "Prize",
    icon: "🦈",
    stock: 2,
    tag: null,
  },
  {
    id: "shop-large-octopus",
    name: "Large Octopus",
    description: "A large octopus plushie.",
    price: 3600,
    category: "Prize",
    icon: "🐙",
    stock: 1,
    tag: null,
  },

  // ── Perks ─────────────────────────────────────────────────────────────────────
  {
    id: "shop-jane-street",
    name: "Jane Street Swag",
    description: "Exclusive merch from Jane Street. One per person.",
    price: 600,
    category: "Perks",
    icon: "💼",
    stock: 1,
    tag: null,
  },
  {
    id: "shop-xyz-domain",
    name: "Free .xyz Domain",
    description: "One free .xyz domain name. One per person.",
    price: 1500,
    category: "Perks",
    icon: "🌐",
    stock: 1,
    tag: null,
  },
];

export const AUCTION_ITEMS: AuctionItem[] = [
  {
    id: "auction-steam",
    name: "Steam Gift Card",
    description: "A Steam gift card — bid to win.",
    icon: "🎮",
    imageUrl: null,
  },
  {
    id: "auction-kepler-scarf",
    name: "Kepler Interactive Scarf",
    description: "Exclusive scarf from Kepler Interactive.",
    icon: "🧣",
    imageUrl: null,
  },
  {
    id: "auction-exp33-cards",
    name: "Expedition 33 Character Cards",
    description: "2 sets of Expedition 33 character cards.",
    icon: "🃏",
    imageUrl: null,
  },
  {
    id: "auction-exp33-journal",
    name: "Expedition 33 Journal",
    description: "2 Expedition 33 journals.",
    icon: "📔",
    imageUrl: null,
  },
  {
    id: "auction-exp33-disc",
    name: "Expedition 33 Special Disc Case",
    description: "2 special disc cases from Expedition 33.",
    icon: "💿",
    imageUrl: null,
  },
  {
    id: "auction-exp33-ps5",
    name: "Expedition 33 PS5 Game",
    description: "1 copy of Expedition 33 on PS5.",
    icon: "🎮",
    imageUrl: null,
  },
  {
    id: "auction-sifu-ps5",
    name: "Sifu PS5 Game",
    description: "1 copy of Sifu on PS5.",
    icon: "🥋",
    imageUrl: null,
  },
  {
    id: "auction-exp33-tote",
    name: "Expedition 33 Esquie Tote Bag",
    description: "Exclusive Esquie tote bag from Expedition 33.",
    icon: "👜",
    imageUrl: null,
  },
];
