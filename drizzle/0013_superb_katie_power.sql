CREATE TABLE `poblacion_municipal` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cve_muni` varchar(5) NOT NULL,
	`municipio` varchar(128) NOT NULL,
	`poblacion` int NOT NULL,
	`anio_censo` int NOT NULL,
	`actualizado_en` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `poblacion_municipal_id` PRIMARY KEY(`id`),
	CONSTRAINT `poblacion_municipal_cve_muni_unique` UNIQUE(`cve_muni`)
);
