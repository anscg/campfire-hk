"use client";

import { useState } from "react";

// ============================================================
// Lunch data
// ============================================================

type AllergyTag = "V" | "B" | "S" | "D";

interface MenuItem {
  name: string;
  qty: number;
  tags: AllergyTag[];
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface DayMenu {
  day: string;
  date: string;
  provider: string;
  sections: MenuSection[];
}

const ALLERGY_META: Record<AllergyTag, { label: string; labelZh: string; color: string; bg: string }> = {
  V: { label: "Vegetarian",     labelZh: "素食",     color: "rgb(74, 222, 128)",  bg: "rgba(74, 222, 128, 0.12)" },
  B: { label: "Contains Beef",  labelZh: "含有牛肉", color: "rgb(251, 146, 60)",  bg: "rgba(251, 146, 60, 0.12)" },
  S: { label: "Contains Seafood", labelZh: "含有海鮮", color: "rgb(56, 189, 248)", bg: "rgba(56, 189, 248, 0.12)" },
  D: { label: "Contains Dairy", labelZh: "含有奶製品", color: "rgb(250, 204, 21)", bg: "rgba(250, 204, 21, 0.12)" },
};

const MENUS: DayMenu[] = [
  {
    day: "Day 1",
    date: "Sat 28 Feb",
    provider: "PHD",
    sections: [
      {
        title: "Pizzas",
        items: [
          { name: "Seafood Deluxe",      qty: 3, tags: ["S", "D"] },
          { name: "PHD Deluxe",          qty: 3, tags: ["D"] },
          { name: "Meaty One",           qty: 3, tags: ["D"] },
          { name: "Crazy Pepperoni",     qty: 3, tags: ["D"] },
          { name: "Margherita",          qty: 2, tags: ["V", "D"] },
          { name: "Mushroom & Chicken",  qty: 2, tags: ["D"] },
          { name: "The Pineapple-SSS",   qty: 2, tags: ["V", "D"] },
          { name: "Hawaiian Island",     qty: 1, tags: ["D"] },
          { name: "Tropical Summer",     qty: 1, tags: ["V", "D"] },
        ],
      },
      {
        title: "Mains & Pasta",
        items: [
          { name: "Spaghetti Bolognese (Beef)", qty: 2, tags: ["B"] },
          { name: "Portuguese Chicken Rice",    qty: 2, tags: [] },
          { name: "Seafood Doria Rice",         qty: 1, tags: ["S", "D"] },
          { name: "Chicken Doria Rice",         qty: 1, tags: ["D"] },
          { name: "Chicken Green Salad",        qty: 1, tags: [] },
        ],
      },
      {
        title: "Snacks & Dessert",
        items: [
          { name: "Mini Chocolate Donut",          qty: 1, tags: ["V"] },
          { name: "Japanese Style Octopus Ball (8 pcs)", qty: 1, tags: ["S"] },
        ],
      },
    ],
  },
  {
    day: "Day 2",
    date: "Sun 1 Mar",
    provider: "Café De Corel",
    sections: [
      {
        title: "Mains",
        items: [
          { name: "Baked Seafood Rice with Cheese & Truffle",       qty: 2, tags: ["S", "D"] },
          { name: "Baked Pork Chop Rice with Cheese & Tomato",      qty: 2, tags: ["D"] },
          { name: "Honey Glazed BBQ Pork Spare Ribs",               qty: 1, tags: [] },
          { name: "Curry Beef Brisket with Steamed Rice",           qty: 1, tags: ["B"] },
          { name: "Baked Vegetarian Pork Chop Rice",                qty: 1, tags: ["V", "D"] },
          { name: "Baked Spaghetti Bolognese (Beef) with Cheese",   qty: 1, tags: ["B", "D"] },
          { name: "XO Sauce Stir-fried Udon with Beef",             qty: 1, tags: ["B", "S"] },
          { name: "Baked Spaghetti with Chicken Breast in Cheese Sauce", qty: 1, tags: ["D"] },
        ],
      },
      {
        title: "Appetizers & Desserts",
        items: [
          { name: "Fried Seafood Platter (46 pcs) — Shrimp, Fish, Squid", qty: 1, tags: ["S"] },
          { name: "Fresh Mixed Fruit & Potato Salad",                      qty: 1, tags: ["V"] },
          { name: "Coconut Jelly Candy",                                   qty: 1, tags: ["V"] },
        ],
      },
    ],
  },
];

// ============================================================
// Tab switcher — matches ScheduleWindow style exactly
// ============================================================

function TabSwitcher({ active, onChange }: { active: 0 | 1; onChange: (i: 0 | 1) => void }) {
  return (
    <div
      className="flex mx-4 mb-3"
      style={{ background: "rgb(30, 30, 32)", border: "1px solid rgb(55, 55, 58)" }}
    >
      {MENUS.map((m, i) => (
        <button
          key={i}
          onClick={() => onChange(i as 0 | 1)}
          className="flex-1 py-1.5 text-xs font-bold tracking-wider transition-colors"
          style={{
            background: active === i ? "rgb(80, 80, 85)" : "transparent",
            color: active === i ? "rgb(255, 255, 255)" : "rgb(113, 113, 122)",
            borderRight: i === 0 ? "1px solid rgb(55, 55, 58)" : "none",
            cursor: "pointer",
          }}
        >
          {m.day}
        </button>
      ))}
    </div>
  );
}

// ============================================================
// Allergy badge
// ============================================================

function AllergyBadge({ tag }: { tag: AllergyTag }) {
  const meta = ALLERGY_META[tag];
  return (
    <span
      className="text-[9px] font-bold tracking-wider px-1 py-px flex-shrink-0"
      style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.color}40` }}
    >
      {tag}
    </span>
  );
}

// ============================================================
// Lunch Window
// ============================================================

export default function LunchWindow() {
  const [activeDay, setActiveDay] = useState<0 | 1>(0);
  const menu = MENUS[activeDay];

  return (
    <div className="h-full bg-zinc-900 font-mono flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 pt-3 pb-0 flex-shrink-0">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xs text-zinc-500 font-bold tracking-widest">LUNCH</h2>
          <span className="text-xs text-zinc-600">{menu.date}</span>
        </div>
        <TabSwitcher active={activeDay} onChange={setActiveDay} />
      </div>

      {/* Menu list */}
      <div className="flex-1 overflow-auto">
        {menu.sections.map((section) => (
          <div key={section.title}>
            {/* Section header */}
            <div
              className="flex items-center px-4 border-b"
              style={{ height: "26px", borderColor: "rgb(39, 39, 42)", background: "rgb(28, 28, 30)" }}
            >
              <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                {section.title}
              </span>
            </div>

            {/* Items */}
            {section.items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-4 border-b"
                style={{
                  minHeight: "34px",
                  paddingTop: "6px",
                  paddingBottom: "6px",
                  borderColor: "rgb(39, 39, 42)",
                }}
              >
                {/* Qty */}
                <span
                  className="text-xs flex-shrink-0 w-5 tabular-nums text-right"
                  style={{ color: "rgb(82, 82, 91)" }}
                >
                  ×{item.qty}
                </span>

                {/* Dot */}
                <span
                  className="w-1.5 h-1.5 flex-shrink-0 rounded-full"
                  style={{
                    background: item.tags.length === 0
                      ? "rgb(82, 82, 91)"
                      : ALLERGY_META[item.tags[0]].color,
                  }}
                />

                {/* Name */}
                <span className="text-xs flex-1 text-zinc-300 leading-snug">
                  {item.name}
                </span>

                {/* Allergy badges */}
                {item.tags.length > 0 && (
                  <div className="flex gap-1 flex-shrink-0">
                    {item.tags.map((tag) => (
                      <AllergyBadge key={tag} tag={tag} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="border-t border-zinc-800 px-4 py-2 flex gap-3 flex-wrap flex-shrink-0">
        {(Object.entries(ALLERGY_META) as [AllergyTag, typeof ALLERGY_META[AllergyTag]][]).map(
          ([tag, meta]) => (
            <span key={tag} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
              <span className="text-[10px]" style={{ color: "rgb(82, 82, 91)" }}>
                {tag} · {meta.label}
              </span>
            </span>
          )
        )}
      </div>
    </div>
  );
}
