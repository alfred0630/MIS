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

let currentPageIndex = 0;
const chartsPerPage = 4;

async function loadJSON(filename) {
    try {
        const response = await fetch(baseUrl + filename);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const jsonData = await response.json();
        
        // Convert from separated index/data format to array of objects
        if (jsonData.index && Array.isArray(jsonData.index)) {
            // Handle format: { name: "...", index: [...], data: [...] } or { index: [...], data: {...} }
            const converted = [];
            const dataObj = jsonData.data || {};
            const indices = jsonData.index;
            
            if (Array.isArray(dataObj)) {
                // data is array: simple single-column case
                indices.forEach((date, idx) => {
                    converted.push({
                        date: new Date(date).toISOString().split('T')[0],
                        [jsonData.name || 'value']: dataObj[idx]
                    });
                });
            } else if (typeof dataObj === 'object') {
                // data is object with multiple columns
                indices.forEach((date, idx) => {
                    const row = { date: new Date(date).toISOString().split('T')[0] };
                    Object.keys(dataObj).forEach(key => {
                        if (Array.isArray(dataObj[key])) {
                            row[key] = dataObj[key][idx];
                        }
                    });
                    converted.push(row);
                });
            }
            return converted;
        }
        
        // Handle standard array format
        if (Array.isArray(jsonData)) {
            return jsonData;
        }
        
        console.warn(`Unexpected data format for ${filename}`, jsonData);
        return null;
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

function createChart(canvas, data, title) {
    if (!canvas || !data || data.length === 0) return null;
    
    try {
        const ctx = canvas.getContext('2d');
        const labels = data.map(item => item.date);
        const datasets = [];

        // Get all keys except 'date'
        const keys = Object.keys(data[0]).filter(key => key !== 'date');

        const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#34495e', '#e67e22'];
        
        keys.forEach((key, index) => {
            const values = data.map(item => {
                const val = item[key];
                return val !== null && val !== undefined ? val : null;
            });
            datasets.push({
                label: key,
                data: values,
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length] + '20',
                borderWidth: 2,
                fill: false,
                tension: 0.1,
                pointRadius: 0,
                pointHoverRadius: 5
            });
        });

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        display: true,
                        grid: {
                            color: '#f0f0f0'
                        }
                    }
                }
            }
        });
        return chart;
    } catch (error) {
        console.error(`Error creating chart for ${title}:`, error);
        return null;
    }
}

async function createSpecialChart(canvas) {
    const [vixData, vixSignalData, twa00Data] = await Promise.all([
        loadJSON('vix.json'),
        loadJSON('vix_signal.json'),
        loadJSON('twa00.json')
    ]);

    if (!vixData || !vixSignalData || !twa00Data) {
        console.error('Failed to load special chart data');
        return null;
    }

    try {
        const ctx = canvas.getContext('2d');
        const labels = vixData.map(item => item.date);
        
        // Extract values from flexible key structure
        const vixValues = vixData.map(item => {
            const key = Object.keys(item).find(k => k !== 'date');
            return item[key];
        });
        
        const twa00Values = twa00Data.map(item => {
            const key = Object.keys(item).find(k => k !== 'date');
            return item[key];
        });

        // Create signal points where vix_signal == 1
        const signalPoints = [];
        vixSignalData.forEach(item => {
            const date = item.date;
            const dateIdx = labels.indexOf(date);
            const sigKey = Object.keys(item).find(k => k !== 'date');
            if (dateIdx !== -1 && item[sigKey] === 1) {
                signalPoints.push({
                    x: date,
                    y: twa00Values[dateIdx]
                });
            }
        });

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'TWA00',
                        data: twa00Values,
                        borderColor: '#3498db',
                        backgroundColor: '#3498db20',
                        borderWidth: 2,
                        yAxisID: 'y',
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        tension: 0.1,
                        fill: false
                    },
                    {
                        label: 'VIX',
                        data: vixValues,
                        borderColor: '#e74c3c',
                        backgroundColor: '#e74c3c20',
                        borderWidth: 2,
                        yAxisID: 'y1',
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        tension: 0.1,
                        fill: false
                    },
                    {
                        type: 'scatter',
                        label: 'Signal Points',
                        data: signalPoints,
                        backgroundColor: '#2ecc71',
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        yAxisID: 'y',
                        showLine: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: {
                            display: true,
                            text: 'TWA00'
                        },
                        grid: {
                            color: '#f0f0f0'
                        }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        title: {
                            display: true,
                            text: 'VIX'
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
        return chart;
    } catch (error) {
        console.error('Error creating special chart:', error);
        return null;
    }
}

async function renderPage(pageIndex) {
    const chartsContainer = document.getElementById('charts-container');
    chartsContainer.innerHTML = '';

    const startIdx = pageIndex * chartsPerPage;
    const endIdx = Math.min(startIdx + chartsPerPage, allJsonFiles.length);
    const filesToLoad = allJsonFiles.slice(startIdx, endIdx);

    for (const fileObj of filesToLoad) {
        const section = createChartSection(fileObj.label);
        chartsContainer.appendChild(section);
        const canvas = section.querySelector('canvas');

        if (fileObj.name === 'vix') {
            await createSpecialChart(canvas);
        } else {
            const data = await loadJSON(fileObj.name + '.json');
            if (data) {
                createChart(canvas, data, fileObj.label);
            } else {
                canvas.style.display = 'none';
                section.innerHTML += '<p style="color: #e74c3c; padding: 1rem;">Failed to load chart data</p>';
            }
        }
    }

    updatePaginationButtons();
}

function updatePaginationButtons() {
    const totalPages = Math.ceil(allJsonFiles.length / chartsPerPage);
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const pageInfo = document.getElementById('page-info');

    prevBtn.disabled = currentPageIndex === 0;
    nextBtn.disabled = currentPageIndex === totalPages - 1;
    pageInfo.textContent = `Page ${currentPageIndex + 1} of ${totalPages}`;
}

function goToPreviousPage() {
    if (currentPageIndex > 0) {
        currentPageIndex--;
        renderPage(currentPageIndex);
    }
}

function goToNextPage() {
    const totalPages = Math.ceil(allJsonFiles.length / chartsPerPage);
    if (currentPageIndex < totalPages - 1) {
        currentPageIndex++;
        renderPage(currentPageIndex);
    }
}

function selectChart(index) {
    currentPageIndex = Math.floor(index / chartsPerPage);
    renderPage(currentPageIndex);
    document.querySelectorAll('.sidebar-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-index="${index}"]`).classList.add('active');
}

async function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    allJsonFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'sidebar-item';
        item.textContent = file.label;
        item.setAttribute('data-index', index);
        item.onclick = () => selectChart(index);
        sidebar.appendChild(item);
    });
}

async function init() {
    await initSidebar();
    await renderPage(0);
    
    // Connect button events
    document.getElementById('prev-btn').addEventListener('click', goToPreviousPage);
    document.getElementById('next-btn').addEventListener('click', goToNextPage);
}

document.addEventListener('DOMContentLoaded', init);