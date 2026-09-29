CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `designation` text NOT NULL,
  `role` text NOT NULL,
  `pin_hash` text NOT NULL,
  `active` integer DEFAULT true NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `users_active_name` ON `users` (`active`,`name`);
