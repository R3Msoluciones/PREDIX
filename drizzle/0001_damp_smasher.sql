CREATE TABLE `incidencia_delictiva` (
	`id` int AUTO_INCREMENT NOT NULL,
	`estado` varchar(64) NOT NULL,
	`municipio` varchar(128) NOT NULL,
	`codigo_municipio` varchar(10),
	`anio` int NOT NULL,
	`mes` int NOT NULL,
	`homicidios` int DEFAULT 0,
	`robos` int DEFAULT 0,
	`lesiones` int DEFAULT 0,
	`violencia_sexual` int DEFAULT 0,
	`trafico_de_drogas` int DEFAULT 0,
	`otros_delitos` int DEFAULT 0,
	`victimas` int DEFAULT 0,
	`fuero` varchar(20) DEFAULT 'comun',
	`last_updated` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`source_url` text,
	CONSTRAINT `incidencia_delictiva_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sesnsp_sync_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`last_sync_time` timestamp DEFAULT (now()),
	`records_processed` int DEFAULT 0,
	`status` varchar(20) DEFAULT 'pending',
	`error_message` text,
	`next_sync_time` timestamp,
	CONSTRAINT `sesnsp_sync_log_id` PRIMARY KEY(`id`)
);
