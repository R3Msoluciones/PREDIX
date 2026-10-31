CREATE TABLE `secret_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`secret_id` int NOT NULL,
	`integration_id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`action` enum('CREATE','READ','UPDATE','DELETE','ROTATE','EXPORT') NOT NULL,
	`status` enum('SUCCESS','FAILED','DENIED') NOT NULL,
	`reason` varchar(255),
	`ip_address` varchar(45),
	`user_agent` text,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `secret_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `secret_rotation_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`secret_id` int NOT NULL,
	`integration_id` varchar(64) NOT NULL,
	`rotation_type` enum('AUTOMATIC','MANUAL','EMERGENCY') NOT NULL,
	`old_value_hash` varchar(255) NOT NULL,
	`new_value_hash` varchar(255) NOT NULL,
	`rotated_by` int,
	`reason` text,
	`status` enum('PENDING','IN_PROGRESS','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',
	`error_message` text,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `secret_rotation_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `secret_vault` (
	`id` int AUTO_INCREMENT NOT NULL,
	`integration_id` varchar(64) NOT NULL,
	`secret_name` varchar(255) NOT NULL,
	`secret_type` enum('API_KEY','OAUTH_TOKEN','BASIC_AUTH','CERTIFICATE','CUSTOM') NOT NULL,
	`encrypted_value` text NOT NULL,
	`encryption_algorithm` varchar(50) NOT NULL DEFAULT 'AES-256-GCM',
	`encryption_iv` varchar(255) NOT NULL,
	`encryption_auth_tag` varchar(255) NOT NULL,
	`expires_at` timestamp,
	`rotation_interval` int,
	`last_rotated_at` timestamp,
	`next_rotation_at` timestamp,
	`is_active` int NOT NULL DEFAULT 1,
	`created_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `secret_vault_id` PRIMARY KEY(`id`)
);
