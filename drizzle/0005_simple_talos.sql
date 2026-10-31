CREATE TABLE `incidencia_delito` (
	`id` int AUTO_INCREMENT NOT NULL,
	`anio` int NOT NULL,
	`mes` int NOT NULL,
	`cve_ent` varchar(2) NOT NULL,
	`entidad` varchar(64) NOT NULL,
	`cve_muni` varchar(5) NOT NULL,
	`municipio` varchar(128) NOT NULL,
	`bien_juridico` varchar(128) NOT NULL,
	`tipo` varchar(128) NOT NULL,
	`subtipo` varchar(160) NOT NULL,
	`modalidad` varchar(255) NOT NULL,
	`fuero` varchar(20) NOT NULL DEFAULT 'comun',
	`cantidad` int NOT NULL DEFAULT 0,
	CONSTRAINT `incidencia_delito_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incidencia_victima` (
	`id` int AUTO_INCREMENT NOT NULL,
	`anio` int NOT NULL,
	`mes` int NOT NULL,
	`cve_ent` varchar(2) NOT NULL,
	`entidad` varchar(64) NOT NULL,
	`cve_muni` varchar(5) NOT NULL,
	`municipio` varchar(128) NOT NULL,
	`bien_juridico` varchar(128) NOT NULL,
	`tipo` varchar(128) NOT NULL,
	`subtipo` varchar(160) NOT NULL,
	`modalidad` varchar(255) NOT NULL,
	`sexo` varchar(32) NOT NULL,
	`rango_edad` varchar(32) NOT NULL,
	`fuero` varchar(20) NOT NULL DEFAULT 'comun',
	`cantidad` int NOT NULL DEFAULT 0,
	CONSTRAINT `incidencia_victima_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_del_muni_anio_mes` ON `incidencia_delito` (`cve_muni`,`anio`,`mes`);--> statement-breakpoint
CREATE INDEX `idx_del_tipo` ON `incidencia_delito` (`tipo`);--> statement-breakpoint
CREATE INDEX `idx_del_anio_mes` ON `incidencia_delito` (`anio`,`mes`);--> statement-breakpoint
CREATE INDEX `idx_vic_muni_anio_mes` ON `incidencia_victima` (`cve_muni`,`anio`,`mes`);--> statement-breakpoint
CREATE INDEX `idx_vic_tipo` ON `incidencia_victima` (`tipo`);