// ==========================================
// Gym Tracker - Main Application
// ==========================================

class GymTrackerApp {
    constructor() {
        this.currentPage = 'home';
        this.currentWorkout = null;
        this.currentExerciseIndex = 0;
        this.currentSeriesIndex = 0;
        this.sessionData = {
            workoutType: null,
            startTime: null,
            exercises: [],
            newPRs: []
        };
    }

    async init() {
        // Try to connect to Firebase
        await firebaseSync.autoConnect();

        // Setup navigation
        this.setupNavigation();

        // Setup workout cards
        this.setupWorkoutCards();

        // Setup workout session controls
        this.setupWorkoutControls();

        // Setup timer controls
        this.setupTimerControls();

        // Setup progress page
        this.setupProgressPage();

        // Setup body tracking page
        this.setupBodyPage();

        // Setup settings page
        this.setupSettingsPage();

        // Setup objective modal
        this.setupObjectiveModal();

        // Initialize calendar
        calendarManager.init();

        // Initialize charts
        chartsManager.initProgressChart('progress-chart');
        chartsManager.initBodyChart('body-chart');
        chartsManager.initImcChart('imc-chart');

        // Listen for data sync events
        window.addEventListener('dataSync', () => {
            this.refreshCurrentPage();
        });

        console.log('Gym Tracker initialized!');
    }

    // ==========================================
    // Navigation
    // ==========================================
    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                this.navigateTo(page);
            });
        });
    }

    navigateTo(page) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });

        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(b => {
            b.classList.remove('active');
        });

        // Show target page
        const pageEl = document.getElementById(`page-${page}`);
        if (pageEl) {
            pageEl.classList.add('active');
        }

        // Activate nav button
        const navBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
        if (navBtn) {
            navBtn.classList.add('active');
        }

        // Show/hide nav for workout pages
        const nav = document.querySelector('.bottom-nav');
        if (['workout', 'rest', 'complete'].includes(page)) {
            nav.style.display = 'none';
        } else {
            nav.style.display = 'flex';
        }

        this.currentPage = page;
        this.onPageShow(page);
    }

    onPageShow(page) {
        switch (page) {
            case 'progress':
                this.populateExerciseSelect();
                this.updateProgressPage();
                break;
            case 'calendar':
                calendarManager.refresh();
                break;
            case 'body':
                this.updateBodyPage();
                break;
        }
    }

    refreshCurrentPage() {
        this.onPageShow(this.currentPage);
    }

    // ==========================================
    // Workout Selection
    // ==========================================
    setupWorkoutCards() {
        const cards = document.querySelectorAll('.workout-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const workoutType = card.dataset.workout;
                this.startWorkout(workoutType);
            });
        });
    }

    startWorkout(workoutType) {
        this.currentWorkout = WORKOUTS[workoutType];
        this.currentExerciseIndex = 0;
        this.currentSeriesIndex = 0;

        this.sessionData = {
            workoutType: workoutType,
            startTime: new Date(),
            exercises: [],
            newPRs: []
        };

        this.showExercise();
        this.navigateTo('workout');
    }

    // ==========================================
    // Workout Session
    // ==========================================
    setupWorkoutControls() {
        // Back button - show cancel modal
        document.getElementById('back-to-home')?.addEventListener('click', () => {
            this.showCancelConfirmation();
        });

        // Next button
        document.getElementById('next-btn')?.addEventListener('click', () => {
            this.nextStep();
        });

        // Weight adjustment buttons
        document.getElementById('weight-minus')?.addEventListener('click', () => {
            const input = document.getElementById('weight-input');
            const current = parseFloat(input.value) || 0;
            input.value = Math.max(0, current - 2.5);
        });

        document.getElementById('weight-plus')?.addEventListener('click', () => {
            const input = document.getElementById('weight-input');
            const current = parseFloat(input.value) || 0;
            input.value = current + 2.5;
        });
    }

    showExercise() {
        const workout = this.currentWorkout;
        const exercise = workout.exercises[this.currentExerciseIndex];
        const series = exercise.series[this.currentSeriesIndex];

        // Update header progress
        document.getElementById('current-exercise-num').textContent = this.currentExerciseIndex + 1;
        document.getElementById('total-exercises').textContent = workout.exercises.length;

        const totalSeries = workout.exercises.reduce((sum, ex) => sum + ex.series.length, 0);
        const completedSeries = workout.exercises.slice(0, this.currentExerciseIndex)
            .reduce((sum, ex) => sum + ex.series.length, 0) + this.currentSeriesIndex;
        const progress = (completedSeries / totalSeries) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;

        // Update exercise info
        document.getElementById('exercise-name').textContent = exercise.name;
        document.getElementById('current-series').textContent = this.currentSeriesIndex + 1;
        document.getElementById('total-series').textContent = exercise.series.length;
        document.getElementById('target-reps').textContent = series.reps;

        // Update GIF (placeholder for now)
        const gifEl = document.getElementById('exercise-gif');
        gifEl.src = `assets/gifs/${exercise.gif}`;
        gifEl.alt = exercise.name;
        gifEl.onerror = () => {
            gifEl.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231a1a2e" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%236366f1" font-size="40">🏋️</text></svg>';
        };

        // Update PR
        const pr = firebaseSync.getPersonalRecord(exercise.id, this.currentSeriesIndex);
        const prValue = document.getElementById('pr-value');
        prValue.textContent = pr !== null ? pr : '--';

        // Default weight to 0
        document.getElementById('weight-input').value = 0;
    }

    showCancelConfirmation() {
        // Create and show cancel confirmation modal
        let modal = document.getElementById('cancel-workout-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'cancel-workout-modal';
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>Abandonner la séance ?</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">Ta progression actuelle ne sera pas sauvegardée.</p>
                    <div class="modal-actions">
                        <button class="btn-secondary" id="cancel-workout-no">Continuer</button>
                        <button class="btn-danger" id="cancel-workout-yes">Abandonner</button>
                    </div>
                </div>
            `;
            document.getElementById('app').appendChild(modal);

            document.getElementById('cancel-workout-no').addEventListener('click', () => {
                modal.classList.remove('active');
            });

            document.getElementById('cancel-workout-yes').addEventListener('click', () => {
                modal.classList.remove('active');
                restTimer.stop();
                this.navigateTo('home');
            });
        } else {
            modal.classList.add('active');
        }
    }

    async nextStep() {
        const workout = this.currentWorkout;
        const exercise = workout.exercises[this.currentExerciseIndex];
        const series = exercise.series[this.currentSeriesIndex];

        // Save weight
        const weight = parseFloat(document.getElementById('weight-input').value) || 0;
        if (weight > 0) {
            // Check for new PR
            const currentPR = firebaseSync.getPersonalRecord(exercise.id, this.currentSeriesIndex);
            if (currentPR === null || weight > currentPR) {
                this.sessionData.newPRs.push({
                    exercise: exercise.name,
                    series: this.currentSeriesIndex + 1,
                    weight: weight,
                    previousPR: currentPR
                });
            }

            await firebaseSync.saveWeight(exercise.id, this.currentSeriesIndex, weight);

            this.sessionData.exercises.push({
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                series: this.currentSeriesIndex + 1,
                weight: weight,
                reps: series.reps
            });
        }

        // Determine next step
        const isLastSeries = this.currentSeriesIndex >= exercise.series.length - 1;
        const isLastExercise = this.currentExerciseIndex >= workout.exercises.length - 1;

        if (isLastSeries && isLastExercise) {
            // Workout complete
            await this.completeWorkout();
        } else if (isLastSeries) {
            // Move to next exercise
            this.currentExerciseIndex++;
            this.currentSeriesIndex = 0;

            // Start rest timer before next exercise
            if (series.rest > 0) {
                this.startRest(series.rest, `${workout.exercises[this.currentExerciseIndex].name} - Série 1`);
            } else {
                this.showExercise();
            }
        } else {
            // Move to next series
            this.currentSeriesIndex++;

            // Start rest timer
            if (series.rest > 0) {
                this.startRest(series.rest, `Série ${this.currentSeriesIndex + 1}`);
            } else {
                this.showExercise();
            }
        }
    }

    // ==========================================
    // Rest Timer
    // ==========================================
    setupTimerControls() {
        document.getElementById('skip-rest')?.addEventListener('click', () => {
            restTimer.skip();
        });
    }

    startRest(seconds, nextPreview) {
        document.getElementById('next-preview').textContent = nextPreview;
        this.navigateTo('rest');

        restTimer.start(seconds, {
            onComplete: () => {
                this.showExercise();
                this.navigateTo('workout');
            }
        });
    }

    // ==========================================
    // Workout Complete
    // ==========================================
    async completeWorkout() {
        const duration = Math.round((new Date() - this.sessionData.startTime) / 1000 / 60);

        // Save workout to history
        await firebaseSync.saveWorkoutSession({
            workoutType: this.sessionData.workoutType,
            duration: duration,
            exerciseCount: new Set(this.sessionData.exercises.map(e => e.exerciseId)).size,
            totalSets: this.sessionData.exercises.length,
            totalVolume: this.sessionData.exercises.reduce((sum, e) => sum + e.weight, 0)
        });

        // Check and update objectives
        await this.checkObjectives();

        // Show summary
        const summary = document.getElementById('session-summary');
        summary.innerHTML = `
            <div class="summary-item">
                <span class="summary-label">Durée</span>
                <span class="summary-value">${duration} min</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Exercices</span>
                <span class="summary-value">${new Set(this.sessionData.exercises.map(e => e.exerciseId)).size}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Séries</span>
                <span class="summary-value">${this.sessionData.exercises.length}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Volume total</span>
                <span class="summary-value">${this.sessionData.exercises.reduce((sum, e) => sum + e.weight, 0)} kg</span>
            </div>
        `;

        // Show new PRs
        const prsEl = document.getElementById('new-prs');
        if (this.sessionData.newPRs.length > 0) {
            prsEl.innerHTML = '<h3 style="margin-bottom: 0.5rem;">🏆 Nouveaux records !</h3>' +
                this.sessionData.newPRs.map(pr => `
                    <div class="new-pr-item">
                        <span class="pr-icon">🏆</span>
                        <span>${pr.exercise} (S${pr.series}): ${pr.weight}kg</span>
                    </div>
                `).join('');
        } else {
            prsEl.innerHTML = '';
        }

        // Finish button
        document.getElementById('finish-workout').onclick = () => {
            this.navigateTo('home');
        };

        this.navigateTo('complete');
    }

    // ==========================================
    // Progress Page
    // ==========================================
    setupProgressPage() {
        document.getElementById('exercise-select')?.addEventListener('change', (e) => {
            const exerciseId = e.target.value;
            chartsManager.updateProgressChart(exerciseId);
            this.updateStatsCards(exerciseId);
        });

        document.getElementById('add-objective-btn')?.addEventListener('click', () => {
            document.getElementById('objective-modal').classList.add('active');
        });
    }

    populateExerciseSelect() {
        const select = document.getElementById('exercise-select');
        const objSelect = document.getElementById('obj-exercise');
        if (!select) return;

        const exercises = getAllExercises();
        const optionsHtml = exercises.map(ex =>
            `<option value="${ex.id}">${ex.name} (${ex.workout})</option>`
        ).join('');

        select.innerHTML = optionsHtml;
        if (objSelect) objSelect.innerHTML = optionsHtml;

        // Trigger initial chart update
        if (exercises.length > 0) {
            chartsManager.updateProgressChart(exercises[0].id);
            this.updateStatsCards(exercises[0].id);
        }
    }

    updateProgressPage() {
        const select = document.getElementById('exercise-select');
        if (select && select.value) {
            chartsManager.updateProgressChart(select.value);
            this.updateStatsCards(select.value);
        }
        this.updateObjectivesList();
    }

    updateStatsCards(exerciseId) {
        const stats = chartsManager.getExerciseStats(exerciseId);
        const container = document.getElementById('stats-cards');
        if (!container) return;

        // Helper to display '--' for null values
        const display = (val) => val !== null ? val : '--';

        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${display(stats.maxWeight)}</div>
                <div class="stat-label">Record (kg)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${display(stats.avgWeight)}</div>
                <div class="stat-label">Moyenne (kg)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${display(stats.totalVolume)}</div>
                <div class="stat-label">Volume total (kg)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${display(stats.sessionCount)}</div>
                <div class="stat-label">Séances</div>
            </div>
        `;
    }

    // ==========================================
    // Objectives
    // ==========================================
    setupObjectiveModal() {
        document.getElementById('cancel-objective')?.addEventListener('click', () => {
            document.getElementById('objective-modal').classList.remove('active');
        });

        document.getElementById('save-objective')?.addEventListener('click', async () => {
            const exerciseId = document.getElementById('obj-exercise').value;
            const targetWeight = parseFloat(document.getElementById('obj-weight').value);

            if (exerciseId && targetWeight > 0) {
                await firebaseSync.saveObjective(exerciseId, targetWeight);
                document.getElementById('objective-modal').classList.remove('active');
                document.getElementById('obj-weight').value = '';
                this.updateObjectivesList();
            }
        });
    }

    updateObjectivesList() {
        const container = document.getElementById('objectives-list');
        if (!container) return;

        const objectives = firebaseSync.getObjectives();

        if (objectives.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Aucun objectif défini</p>';
            return;
        }

        container.innerHTML = objectives.map(obj => {
            const exercise = getExerciseById(obj.exerciseId);
            const currentPR = firebaseSync.getPersonalRecord(obj.exerciseId);
            const progress = currentPR ? Math.round((currentPR / obj.targetWeight) * 100) : 0;
            const achieved = currentPR >= obj.targetWeight;

            return `
                <div class="objective-item ${achieved ? 'objective-achieved' : ''}">
                    <div class="objective-info">
                        <h4>${exercise ? exercise.name : obj.exerciseId}</h4>
                        <div class="objective-progress">${progress}% atteint</div>
                    </div>
                    <div class="objective-target">
                        <div class="target-value">${obj.targetWeight}kg</div>
                        <div class="current-value">Actuel: ${currentPR || 0}kg</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async checkObjectives() {
        const objectives = firebaseSync.getObjectives();
        for (const obj of objectives) {
            if (!obj.achieved) {
                const currentPR = firebaseSync.getPersonalRecord(obj.exerciseId);
                if (currentPR >= obj.targetWeight) {
                    await firebaseSync.markObjectiveAchieved(obj.id);
                }
            }
        }
    }

    // ==========================================
    // Body Tracking Page
    // ==========================================
    setupBodyPage() {
        document.getElementById('save-body-data')?.addEventListener('click', async () => {
            const weight = parseFloat(document.getElementById('body-weight').value);
            const height = parseFloat(document.getElementById('body-height').value);

            if (weight > 0) {
                // Get stored height if not provided
                const latestData = firebaseSync.getLatestBodyData();
                const finalHeight = height > 0 ? height : (latestData?.height || 0);

                await firebaseSync.saveBodyData(weight, finalHeight);
                this.updateBodyPage();
            }
        });
    }

    updateBodyPage() {
        const latestData = firebaseSync.getLatestBodyData();

        if (latestData) {
            document.getElementById('body-height').value = latestData.height || '';

            // Calculate and display IMC
            if (latestData.weight && latestData.height) {
                const heightM = latestData.height / 100;
                const imc = latestData.weight / (heightM * heightM);
                const imcRounded = Math.round(imc * 10) / 10;

                document.getElementById('imc-value').textContent = imcRounded;

                let category = '';
                let categoryClass = '';
                if (imc < 18.5) {
                    category = 'Insuffisance pondérale';
                    categoryClass = 'underweight';
                } else if (imc < 25) {
                    category = 'Corpulence normale';
                    categoryClass = 'normal';
                } else if (imc < 30) {
                    category = 'Surpoids';
                    categoryClass = 'overweight';
                } else {
                    category = 'Obésité';
                    categoryClass = 'overweight';
                }

                const categoryEl = document.getElementById('imc-category');
                categoryEl.textContent = category;
                categoryEl.className = 'imc-category ' + categoryClass;
            }
        }

        chartsManager.updateBodyChart();
        chartsManager.updateImcChart();
    }

    // ==========================================
    // Settings Page
    // ==========================================
    setupSettingsPage() {
        // Firebase URL
        const savedUrl = localStorage.getItem('gymtracker_firebase_url');
        if (savedUrl) {
            document.getElementById('firebase-url').value = savedUrl;
        }

        document.getElementById('connect-firebase')?.addEventListener('click', async () => {
            const url = document.getElementById('firebase-url').value;
            const syncInfo = document.getElementById('sync-info');
            const connectBtn = document.getElementById('connect-firebase');

            // Show loading state
            connectBtn.disabled = true;
            connectBtn.textContent = 'Connexion...';
            syncInfo.innerHTML = '<span style="color: #f59e0b;">Connexion en cours...</span>';

            try {
                await firebaseSync.connect(url);
                syncInfo.innerHTML = '<span style="color: #10b981;">✅ Connecté avec succès !</span>';
            } catch (error) {
                console.error('Connection error:', error);
                syncInfo.innerHTML = `<span style="color: #ef4444;">❌ Erreur: ${error.message}</span>`;
            } finally {
                connectBtn.disabled = false;
                connectBtn.textContent = 'Connecter';
            }
        });

        // Export buttons
        document.getElementById('export-json')?.addEventListener('click', () => {
            firebaseSync.exportData();
        });

        document.getElementById('export-csv')?.addEventListener('click', () => {
            firebaseSync.exportCSV();
        });

        // Import
        document.getElementById('import-json')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await firebaseSync.importData(file);
                    alert('Données importées avec succès !');
                    this.refreshCurrentPage();
                } catch (error) {
                    alert('Erreur lors de l\'import: ' + error.message);
                }
            }
        });

        // Clear data
        document.getElementById('clear-data')?.addEventListener('click', async () => {
            const cleared = await firebaseSync.clearAllData();
            if (cleared) {
                alert('Toutes les données ont été effacées.');
                this.refreshCurrentPage();
            }
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new GymTrackerApp();
    app.init();
});
