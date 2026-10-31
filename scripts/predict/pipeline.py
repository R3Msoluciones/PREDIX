"""pipeline.py — Modelos candidatos, backtesting walk-forward y selección
del ganador por serie (municipio x tipo de delito).

Todos los candidatos comparten la firma:
    forecast_fn(train: np.ndarray, horizon: int) -> np.ndarray  (len == horizon)
para que backtest_series() los pueda evaluar de forma uniforme.
"""

from __future__ import annotations

from typing import Callable

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import ElasticNetCV, PoissonRegressor
from sklearn.model_selection import TimeSeriesSplit
from statsmodels.tsa.holtwinters import ExponentialSmoothing
import statsmodels.api as sm


# ── Modelos base (sin features) ──

def sma_forecast(train: np.ndarray, horizon: int, window: int = 3) -> np.ndarray:
    last = train[-window:] if len(train) >= window else train
    level = float(last.mean())
    return np.full(horizon, max(level, 0.0))


def holt_winters_forecast(train: np.ndarray, horizon: int) -> np.ndarray:
    seasonal = "add" if len(train) >= 24 else None
    seasonal_periods = 12 if seasonal else None
    model = ExponentialSmoothing(
        train,
        trend="add",
        seasonal=seasonal,
        seasonal_periods=seasonal_periods,
        initialization_method="estimated",
    ).fit(optimized=True)
    fc = model.forecast(horizon)
    return np.clip(np.asarray(fc), 0, None)


# ── Modelos con features (lag1-3, media móvil 3m, mes-del-ciclo) ──

def _make_features(train: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    n = len(train)
    rows, targets = [], []
    for i in range(3, n):
        lag1, lag2, lag3 = train[i - 1], train[i - 2], train[i - 3]
        roll3 = train[i - 3:i].mean()
        rows.append([lag1, lag2, lag3, roll3, i % 12])
        targets.append(train[i])
    return np.array(rows), np.array(targets)


def _recursive_forecast(train: np.ndarray, horizon: int, fit_fn: Callable) -> np.ndarray:
    X, y = _make_features(train)
    if len(X) < 5:
        return sma_forecast(train, horizon)
    model = fit_fn(X, y)
    # Cota defensiva: PoissonRegressor usa link exponencial internamente —
    # en series con muchos ceros (huecos de calendario rellenados) puede
    # dispararse a infinito, y el forecast recursivo retroalimentaría ese
    # valor como lag del siguiente paso. Si se dispara, cae a SMA.
    cota = max(float(train.max()) * 10, 100.0)
    history = list(train)
    preds = []
    for _ in range(horizon):
        i = len(history)
        lag1, lag2, lag3 = history[-1], history[-2], history[-3]
        roll3 = np.mean(history[-3:])
        x = np.array([[lag1, lag2, lag3, roll3, i % 12]])
        yhat = float(model.predict(x)[0])
        if not np.isfinite(yhat) or yhat > cota:
            return sma_forecast(train, horizon)
        yhat = max(yhat, 0.0)
        preds.append(yhat)
        history.append(yhat)
    return np.array(preds)


def elasticnet_forecast(train: np.ndarray, horizon: int) -> np.ndarray:
    def fit(X, y):
        # n_alphas bajo (default sklearn es 100) — con 3 l1_ratio x cv=3 folds,
        # el default hace ~900 ajustes por llamada; con ~750 series x hasta 4
        # llamadas cada una, eso vuelve el pipeline completo impracticable.
        # n_jobs=1 (no -1): el paralelismo real ocurre a nivel de serie, no
        # aquí — ver build_predictions.py, evita paralelismo anidado.
        m = ElasticNetCV(cv=3, l1_ratio=[0.1, 0.5, 0.9], alphas=20, max_iter=2000, n_jobs=1)
        m.fit(X, y)
        return m
    return _recursive_forecast(train, horizon, fit)


def random_forest_forecast(train: np.ndarray, horizon: int) -> np.ndarray:
    def fit(X, y):
        m = RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42, n_jobs=1)
        m.fit(X, y)
        return m
    return _recursive_forecast(train, horizon, fit)


def poisson_forecast(train: np.ndarray, horizon: int) -> np.ndarray:
    def fit(X, y):
        m = PoissonRegressor(alpha=1.0, max_iter=500)
        m.fit(X, np.clip(y, 0, None))
        return m
    return _recursive_forecast(train, horizon, fit)


def neg_binomial_forecast(train: np.ndarray, horizon: int) -> np.ndarray:
    X, y = _make_features(train)
    if len(X) < 5:
        return sma_forecast(train, horizon)
    Xc = sm.add_constant(X, prepend=True)
    try:
        model = sm.GLM(y, Xc, family=sm.families.NegativeBinomial()).fit()
    except Exception:
        return sma_forecast(train, horizon)
    # Cota defensiva: el link exponencial de NegativeBinomial puede
    # dispararse a infinito en series con muchos ceros (huecos de calendario
    # rellenados) — el forecast recursivo retroalimenta ese valor como lag
    # del siguiente paso, agravándolo. Si se dispara, esta serie completa
    # cae a SMA en vez de devolver infinito/NaN.
    cota = max(float(train.max()) * 10, 100.0)
    history = list(train)
    preds = []
    for _ in range(horizon):
        i = len(history)
        lag1, lag2, lag3 = history[-1], history[-2], history[-3]
        roll3 = np.mean(history[-3:])
        x = np.array([[1.0, lag1, lag2, lag3, roll3, i % 12]])
        yhat = float(model.predict(x)[0])
        if not np.isfinite(yhat) or yhat > cota:
            return sma_forecast(train, horizon)
        yhat = max(yhat, 0.0)
        preds.append(yhat)
        history.append(yhat)
    return np.array(preds)


CANDIDATES: dict[str, Callable[[np.ndarray, int], np.ndarray]] = {
    "sma": sma_forecast,
    "holt_winters": holt_winters_forecast,
    "elasticnet": elasticnet_forecast,
    "random_forest": random_forest_forecast,
    "poisson": poisson_forecast,
    "neg_binomial": neg_binomial_forecast,
}


# ── Métricas ──

def mape(actual: np.ndarray, pred: np.ndarray) -> float:
    denom = np.maximum(actual, 1.0)  # evita división por cero en meses sin delitos
    return float(np.mean(np.abs(actual - pred) / denom) * 100)


def rmse(actual: np.ndarray, pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((actual - pred) ** 2)))


# ── Backtesting walk-forward ──

def backtest_series(values: np.ndarray, min_history: int = 12) -> dict[str, dict[str, float]]:
    n = len(values)
    if n < min_history:
        return {}
    n_splits = min(3, (n - min_history) // 3)
    if n_splits < 2:
        return {}
    tscv = TimeSeriesSplit(n_splits=n_splits, test_size=3)
    raw: dict[str, list[tuple[float, float]]] = {name: [] for name in CANDIDATES}
    for train_idx, test_idx in tscv.split(values):
        train, test = values[train_idx], values[test_idx]
        if len(train) < min_history:
            continue
        for name, forecast_fn in CANDIDATES.items():
            try:
                pred = forecast_fn(train, len(test))
            except Exception:
                continue
            raw[name].append((mape(test, pred), rmse(test, pred)))
    scores: dict[str, dict[str, float]] = {}
    for name, vals in raw.items():
        if not vals:
            continue
        mapes, rmses = zip(*vals)
        scores[name] = {"mape": float(np.mean(mapes)), "rmse": float(np.mean(rmses))}
    return scores


def select_winner(scores: dict[str, dict[str, float]]) -> str:
    if not scores:
        return "sma"
    return min(scores, key=lambda k: scores[k]["mape"])


def confidence_from_mape(mape_pct: float | None) -> int:
    """Confianza honesta derivada del error medido en backtest — nunca inventada.
    Series sin backtest (muy cortas) caen a una confianza baja fija."""
    if mape_pct is None:
        return 40
    conf = 1 - min(mape_pct, 100) / 100
    return int(round(min(max(conf, 0.30), 0.95) * 100))


def forecast_series(
    values: np.ndarray, winner: str, horizon: int, backtest_mape: float | None
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    forecast_fn = CANDIDATES.get(winner, sma_forecast)
    point = forecast_fn(values, horizon)
    error_frac = (backtest_mape / 100) if backtest_mape is not None else 0.3
    error_frac = min(max(error_frac, 0.05), 0.8)
    lo = np.clip(point * (1 - error_frac), 0, None)
    hi = point * (1 + error_frac)
    return point, lo, hi
