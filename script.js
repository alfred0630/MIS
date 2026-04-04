const repoOwner = 'alfred0630';
const repoName = 'MIS';
const branch = 'main';
const baseUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${branch}/index/`;

const allJsonFiles = [
    { name: 'vix', label: 'VIX, VIX Signal & TWA00' },
    { name: 'close', label: 'Close Price' },
    { name: 'call_oi', label: 'Call OI' },
    { name: 'put_oi', label: 'Put OI' },
    { name: 'corr', label: 'Correlation' },
    { name: 'fi_3ind', label: 'Foreign Investment (3 Ind)' },
    { name: 'fi', label: 'Foreign Investment' },
    { name: 'fin_devation', label: 'Finance Deviation' },
    { name: 'foreign_net', label: 'Foreign Net' },
    { name: 'i1', label: 'Index 1' },
    { name: 'i2', label: 'Index 2' },
    { name: 'law', label: 'Law' },
    { name: 'market_deviation', label: 'Market Deviation' },
    { name: 'mo_deviation', label: 'Monthly Deviation' },
    { name: 'mob', label: 'Momentum' },
    { name: 'otc_deviation', label: 'OTC Deviation' },
    { name: 'pcr', label: 'Put-Call Ratio' },
    { name: 'returns', label: 'Returns' },
    { name: 'tech_deviation', label: 'Tech Deviation' },
    { name: 'tech_fin_deviation', label: 'Tech-Finance Deviation' },
    { name: 'tech_tra_deviation', label: 'Tech-Trade Deviation' },
    { name: 'total', label: 'Total' },
    { name: 'tra_deviation', label: 'Trade Deviation' },
    { name: 'upon_ma', label: 'Upper MA' },
    { name: 'upon_ratio', label: 'Upper Ratio' },
    { name: 'weight_diff', label: 'Weight Difference' }
];

let selectedCharts = [];
let chartInstances = {};

// 初始化日期
const today = new Date();
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(today.getMonth() - 6);

document.getElementById('start-date').value = sixMonthsAgo.toISOString().split('T')[0];
document.getElementById('end-date').value = today.toISOString().split('T')[0];

async function loadAndFilterJSON(filename) {
    try {
        const response = await fetch(baseUrl + filename + '.json');
        if (!response.ok) throw new Error('Network error');
        const jsonData = await response.json();
        
        let rawData = [];
        // 格式轉換 (承襲原邏輯)
        if (jsonData.index && Array.isArray(jsonData.index)) {
            const dataObj = jsonData.data || {};
            const indices = jsonData.index;
            indices.forEach((date, idx) => {
                const row = { date: new Date(date).toISOString().split('T')[0] };
                if (Array.isArray(dataObj)) {
                    row[jsonData.name || 'value'] = dataObj[idx];
                } else {
                    Object.keys(dataObj).forEach(key => {
                        row[key] = dataObj[key][idx];
                    });
                }
                rawData.push(row);
            });
        } else if (Array.isArray(jsonData)) {
            rawData = jsonData;
        }

        // 時間篩選
        const start = document.getElementById('start-date').value;
        const end = document.getElementById('end-date').value;
        return rawData.filter(item => item.date >= start && item.date <= end);
    } catch (error) {
        console.error(`Error loading ${filename}:`, error);
        return null;
    }
}

function initSidebar() {
    const list = document.getElementById('factor-list');
    allJsonFiles.forEach((file) => {
        const item = document.createElement('div');
        item.className = 'factor-item';
        item.innerHTML = `
            <input type="checkbox" id="chk-${file.name}" value="${file.name}">
            <label for="chk-${file.name}">${file.label}</label>
        `;
        
        const checkbox = item.querySelector('input');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (selectedCharts.length >= 4) {
                    e.target.checked = false;
                    alert('最多只能同時選擇 4 個因子');
                    return;
                }
                selectedCharts.push(file);
            } else {
                selectedCharts = selectedCharts.filter(c => c.name !== file.name);
            }
            updateUI();
        });
        list.appendChild(item);
    });
}

async function updateUI() {
    const grid = document.getElementById('charts-grid');
    const countInfo = document.getElementById('count-info');
    countInfo.textContent = `(${selectedCharts.length}/4)`;

    if (selectedCharts.length === 0) {
        grid.innerHTML = `<div class="empty-state"><i class="fas fa-chart-area"></i><p>請從左側選單選擇欲顯示的圖表（最多 4 個）</p></div>`;
        return;
    }

    grid.innerHTML = ''; // 清空
    grid.className = `charts-grid count-${selectedCharts.length}`;

    for (const file of selectedCharts) {
        const section = document.createElement('div');
        section.className = 'chart-card';
        section.innerHTML = `<h3>${file.label}</h3><div class="canvas-wrapper"><canvas id="chart-${file.name}"></canvas></div>`;
        grid.appendChild(section);

        const data = await loadAndFilterJSON(file.name);
        if (data) {
            renderSingleChart(file.name, data, file.label);
        }
    }
}

function renderSingleChart(id, data, label) {
    const ctx = document.getElementById(`chart-${id}`).getContext('2d');
    const labels = data.map(item => item.date);
    const keys = Object.keys(data[0]).filter(k => k !== 'date');
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: keys.map((key, i) => ({
                label: key,
                data: data.map(item => item[key]),
                borderColor: colors[i % colors.length],
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.1
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true } } },
            scales: { 
                x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
                y: { grid: { color: '#f3f4f6' } }
            }
        }
    });
}

// 監聽日期變動
document.getElementById('start-date').addEventListener('change', updateUI);
document.getElementById('end-date').addEventListener('change', updateUI);

initSidebar();