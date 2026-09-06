import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const importRecords = sqliteTable("import_records", {
  id: text("id").primaryKey(),
  sourceType: text("source_type").notNull(),
  name: text("name").notNull(),
  objectKey: text("object_key"),
  sourceUrl: text("source_url"),
  fetchedAt: text("fetched_at").notNull(),
  frequency: text("frequency").notNull().default("仅一次"),
  status: text("status").notNull(),
  aiDigest: text("ai_digest"),
  nextRunAt: text("next_run_at"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_import_records_created_at").on(table.createdAt),
  index("idx_import_records_next_run_at").on(table.nextRunAt),
]);
