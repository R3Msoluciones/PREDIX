CREATE TABLE `incident_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incident_id` varchar(64) NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`file_type` varchar(50) NOT NULL,
	`file_size` int NOT NULL,
	`s3_key` varchar(512) NOT NULL,
	`s3_url` text NOT NULL,
	`uploaded_by` varchar(128),
	`uploaded_at` timestamp NOT NULL DEFAULT (now()),
	`description` text,
	`mime_type` varchar(100),
	CONSTRAINT `incident_attachments_id` PRIMARY KEY(`id`)
);
