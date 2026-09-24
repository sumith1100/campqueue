CREATE TABLE `camps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`venue` text DEFAULT '' NOT NULL,
	`notify_ahead` integer DEFAULT 3 NOT NULL,
	`grace_minutes` integer DEFAULT 5 NOT NULL,
	`opens_at` text DEFAULT '09:00' NOT NULL,
	`closes_at` text DEFAULT '17:00' NOT NULL,
	`slot_minutes` integer DEFAULT 30 NOT NULL,
	`slot_capacity` integer DEFAULT 10 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `camps_slug_unique` ON `camps` (`slug`);--> statement-breakpoint
CREATE TABLE `entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_id` integer NOT NULL,
	`station_id` integer NOT NULL,
	`camp_id` integer NOT NULL,
	`status` text NOT NULL,
	`priority_rank` integer DEFAULT 2 NOT NULL,
	`queued_at` integer NOT NULL,
	`called_at` integer,
	`started_at` integer,
	`ended_at` integer,
	`counter` integer,
	`notified_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`token_id`) REFERENCES `tokens`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`station_id`) REFERENCES `stations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entries_station_status` ON `entries` (`station_id`,`status`);--> statement-breakpoint
CREATE INDEX `entries_token` ON `entries` (`token_id`);--> statement-breakpoint
CREATE INDEX `entries_camp` ON `entries` (`camp_id`);--> statement-breakpoint
CREATE TABLE `stations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`camp_id` integer NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`color` text DEFAULT '#0a6f72' NOT NULL,
	`counters` integer DEFAULT 1 NOT NULL,
	`default_service_seconds` integer DEFAULT 300 NOT NULL,
	`next_station_id` integer,
	`accepts_registration` integer DEFAULT true NOT NULL,
	`is_paused` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`camp_id`) REFERENCES `camps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stations_camp_code` ON `stations` (`camp_id`,`code`);--> statement-breakpoint
CREATE TABLE `tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`camp_id` integer NOT NULL,
	`public_id` text NOT NULL,
	`prefix` text NOT NULL,
	`number` integer NOT NULL,
	`label` text NOT NULL,
	`name` text NOT NULL,
	`age` integer NOT NULL,
	`phone` text,
	`language` text DEFAULT 'en' NOT NULL,
	`priority_reason` text DEFAULT 'none' NOT NULL,
	`source` text NOT NULL,
	`scheduled_for` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`camp_id`) REFERENCES `camps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tokens_public_id_unique` ON `tokens` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tokens_camp_label` ON `tokens` (`camp_id`,`label`);