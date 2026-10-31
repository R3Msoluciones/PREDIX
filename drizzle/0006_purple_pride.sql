CREATE TABLE `alertas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nivel` enum('critical','warning','info','safe') NOT NULL DEFAULT 'info',
	`titulo` varchar(255) NOT NULL,
	`descripcion` text,
	`municipio` varchar(128) NOT NULL,
	`lat` varchar(20),
	`lng` varchar(20),
	`unidades` int NOT NULL DEFAULT 0,
	`reconocida` int NOT NULL DEFAULT 0,
	`escalada` int NOT NULL DEFAULT 0,
	`resuelta` int NOT NULL DEFAULT 0,
	`operador` varchar(128),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alertas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_alerta_nivel` ON `alertas` (`nivel`);--> statement-breakpoint
CREATE INDEX `idx_alerta_muni` ON `alertas` (`municipio`);