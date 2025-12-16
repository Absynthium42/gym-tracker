// ==========================================
// Gym Tracker - Charts Module
// ==========================================

class ChartsManager {
    constructor() {
        this.progressChart = null;
        this.bodyChart = null;
        this.imcChart = null;
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
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#6366f1',
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

    initBodyChart(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.bodyChart) {
            this.bodyChart.destroy();
        }

        this.bodyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Poids (kg)',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#10b981',
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

    updateBodyChart() {
        if (!this.bodyChart) return;

        const bodyData = firebaseSync.getBodyData();

        if (bodyData.length === 0) {
            this.bodyChart.data.labels = [];
            this.bodyChart.data.datasets[0].data = [];
            this.bodyChart.update();
            return;
        }

        const labels = bodyData.map(entry =>
            new Date(entry.date).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit'
            })
        );
        const data = bodyData.map(entry => entry.weight);

        this.bodyChart.data.labels = labels;
        this.bodyChart.data.datasets[0].data = data;
        this.bodyChart.update();
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

    initImcChart(canvasId) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.imcChart) {
            this.imcChart.destroy();
        }

        this.imcChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'IMC',
                    data: [],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#f59e0b',
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
                        suggestedMin: 15,
                        suggestedMax: 35
                    }
                }
            }
        });
    }

    updateImcChart() {
        if (!this.imcChart) return;

        const bodyData = firebaseSync.getBodyData();

        if (bodyData.length === 0) {
            this.imcChart.data.labels = [];
            this.imcChart.data.datasets[0].data = [];
            this.imcChart.update();
            return;
        }

        // Filter entries that have both weight and height
        const validData = bodyData.filter(entry => entry.weight && entry.height);

        if (validData.length === 0) {
            this.imcChart.data.labels = [];
            this.imcChart.data.datasets[0].data = [];
            this.imcChart.update();
            return;
        }

        const labels = validData.map(entry =>
            new Date(entry.date).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit'
            })
        );

        const data = validData.map(entry => {
            const heightM = entry.height / 100;
            return Math.round((entry.weight / (heightM * heightM)) * 10) / 10;
        });

        this.imcChart.data.labels = labels;
        this.imcChart.data.datasets[0].data = data;
        this.imcChart.update();
    }
}

// Global instance
const chartsManager = new ChartsManager();

