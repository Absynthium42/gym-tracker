// ==========================================
// Gym Tracker - Charts Module
// ==========================================

class ChartsManager {
    constructor() {
        this.progressChart = null;
        this.bodyFatChart = null;
    }

    initProgressChart(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.progressChart) {
            this.progressChart.destroy();
        }

        this.progressChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Poids (kg)',
                    data: [],
                    borderColor: '#ffffff',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#1a1a2e',
                        titleColor: '#ffffff',
                        bodyColor: '#a1a1aa',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#71717a',
                            maxRotation: 45
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#71717a'
                        },
                        beginAtZero: false
                    }
                }
            }
        });
    }

    updateProgressChart(exerciseId) {
        if (!this.progressChart) return;

        const history = firebaseSync.getWeightHistory(exerciseId);

        if (history.length === 0) {
            this.progressChart.data.labels = [];
            this.progressChart.data.datasets[0].data = [];
            this.progressChart.update();
            return;
        }

        // Group by date and get max weight per day
        const byDate = {};
        history.forEach(entry => {
            const date = new Date(entry.date).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit'
            });
            if (!byDate[date] || entry.weight > byDate[date]) {
                byDate[date] = entry.weight;
            }
        });

        const labels = Object.keys(byDate);
        const data = Object.values(byDate);

        this.progressChart.data.labels = labels;
        this.progressChart.data.datasets[0].data = data;
        this.progressChart.update();
    }

    // Body Fat Chart (Navy Formula)
    initBodyFatChart(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.bodyFatChart) {
            this.bodyFatChart.destroy();
        }

        this.bodyFatChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Masse Grasse (%)',
                    data: [],
                    borderColor: '#ffffff',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#1a1a2e',
                        titleColor: '#ffffff',
                        bodyColor: '#a1a1aa',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#71717a',
                            maxRotation: 45
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#71717a'
                        },
                        suggestedMin: 5,
                        suggestedMax: 30
                    }
                }
            }
        });
    }

    updateBodyFatChart() {
        if (!this.bodyFatChart) return;

        const bodyData = firebaseSync.getBodyData();

        // Filter entries that have a weight field
        const validData = bodyData.filter(entry => entry.weight);

        if (validData.length === 0) {
            this.bodyFatChart.data.labels = [];
            this.bodyFatChart.data.datasets[0].data = [];
            this.bodyFatChart.update();
            return;
        }

        const labels = validData.map(entry =>
            new Date(entry.date).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit'
            })
        );

        const data = validData.map(entry => entry.weight);

        this.bodyFatChart.data.labels = labels;
        this.bodyFatChart.data.datasets[0].data = data;
        this.bodyFatChart.data.datasets[0].label = 'Poids (kg)';
        this.bodyFatChart.options.scales.y.suggestedMin = undefined;
        this.bodyFatChart.options.scales.y.suggestedMax = undefined;
        this.bodyFatChart.options.scales.y.beginAtZero = false;
        this.bodyFatChart.update();
    }

    getExerciseStats(exerciseId) {
        const history = firebaseSync.getWeightHistory(exerciseId);

        if (history.length === 0) {
            return {
                maxWeight: null,
                avgWeight: null,
                totalVolume: null,
                sessionCount: null
            };
        }

        const weights = history.map(h => h.weight);
        const maxWeight = Math.max(...weights);
        const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;

        // Count unique dates
        const uniqueDates = new Set(history.map(h =>
            new Date(h.date).toDateString()
        ));

        return {
            maxWeight: maxWeight,
            avgWeight: Math.round(avgWeight * 10) / 10,
            totalVolume: Math.round(weights.reduce((a, b) => a + b, 0)),
            sessionCount: uniqueDates.size
        };
    }
}

// Global instance
const chartsManager = new ChartsManager();
