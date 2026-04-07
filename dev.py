import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# 解析資料路徑
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "index"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def calculate_deviation(data: pd.Series, window: int = 60) -> pd.Series:
    ma = data.rolling(window=window).mean()
    return (data - ma) / ma * 100


def convert_value(value):
    """把 numpy / pandas 型別轉成 JSON 可序列化格式。"""
    if pd.isna(value):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    return value


def format_index_value(idx):
    """統一 index 輸出格式。日期輸出 ISO 字串，其餘維持原值。"""
    if isinstance(idx, (pd.Timestamp, np.datetime64)):
        return pd.Timestamp(idx).isoformat()
    return convert_value(idx)


def dataframe_to_frontend_json(df: pd.DataFrame) -> dict:
    """DataFrame -> {index: [...], data: {col: [...]}}"""
    df = df.copy()
    df = df.sort_index()

    return {
        "index": [format_index_value(idx) for idx in df.index],
        "data": {
            str(col): [convert_value(v) for v in df[col].tolist()]
            for col in df.columns
        },
    }


def series_to_frontend_json(series: pd.Series) -> dict:
    """Series -> {index: [...], data: {series_name: [...]}}"""
    s = series.copy()
    s = s.sort_index()
    column_name = str(s.name) if s.name is not None else "value"

    return {
        "index": [format_index_value(idx) for idx in s.index],
        "data": {
            column_name: [convert_value(v) for v in s.tolist()]
        },
    }


def save_json(obj, filepath: Path) -> None:
    """
    統一輸出成前端易讀格式：
    - Series: {"index": [...], "data": {"欄位名": [...]}}
    - DataFrame: {"index": [...], "data": {"欄位1": [...], "欄位2": [...]}}
    """
    filepath = filepath.with_suffix(".json")

    if isinstance(obj, pd.Series):
        payload = series_to_frontend_json(obj)
    elif isinstance(obj, pd.DataFrame):
        payload = dataframe_to_frontend_json(obj)
    else:
        payload = obj

    with filepath.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)




def load_series_json(filepath: Path) -> pd.Series:
    """讀取 frontend JSON 格式的 Series；不存在則回傳空 Series。"""
    filepath = filepath.with_suffix(".json")
    if not filepath.exists():
        return pd.Series(dtype=float)

    with filepath.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    index = pd.to_datetime(payload.get("index", []), errors="coerce")
    data_dict = payload.get("data", {})
    if not data_dict:
        return pd.Series(dtype=float)

    column_name = next(iter(data_dict))
    values = data_dict[column_name]
    s = pd.Series(values, index=index, name=column_name, dtype=float)
    s = s[~s.index.isna()]
    s = s[~s.index.duplicated(keep="last")].sort_index()
    return s


def merge_recent_series(old_series: pd.Series, new_series: pd.Series) -> pd.Series:
    """保留舊歷史資料，僅用新資料覆蓋同日期的值。"""
    if old_series is None or len(old_series) == 0:
        merged = new_series.copy()
    else:
        old_series = old_series.copy()
        old_series.index = pd.to_datetime(old_series.index)
        new_series = new_series.copy()
        new_series.index = pd.to_datetime(new_series.index)

        overlap_index = new_series.index
        old_series = old_series.drop(index=overlap_index, errors="ignore")
        merged = pd.concat([old_series, new_series])

    merged = merged[~merged.index.duplicated(keep="last")].sort_index()
    merged.name = new_series.name
    return merged

def load_csv(path: Path, **kwargs) -> pd.DataFrame:
    df = pd.read_csv(path, encoding="utf-8-sig", **kwargs)
    if "日期" in df.columns:
        df["日期"] = pd.to_datetime(df["日期"])
        df.set_index("日期", inplace=True)
    return df


def avg_corr_fast(df: pd.DataFrame, window: int = 60) -> pd.Series:
    res = []
    idx = []

    for i in range(window - 1, len(df)):
        sub = df.iloc[i - window + 1 : i + 1]
        z = (sub - sub.mean()) / sub.std(ddof=1)
        Z = z.to_numpy()
        mask = ~np.isnan(Z).any(axis=0)
        Z = Z[:, mask]
        m = Z.shape[1]

        if m < 2:
            res.append(np.nan)
            idx.append(df.index[i])
            continue

        C = (Z.T @ Z) / (window - 1)
        avg_corr = (C.sum() - m) / (m * (m - 1))
        res.append(avg_corr)
        idx.append(df.index[i])

    return pd.Series(res, index=idx, name="avg_corr")


def main() -> None:
    data1 = load_csv(DATA_DIR / "market_indices.csv")
    data2 = load_csv(DATA_DIR / "vix_index.csv")
    data3 = load_csv(DATA_DIR / "futures_chip.csv")
    data4 = load_csv(DATA_DIR / "margin_and_legal.csv")

    # 外資 / 投信 / 自營商
    fi = data4["外資買賣超"].cumsum().rename("外資累計買賣超")
    fi_3ind = pd.DataFrame(
        {
            "傳產外資買賣超": data4["不含金電外資買賣超"].cumsum(),
            "金融外資買賣超": data4["金融外資買賣超"].cumsum(),
            "電子外資買賣超": data4["電子外資買賣超"].cumsum(),
        }
    )
    i1 = data4["投信買賣超"].cumsum().rename("投信累計買賣超")
    i2 = data4["自營商買賣超"].cumsum().rename("自營商累計買賣超")

    # 指數乖離
    otc_deviation = calculate_deviation(data1["OTC指數:收盤價"]).rename("OTC 指數乖離率")
    market_deviation = calculate_deviation(data1["加權指數:收盤價"]).rename("加權指數乖離率")
    mo_deviation = (market_deviation - otc_deviation).rename("上市櫃乖離差")

    tech_deviation = calculate_deviation(data1["電子類:收盤價"]).rename("電子乖離率")
    fin_devation = calculate_deviation(data1["金融保險:收盤價"]).rename("金融乖離率")
    tra_deviation = calculate_deviation(data1["不含金融電子:收盤價"]).rename("傳產乖離率")

    tech_fin_deviation = (tech_deviation - fin_devation).rename("電子金融乖離差")
    tech_tra_deviation = (tech_deviation - tra_deviation).rename("電子傳產乖離差")

    # 籌碼 / 部位
    law = (
        data3["MTX01自營商:多方未平倉"]
        + data3["MTX02投信:多方未平倉"]
        + data3["MTX03外資:多方未平倉"]
        - data3["MTX01自營商:空方未平倉"]
        - data3["MTX02投信:空方未平倉"]
        - data3["MTX03外資:空方未平倉"]
    ).rename("法人淨部位")

    mob = (-law).rolling(window=5).mean().rename("散戶淨部位(5日平滑)")
    foreign_net = (
        data3["TX03外資:期貨多方未平倉"] - data3["TX03外資:期貨空方未平倉"]
    ).rename("外資期貨淨部位")

    weight_diff = (
        data1["電子類:成交值比重(%)"] - data1["電子類:市值比重(%)"]
    ).rename("電子成交比重-市值比重")

    pcr = (
        data3["TXOP台指選近月:全部未沖銷"] / data3["TXOC台指選近月:全部未沖銷"]
    ).rename("PCR 比值")

    put_oi = data3["TXOP1台指選近月:全部未沖銷"].rename("Put OI")
    call_oi = data3["TXOC1台指選近月:全部未沖銷"].rename("Call OI")

    # close.csv 處理


    close = pd.read_csv(DATA_DIR / "close_clean.csv", encoding="utf-8-sig", index_col=0, parse_dates=True)

    total = (~close.isna()).sum(axis=1).rename("股票總數")
    upon_ma = (
        ((close - close.rolling(window=60).mean()) / close.rolling(window=60).mean()) > 0
    ).sum(axis=1).rename("站上60MA家數")

    upon_ratio = (upon_ma / total).rename("季線上家數比重")
    returns = close.pct_change()

    # 平均相關係數只重算最近 100 天，但保留舊 JSON 歷史資料並覆蓋最新區間
    corr_window = 60
    corr_recent_days = 100
    corr_input = returns.tail(corr_window + corr_recent_days - 1)
    corr_recent = avg_corr_fast(corr_input, window=corr_window).rename("平均相關係數")

    old_corr = load_series_json(OUTPUT_DIR / "corr")
    corr = merge_recent_series(old_corr, corr_recent).rename("平均相關係數")

    # 大盤 / VIX
    twa00 = data1["加權報酬指數:收盤價"].rename("TWA00")
    tw_returns = data1["加權報酬指數:收盤價"].pct_change()

    vix_df = pd.DataFrame(index=data2.index)
    vix_df["VIX"] = data2["VIX_收盤價"]
    vix_df["大盤報酬"] = tw_returns
    vix_df["VIX變動率"] = vix_df["VIX"].pct_change()
    vix_df["訊號"] = 0
    vix_df.loc[
        (vix_df["大盤報酬"] > 0.015) & (vix_df["VIX變動率"] > 0),
        "訊號"
    ] = 1

    # 你前端目前把 vix / vix_signal / twa00 當成 special chart
    # 所以這三個還是分開輸出，維持相容
    vix = vix_df["VIX"].rename("VIX")
    vix_signal = vix_df["訊號"].rename("signal")

    outputs = {
        # 大盤指數相關
        "twa00": twa00,

        # VIX 指數相關
        "vix": vix,
        "vix_signal": vix_signal,

        # 外資買賣超相關
        "fi": fi,
        "fi_3ind": fi_3ind,
        "i1": i1,
        "i2": i2,

        # 指數乖離率相關
        "otc_deviation": otc_deviation,
        "market_deviation": market_deviation,
        "mo_deviation": mo_deviation,
        "tech_deviation": tech_deviation,
        "fin_devation": fin_devation,
        "tra_deviation": tra_deviation,
        "tech_fin_deviation": tech_fin_deviation,
        "tech_tra_deviation": tech_tra_deviation,

        # 籌碼與未平倉相關
        "law": law,
        "mob": mob,
        "foreign_net": foreign_net,
        "weight_diff": weight_diff,
        "pcr": pcr,
        "put_oi": put_oi,
        "call_oi": call_oi,

        # 個股收盤價相關
        "total": total,
        "upon_ma": upon_ma,
        "upon_ratio": upon_ratio,
        "corr": corr,
    }

    for name, obj in outputs.items():
        save_json(obj, OUTPUT_DIR / name)

    print(f"已建立 {OUTPUT_DIR} 並儲存 {len(outputs)} 個 JSON 檔案。")


if __name__ == "__main__":
    main()