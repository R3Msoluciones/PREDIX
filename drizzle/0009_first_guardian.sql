CREATE TABLE `incidentes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`folio` varchar(20) NOT NULL,
	`tipo` varchar(255) NOT NULL,
	`municipio` varchar(128) NOT NULL,
	`colonia` varchar(150),
	`narrativa` text NOT NULL,
	`estado` enum('en_proceso','cerrado','investigacion') NOT NULL DEFAULT 'en_proceso',
	`prioridad` enum('baja','media','alta','critica') NOT NULL DEFAULT 'media',
	`lat` varchar(20),
	`lng` varchar(20),
	`personal` varchar(255),
	`atendido` int NOT NULL DEFAULT 0,
	`created_by` varchar(128),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `incidentes_id` PRIMARY KEY(`id`),
	CONSTRAINT `incidentes_folio_unique` UNIQUE(`folio`)
);
--> statement-breakpoint
CREATE INDEX `idx_incidente_folio` ON `incidentes` (`folio`);--> statement-breakpoint
CREATE INDEX `idx_incidente_estado` ON `incidentes` (`estado`);--> statement-breakpoint
CREATE INDEX `idx_incidente_muni` ON `incidentes` (`municipio`);--> statement-breakpoint
CREATE INDEX `idx_incidente_created` ON `incidentes` (`created_at`);