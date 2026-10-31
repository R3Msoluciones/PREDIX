"""build_predictions.py — Entrypoint del pipeline offline de predicción.

Uso:
    cd scripts/predict && python build_predictions.py

Lee el histórico completo de incidencia_delito, corre backtesting sobre
6 modelos candidatos por serie (municipio x tipo de delito), elige el
ganador y escribe horizonte 1-12 meses a la tabla predicciones_ml.

Idempotente: TRUNCATE + INSERT, se puede re-correr después de cargar
datos SESNSP nuevos (mismo patrón que scripts/load-sesnsp.ts).
"""

import pandas as pd
from joblib import Parallel, delayed

from db import get_engine, load_incidencia_mensual, write_predicciones
from pipeline import backtest_series, select_winner, forecast_series, confidence_from_mape

HORIZON = 12
MIN_HISTORY = 12


def _next_calendar(anio: int, mes: int, steps: int) -> tuple[int, int]:
    total = (anio * 12 + (mes - 1)) + steps
    return total // 12, (total % 12) + 1


def _process_one_series(cve_muni: str, municipio: str, tipo: str, group: pd.DataFrame) -> list[dict]:
    """Backtest + forecast para UNA serie (municipio x tipo de delito).
    Función de nivel de módulo (no closure) para que joblib la pueda picklear
    y correrla en un proceso worker separado."""
    g = group.sort_values(["anio", "mes"])
    values = g["cantidad"].to_numpy(dtype=float)
    last_anio, last_mes = int(g["anio"].iloc[-1]), int(g["mes"].iloc[-1])

    if len(values) < MIN_HISTORY:
        winner, mape_score, rmse_score = "sma", None, None
    else:
        scores = backtest_series(values, min_history=MIN_HISTORY)
        winner = select_winner(scores)
        winner_score = scores.get(winner, {})
        mape_score = winner_score.get("mape")
        rmse_score = winner_score.get("rmse")

    point, lo, hi = forecast_series(values, winner, HORIZON, mape_score)
    confianza = confidence_from_mape(mape_score)

    rows = []
    for h in range(1, HORIZON + 1):
        anio_p, mes_p = _next_calendar(last_anio, last_mes, h)
        rows.append({
            "cve_muni": cve_muni,
            "municipio": municipio,
            "tipo_delito": tipo,
            "modelo_ganador": winner,
            "mape_backtest": int(round(mape_score)) if mape_score is not None else None,
            "rmse_backtest": int(round(rmse_score)) if rmse_score is not None else None,
            "horizonte": h,
            "mes_prediccion": mes_p,
            "anio_prediccion": anio_p,
            "valor_predicho": int(round(point[h - 1])),
            "confianza": confianza,
            "intervalo_min": int(round(lo[h - 1])),
            "intervalo_max": int(round(hi[h - 1])),
        })
    return rows


def build_all_predictions(long_df: pd.DataFrame) -> pd.DataFrame:
    groups = list(long_df.groupby(["cve_muni", "municipio", "tipo_delito"]))
    total_series = len(groups)
    print(f"[predict] {total_series} series a procesar, repartiendo en bloques entre los núcleos disponibles...")

    # batch_size="auto": joblib agrupa las series en bloques y los reparte
    # entre procesos worker (todos los núcleos, n_jobs=-1) — evita el overhead
    # de mandar una serie a la vez y aprovecha que cada serie es independiente.
    results = Parallel(n_jobs=-1, batch_size="auto", verbose=5)(
        delayed(_process_one_series)(cve_muni, municipio, tipo, group)
        for (cve_muni, municipio, tipo), group in groups
    )

    rows = [row for series_rows in results for row in series_rows]
    print(f"[predict] {total_series} series procesadas (municipio x tipo de delito)")
    return pd.DataFrame(rows)


def main() -> None:
    engine = get_engine()
    print("[predict] Leyendo histórico completo de incidencia_delito...")
    long_df = load_incidencia_mensual(engine)
    if long_df.empty:
        raise SystemExit("[predict] incidencia_delito está vacía — corre scripts/load-sesnsp.ts primero")
    print(f"[predict] {len(long_df)} filas mensuales cargadas, generando predicciones...")
    out_df = build_all_predictions(long_df)
    write_predicciones(engine, out_df)
    print(f"[predict] {len(out_df)} filas escritas en predicciones_ml")


if __name__ == "__main__":
    main()
