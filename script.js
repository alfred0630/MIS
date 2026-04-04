const repoOwner = 'alfred0630';
const repoName = '----';
const branch = 'main';
const baseUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${branch}/index/`;

const jsonFiles = [
    'call_oi.json',
    'close.json',
    'corr.json',
    'fi_3ind.json',
    'fi.json',
    'fin_devation.json',
    'foreign_net.json',
    'i1.json',
    'i2.json',
    'law.json',
    'market_deviation.json',
    'mo_deviation.json',
    'mob.json',
    'otc_deviation.json',
    'pcr.json',
    'put_oi.json',
    'returns.json',
    'tech_deviation.json',
    'tech_fin_deviation.json',
    'tech_tra_deviation.json',
    'total.json',
    'tra_deviation.json',
    'upon_ma.json',
    'upon_ratio.json',
    'weight_diff.json'
];

async function loadJSON(filename) {
    try {
        const response = await fetch(baseUrl + filename);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error loading ${filename}:`, error);
        return null;
    }
}

function createChartSection(title) {
    const section = document.createElement('div');
    section.className = 'chart-section';
    section.innerHTML = `
        <h2>${title}</h2>
        <div class="chart-container">
            <canvas></canvas>
        </div>
    `;
    return section;
}

function createChart(canvas, data, title, options = {}) {
    const ctx = canvas.getContext('2d');
    const labels = data.map(item => item.date);
    const datasets = [];

    // Get all keys except 'date'
    const keys = Object.keys(data[0]).filter(key => key !== 'date');

    keys.forEach((key, index) => {
        const values = data.map(item => item[key]);
        datasets.push({
            label: key,
            data: values,
            borderColor: `hsl(${index * 360 / keys.length}, 70%, 50%)`,
            backgroundColor: `hsl(${index * 360 / keys.length}, 70%, 50%, 0.1)`,
            fill: false,
            ...options
        });
    });

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title
                },
                legend: {
                    display: true
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day'
                    }
                },
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}

async function createSpecialChart() {
    const [vixData, vixSignalData, twa00Data] = await Promise.all([
        loadJSON('vix.json'),
        loadJSON('vix_signal.json'),
        loadJSON('twa00.json')
    ]);

    if (!vixData || !vixSignalData || !twa00Data) {
        console.error('Failed to load special chart data');
        return;
    }

    const section = createChartSection('VIX, VIX Signal & TWA00 綜合圖表');
    document.getElementById('charts-container').appendChild(section);
    const canvas = section.querySelector('canvas');

    const labels = twa00Data.map(item => item.date);
    const twa00Values = twa00Data.map(item => item.twa00);
    const vixValues = vixData.map(item => item.vix);

    // Create signal points where vix_signal == 1
    const signalPoints = [];
    vixSignalData.forEach(item => {
        if (item.vix_signal === 1) {
            const index = labels.indexOf(item.date);
            if (index !== -1) {
                signalPoints.push({
                    x: new Date(item.date),
                    y: twa00Values[index]
                });
            }
        }
    });

    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: 'TWA00',
                    data: twa00Values,
                    borderColor: 'blue',
                    backgroundColor: 'blue',
                    yAxisID: 'y'
                },
                {
                    type: 'line',
                    label: 'VIX',
                    data: vixValues,
                    borderColor: 'red',
                    backgroundColor: 'red',
                    yAxisID: 'y1'
                },
                {
                    type: 'scatter',
                    label: 'Signal Points',
                    data: signalPoints,
                    backgroundColor: 'green',
                    pointRadius: 5,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'VIX, VIX Signal & TWA00 綜合圖表'
                },
                legend: {
                    display: true
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'TWA00'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'VIX'
                    },
                    grid: {
                        drawOnChartArea: false,
                    }
                }
            }
        }
    });
}

async function init() {
    // Create special chart first
    await createSpecialChart();

    // Create charts for individual files
    for (const file of jsonFiles) {
        const data = await loadJSON(file);
        if (data) {
            const title = file.replace('.json', '').replace(/_/g, ' ').toUpperCase();
            const section = createChartSection(title);
            document.getElementById('charts-container').appendChild(section);
            const canvas = section.querySelector('canvas');
            createChart(canvas, data, title);
        }
    }
}

document.addEventListener('DOMContentLoaded', init);