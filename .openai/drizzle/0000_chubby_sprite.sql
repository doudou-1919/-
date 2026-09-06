CREATE TABLE `import_records` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`name` text NOT NULL,
	`object_key` text,
	`source_url` text,
	`fetched_at` text NOT NULL,
	`frequency` text DEFAULT '仅一次' NOT NULL,
	`status` text NOT NULL,
	`ai_digest` text,
	`next_run_at` text,
	`created_at` integer NOT NULL
);
