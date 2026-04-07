import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import os

print("進度: 開始讀取資料...")
data = pd.read_excel('data.xlsx',sheet_name="傳金電")
data_vix = pd.read_excel('data.xlsx',sheet_name="vix")
data3= pd.read_excel('data.xlsx',sheet_name="data")
data4= pd.read_excel('data.xlsx',sheet_name="現貨")
print("進度: 資料讀取完成。")



import pandas as pd

# 1. 定義標題：手動提取或根據你的資料結構選取
# 根據你提供的資料，正確的欄位名稱應該從 "日期" 開始
column_names = [
    '日期', '加權指數:收盤價', '加權報酬指數:收盤價', '電子類:收盤價', 
    '金融保險:收盤價', '不含金融電子:收盤價', 'OTC指數:收盤價', 
    '不含金融電子報酬指數:收盤價', '電子類報酬指數:收盤價', '金融保險類報酬指數:收盤價', 
    '電子類:成交值比重(%)', '電子類:市值比重(%)'
]

# 2. 定位數據起始點
# 觀察資料，真正的數據大約從索引 3973 左右（或是從包含 "2010-01-04" 那列開始）
# 我們假設數據是從包含日期的那一行開始，並過濾掉不必要的 NaN
# 這裡使用 iloc 切掉前面的參數描述區 (假設 row 0-11 是參數)
clean_df = data.iloc[12:].copy()

# 3. 移除全空或多餘的索引欄位 (假設第一欄是無意義的 index)
# 使用 iloc 選取從「日期」欄位開始到最後的內容
clean_df = clean_df.iloc[:, 1:-1] 
clean_df.columns = column_names

# 4. 資料格式轉換與清理
# 將日期轉為 datetime 格式
clean_df['日期'] = pd.to_datetime(clean_df['日期'])


# 5. 重設索引
clean_df = clean_df.reset_index(drop=True)

# 顯示最後幾列確認結果




#vix資料清理

columns = ['日期', 'VIX_收盤價']

data_vix_clean = data_vix.iloc[4:, 1:3].copy()
data_vix_clean.columns = columns
data_vix_clean['日期'] = pd.to_datetime(data_vix_clean['日期'])
data_vix_clean = data_vix_clean.reset_index(drop=True)





#data3資料清理

import pandas as pd

# 1. 根據你提供的圖片，手動整理出完整的欄位清單
# 這裡務必確保數量與 data3.iloc[:, 2:] 剩下來的欄位數量一致
full_columns = [
    "日期", "TWA00加權指數:收盤價", "TX台指期近期:收盤價", "TX2台指期次月:收盤價",
    "TX近期:交割月份", "TX近期:未沖銷契約數", "TX2次月:未沖銷契約數", "TWX摩根現貨:收盤價",
    "SMTF:收盤價", "SMTF2:收盤價", "SMTF:交割月份", "SMTF:未沖銷契約數", "SMTF2:未沖銷契約數",
    "TXOC台指選近月:全部未沖銷", "TXOC1台指選近月:全部未沖銷", "TXOC2台指選近月:全部未沖銷",
    "TXOP台指選近月:全部未沖銷", "TXOP1台指選近月:全部未沖銷", "TXOP2台指選近月:全部未沖銷",
    "TX03外資:期貨多方未平倉", "TX03外資:期貨空方未平倉", 
    "MTX01自營商:多方未平倉", "MTX02投信:多方未平倉", "MTX03外資:多方未平倉",
    "MTX01自營商:空方未平倉", "MTX02投信:空方未平倉", "MTX03外資:空方未平倉",
    "MTX近期:未沖銷契約數", "MTX2次月:未沖銷契約數",
    "TX近月:前十大淨", "TX全月:前十大淨", "TX近月:特定人淨", "TX全月:特定人淨",
    "TX03PM外資(盤後):多方交易", "TX03PM外資(盤後):空方交易", "TX03PM外資(盤後):淨額"
]

# 2. 用 iloc 切割：跳過前面那些系統參數列
# 根據你的資料，數據大約是從 index 4 開始，並且跳過前兩欄無用的 NaN
clean_data3 = data3.iloc[4:, 1:].copy()

# 3. 檢查欄位數量是否匹配（如果不匹配會報錯，可用來除錯）
if clean_data3.shape[1] == len(full_columns):
    clean_data3.columns = full_columns
else:
    print("進度: 警告 - data3欄位數量不符，正在調整...")
    # 如果不符，我們先強制給個臨時標題，讓你可以繼續跑
    clean_data3.columns = [f"col_{i}" for i in range(clean_data3.shape[1])]

# 4. 資料型態轉換
# 轉日期
print("進度: 清理data3中...")
clean_data3['日期'] = pd.to_datetime(clean_data3['日期'])

# 轉數字：把所有收盤價、口數都轉成 float/int，非數字的轉 NaN
cols_to_convert = clean_data3.columns[1:]
clean_data3[cols_to_convert] = clean_data3[cols_to_convert].apply(pd.to_numeric, errors='coerce')

# 5. 整理收尾
clean_data3 = clean_data3.dropna(subset=['日期']).reset_index(drop=True)

print("進度: data3清理完成。")







#data4資料清理
import pandas as pd

# 1. 定義標題名稱 (移除原始資料中的「使用者定義」)
# 對應 data4.iloc[:, 2:] 後的 14 個位置
full_columns_data4 = [
    "日期", 
    "外資買賣超", "自營商買賣超", "投信買賣超", "空欄1", 
    "電子外資買賣超", "不含金電外資買賣超", "金融外資買賣超", "空欄2",
    "融資餘額", "融資增減", "券餘", "空欄3", 
    "借券賣出餘額", "空欄4"
]

# 2. 用 iloc 切割：跳過前 4 列參數區，選取第 2 欄之後的所有數據
clean_data4 = data4.iloc[4:, 1:].copy()

# 3. 強制設定標題
# 這裡 clean_data4 應該剛好剩下 14 欄 (37-23=14，或者依原始 df 寬度而定)
clean_data4.columns = full_columns_data4

# 4. 移除那些「使用者定義」產生的空欄位
clean_data4 = clean_data4.drop(columns=["空欄1", "空欄2", "空欄3", "空欄4"])

# 5. 資料型態轉換
print("進度: 清理data4中...")
clean_data4['日期'] = pd.to_datetime(clean_data4['日期'])

# 將數值欄位轉為 float
cols_to_convert = clean_data4.columns[1:]
clean_data4[cols_to_convert] = clean_data4[cols_to_convert].apply(pd.to_numeric, errors='coerce')

# 6. 重設索引
clean_data4 = clean_data4.dropna(subset=['日期']).reset_index(drop=True)

print("進度: data4清理完成。")







#data1-4儲存


import os

# 1. 建立資料夾 (如果不存在就建立)
folder_name = 'data'
if not os.path.exists(folder_name):
    os.makedirs(folder_name)
    print(f"進度: 已建立資料夾: {folder_name}")

# 2. 定義要存檔的 DataFrame 列表與對應檔名
# 假設你之前的變數名稱分別是 clean_df, clean_vix, clean_data3, clean_data4
files_to_save = {
    'market_indices.csv': clean_df,      # 大盤與電子指數
    'vix_index.csv': data_vix_clean,          # 恐慌指數
    'futures_chip.csv': clean_data3,     # 期貨與大額籌碼
    'margin_and_legal.csv': clean_data4  # 融資券與法人買賣超
}

# 3. 迴圈存檔
print("進度: 開始儲存資料...")
total_files = len(files_to_save)
for i, (file_name, df) in enumerate(files_to_save.items(), 1):
    file_path = os.path.join(folder_name, file_name)
    
    # index=False 表示不儲存 Pandas 自動產生的序號列
    # encoding='utf-8-sig' 確保 Excel 打開中文不亂碼
    df.to_csv(file_path, index=False, encoding='utf-8-sig')
    print(f"進度: 儲存 {file_name} 完成 ({i}/{total_files})")











#close資料清理與合併

#新資料
price = pd.read_excel('data.xlsx', sheet_name='收盤價')
price = price.iloc[3:, :]
price.columns = price.iloc[0, :].values
price.drop(columns="股票名稱", inplace=True)
price = price.iloc[1:, :].copy()

def clean_close_data(close):
    """
    Clean and process the close DataFrame by renaming columns, setting index, and transposing.
    
    Parameters:
    close (pd.DataFrame): The raw close data DataFrame.
    
    Returns:
    pd.DataFrame: The cleaned and processed DataFrame.
    """
    new_columns = []
    for col in close.columns:
        if '收盤價' in col:
            # 去掉「收盤價」字眼
            date_str = col.replace('收盤價', '')
            # 轉換為 datetime 物件 (格式為 YYYYMMDD)
            new_columns.append(pd.to_datetime(date_str, format='%Y%m%d'))
        else:
            # 保留「股票代號」、「股票名稱」等原欄位
            new_columns.append(col)
    
    # 2. 將處理完的列表重新指派給 columns
    close.columns = new_columns
    
    close.set_index("股票代號", inplace=True)
    close = close.T
    close.index = pd.to_datetime(close.index, format='%Y%m%d')
    
    return close

# 使用函數處理 close DataFrame
price = clean_close_data(price)



#原本資料
close2 = pd.read_csv("data/close_clean.csv", encoding='utf-8-sig', index_col=0, parse_dates=True)
combined_close2 = pd.concat([close2, price] ,join='outer', ignore_index=False).drop_duplicates(keep='last')
combined_close2.to_csv("data/close_clean.csv", encoding='utf-8-sig' )


print("進度: 所有資料已準備就緒。")









