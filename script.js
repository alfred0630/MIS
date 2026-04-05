console.log("中文版 script.js 已載入", new Date().toISOString());
alert("新版 script.js 已載入");
const repoOwner = "alfred0630";
const repoName = "MIS";
const branch = "main";
const baseUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${branch}/index/`;



const allJsonFiles = [
    { name: "vix", label: "VIX 指數" },

    { name: "call_oi", label: "台指選買權未沖銷" },
    { name: "put_oi", label: "台指選賣權未沖銷" },
    { name: "pcr", label: "PCR 比值 (近月)" },


    { name: "fi_3ind", label: "三大產業外資買賣超" },
    { name: "fi", label: "外資累計買賣超" },
    { name: "i1", label: "投信累計買賣超" },
    { name: "i2", label: "自營商累計買賣超" },


    { name: "law", label: "法人淨部位" },
    { name: "mob", label: "散戶淨部位" },
    { name: "foreign_net", label: "外資期貨淨部位" },


    { name: "mo_deviation", label: "上市櫃乖離差" },
    { name: "tech_fin_deviation", label: "電金乖離差" },
    { name: "tech_tra_deviation", label: "電傳乖離差" },
    { name: "tech_deviation", label: "電子乖離率" },


    
    { name: "weight_diff", label: "電子成交比重-市值比重" },

    { name: "upon_ratio", label: "季線上家數比重" },
    { name: "corr", label: "平均相關係數" },
];

const MAX_SELECTED = 4;
const DEFAULT_SELECTED = ["vix"];
const dataCache = new Map();
const chartInstances = new Map();
// Map of chartName -> overlay indicator name (or null)
const chartOverlays = new Map();


let selectedCharts = [...DEFAULT_SELECTED];
let currentRange = "1Y";
let customDateMode = false;

function formatDateInputValue(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function parseDateSafe(dateString) {
    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? null : date;
}

function hexToRgba(hex, alpha = 1) {
    const clean = hex.replace("#", "");
    const full = clean.length === 3
        ? clean.split("").map((ch) => ch + ch).join("")
        : clean;

    const r = parseInt(full.substring(0, 2), 16);
    const g = parseInt(full.substring(2, 4), 16);
    const b = parseInt(full.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getSeriesColor(index) {
    const palette = [
        "#3f5efb",
        "#22a06b",
        "#f59e0b",
        "#ef4444",
        "#7c3aed",
        "#0ea5e9",
        "#14b8a6",
        "#a855f7"
    ];
    return palette[index % palette.length];
}

function getSelectedMeta() {
    return allJsonFiles.filter((item) => selectedCharts.includes(item.name));
}

function getDisplayRangeText() {
    if (customDateMode) {
        const start = document.getElementById("start-date").value || "--";
        const end = document.getElementById("end-date").value || "--";
        return `${start} ~ ${end}`;
    }
    return currentRange;
}

function updateSummary() {
    const summaryText = document.getElementById("summary-text");
    const rangePill = document.getElementById("range-pill");
    const selectedMeta = getSelectedMeta();

    if (selectedMeta.length === 0) {
        summaryText.textContent = "請從左側選擇要顯示的圖表";
    } else {
        summaryText.textContent = `目前顯示 ${selectedMeta.length} 張圖：${selectedMeta.map((item) => item.label).join("、")}`;
    }

    rangePill.textContent = getDisplayRangeText();
    document.getElementById("selected-count").textContent = selectedMeta.length;
}

function updateSelectorDisabledState() {
    const checkedCount = selectedCharts.length;
    const allCheckboxes = document.querySelectorAll('.chart-option input[type="checkbox"]');

    allCheckboxes.forEach((checkbox) => {
        const wrapper = checkbox.closest(".chart-option");
        const shouldDisable = checkedCount >= MAX_SELECTED && !checkbox.checked;
        checkbox.disabled = shouldDisable;
        wrapper.classList.toggle("disabled", shouldDisable);
    });
}

function initChartSelector() {
    const selector = document.getElementById("chart-selector");
    selector.innerHTML = "";

    allJsonFiles.forEach((file) => {
        const row = document.createElement("div");
        row.className = "chart-option";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `chart-${file.name}`;
        checkbox.value = file.name;
        checkbox.checked = selectedCharts.includes(file.name);

        checkbox.addEventListener("change", (event) => {
            const { checked, value } = event.target;

            if (checked) {
                if (selectedCharts.length >= MAX_SELECTED) {
                    event.target.checked = false;
                    alert("最多只能同時顯示 4 張圖表。");
                    return;
                }
                selectedCharts.push(value);
            } else {
                selectedCharts = selectedCharts.filter((name) => name !== value);
            }

            updateSelectorDisabledState();
            updateSummary();
            renderCharts();
        });

        const label = document.createElement("label");
        label.setAttribute("for", checkbox.id);
        label.textContent = file.label;

        row.appendChild(checkbox);
        row.appendChild(label);
        selector.appendChild(row);
    });

    updateSelectorDisabledState();
}

async function loadJSON(filename) {
    if (dataCache.has(filename)) {
        return dataCache.get(filename);
    }

    try {
        const response = await fetch(baseUrl + filename);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const jsonData = await response.json();
        let converted = null;

        if (jsonData.index && Array.isArray(jsonData.index)) {
            const rows = [];
            const indices = jsonData.index;
            const dataObj = jsonData.data || {};

            if (Array.isArray(dataObj)) {
                indices.forEach((date, idx) => {
                    rows.push({
                        date: new Date(date).toISOString().split("T")[0],
                        [jsonData.name || "value"]: dataObj[idx]
                    });
                });
            } else if (typeof dataObj === "object" && dataObj !== null) {
                indices.forEach((date, idx) => {
                    const row = { date: new Date(date).toISOString().split("T")[0] };
                    Object.keys(dataObj).forEach((key) => {
                        if (Array.isArray(dataObj[key])) {
                            row[key] = dataObj[key][idx];
                        }
                    });
                    rows.push(row);
                });
            }

            converted = rows;
        } else if (Array.isArray(jsonData)) {
            converted = jsonData;
        } else {
            console.warn(`Unexpected data format for ${filename}`, jsonData);
            converted = null;
        }

        dataCache.set(filename, converted);
        return converted;
    } catch (error) {
        console.error(`Error loading ${filename}:`, error);
        dataCache.set(filename, null);
        return null;
    }
}

function getAllDatesFromData(data) {
    if (!Array.isArray(data)) return [];
    return data
        .map((item) => item.date)
        .filter(Boolean)
        .map((dateStr) => parseDateSafe(dateStr))
        .filter(Boolean)
        .sort((a, b) => a - b);
}

function getCurrentDateBounds() {
    const allDates = [];

    dataCache.forEach((data, key) => {
        if (!data) return;
        if (key === "vix.json" || key === "vix_signal.json" || key === "twa00.json") {
            allDates.push(...getAllDatesFromData(data));
        } else {
            allDates.push(...getAllDatesFromData(data));
        }
    });

    if (allDates.length === 0) {
        return null;
    }

    return {
        minDate: allDates[0],
        maxDate: allDates[allDates.length - 1]
    };
}

function getRangeDates() {
    const bounds = getCurrentDateBounds();
    if (!bounds) return null;

    const { minDate, maxDate } = bounds;

    if (customDateMode) {
        const startInput = document.getElementById("start-date").value;
        const endInput = document.getElementById("end-date").value;
        const startDate = startInput ? parseDateSafe(startInput) : minDate;
        const endDate = endInput ? parseDateSafe(endInput) : maxDate;

        if (!startDate || !endDate) return { startDate: minDate, endDate: maxDate };

        return {
            startDate: startDate < minDate ? minDate : startDate,
            endDate: endDate > maxDate ? maxDate : endDate
        };
    }

    if (currentRange === "ALL") {
        return { startDate: minDate, endDate: maxDate };
    }

    const years = parseInt(currentRange.replace("Y", ""), 10);
    const startDate = new Date(maxDate);
    startDate.setFullYear(startDate.getFullYear() - years);

    return {
        startDate: startDate < minDate ? minDate : startDate,
        endDate: maxDate
    };
}

function filterDataByDateRange(data) {
    if (!Array.isArray(data) || data.length === 0) return [];

    const range = getRangeDates();
    if (!range) return data;

    const { startDate, endDate } = range;

    return data.filter((row) => {
        const rowDate = parseDateSafe(row.date);
        if (!rowDate) return false;
        return rowDate >= startDate && rowDate <= endDate;
    });
}

function syncDateInputsWithRange() {
    const bounds = getCurrentDateBounds();
    if (!bounds) return;

    const { minDate, maxDate } = bounds;
    const startInput = document.getElementById("start-date");
    const endInput = document.getElementById("end-date");

    let startDate = minDate;
    let endDate = maxDate;

    if (!customDateMode) {
        const range = getRangeDates();
        if (range) {
            startDate = range.startDate;
            endDate = range.endDate;
        }
    } else {
        const customRange = getRangeDates();
        if (customRange) {
            startDate = customRange.startDate;
            endDate = customRange.endDate;
        }
    }

    startInput.min = formatDateInputValue(minDate);
    startInput.max = formatDateInputValue(maxDate);
    endInput.min = formatDateInputValue(minDate);
    endInput.max = formatDateInputValue(maxDate);

    startInput.value = formatDateInputValue(startDate);
    endInput.value = formatDateInputValue(endDate);
}

function destroyAllCharts() {
    chartInstances.forEach((chart) => chart.destroy());
    chartInstances.clear();
}

function createChartCard(fileObj, chartCount) {
    const card = document.createElement("article");
    card.className = `chart-card ${getHeightClass(chartCount)}`;
    card.dataset.chartName = fileObj.name;

    const isVix = fileObj.name === "vix";
    const currentOverlay = chartOverlays.get(fileObj.name) || null;
    const overlayMeta = currentOverlay ? allJsonFiles.find(f => f.name === currentOverlay) : null;

    // Build title: label + optional overlay badge
    const titleHtml = isVix
        ? `<h3 class="chart-card-title">${fileObj.label}</h3>`
        : `<h3 class="chart-card-title">
               ${fileObj.label}
               ${overlayMeta ? `<span class="overlay-badge">${overlayMeta.label}<button class="overlay-remove-btn" data-chart="${fileObj.name}" title="移除疊加指標">✕</button></span>` : ""}
               <button class="add-overlay-btn" data-chart="${fileObj.name}" title="疊加第二指標">＋</button>
           </h3>`;

    card.innerHTML = `
        <div class="chart-card-header">
            <div class="chart-card-title-wrap">
                ${titleHtml}
                <div class="chart-card-subtitle">依所選時間區間顯示歷史走勢</div>
            </div>
            <div class="chart-card-tag">${getDisplayRangeText()}</div>
        </div>
        <div class="chart-body">
            <canvas id="chart-canvas-${fileObj.name}"></canvas>
        </div>
        ${!isVix ? `<div class="overlay-dropdown hidden" id="overlay-dropdown-${fileObj.name}">
            <div class="overlay-dropdown-title">選擇疊加指標（右軸）</div>
            <div class="overlay-options">
                ${allJsonFiles
                    .filter(f => f.name !== fileObj.name)
                    .map(f => `<button class="overlay-option-btn ${currentOverlay === f.name ? "selected" : ""}" data-chart="${fileObj.name}" data-overlay="${f.name}">${f.label}</button>`)
                    .join("")}
            </div>
        </div>` : ""}
    `;

    // Bind events after inserting HTML
    if (!isVix) {
        const addBtn = card.querySelector(".add-overlay-btn");
        const dropdown = card.querySelector(`#overlay-dropdown-${fileObj.name}`);

        addBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            // Close all other dropdowns
            document.querySelectorAll(".overlay-dropdown").forEach(d => {
                if (d !== dropdown) d.classList.add("hidden");
            });
            dropdown.classList.toggle("hidden");
        });

        card.querySelectorAll(".overlay-option-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const overlayName = btn.dataset.overlay;
                const chartName = btn.dataset.chart;
                chartOverlays.set(chartName, overlayName);
                dropdown.classList.add("hidden");
                await reRenderSingleChart(chartName);
            });
        });

        const removeBtn = card.querySelector(".overlay-remove-btn");
        if (removeBtn) {
            removeBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const chartName = removeBtn.dataset.chart;
                chartOverlays.delete(chartName);
                await reRenderSingleChart(chartName);
            });
        }
    }

    return card;
}

// Close dropdowns when clicking outside
document.addEventListener("click", () => {
    document.querySelectorAll(".overlay-dropdown").forEach(d => d.classList.add("hidden"));
});

function getHeightClass(chartCount) {
    if (chartCount === 1) return "one-chart";
    if (chartCount === 2) return "two-charts";
    if (chartCount === 3) return "three-charts";
    return "four-charts";
}

function getStandardDatasets(data) {
    const labels = data.map((item) => item.date);
    const keys = Object.keys(data[0] || {}).filter((key) => key !== "date");

    const datasets = keys.map((key, index) => {
        const color = getSeriesColor(index);
        return {
            label: key,
            data: data.map((item) => {
                const value = item[key];
                return value === null || value === undefined ? null : value;
            }),
            borderColor: color,
            backgroundColor: hexToRgba(color, 0.12),
            borderWidth: 2,
            tension: 0.22,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: false,
            spanGaps: true
        };
    });

    return { labels, datasets };
}

function getCommonChartOptions(hasDualAxis = false) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: "index",
            intersect: false
        },
        animation: false,
        plugins: {
            legend: {
                display: true,
                position: "top",
                align: "start",
                labels: {
                    usePointStyle: true,
                    pointStyle: "line",
                    boxWidth: 28,
                    color: "#44526b",
                    font: {
                        size: 12,
                        weight: 600
                    },
                    padding: 16
                }
            },
            tooltip: {
                backgroundColor: "rgba(26, 37, 63, 0.96)",
                titleColor: "#ffffff",
                bodyColor: "#ecf2ff",
                padding: 12,
                displayColors: true,
                borderColor: "rgba(255,255,255,0.08)",
                borderWidth: 1
            }
        },
        scales: {
            x: {
                ticks: {
                    maxTicksLimit: 8,
                    color: "#7a889f",
                    font: {
                        size: 11
                    }
                },
                grid: {
                    display: false,
                    drawBorder: false
                },
                border: {
                    display: false
                }
            },
            y: {
                position: "left",
                ticks: {
                    color: "#7a889f",
                    font: {
                        size: 11
                    }
                },
                grid: {
                    color: "#edf2f8",
                    drawBorder: false
                },
                border: {
                    display: false
                }
            },
            ...(hasDualAxis
                ? {
                      y1: {
                          type: "linear",
                          position: "right",
                          ticks: {
                              color: "#7a889f",
                              font: {
                                  size: 11
                              }
                          },
                          grid: {
                              display: false
                          },
                          border: {
                              display: false
                          }
                      }
                  }
                : {})
        }
    };
}

function createStandardChart(canvas, data, overlayData = null, overlayLabel = null) {
    const { labels, datasets } = getStandardDatasets(data);

    // If overlay data provided, add as right-axis dataset
    if (overlayData && overlayData.length > 0) {
        const overlayKeys = Object.keys(overlayData[0] || {}).filter(k => k !== "date");
        // Align overlay data to primary labels
        const overlayMap = new Map(overlayData.map(row => [row.date, row]));
        overlayKeys.forEach((key, i) => {
            const color = getSeriesColor(datasets.length + i);
            datasets.push({
                label: overlayLabel ? `${overlayLabel}` : key,
                data: labels.map(date => {
                    const row = overlayMap.get(date);
                    if (!row) return null;
                    const val = row[key];
                    return val === null || val === undefined ? null : val;
                }),
                borderColor: color,
                backgroundColor: hexToRgba(color, 0.12),
                borderWidth: 2,
                tension: 0.22,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: false,
                spanGaps: true,
                yAxisID: "y1"
            });
        });
    }

    const hasDual = overlayData && overlayData.length > 0;
    return new Chart(canvas.getContext("2d"), {
        type: "line",
        data: { labels, datasets },
        options: getCommonChartOptions(hasDual)
    });
}

async function reRenderSingleChart(chartName) {
    // Destroy existing chart instance
    if (chartInstances.has(chartName)) {
        chartInstances.get(chartName).destroy();
        chartInstances.delete(chartName);
    }

    const fileObj = allJsonFiles.find(f => f.name === chartName);
    if (!fileObj) return;

    // Re-create the card in place
    const existingCard = document.querySelector(`[data-chart-name="${chartName}"]`);
    if (!existingCard) return;

    const chartCount = selectedCharts.length;
    const newCard = createChartCard(fileObj, chartCount);
    existingCard.replaceWith(newCard);

    const canvas = newCard.querySelector("canvas");
    try {
        const rawData = await loadJSON(`${fileObj.name}.json`);
        if (!rawData || rawData.length === 0) throw new Error("No data");
        const filteredData = filterDataByDateRange(rawData);

        const overlayName = chartOverlays.get(chartName);
        let overlayFiltered = null;
        let overlayLabel = null;
        if (overlayName) {
            const overlayMeta = allJsonFiles.find(f => f.name === overlayName);
            overlayLabel = overlayMeta ? overlayMeta.label : overlayName;
            const overlayRaw = await loadJSON(`${overlayName}.json`);
            if (overlayRaw) overlayFiltered = filterDataByDateRange(overlayRaw);
        }

        const chart = createStandardChart(canvas, filteredData, overlayFiltered, overlayLabel);
        chartInstances.set(chartName, chart);
    } catch (err) {
        console.error(`Error re-rendering ${chartName}:`, err);
        newCard.querySelector(".chart-body").innerHTML = `<div class="chart-error">無法顯示圖表資料：${fileObj.label}</div>`;
    }
}

async function createSpecialChart(canvas) {
    const [vixDataRaw, vixSignalDataRaw, twa00DataRaw] = await Promise.all([
        loadJSON("vix.json"),
        loadJSON("vix_signal.json"),
        loadJSON("twa00.json")
    ]);

    if (!vixDataRaw || !vixSignalDataRaw || !twa00DataRaw) {
        throw new Error("Failed to load VIX related data");
    }

    const vixData = filterDataByDateRange(vixDataRaw);
    const vixSignalData = filterDataByDateRange(vixSignalDataRaw);
    const twa00Data = filterDataByDateRange(twa00DataRaw);

    const labels = vixData.map((item) => item.date);

    const vixValues = vixData.map((item) => {
        const key = Object.keys(item).find((k) => k !== "date");
        return item[key];
    });

    const twa00Values = twa00Data.map((item) => {
        const key = Object.keys(item).find((k) => k !== "date");
        return item[key];
    });

    const signalPoints = [];
    const twa00Map = new Map(
        twa00Data.map((item) => {
            const key = Object.keys(item).find((k) => k !== "date");
            return [item.date, item[key]];
        })
    );

    vixSignalData.forEach((item) => {
        const sigKey = Object.keys(item).find((k) => k !== "date");
        if (item[sigKey] === 1 && twa00Map.has(item.date)) {
            signalPoints.push({
                x: item.date,
                y: twa00Map.get(item.date)
            });
        }
    });

    return new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "TWA00",
                    data: twa00Values,
                    borderColor: "#3f5efb",
                    backgroundColor: hexToRgba("#3f5efb", 0.12),
                    borderWidth: 2.2,
                    yAxisID: "y",
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.22,
                    fill: false,
                    spanGaps: true
                },
                {
                    label: "VIX",
                    data: vixValues,
                    borderColor: "#f59e0b",
                    backgroundColor: hexToRgba("#f59e0b", 0.12),
                    borderWidth: 2,
                    yAxisID: "y1",
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.22,
                    fill: false,
                    spanGaps: true
                },
                {
                    type: "scatter",
                    label: "Signal",
                    data: signalPoints,
                    backgroundColor: "#15a36d",
                    borderColor: "#15a36d",
                    pointRadius: 4,
                    pointHoverRadius: 5,
                    yAxisID: "y",
                    showLine: false
                }
            ]
        },
        options: getCommonChartOptions(true)
    });
}

async function renderCharts() {
    destroyAllCharts();

    const chartsContainer = document.getElementById("charts-container");
    const emptyState = document.getElementById("empty-state");
    const selectedMeta = getSelectedMeta();
    const chartCount = selectedMeta.length;

    chartsContainer.innerHTML = "";

    if (chartCount === 0) {
        chartsContainer.classList.add("hidden");
        emptyState.classList.remove("hidden");
        updateSummary();
        return;
    }

    emptyState.classList.add("hidden");
    chartsContainer.classList.remove("hidden");

    for (const fileObj of selectedMeta) {
        const card = createChartCard(fileObj, chartCount);
        chartsContainer.appendChild(card);
        const canvas = card.querySelector("canvas");

        try {
            if (fileObj.name === "vix") {
                const chart = await createSpecialChart(canvas);
                chartInstances.set(fileObj.name, chart);
            } else {
                const rawData = await loadJSON(`${fileObj.name}.json`);
                if (!rawData || rawData.length === 0) {
                    throw new Error("No data loaded");
                }

                const filteredData = filterDataByDateRange(rawData);
                if (!filteredData || filteredData.length === 0) {
                    throw new Error("Selected date range has no data");
                }

                const overlayName = chartOverlays.get(fileObj.name);
                let overlayFiltered = null;
                let overlayLabel = null;
                if (overlayName) {
                    const overlayMeta = allJsonFiles.find(f => f.name === overlayName);
                    overlayLabel = overlayMeta ? overlayMeta.label : overlayName;
                    const overlayRaw = await loadJSON(`${overlayName}.json`);
                    if (overlayRaw) overlayFiltered = filterDataByDateRange(overlayRaw);
                }

                const chart = createStandardChart(canvas, filteredData, overlayFiltered, overlayLabel);
                chartInstances.set(fileObj.name, chart);
            }
        } catch (error) {
            console.error(`Error rendering chart ${fileObj.name}:`, error);
            card.querySelector(".chart-body").innerHTML = `
                <div class="chart-error">
                    無法顯示圖表資料：${fileObj.label}
                </div>
            `;
        }
    }

    updateSummary();
}

function setPresetActive(rangeValue) {
    document.querySelectorAll(".preset-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.range === rangeValue);
    });
}

function bindPresetButtons() {
    document.querySelectorAll(".preset-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            currentRange = btn.dataset.range;
            customDateMode = false;
            setPresetActive(currentRange);
            syncDateInputsWithRange();
            updateSummary();
            renderCharts();
        });
    });
}

function bindDateActions() {
    document.getElementById("apply-date-btn").addEventListener("click", () => {
        const startValue = document.getElementById("start-date").value;
        const endValue = document.getElementById("end-date").value;

        if (!startValue || !endValue) {
            alert("請先選擇開始與結束日期。");
            return;
        }

        const startDate = parseDateSafe(startValue);
        const endDate = parseDateSafe(endValue);

        if (!startDate || !endDate) {
            alert("日期格式不正確。");
            return;
        }

        if (startDate > endDate) {
            alert("開始日期不能晚於結束日期。");
            return;
        }

        customDateMode = true;
        document.querySelectorAll(".preset-btn").forEach((btn) => btn.classList.remove("active"));
        updateSummary();
        renderCharts();
    });

    document.getElementById("reset-date-btn").addEventListener("click", () => {
        customDateMode = false;
        currentRange = "1Y";
        setPresetActive(currentRange);
        syncDateInputsWithRange();
        updateSummary();
        renderCharts();
    });
}

async function preloadInitialData() {
    const initialFiles = new Set([
        ...selectedCharts.map((name) => `${name}.json`),
        "vix.json",
        "vix_signal.json",
        "twa00.json"
    ]);

    await Promise.all(
        [...initialFiles].map(async (filename) => {
            await loadJSON(filename);
        })
    );
}

async function init() {
    initChartSelector();
    bindPresetButtons();
    bindDateActions();
    await preloadInitialData();
    syncDateInputsWithRange();
    updateSummary();
    await renderCharts();
}

document.addEventListener("DOMContentLoaded", init);