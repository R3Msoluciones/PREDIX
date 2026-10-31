"""build_riesgo_clasificacion.py — Entrypoint del clasificador de riesgo.

Uso:
    cd scripts/predict && python build_riesgo_clasificacion.py

Entrena un torneo de 3 modelos (Logistic Regression, Random Forest,
Gradient Boosting) sobre el panel completo (125 municipios x histórico
mensual), evalúa cada uno con un holdout TEMPORAL (últimos 12 meses,
nunca aleatorio) y escribe:

  - riesgo_clasificacion: 1 fila por municipio con la clase de riesgo
    predicha para el PRÓXIMO mes (modelo ganador, reentrenado sobre todo
    el panel una vez terminada la evaluación).
  - riesgo_clasificacion_metrics: 1 fila por candidato del torneo
    (Accuracy, Precision, Recall, F1, ROC-AUC) — misma transparencia que
    el desglose por tipo de delito del pipeline de regresión.

Idempotente: TRUNCATE + INSERT, se puede re-correr después de cargar
datos SESNSP nuevos (mismo patrón que build_predictions.py).
"""

import pandas as pd

from classify import FEATURE_COLS, build_panel_features, predict_next_month, run_tournament
from db import (
    get_engine,
    load_incidencia_total_mensual,
    write_riesgo_clasificacion,
    write_riesgo_clasificacion_metrics,
)


def main() -> None:
    engine = get_engine()
    print("[classify] Leyendo histórico total mensual de incidencia_delito...")
    long_df = load_incidencia_total_mensual(engine)
    if long_df.empty:
        raise SystemExit("[classify] incidencia_delito está vacía — corre scripts/load-sesnsp.ts primero")

    print("[classify] Construyendo panel de features (lag1-3, roll3, mes-ciclo)...")
    panel = build_panel_features(long_df)

    print(f"[classify] {len(panel)} filas municipio-mes en el panel")

    print("[classify] Corriendo torneo de 3 modelos (holdout temporal, últimos 12 meses)...")
    results, winner = run_tournament(panel)
    for r in results:
        marca = " <- GANADOR" if r["modelo"] == winner["modelo"] else ""
        roc = f"{r['roc_auc_macro']:.3f}" if r["roc_auc_macro"] is not None else "n/a"
        print(
            f"  {r['modelo']}: accuracy={r['accuracy']:.3f} f1_macro={r['f1_macro']:.3f} "
            f"precision_macro={r['precision_macro']:.3f} recall_macro={r['recall_macro']:.3f} "
            f"roc_auc_macro={roc}{marca}"
        )

    metrics_df = pd.DataFrame([{
        "modelo": r["modelo"],
        "es_ganador": 1 if r["modelo"] == winner["modelo"] else 0,
        "accuracy": int(round(r["accuracy"] * 100)),
        "precision_macro": int(round(r["precision_macro"] * 100)),
        "recall_macro": int(round(r["recall_macro"] * 100)),
        "f1_macro": int(round(r["f1_macro"] * 100)),
        "roc_auc_macro": int(round(r["roc_auc_macro"] * 100)) if r["roc_auc_macro"] is not None else None,
        "n_test": r["n_test"],
    } for r in results])
    write_riesgo_clasificacion_metrics(engine, metrics_df)

    print(f"[classify] Ganador: {winner['modelo']} (F1 macro {winner['f1_macro']:.3f}) — reentrenando sobre todo el panel...")
    # El holdout ya cumplió su propósito de evaluación honesta; para la
    # predicción real del próximo mes, reentrena el ganador con TODOS los
    # datos disponibles (más historia = mejor estimación del último punto).
    final_pipe = winner["pipeline"]
    X_all, y_all = panel[FEATURE_COLS], panel["clase"]
    final_pipe.fit(X_all, y_all)

    pred_df = predict_next_month(panel, final_pipe)
    pred_df["modelo_ganador"] = winner["modelo"]
    write_riesgo_clasificacion(engine, pred_df)
    print(f"[classify] {len(pred_df)} municipios clasificados, escrito en riesgo_clasificacion")


if __name__ == "__main__":
    main()
