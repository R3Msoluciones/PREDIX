"""classify.py — Clasificador global de riesgo (bajo/medio/alto/crítico).

Reemplaza los umbrales fijos que aplicaba mlPredictor.ts sobre el promedio
de la predicción de conteo: UN SOLO modelo, entrenado sobre el panel
completo (125 municipios x histórico mensual, municipio como feature),
predice la clase de riesgo del PRÓXIMO mes por municipio.

Evaluado con un holdout TEMPORAL (últimos N meses del panel, nunca
aleatorio — un split aleatorio filtraría información futura al training,
igual de importante aquí que en el walk-forward de pipeline.py). Torneo de
3 candidatos, gana el de mayor F1 macro (más honesto que Accuracy solo
cuando las clases están desbalanceadas, que es el caso: "crítico" es raro).
"""

from __future__ import annotations

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

CLASSES = ["bajo", "medio", "alto", "critico"]
TEST_MONTHS = 12
# Probado agregar "poblacion" como feature (Opción 2a,  Issue #20-2a):
# no mejoró nada (Accuracy/F1 dentro del ruido, ±0.5pp) — el one-hot de
# municipio ya capturaba esa información implícitamente. Revertido; el
# StandardScaler en _make_pipeline se quedó, es una mejora real aparte.
FEATURE_NUM = ["lag1", "lag2", "lag3", "roll3", "mes_ciclo"]
FEATURE_CAT = ["municipio"]
FEATURE_COLS = FEATURE_CAT + FEATURE_NUM


def clase_riesgo(total: float) -> str:
    """Mismos umbrales que usaba mlPredictor.ts sobre el promedio predictivo
    — la clase significa lo mismo en toda la app, solo cambia CÓMO se predice."""
    if total < 50:
        return "bajo"
    if total < 150:
        return "medio"
    if total < 300:
        return "alto"
    return "critico"


def build_panel_features(long_df: pd.DataFrame) -> pd.DataFrame:
    """De (cve_muni, municipio, anio, mes, total) construye el panel de
    entrenamiento: una fila por municipio-mes con lag1-3/roll3/mes_ciclo
    calculados SOLO sobre la historia de ese mismo municipio (groupby evita
    mezclar la cola de un municipio con el inicio de otro)."""
    df = long_df.sort_values(["cve_muni", "anio", "mes"]).reset_index(drop=True)
    df["periodo_idx"] = df["anio"] * 12 + df["mes"]

    rows = []
    for cve_muni, g in df.groupby("cve_muni"):
        g = g.sort_values("periodo_idx").reset_index(drop=True)
        values = g["total"].to_numpy(dtype=float)
        for i in range(3, len(g)):
            rows.append({
                "cve_muni": cve_muni,
                "municipio": g["municipio"].iloc[i],
                "anio": int(g["anio"].iloc[i]),
                "mes": int(g["mes"].iloc[i]),
                "periodo_idx": int(g["periodo_idx"].iloc[i]),
                "lag1": values[i - 1],
                "lag2": values[i - 2],
                "lag3": values[i - 3],
                "roll3": values[i - 3:i].mean(),
                "mes_ciclo": int(g["mes"].iloc[i]) % 12,
                "clase": clase_riesgo(values[i]),
            })
    return pd.DataFrame(rows)


def _make_pipeline(estimator) -> Pipeline:
    """Municipio (125 categorías) vía one-hot, features numéricas estandarizadas
    (media 0, desviación 1) — misma preparación para los 3 candidatos.

    El escalado importa sobre todo para Logistic Regression: "poblacion" va
    de ~4,800 a ~1,645,000 (rango enorme, muy sesgado) frente a lag1-3/roll3
    en decenas-centenas y mes_ciclo en 0-11 — sin escalar, esa variable por
    sí sola domina la regularización L2 y descompone el modelo (probado:
    accuracy de logistic_regression cayó de 92% a 70% sin este escalado).
    Los modelos de árboles (Random Forest/Gradient Boosting) son invariantes
    a la escala, así que esto no les afecta — se aplica parejo a los 3 por
    consistencia, no porque lo necesiten todos."""
    pre = ColumnTransformer(
        [
            ("muni", OneHotEncoder(handle_unknown="ignore"), FEATURE_CAT),
            ("num", StandardScaler(), FEATURE_NUM),
        ]
    )
    return Pipeline([("pre", pre), ("clf", estimator)])


def _candidates() -> dict[str, Pipeline]:
    return {
        "logistic_regression": _make_pipeline(LogisticRegression(max_iter=3000)),
        "random_forest": _make_pipeline(
            RandomForestClassifier(n_estimators=200, max_depth=10, random_state=42, n_jobs=-1)
        ),
        "gradient_boosting": _make_pipeline(GradientBoostingClassifier(random_state=42)),
    }


def temporal_split(panel: pd.DataFrame, test_months: int = TEST_MONTHS) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Holdout por TIEMPO, no aleatorio: los últimos `test_months` meses del
    panel (de cualquier municipio) son el test — así el modelo nunca ve
    features calculadas con datos posteriores al punto que está prediciendo."""
    cutoff = panel["periodo_idx"].max() - test_months + 1
    train = panel[panel["periodo_idx"] < cutoff]
    test = panel[panel["periodo_idx"] >= cutoff]
    return train, test


def evaluate_model(name: str, pipe: Pipeline, X_train, y_train, X_test, y_test) -> dict:
    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)
    proba = pipe.predict_proba(X_test)
    classes = list(pipe.classes_)

    roc_auc = None
    present = sorted(set(y_test))
    if len(present) > 1:
        try:
            idx = [classes.index(c) for c in present]
            roc_auc = roc_auc_score(y_test, proba[:, idx], multi_class="ovr", average="macro", labels=present)
        except ValueError:
            roc_auc = None

    return {
        "modelo": name,
        "pipeline": pipe,
        "accuracy": accuracy_score(y_test, y_pred),
        "precision_macro": precision_score(y_test, y_pred, average="macro", zero_division=0),
        "recall_macro": recall_score(y_test, y_pred, average="macro", zero_division=0),
        "f1_macro": f1_score(y_test, y_pred, average="macro", zero_division=0),
        "roc_auc_macro": roc_auc,
        "n_test": len(y_test),
    }


def run_tournament(panel: pd.DataFrame) -> tuple[list[dict], dict]:
    train, test = temporal_split(panel)
    X_train, y_train = train[FEATURE_COLS], train["clase"]
    X_test, y_test = test[FEATURE_COLS], test["clase"]

    results = [evaluate_model(name, pipe, X_train, y_train, X_test, y_test) for name, pipe in _candidates().items()]
    winner = max(results, key=lambda r: r["f1_macro"])
    return results, winner


def predict_next_month(panel: pd.DataFrame, fitted_pipeline: Pipeline) -> pd.DataFrame:
    """Para cada municipio, toma su fila MÁS RECIENTE del panel (lags/roll3
    ya calculados sobre datos reales) y predice la clase del mes siguiente
    al último dato disponible."""
    latest = panel.sort_values("periodo_idx").groupby("cve_muni").tail(1).reset_index(drop=True)
    X = latest[FEATURE_COLS]
    proba = fitted_pipeline.predict_proba(X)
    classes = list(fitted_pipeline.classes_)
    pred_class = fitted_pipeline.predict(X)

    def next_mes_anio(anio: int, mes: int) -> tuple[int, int]:
        total = anio * 12 + (mes - 1) + 1
        return total // 12, (total % 12) + 1

    rows = []
    for i, row in latest.iterrows():
        anio_p, mes_p = next_mes_anio(int(row["anio"]), int(row["mes"]))
        proba_row = {c: (proba[i, classes.index(c)] if c in classes else 0.0) for c in CLASSES}
        rows.append({
            "cve_muni": row["cve_muni"],
            "municipio": row["municipio"],
            "clase_predicha": pred_class[i],
            "proba_bajo": int(round(proba_row["bajo"] * 100)),
            "proba_medio": int(round(proba_row["medio"] * 100)),
            "proba_alto": int(round(proba_row["alto"] * 100)),
            "proba_critico": int(round(proba_row["critico"] * 100)),
            "mes_prediccion": mes_p,
            "anio_prediccion": anio_p,
        })
    return pd.DataFrame(rows)
