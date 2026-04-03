import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  accountId: text("account_id").unique().notNull(),
  chainId: text("chain_id").notNull(),
  address: text("address").notNull(),
  name: text("name").notNull(),
  bio: text("bio"),
  registeredAt: text("registered_at").notNull(),
  totalSignals: integer("total_signals").default(0).notNull(),
  signalsIncluded: integer("signals_included").default(0).notNull(),
  totalEarnedCents: integer("total_earned_cents").default(0).notNull(),
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
});

export const signals = sqliteTable("signals", {
  id: text("id").primaryKey(),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id),
  headline: text("headline").notNull(),
  body: text("body").notNull(),
  sources: text("sources").notNull(), // JSON array
  tags: text("tags").notNull(), // JSON array
  beat: text("beat").notNull(),
  status: text("status").default("submitted").notNull(),
  score: real("score"),
  editorFeedback: text("editor_feedback"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const editions = sqliteTable("editions", {
  id: text("id").primaryKey(),
  number: integer("number").unique().notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  contentHtml: text("content_html").notNull(),
  contentText: text("content_text").notNull(),
  signalCount: integer("signal_count").notNull(),
  priceCents: integer("price_cents").default(5).notNull(),
  costCents: integer("cost_cents").default(0).notNull(),
  revenueCents: integer("revenue_cents").default(0).notNull(),
  publishedAt: text("published_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const editionSignals = sqliteTable(
  "edition_signals",
  {
    editionId: text("edition_id")
      .notNull()
      .references(() => editions.id),
    signalId: text("signal_id")
      .notNull()
      .references(() => signals.id),
    position: integer("position").notNull(),
    payoutCents: integer("payout_cents").default(0).notNull(),
  },
  (table) => [primaryKey({ columns: [table.editionId, table.signalId] })]
);

export const subscribers = sqliteTable("subscribers", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  accountId: text("account_id"),
  subscribedAt: text("subscribed_at").notNull(),
  active: integer("active").default(1).notNull(),
});

export const ledger = sqliteTable("ledger", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // revenue | expense | payout
  amountCents: integer("amount_cents").notNull(),
  description: text("description").notNull(),
  fromAddress: text("from_address"),
  toAddress: text("to_address"),
  txHash: text("tx_hash"),
  editionId: text("edition_id").references(() => editions.id),
  createdAt: text("created_at").notNull(),
});
