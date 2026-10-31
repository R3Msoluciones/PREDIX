CREATE TABLE `predicciones_ml` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cve_muni` varchar(5) NOT NULL,
	`municipio` varchar(128) NOT NULL,
	`tipo_delito` varchar(32) NOT NULL,
	`modelo_ganador` varchar(32) NOT NULL,
	`mape_backtest` int,
	`rmse_backtest` int,
	`horizonte` int NOT NULL,
	`mes_prediccion` int NOT NULL,
	`anio_prediccion` int NOT NULL,
	`valor_predicho` int NOT NULL,
	`confianza` int NOT NULL,
	`intervalo_min` int NOT NULL,
	`intervalo_max` int NOT NULL,
	`calculado_en` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `predicciones_ml_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_pred_ml_muni_tipo_horizonte` ON `predicciones_ml` (`municipio`,`tipo_delito`,`horizonte`);--> statement-breakpoint
CREATE INDEX `idx_pred_ml_cve_muni` ON `predicciones_ml` (`cve_muni`);