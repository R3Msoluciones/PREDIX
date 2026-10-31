CREATE TABLE `riesgo_clasificacion` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cve_muni` varchar(5) NOT NULL,
	`municipio` varchar(128) NOT NULL,
	`clase_predicha` varchar(16) NOT NULL,
	`proba_bajo` int NOT NULL,
	`proba_medio` int NOT NULL,
	`proba_alto` int NOT NULL,
	`proba_critico` int NOT NULL,
	`modelo_ganador` varchar(32) NOT NULL,
	`mes_prediccion` int NOT NULL,
	`anio_prediccion` int NOT NULL,
	`calculado_en` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `riesgo_clasificacion_id` PRIMARY KEY(`id`),
	CONSTRAINT `riesgo_clasificacion_municipio_unique` UNIQUE(`municipio`)
);
--> statement-breakpoint
CREATE TABLE `riesgo_clasificacion_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelo` varchar(32) NOT NULL,
	`es_ganador` int NOT NULL,
	`accuracy` int NOT NULL,
	`precision_macro` int NOT NULL,
	`recall_macro` int NOT NULL,
	`f1_macro` int NOT NULL,
	`roc_auc_macro` int,
	`n_test` int NOT NULL,
	`calculado_en` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `riesgo_clasificacion_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_riesgo_clas_cve_muni` ON `riesgo_clasificacion` (`cve_muni`);