import os
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings('ignore')

# 解析資料路徑
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / 'data'
OUTPUT_DIR = BASE_DIR / 'index'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def calculate_deviation(data: pd.Series, window: int = 60) -> pd.Series:
    return (data - data.rolling(window=window).mean()) / data.rolling(window=window).mean() * 100


def save_json(obj, filepath: Path) -> None:
    filepath = filepath.with_suffix('.json')
    if isinstance(obj, pd.DataFrame):
        obj.to_json(filepath, orient='split', date_format='iso')
    elif isinstance(obj, pd.Series):
        obj.to_json(filepath, orient='split', date_format='iso')
    else:
        import json

        with filepath.open('w', encoding='utf-8') as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)


def load_csv(path: Path, **kwargs) -> pd.DataFrame:
    df = pd.read_csv(path, encoding='utf-8-sig', **kwargs)
    if '日期' in df.columns:
        df['日期'] = pd.to_datetime(df['日期'])
        df.set_index('日期', inplace=True)
    return df
#


def main() -> None:
    data1 = load_csv(DATA_DIR / 'market_indices.csv')
    data2 = load_csv(DATA_DIR / 'vix_index.csv')
    data3 = load_csv(DATA_DIR / 'futures_chip.csv')
    data4 = load_csv(DATA_DIR / 'margin_and_legal.csv')

    fi = data4['外資買賣超'].cumsum()
    fi_3ind = pd.DataFrame(
        {
            '傳產外資買賣超': data4['不含金電外資買賣超'].cumsum(),
            '金融外資買賣超': data4['金融外資買賣超'].cumsum(),
            '電子外資買賣超': data4['電子外資買賣超'].cumsum(),
        }
    )

    i1 = data4['投信買賣超'].cumsum()
    i2 = data4['自營商買賣超'].cumsum()

    otc_deviation = calculate_deviation(data1['OTC指數:收盤價'])
    market_deviation = calculate_deviation(data1['加權指數:收盤價'])
    mo_deviation = market_deviation - otc_deviation

    tech_deviation = calculate_deviation(data1['電子類:收盤價'])
    fin_devation = calculate_deviation(data1['金融保險:收盤價'])
    tra_deviation = calculate_deviation(data1['不含金融電子:收盤價'])

    tech_fin_deviation = tech_deviation - fin_devation
    tech_tra_deviation = tech_deviation - tra_deviation

    law = (
        data3['MTX01自營商:多方未平倉']
        + data3['MTX02投信:多方未平倉']
        + data3['MTX03外資:多方未平倉']
        - data3['MTX01自營商:空方未平倉']
        - data3['MTX02投信:空方未平倉']
        - data3['MTX03外資:空方未平倉']
    )
    mob = (-law).rolling(window=5).mean()

    foreign_net = data3['TX03外資:期貨多方未平倉'] - data3['TX03外資:期貨空方未平倉']
    weight_diff = data1['電子類:成交值比重(%)'] - data1['電子類:市值比重(%)']

    pcr = data3['TXOP台指選近月:全部未沖銷'] / data3['TXOC台指選近月:全部未沖銷']
    put_oi = data3['TXOP1台指選近月:全部未沖銷']
    call_oi = data3['TXOC1台指選近月:全部未沖銷']

    close = pd.read_csv(BASE_DIR / 'close.csv', encoding='utf-8-sig')
    new_columns = []
    for col in close.columns:
        if '收盤價' in col:
            date_str = col.replace('收盤價', '')
            new_columns.append(pd.to_datetime(date_str, format='%Y%m%d'))
        else:
            new_columns.append(col)
    close.columns = new_columns
    close.set_index('股票代號', inplace=True)
    close = close.T
    close.index = pd.to_datetime(close.index, format='%Y%m%d')

    total = (~close.isna()).sum(axis=1)
    upon_ma = (((close - close.rolling(window=60).mean()) / close.rolling(window=60).mean()) > 0).sum(axis=1)
    upon_ratio = upon_ma / total
    returns = close.pct_change()

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

        return pd.Series(res, index=idx)

    corr = avg_corr_fast(returns, window=60)


    twa00 = data1["加權報酬指數:收盤價"]


    vix = data2[["VIX_收盤價"]]
    twa00 = data1["加權報酬指數:收盤價"]

    tw_returns = data1["加權報酬指數:收盤價"].pct_change().dropna()
    vix["大盤"] = tw_returns
    vix["vix_change"] = vix["VIX_收盤價"].pct_change().dropna() 
    vix.dropna(inplace=True)
    vix.loc[(vix["大盤"]>0.015)&(vix["vix_change"]>0), "signal"] = 1 
    vix["signal"].fillna(0, inplace=True)
    




    outputs = {

        #大盤指數相關
        'twa00': twa00,  # 加權報酬指數收盤價


        # VIX 指數相關
        'vix': vix['VIX_收盤價'],  # VIX 收盤價
        'vix_signal': vix['signal'],  # VIX 異常上升訊號
        
        

        # 外資買賣超相關
        'fi': fi,  # 外資累計買賣超
        'fi_3ind': fi_3ind,  # 分三產業的外資累計買賣超
        'i1': i1,  # 投信累計買賣超
        'i2': i2,  # 自營商累計買賣超

        # 指數乖離率相關
        'otc_deviation': otc_deviation,  # OTC 指數乖離率
        'market_deviation': market_deviation,  # 加權指數乖離率
        'mo_deviation': mo_deviation,  # 加權指數與 OTC 乖離差
        'tech_deviation': tech_deviation,  # 電子類指數乖離率
        'fin_devation': fin_devation,  # 金融保險類指數乖離率
        'tra_deviation': tra_deviation,  # 不含金融電子類指數乖離率
        'tech_fin_deviation': tech_fin_deviation,  # 電子 vs 金融乖離差
        'tech_tra_deviation': tech_tra_deviation,  # 電子 vs 傳產乖離差

        # 籌碼與未平倉相關
        'law': law,  # 散戶淨部位（多單減空單）
        'mob': mob,  # 散戶淨部位 5 日平滑
        'foreign_net': foreign_net,  # 外資期貨多空淨部位
        'weight_diff': weight_diff,  # 電子類成交值比重減市值比重
        'pcr': pcr,  # 近月選擇權 Put/Call 比
        'put_oi': put_oi,  # 近月 Put 未沖銷量
        'call_oi': call_oi,  # 近月 Call 未沖銷量

        # 個股收盤價相關

        'total': total,  # 每日有資料的股票數
        'upon_ma': upon_ma,  # 60 日收盤價高於 60 日均線的股票數


        'upon_ratio': upon_ratio,  # 多頭比例

        'corr': corr,  # 60 日平均相關係數
    }

    for name, obj in outputs.items():
        save_json(obj, OUTPUT_DIR / name)

    print(f'已建立 {OUTPUT_DIR} 並儲存 {len(outputs)} 個 JSON 檔案。')


if __name__ == '__main__':
    main()
