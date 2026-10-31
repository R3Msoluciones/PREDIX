"""db.py — Conexión MySQL y acceso a datos para el pipeline de predicción.

Misma lógica de bucketing de tipos de delito que server/data/sesnsp.ts
(queryRealIncidencia), pero SIN el recorte automático a los últimos 3 años
que aplica ese helper — este pipeline usa el histórico completo (2015-2026).
"""

import os
import re
from pathlib import Path

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parents[2]

BUCKET_CASE_SQL = """
CASE
  WHEN tipo IN ('Homicidio','Feminicidio') THEN 'homicidios'
  WHEN tipo = 'Robo' THEN 'robos'
  WHEN tipo = 'Lesiones' THEN 'lesiones'
  WHEN bien_juridico = 'La libertad y la seguridad sexual' THEN 'violencia_sexual'
  WHEN tipo = 'Narcomenudeo' THEN 'narcomenudeo'
  ELSE 'otros'
END
"""


def get_database_url() -> str:
    """Lee DATABASE_URL de env o de .env en la raíz del repo (mismo parseo
    que scripts/load-sesnsp.ts, para no depender de una segunda fuente)."""
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^DATABASE_URL=(.*)$", line)
            if m:
                return m.group(1).strip().strip("\"'")
    raise RuntimeError("DATABASE_URL vacío — configúralo en .env antes de correr el pipeline")


def get_engine():
    url = get_database_url()
    # mysql2 (Node) usa "mysql://...", SQLAlchemy+PyMySQL necesita "mysql+pymysql://".
    sa_url = url.replace("mysql://", "mysql+pymysql://", 1)
    return create_engine(sa_url)


def _reindex_monthly(df: pd.DataFrame, group_cols: list[str], value_col: str) -> pd.DataFrame:
    """Rellena huecos de calendario con 0 dentro del rango [primer mes, último
    mes] de cada serie (municipio, o municipio x tipo de delito).

    SESNSP solo emite fila cuando cantidad>0 — un mes sin delitos de cierto
    tipo (o sin ningún delito, para el total) simplemente no aparece en la
    tabla. Confirmado en datos reales: 12 de 125 municipios rurales chicos
    (ej. Zacazonapan, mediana 2 delitos/mes) tienen meses ausentes así.
    Sin este relleno, pipeline.py/classify.py calculan lag1/lag2/lag3/roll3
    por POSICIÓN tras ordenar — con un hueco, "lag1" termina siendo de 2+
    meses atrás en vez del mes inmediato anterior, corrompiendo esas
    features en silencio para esas series."""
    out = []
    for keys, g in df.groupby(group_cols, sort=False):
        keys = keys if isinstance(keys, tuple) else (keys,)
        periodo = (g["anio"] * 12 + g["mes"]).to_numpy()
        valores = dict(zip(periodo, g[value_col]))
        full_periodo = np.arange(periodo.min(), periodo.max() + 1)
        rows = {col: val for col, val in zip(group_cols, keys)}
        block = pd.DataFrame([rows] * len(full_periodo))
        block["anio"] = (full_periodo - 1) // 12
        block["mes"] = (full_periodo - 1) % 12 + 1
        block[value_col] = [valores.get(p, 0) for p in full_periodo]
        out.append(block)
    return pd.concat(out, ignore_index=True)


def load_incidencia_mensual(engine) -> pd.DataFrame:
    """Histórico COMPLETO agrupado mensual por (municipio, tipo de delito).
    Sin filtro de año — a diferencia de queryRealIncidencia() en Node."""
    query = text(f"""
        SELECT
            cve_muni,
            municipio,
            anio,
            mes,
            {BUCKET_CASE_SQL} AS tipo_delito,
            SUM(cantidad) AS cantidad
        FROM incidencia_delito
        GROUP BY cve_muni, municipio, anio, mes, tipo_delito
        ORDER BY cve_muni, tipo_delito, anio, mes
    """)
    df = pd.read_sql(query, engine)
    return _reindex_monthly(df, ["cve_muni", "municipio", "tipo_delito"], "cantidad")


def write_predicciones(engine, df: pd.DataFrame) -> None:
    """Sobreescribe completo: TRUNCATE + INSERT (mismo patrón idempotente
    que scripts/load-sesnsp.ts)."""
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE predicciones_ml"))
        df.to_sql("predicciones_ml", conn, if_exists="append", index=False)


def load_incidencia_total_mensual(engine) -> pd.DataFrame:
    """Histórico COMPLETO agrupado mensual por municipio, TOTAL de delitos
    (todos los tipos sumados, sin bucket) — panel para el clasificador de
    riesgo (server/services/riesgoClassifier equivalente en Python)."""
    query = text("""
        SELECT
            cve_muni,
            municipio,
            anio,
            mes,
            SUM(cantidad) AS total
        FROM incidencia_delito
        GROUP BY cve_muni, municipio, anio, mes
        ORDER BY cve_muni, anio, mes
    """)
    df = pd.read_sql(query, engine)
    return _reindex_monthly(df, ["cve_muni", "municipio"], "total")


def write_riesgo_clasificacion(engine, df: pd.DataFrame) -> None:
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE riesgo_clasificacion"))
        df.to_sql("riesgo_clasificacion", conn, if_exists="append", index=False)


def write_riesgo_clasificacion_metrics(engine, df: pd.DataFrame) -> None:
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE riesgo_clasificacion_metrics"))
        df.to_sql("riesgo_clasificacion_metrics", conn, if_exists="append", index=False)

