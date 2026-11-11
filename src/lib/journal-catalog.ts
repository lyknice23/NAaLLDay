export type Milestone = {
  days: number;
  title: string;
  partnerId: string | null;
};

export type Partner = {
  id: string;
  name: string;
  ad: string;
  offer: string;
  days: number;
};

export const MILESTONES: Milestone[] = [
  { days: 1, title: "Just for today", partnerId: null },
  { days: 7, title: "One week", partnerId: "harbor-roast" },
  { days: 30, title: "30 days", partnerId: "corner-market" },
  { days: 90, title: "90 days", partnerId: "northside" },
  { days: 180, title: "6 months", partnerId: "table-for-one" },
  { days: 365, title: "One year", partnerId: "quiet-street" },
  { days: 730, title: "Two years", partnerId: "lantern-transit" },
];

export const PARTNERS: Partner[] = [
  {
    id: "harbor-roast",
    name: "Harbor Roast",
    ad: "A quiet morning coffee, any day you need a seat.",
    offer: "One free coffee.",
    days: 7,
  },
  {
    id: "corner-market",
    name: "Corner Market",
    ad: "Groceries close to home, without the rush.",
    offer: "$10 off a grocery trip.",
    days: 30,
  },
  {
    id: "northside",
    name: "Northside Fitness",
    ad: "A neighborhood gym with early hours.",
    offer: "One free week of classes.",
    days: 90,
  },
  {
    id: "table-for-one",
    name: "Table for One",
    ad: "Simple meals delivered when cooking feels like too much.",
    offer: "A free meal credit.",
    days: 180,
  },
  {
    id: "quiet-street",
    name: "Quiet Street Books",
    ad: "Used books, and a chair if you want to stay.",
    offer: "A free book of your choice.",
    days: 365,
  },
  {
    id: "lantern-transit",
    name: "Lantern Transit",
    ad: "Day passes for getting to a meeting.",
    offer: "A week of day passes.",
    days: 730,
  },
];

export function milestoneTitle(days: number) {
  return MILESTONES.find((item) => item.days === days)?.title ?? `${days} days`;
}

export function dealCode(partnerId: string, days: number) {
  const word = partnerId.split("-")[0]?.toUpperCase() ?? "DEAL";
  return `${word}-${days}`;
}
