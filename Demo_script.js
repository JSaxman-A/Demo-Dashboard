// ===== DATA STORAGE =====
let allData = {
    november: [],
    october: [],
    total: []
};
let currentPeriod = 'november';
let currentAgent = 'all';
let charts = {};

// ===== UTILITY FUNCTIONS =====
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

function formatCurrencyShort(value) {
    if (value === null || value === undefined || isNaN(value)) return '$0';
    if (Math.abs(value) >= 1000000) {
        return '$' + (value / 1000000).toFixed(2) + 'M';
    }
    if (Math.abs(value) >= 1000) {
        return '$' + (value / 1000).toFixed(0) + 'K';
    }
    return formatCurrency(value);
}

function formatNumber(value) {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return new Intl.NumberFormat('en-US').format(Math.round(value));
}

function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',');
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                let value = values[index];
                if (value && value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                row[header.trim()] = value;
            });
            data.push(row);
        }
    }
    return data;
}

// ===== DATA LOADING =====
async function loadData() {
    try {
        const novResponse = await fetch('Demo_11_25_Master_Report_cleaned.csv');
        const novText = await novResponse.text();
        allData.november = parseCSV(novText);
        
        const octResponse = await fetch('Demo_10_25_Master_Report_cleaned.csv');
        const octText = await octResponse.text();
        allData.october = parseCSV(octText);
        
        // Create total dataset
        allData.total = [...allData.october, ...allData.november];
        
        console.log('Data loaded:', {
            november: allData.november.length,
            october: allData.october.length,
            total: allData.total.length
        });
        
        populateFilters();
        updateDashboard();
        
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading data files. Please ensure CSV files are uploaded.');
    }
}

// ===== FILTERS =====
function populateFilters() {
    const allAgents = new Set();
    allData.november.forEach(r => r.Rep && allAgents.add(r.Rep));
    allData.october.forEach(r => r.Rep && allAgents.add(r.Rep));
    const agents = Array.from(allAgents).sort();
    
    const agentSelect = document.getElementById('agentSelect');
    agentSelect.innerHTML = '<option value="all">All Agents</option>';
    agents.forEach(agent => {
        const option = document.createElement('option');
        option.value = agent;
        option.textContent = agent;
        agentSelect.appendChild(option);
    });
}

function getCurrentData() {
    let data = allData[currentPeriod] || [];
    if (currentAgent !== 'all') {
        data = data.filter(r => r.Rep === currentAgent);
    }
    return data;
}

function getPreviousData() {
    // Handle October special case - no previous data
    if (currentPeriod === 'october') {
        return null;
    }
    
    // For November, previous is October
    if (currentPeriod === 'november') {
        let data = allData.october || [];
        if (currentAgent !== 'all') {
            data = data.filter(r => r.Rep === currentAgent);
        }
        return data;
    }
    
    // For total view, no comparison
    return null;
}

// ===== DASHBOARD UPDATE =====
function updateDashboard() {
    updateKPIs();
    updateCharts();
    updateTopTable();
    updateAllTables();
    updateValuation();
    updateAnalytics();
    updateActiveNav();
}

function updateKPIs() {
    const current = getCurrentData();
    const previous = getPreviousData();
    
    const totalResiduals = current.reduce((sum, r) => sum + parseFloat(r['Net Residual'] || 0), 0);
    const totalVolume = current.reduce((sum, r) => sum + parseFloat(r['Sales Volume'] || 0), 0);
    
    // Active Merchants: Count ALL unique MIDs (regardless of sales volume)
    let activeMerchants;
    if (currentPeriod === 'total') {
        // For total period, count unique MIDs across both months
        const uniqueMIDs = new Set();
        current.forEach(r => {
            if (r.MID) uniqueMIDs.add(r.MID);
        });
        activeMerchants = uniqueMIDs.size;
    } else {
        // For single period, count all unique MIDs
        const uniqueMIDs = new Set(current.map(r => r.MID).filter(Boolean));
        activeMerchants = uniqueMIDs.size;
    }
    
    const avgPerMerchant = activeMerchants > 0 ? totalResiduals / activeMerchants : 0;
    
    // Update values
    document.getElementById('totalResiduals').textContent = formatCurrencyShort(totalResiduals);
    document.getElementById('activeMerchants').textContent = formatNumber(activeMerchants);
    document.getElementById('avgPerMerchant').textContent = formatCurrencyShort(avgPerMerchant);
    document.getElementById('processingVolume').textContent = formatCurrencyShort(totalVolume);
    
    // Handle comparisons
    if (previous && previous.length > 0) {
        const prevResiduals = previous.reduce((sum, r) => sum + parseFloat(r['Net Residual'] || 0), 0);
        const prevVolume = previous.reduce((sum, r) => sum + parseFloat(r['Sales Volume'] || 0), 0);
        
        // Count ALL unique MIDs in previous period (same logic as current)
        const prevUniqueMIDs = new Set(previous.map(r => r.MID).filter(Boolean));
        const prevActive = prevUniqueMIDs.size;
        
        const prevAvg = prevActive > 0 ? prevResiduals / prevActive : 0;
        
        const residualChange = prevResiduals !== 0 ? ((totalResiduals - prevResiduals) / Math.abs(prevResiduals) * 100) : 0;
        const merchantChange = activeMerchants - prevActive;
        const avgChange = prevAvg !== 0 ? ((avgPerMerchant - prevAvg) / Math.abs(prevAvg) * 100) : 0;
        const volumeChange = prevVolume !== 0 ? ((totalVolume - prevVolume) / Math.abs(prevVolume) * 100) : 0;
        
        updateKPIBadge('residualBadge', residualChange);
        updateKPIBadge('merchantBadge', merchantChange, false);
        updateKPIBadge('avgBadge', avgChange);
        updateKPIBadge('volumeBadge', volumeChange);
        
        document.getElementById('residualSubtext').textContent = 'vs ' + formatCurrencyShort(prevResiduals) + ' previous period';
        document.getElementById('merchantSubtext').textContent = prevActive + ' previous period';
        document.getElementById('avgSubtext').textContent = 'vs ' + formatCurrencyShort(prevAvg) + ' previous';
        document.getElementById('volumeSubtext').textContent = 'vs ' + formatCurrencyShort(prevVolume) + ' previous';
    } else {
        // No previous data (October or Total view)
        document.getElementById('residualBadge').textContent = 'N/A';
        document.getElementById('residualBadge').className = 'kpi-badge neutral';
        document.getElementById('merchantBadge').textContent = 'N/A';
        document.getElementById('merchantBadge').className = 'kpi-badge neutral';
        document.getElementById('avgBadge').textContent = 'N/A';
        document.getElementById('avgBadge').className = 'kpi-badge neutral';
        document.getElementById('volumeBadge').textContent = 'N/A';
        document.getElementById('volumeBadge').className = 'kpi-badge neutral';
        
        document.getElementById('residualSubtext').textContent = 'current period';
        document.getElementById('merchantSubtext').textContent = 'all unique MIDs';
        document.getElementById('avgSubtext').textContent = 'total residuals ÷ all merchants';
        document.getElementById('volumeSubtext').textContent = 'total volume';
    }
}

function updateKPIBadge(elementId, value, isPercentage = true) {
    const badge = document.getElementById(elementId);
    const formatted = isPercentage ? 
        (value >= 0 ? '+' : '') + value.toFixed(1) + '%' :
        (value >= 0 ? '+' : '') + formatNumber(value);
    
    badge.textContent = formatted;
    badge.className = 'kpi-badge ' + (value >= 0 ? 'positive' : 'negative');
}

// ===== CHARTS =====
function updateCharts() {
    updateResidualChart();
    updateAgentPieChart();
    updateTop10BarChart();
}

function updateResidualChart() {
    const ctx = document.getElementById('residualChart');
    if (!ctx) return;
    
    if (charts.residual) charts.residual.destroy();
    
    // Get filtered data for both periods
    let octData = allData.october || [];
    let novData = allData.november || [];
    
    if (currentAgent !== 'all') {
        octData = octData.filter(r => r.Rep === currentAgent);
        novData = novData.filter(r => r.Rep === currentAgent);
    }
    
    const octTotal = octData.reduce((sum, r) => sum + parseFloat(r['Net Residual'] || 0), 0);
    const novTotal = novData.reduce((sum, r) => sum + parseFloat(r['Net Residual'] || 0), 0);
    
    charts.residual = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['October', 'November'],
            datasets: [{
                label: 'Net Residuals',
                data: [octTotal, novTotal],
                borderColor: '#ff9900',
                backgroundColor: 'rgba(255, 153, 0, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 6,
                pointBackgroundColor: '#ff9900',
                pointBorderColor: '#0A0A0A',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: 2,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1A1A1A',
                    titleColor: '#FFFFFF',
                    bodyColor: '#A0A0A0',
                    borderColor: '#ff9900',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: (context) => 'Residuals: ' + formatCurrency(context.parsed.y)
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#A0A0A0',
                        callback: (value) => formatCurrencyShort(value)
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#A0A0A0' }
                }
            }
        }
    });
}

function updateAgentPieChart() {
    const ctx = document.getElementById('agentPieChart');
    if (!ctx) return;
    
    if (charts.agentPie) charts.agentPie.destroy();
    
    const data = getCurrentData();
    const agentTotals = {};
    
    data.forEach(r => {
        const agent = r.Rep || 'Unknown';
        const residual = parseFloat(r['Net Residual'] || 0);
        agentTotals[agent] = (agentTotals[agent] || 0) + residual;
    });
    
    const sorted = Object.entries(agentTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const colors = [
        '#ff9900', '#ff8800', '#ff7700', '#ff6600', '#ff5500',
        '#ff4400', '#ff3300', '#ff2200', '#ff1100', '#ff0000'
    ];
    
    charts.agentPie = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sorted.map(([agent]) => agent),
            datasets: [{
                data: sorted.map(([, total]) => total),
                backgroundColor: colors,
                borderColor: '#0A0A0A',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: 1,
            layout: {
                padding: {
                    bottom: 10
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: '#A0A0A0',
                        padding: 8,
                        font: { 
                            size: 10
                        },
                        boxWidth: 12,
                        boxHeight: 12,
                        generateLabels: function(chart) {
                            const data = chart.data;
                            return data.labels.map((label, i) => {
                                // Truncate long names
                                const shortLabel = label.length > 20 ? label.substring(0, 18) + '...' : label;
                                return {
                                    text: shortLabel,
                                    fillStyle: data.datasets[0].backgroundColor[i],
                                    hidden: false,
                                    index: i
                                };
                            });
                        }
                    },
                    maxHeight: 120
                },
                tooltip: {
                    callbacks: {
                        label: (context) => context.label + ': ' + formatCurrency(context.parsed)
                    }
                }
            }
        }
    });
}

function updateTop10BarChart() {
    const ctx = document.getElementById('top10BarChart');
    if (!ctx) return;
    
    if (charts.top10Bar) charts.top10Bar.destroy();
    
    const data = getCurrentData();
    const top10 = data
        .sort((a, b) => parseFloat(b['Net Residual'] || 0) - parseFloat(a['Net Residual'] || 0))
        .slice(0, 10);
    
    charts.top10Bar = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top10.map(r => r.DBA || 'Unknown'),
            datasets: [{
                label: 'Net Residual',
                data: top10.map(r => parseFloat(r['Net Residual'] || 0)),
                backgroundColor: '#ff9900',
                borderColor: '#ff8800',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: 2,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => formatCurrency(context.parsed.x)
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#A0A0A0',
                        callback: (value) => formatCurrencyShort(value)
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#A0A0A0', font: { size: 11 } }
                }
            }
        }
    });
}

// ===== TABLES =====
function updateTopTable() {
    const tbody = document.getElementById('topMerchantsTable');
    if (!tbody) return;
    
    const data = getCurrentData();
    const top10 = data
        .sort((a, b) => parseFloat(b['Net Residual'] || 0) - parseFloat(a['Net Residual'] || 0))
        .slice(0, 10);
    
    tbody.innerHTML = top10.map(r => {
        const residual = parseFloat(r['Net Residual'] || 0);
        const residualClass = residual < 0 ? 'negative' : 'positive';
        
        return `
            <tr>
                <td>
                    <div class="merchant-cell">
                        <div class="merchant-avatar">${(r.DBA || 'UN').substring(0, 2).toUpperCase()}</div>
                        <span>${r.DBA || 'Unknown'}</span>
                    </div>
                </td>
                <td><code class="mid-code">${(r.MID || '').substring(0, 12)}</code></td>
                <td>${r.Rep || 'Unknown'}</td>
                <td><strong>${formatCurrency(parseFloat(r['Sales Volume'] || 0))}</strong></td>
                <td><strong class="${residualClass}">${formatCurrency(residual)}</strong></td>
            </tr>
        `;
    }).join('');
}

function updateAllTables() {
    updateMasterTable();
    updateNegativeTable();
    updateChangesTable();
}

function updateMasterTable() {
    const tbody = document.getElementById('masterTable');
    if (!tbody) return;
    
    const data = getCurrentData();
    document.getElementById('masterRecordCount').textContent = `Showing ${data.length} merchants`;
    
    tbody.innerHTML = data.map(r => {
        const residual = parseFloat(r['Net Residual'] || 0);
        const residualClass = residual < 0 ? 'negative' : '';
        
        return `
            <tr>
                <td>${r.DBA || 'Unknown'}</td>
                <td><code class="mid-code">${(r.MID || '').substring(0, 12)}</code></td>
                <td>${r.Rep || 'Unknown'}</td>
                <td>${r.Pricing || 'N/A'}</td>
                <td>${formatCurrency(parseFloat(r['Sales Volume'] || 0))}</td>
                <td>${formatNumber(parseFloat(r['Transaction Count'] || 0))}</td>
                <td class="${residualClass}">${formatCurrency(residual)}</td>
            </tr>
        `;
    }).join('');
}

function updateNegativeTable() {
    const tbody = document.getElementById('negativeTable');
    if (!tbody) return;
    
    const data = getCurrentData();
    const negative = data
        .filter(r => parseFloat(r['Net Residual'] || 0) < 0)
        .sort((a, b) => parseFloat(a['Net Residual'] || 0) - parseFloat(b['Net Residual'] || 0)); // Ascending (most negative first)
    
    document.getElementById('negativeCount').textContent = negative.length;
    
    tbody.innerHTML = negative.map(r => `
        <tr>
            <td>${r.DBA || 'Unknown'}</td>
            <td><code class="mid-code">${(r.MID || '').substring(0, 12)}</code></td>
            <td>${r.Rep || 'Unknown'}</td>
            <td>${formatCurrency(parseFloat(r['Sales Volume'] || 0))}</td>
            <td class="negative">${formatCurrency(parseFloat(r['Net Residual'] || 0))}</td>
        </tr>
    `).join('');
}

function updateChangesTable() {
    const tbody = document.getElementById('changesTable');
    if (!tbody) return;
    
    const current = getCurrentData();
    const previous = getPreviousData();
    
    if (!previous || previous.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">No previous period data available for comparison</td></tr>';
        document.getElementById('changesCount').textContent = 'N/A';
        return;
    }
    
    const prevMap = {};
    previous.forEach(r => {
        prevMap[r.MID] = parseFloat(r['Net Residual'] || 0);
    });
    
    const changes = [];
    current.forEach(r => {
        const mid = r.MID;
        const currentVal = parseFloat(r['Net Residual'] || 0);
        const prevVal = prevMap[mid];
        
        if (prevVal !== undefined && prevVal !== 0) {
            const changePct = ((currentVal - prevVal) / Math.abs(prevVal)) * 100;
            if (Math.abs(changePct) >= 30) {
                changes.push({
                    ...r,
                    previous: prevVal,
                    current: currentVal,
                    changePct: changePct
                });
            }
        }
    });
    
    changes.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
    
    document.getElementById('changesCount').textContent = changes.length;
    
    tbody.innerHTML = changes.map(r => {
        const changeClass = r.changePct >= 0 ? 'positive' : 'negative';
        
        return `
            <tr>
                <td>${r.DBA || 'Unknown'}</td>
                <td><code class="mid-code">${(r.MID || '').substring(0, 12)}</code></td>
                <td>${r.Rep || 'Unknown'}</td>
                <td>${formatCurrency(r.previous)}</td>
                <td>${formatCurrency(r.current)}</td>
                <td class="${changeClass}"><strong>${r.changePct >= 0 ? '+' : ''}${r.changePct.toFixed(1)}%</strong></td>
            </tr>
        `;
    }).join('');
}

// ===== VALUATION =====
function updateValuation() {
    const current = getCurrentData();
    const previous = getPreviousData();
    
    // For Total period, valuation should be averaged across months or N/A
    if (currentPeriod === 'total') {
        // Show N/A or averaged valuation
        document.getElementById('portfolioValue').textContent = 'N/A';
        document.getElementById('conservative24x').textContent = 'N/A';
        document.getElementById('market30x').textContent = 'N/A';
        document.getElementById('premium36x').textContent = 'N/A';
        
        const conservativeLabel = document.querySelector('.valuation-metrics .valuation-card:nth-child(1) h4');
        const marketLabel = document.querySelector('.valuation-metrics .valuation-card:nth-child(2) h4');
        const premiumLabel = document.querySelector('.valuation-metrics .valuation-card:nth-child(3) h4');
        
        if (conservativeLabel) conservativeLabel.textContent = 'Conservative';
        if (marketLabel) marketLabel.textContent = 'Market';
        if (premiumLabel) premiumLabel.textContent = 'Premium';
        
        document.getElementById('growthRate').textContent = 'N/A';
        
        const uniqueMIDs = new Set(current.map(r => r.MID).filter(Boolean));
        const activeMerchants = uniqueMIDs.size;
        const negativeMerchants = current.filter(r => parseFloat(r['Net Residual'] || 0) < 0).length;
        
        document.getElementById('valuationMerchants').textContent = activeMerchants;
        document.getElementById('valuationNegative').textContent = negativeMerchants;
        
        const breakdownHtml = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 40px; color: #A0A0A0;">
                    <strong>Valuation requires single-month data.</strong><br>
                    Please select October or November to view portfolio valuation metrics.
                </td>
            </tr>
        `;
        document.getElementById('valuationBreakdown').innerHTML = breakdownHtml;
        
        const methodologyHTML = `
            <div class="method-card" style="grid-column: 1 / -1;">
                <h4>ℹ️ Valuation Note</h4>
                <p>Portfolio valuation is calculated on a monthly basis. Please select a specific month (October or November) to view detailed valuation metrics including base multiple, attrition analysis, and concentration risk.</p>
            </div>
        `;
        document.querySelector('.methodology-grid').innerHTML = methodologyHTML;
        
        return;
    }
    
    // Calculate metrics for single month
    const totalResiduals = current.reduce((sum, r) => sum + parseFloat(r['Net Residual'] || 0), 0);
    
    // Active merchants: ALL unique MIDs
    const uniqueMIDs = new Set(current.map(r => r.MID).filter(Boolean));
    const activeMerchants = uniqueMIDs.size;
    
    const avgPerMerchant = activeMerchants > 0 ? totalResiduals / activeMerchants : 0;
    
    // STEP 1: Determine Base Multiple based on Average Residual per Merchant
    let baseMultiple = 15; // Default
    
    if (avgPerMerchant >= 50000) {
        baseMultiple = 32; // 28-35x range, use 32
    } else if (avgPerMerchant >= 25000) {
        baseMultiple = 28; // 21-35x range, use 28
    } else if (avgPerMerchant >= 10000) {
        baseMultiple = 23; // 18-28x range, use 23
    } else if (avgPerMerchant >= 5000) {
        baseMultiple = 20; // 15-25x range, use 20
    } else if (avgPerMerchant >= 2000) {
        baseMultiple = 17; // low teens, use 17
    } else {
        baseMultiple = 15; // Below $2k, starting at 15x
    }
    
    // STEP 2: Calculate Attrition (Lost Merchants)
    let monthlyAttrition = 0;
    let attritionPenalty = 0;
    let lostMerchants = 0;
    
    if (previous && previous.length > 0 && currentPeriod === 'november') {
        // Get unique MIDs from previous month
        const prevMIDs = new Set(previous.map(r => r.MID).filter(Boolean));
        const currentMIDs = new Set(current.map(r => r.MID).filter(Boolean));
        
        // Lost Merchants: MIDs in previous month that don't appear in current month
        lostMerchants = 0;
        prevMIDs.forEach(mid => {
            if (!currentMIDs.has(mid)) {
                lostMerchants++;
            }
        });
        
        // Attrition Rate: Simple percentage of merchants lost
        if (prevMIDs.size > 0) {
            monthlyAttrition = (lostMerchants / prevMIDs.size) * 100;
            
            // Apply penalties based on attrition rate
            // These are realistic monthly thresholds
            if (monthlyAttrition >= 10) {
                attritionPenalty = 5; // 10%+ monthly is severe
            } else if (monthlyAttrition >= 7) {
                attritionPenalty = 3; // 7-10% is high
            } else if (monthlyAttrition >= 5) {
                attritionPenalty = 2; // 5-7% is elevated
            } else if (monthlyAttrition >= 3) {
                attritionPenalty = 1; // 3-5% is moderate
            }
            // < 3% = no penalty (good retention)
        }
    }
    
    // STEP 3: Calculate Concentration Risk
    // Top 20% of merchants as % of total residuals
    const sortedMerchants = current
        .map(r => ({ mid: r.MID, residual: parseFloat(r['Net Residual'] || 0) }))
        .filter(r => r.residual > 0)
        .sort((a, b) => b.residual - a.residual);
    
    const top20Count = Math.ceil(sortedMerchants.length * 0.2);
    const top20Total = sortedMerchants.slice(0, top20Count).reduce((sum, r) => sum + r.residual, 0);
    const concentrationPct = sortedMerchants.length > 0 ? (top20Total / totalResiduals * 100) : 0;
    
    let concentrationPenalty = 0;
    if (concentrationPct > 60) {
        concentrationPenalty = 2;
    } else if (concentrationPct > 50) {
        concentrationPenalty = 1;
    }
    
    // STEP 4: Calculate Final Multiple
    const adjustedMultiple = Math.max(baseMultiple - attritionPenalty - concentrationPenalty, 10); // Floor at 10x
    
    // Calculate valuations
    const conservative = totalResiduals * (adjustedMultiple - 3); // Conservative: -3x
    const market = totalResiduals * adjustedMultiple; // Market: adjusted
    const premium = totalResiduals * (adjustedMultiple + 3); // Premium: +3x
    
    // Update display
    document.getElementById('portfolioValue').textContent = formatCurrency(market);
    document.getElementById('conservative24x').textContent = formatCurrency(conservative);
    document.getElementById('market30x').textContent = formatCurrency(market);
    document.getElementById('premium36x').textContent = formatCurrency(premium);
    
    // Update valuation card titles with actual multiples
    const conservativeLabel = document.querySelector('.valuation-metrics .valuation-card:nth-child(1) h4');
    const marketLabel = document.querySelector('.valuation-metrics .valuation-card:nth-child(2) h4');
    const premiumLabel = document.querySelector('.valuation-metrics .valuation-card:nth-child(3) h4');
    
    if (conservativeLabel) conservativeLabel.textContent = `Conservative (${(adjustedMultiple - 3)}x)`;
    if (marketLabel) marketLabel.textContent = `Market (${adjustedMultiple}x)`;
    if (premiumLabel) premiumLabel.textContent = `Premium (${(adjustedMultiple + 3)}x)`;
    
    // Growth rate
    if (previous && previous.length > 0) {
        const prevResiduals = previous.reduce((sum, r) => sum + parseFloat(r['Net Residual'] || 0), 0);
        const growthRate = prevResiduals !== 0 ? ((totalResiduals - prevResiduals) / Math.abs(prevResiduals) * 100) : 0;
        document.getElementById('growthRate').textContent = (growthRate >= 0 ? '+' : '') + growthRate.toFixed(1) + '%';
    } else {
        document.getElementById('growthRate').textContent = 'N/A';
    }
    
    // Portfolio stats
    const negativeMerchants = current.filter(r => parseFloat(r['Net Residual'] || 0) < 0).length;
    
    document.getElementById('valuationMerchants').textContent = activeMerchants;
    document.getElementById('valuationNegative').textContent = negativeMerchants;
    
    // Breakdown table with actual metrics
    const breakdownHtml = `
        <tr>
            <td><strong>Monthly Residuals</strong></td>
            <td>${formatCurrency(totalResiduals)}</td>
            <td>Base calculation metric</td>
        </tr>
        <tr>
            <td><strong>Total Merchants</strong></td>
            <td>${activeMerchants}</td>
            <td>All unique MIDs in portfolio</td>
        </tr>
        <tr>
            <td><strong>Avg Residual/Merchant</strong></td>
            <td>${formatCurrency(avgPerMerchant)}</td>
            <td>Base Multiple: ${baseMultiple}x</td>
        </tr>
        <tr>
            <td><strong>Lost Merchants</strong></td>
            <td>${previous ? lostMerchants + ' merchants' : 'N/A'}</td>
            <td>${previous ? 'MIDs from Oct not in Nov' : 'Need previous month data'}</td>
        </tr>
        <tr>
            <td><strong>Attrition Rate</strong></td>
            <td>${previous ? monthlyAttrition.toFixed(1) + '%' : 'N/A'}</td>
            <td>${previous ? `${lostMerchants} of ${previous.filter((r, i, arr) => arr.findIndex(t => t.MID === r.MID) === i).length} lost` : ''} | Penalty: -${attritionPenalty}x</td>
        </tr>
        <tr>
            <td><strong>Concentration (Top 20%)</strong></td>
            <td>${concentrationPct.toFixed(1)}%</td>
            <td>Penalty: -${concentrationPenalty}x</td>
        </tr>
        <tr style="background: rgba(255, 153, 0, 0.1); font-weight: 600;">
            <td><strong>Final Multiple</strong></td>
            <td>${adjustedMultiple}x</td>
            <td>After all adjustments</td>
        </tr>
    `;
    document.getElementById('valuationBreakdown').innerHTML = breakdownHtml;
    
    // Update methodology cards with actual numbers
    const methodologyHTML = `
        <div class="method-card">
            <h4>📊 Base Multiple</h4>
            <p>Average residual of <strong>${formatCurrency(avgPerMerchant)}</strong> per merchant yields a base multiple of <strong>${baseMultiple}x</strong> monthly residuals.</p>
        </div>
        <div class="method-card">
            <h4>📉 Attrition Impact</h4>
            <p>${previous ? `Lost <strong>${lostMerchants} merchants</strong> from October to November. Attrition rate: <strong>${monthlyAttrition.toFixed(1)}%</strong>. This reduces the multiple by <strong>${attritionPenalty}x</strong>.` : 'Insufficient data to calculate attrition. Need month-over-month comparison.'}</p>
        </div>
        <div class="method-card">
            <h4>🎯 Concentration Risk</h4>
            <p>Top 20% of merchants represent <strong>${concentrationPct.toFixed(1)}%</strong> of revenue. ${concentrationPenalty > 0 ? `High concentration reduces multiple by <strong>${concentrationPenalty}x</strong>.` : 'Good diversification - no penalty.'}</p>
        </div>
        <div class="method-card">
            <h4>💎 Final Valuation</h4>
            <p>Market valuation: <strong>${formatCurrency(market)}</strong> at <strong>${adjustedMultiple}x</strong> monthly residuals. Range: ${formatCurrency(conservative)} - ${formatCurrency(premium)}</p>
        </div>
    `;
    document.querySelector('.methodology-grid').innerHTML = methodologyHTML;
}

// ===== ANALYTICS =====
function updateAnalytics() {
    const current = getCurrentData();
    const previous = getPreviousData();
    
    // Growth insight
    if (previous && previous.length > 0) {
        const currentTotal = current.reduce((sum, r) => sum + parseFloat(r['Net Residual'] || 0), 0);
        const prevTotal = previous.reduce((sum, r) => sum + parseFloat(r['Net Residual'] || 0), 0);
        const growth = prevTotal !== 0 ? ((currentTotal - prevTotal) / Math.abs(prevTotal) * 100) : 0;
        
        if (growth > 5) {
            document.getElementById('insightGrowth').textContent = `Strong growth of ${growth.toFixed(1)}% indicates healthy portfolio expansion. Continue current merchant acquisition strategy.`;
        } else if (growth > 0) {
            document.getElementById('insightGrowth').textContent = `Modest growth of ${growth.toFixed(1)}%. Consider implementing targeted merchant development programs.`;
        } else {
            document.getElementById('insightGrowth').textContent = `Negative growth of ${growth.toFixed(1)}%. Immediate review of merchant retention strategies recommended.`;
        }
    } else {
        document.getElementById('insightGrowth').textContent = 'No previous period data available for growth analysis.';
    }
    
    // Risk insight
    const negative = current.filter(r => parseFloat(r['Net Residual'] || 0) < 0);
    const negativeTotal = Math.abs(negative.reduce((sum, r) => sum + parseFloat(r['Net Residual'] || 0), 0));
    const negativePercent = (negative.length / current.length * 100).toFixed(1);
    
    document.getElementById('insightRisk').textContent = `${negative.length} merchants (${negativePercent}%) with negative residuals totaling ${formatCurrency(negativeTotal)}. Review these accounts for adjustment or closure.`;
    
    // Opportunity insight
    const top20 = current
        .sort((a, b) => parseFloat(b['Net Residual'] || 0) - parseFloat(a['Net Residual'] || 0))
        .slice(0, 20);
    const top20Total = top20.reduce((sum, r) => sum + parseFloat(r['Net Residual'] || 0), 0);
    const totalResiduals = current.reduce((sum, r) => sum + parseFloat(r['Net Residual'] || 0), 0);
    const concentration = (top20Total / totalResiduals * 100).toFixed(1);
    
    document.getElementById('insightOpportunity').textContent = `Top 20 merchants represent ${concentration}% of residuals. Focus on nurturing these relationships and developing similar high-value accounts.`;
    
    // Agent performance table
    const agentStats = {};
    current.forEach(r => {
        const agent = r.Rep || 'Unknown';
        if (!agentStats[agent]) {
            agentStats[agent] = {
                merchants: 0,
                totalResiduals: 0,
                volumes: []
            };
        }
        agentStats[agent].merchants++;
        agentStats[agent].totalResiduals += parseFloat(r['Net Residual'] || 0);
        agentStats[agent].volumes.push(parseFloat(r['Sales Volume'] || 0));
    });
    
    const agentPerformance = Object.entries(agentStats)
        .map(([agent, stats]) => ({
            agent,
            merchants: stats.merchants,
            total: stats.totalResiduals,
            avg: stats.totalResiduals / stats.merchants,
            rating: stats.totalResiduals / stats.merchants > 150 ? '⭐⭐⭐' : stats.totalResiduals / stats.merchants > 100 ? '⭐⭐' : '⭐'
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    
    document.getElementById('agentPerformanceTable').innerHTML = agentPerformance.map(a => `
        <tr>
            <td><strong>${a.agent}</strong></td>
            <td>${a.merchants}</td>
            <td>${formatCurrency(a.total)}</td>
            <td>${formatCurrency(a.avg)}</td>
            <td>${a.rating}</td>
        </tr>
    `).join('');
    
    // Recommendations
    const recommendations = [
        {
            icon: '📈',
            title: 'Merchant Retention',
            text: 'Implement quarterly reviews with top 50 merchants to ensure satisfaction and identify growth opportunities.'
        },
        {
            icon: '⚠️',
            title: 'Address Negatives',
            text: `${negative.length} merchants need attention. Schedule review calls to resolve issues or consider account closure.`
        },
        {
            icon: '💼',
            title: 'Agent Development',
            text: 'Top performing agents averaging $' + agentPerformance[0].avg.toFixed(0) + ' per merchant. Share best practices across team.'
        },
        {
            icon: '🎯',
            title: 'Volume Growth',
            text: 'Focus on increasing transaction volume with existing merchants through POS system optimization and marketing support.'
        }
    ];
    
    document.getElementById('recommendationsGrid').innerHTML = recommendations.map(rec => `
        <div class="recommendation-card">
            <div class="rec-icon">${rec.icon}</div>
            <h4>${rec.title}</h4>
            <p>${rec.text}</p>
        </div>
    `).join('');
}

// ===== TABLE SORTING =====
function setupTableSorting() {
    document.querySelectorAll('.sortable thead th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const table = th.closest('table');
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const thIndex = Array.from(th.parentElement.children).indexOf(th);
            
            const isAsc = th.classList.contains('sort-asc');
            table.querySelectorAll('th').forEach(t => t.classList.remove('sort-asc', 'sort-desc'));
            th.classList.add(isAsc ? 'sort-desc' : 'sort-asc');
            
            rows.sort((a, b) => {
                let aVal = a.children[thIndex].textContent.trim();
                let bVal = b.children[thIndex].textContent.trim();
                
                const aNum = parseFloat(aVal.replace(/[$,\s%]/g, ''));
                const bNum = parseFloat(bVal.replace(/[$,\s%]/g, ''));
                
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return isAsc ? aNum - bNum : bNum - aNum;
                }
                
                return isAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            });
            
            rows.forEach(row => tbody.appendChild(row));
        });
    });
}

// ===== NAVIGATION =====
function updateActiveNav() {
    const sections = document.querySelectorAll('.section');
    const navItems = document.querySelectorAll('.nav-item');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                navItems.forEach(item => {
                    item.classList.remove('active');
                    if (item.getAttribute('href') === `#${id}`) {
                        item.classList.add('active');
                    }
                });
            }
        });
    }, { threshold: 0.3 });
    
    sections.forEach(section => observer.observe(section));
}

function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// ===== EXPORTS =====
function downloadAllCSV() {
    const data = allData[currentPeriod] || [];
    let csv = 'Merchant,MID,Agent,Pricing,Volume,Transactions,Net Residual\n';
    
    data.forEach(r => {
        csv += `"${r.DBA || ''}","${r.MID || ''}","${r.Rep || ''}","${r.Pricing || ''}",${r['Sales Volume'] || 0},${r['Transaction Count'] || 0},${r['Net Residual'] || 0}\n`;
    });
    
    downloadFile(csv, `demo-dashboard-${currentPeriod}-${Date.now()}.csv`, 'text/csv');
}

function downloadFilteredCSV(type) {
    let data = getCurrentData();
    let filename = `demo-${type}-${currentPeriod}`;
    
    if (type === 'negative') {
        data = data.filter(r => parseFloat(r['Net Residual'] || 0) < 0);
    }
    
    let csv = 'Merchant,MID,Agent,Volume,Net Residual\n';
    data.forEach(r => {
        csv += `"${r.DBA || ''}","${r.MID || ''}","${r.Rep || ''}",${r['Sales Volume'] || 0},${r['Net Residual'] || 0}\n`;
    });
    
    downloadFile(csv, `${filename}.csv`, 'text/csv');
}

function downloadExcel() {
    const data = getCurrentData();
    const ws_data = [
        ['Merchant', 'MID', 'Agent', 'Pricing', 'Volume', 'Transactions', 'Gross Profit', 'Net Residual']
    ];
    
    data.forEach(r => {
        ws_data.push([
            r.DBA || '',
            r.MID || '',
            r.Rep || '',
            r.Pricing || '',
            parseFloat(r['Sales Volume'] || 0),
            parseFloat(r['Transaction Count'] || 0),
            parseFloat(r['Gross Profit'] || 0),
            parseFloat(r['Net Residual'] || 0)
        ]);
    });
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `demo-dashboard-${currentPeriod}.xlsx`);
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupTableSorting();
    setupSmoothScroll();
    
    document.getElementById('periodSelect').addEventListener('change', (e) => {
        currentPeriod = e.target.value;
        updateDashboard();
    });
    
    document.getElementById('agentSelect').addEventListener('change', (e) => {
        currentAgent = e.target.value;
        updateDashboard();
    });
    
    const searchInput = document.getElementById('masterSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#masterTable tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }
});
