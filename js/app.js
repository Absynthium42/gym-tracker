// ==========================================
// Gym Tracker - Main Application
// ==========================================

class GymTrackerApp {
    constructor() {
        this.currentPage = 'home';
        this.currentWorkout = null;
        this.currentExerciseIndex = 0;
        this.currentSeriesIndex = 0;
        this.currentDifficulty = null; // Track current series difficulty selection
        this.comboDifficulties = [null, null]; // For combo exercises
        this.sessionData = {
            workoutType: null,
            startTime: null,
            exercises: [],
            newPRs: [],
            difficultyRatings: [] // { exerciseId, seriesIndex, rating }
        };
    }

    async init() {
        // Initialize app first
        this.setupNavigation();
        this.setupWorkoutCards();
        this.setupWorkoutControls();
        this.setupTimerControls();
        this.setupProgressPage();
        this.setupBodyPage();
        this.setupSettingsPage();
        this.setupGoalSection();
        this.setupObjectiveModal();

        // Listen for Firebase data sync
        window.addEventListener('dataSync', () => {
            console.log('Data synced from Firebase, refreshing UI...');
            this.refreshCurrentPage();
            this.loadCalendar();
        });

        calendarManager.init();

        chartsManager.initProgressChart('progress-chart');
        chartsManager.initBodyFatChart('bodyfat-chart');

        // Try to connect to Firebase in background
        console.log('App initialized, starting background sync...');
        firebaseSync.autoConnect().catch(e => console.error('Background sync failed:', e));

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
        this.currentDifficulty = null;
        this.comboDifficulties = [null, null];

        this.sessionData = {
            workoutType: workoutType,
            startTime: new Date(),
            exercises: [],
            newPRs: [],
            difficultyRatings: []
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
        const customName = firebaseSync.getCustomExerciseName(exercise.id);
        const displayName = customName || exercise.name;

        const nameContainer = document.getElementById('exercise-name');
        nameContainer.innerHTML = `
            ${displayName} 
            <button id="rename-exercise-btn" style="background:none;border:none;cursor:pointer;font-size:1rem;margin-left:0.5rem;opacity:0.7;">✏️</button>
        `;

        document.getElementById('rename-exercise-btn').onclick = async (e) => {
            e.stopPropagation();
            const newName = prompt('Nouveau nom pour cet exercice :', displayName);
            if (newName !== null) {
                await firebaseSync.saveCustomExerciseName(exercise.id, newName);
                this.showExercise(); // Refresh view
            }
        };

        document.getElementById('current-series').textContent = this.currentSeriesIndex + 1;
        document.getElementById('total-series').textContent = exercise.series.length;
        document.getElementById('target-reps').textContent = series.reps;

        // Update GIF (placeholder for now)
        const gifEl = document.getElementById('exercise-gif');
        gifEl.src = `assets/gifs/${exercise.gif}`;
        gifEl.alt = displayName;
        gifEl.onerror = () => {
            gifEl.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%231a1a2e" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%236366f1" font-size="40">🏋️</text></svg>';
        };

        // Update PR
        const pr = firebaseSync.getPersonalRecord(exercise.id, this.currentSeriesIndex);
        const prValue = document.getElementById('pr-value');
        prValue.textContent = pr !== null ? pr : '--';

        // Default weight to 0 (or previous)
        document.getElementById('weight-input').value = 0;

        // Check if this is a combo exercise
        const isCombo = exercise.isCombo && exercise.subExercises;
        const comboSection = document.getElementById('combo-section');
        const singleWeightSection = document.querySelector('.weight-section');
        const singleDiffSection = document.getElementById('difficulty-section-single');

        if (isCombo) {
            // Show combo section, hide single inputs
            comboSection.style.display = 'block';
            singleWeightSection.style.display = 'none';
            singleDiffSection.style.display = 'none';

            // Reset combo difficulty selections
            this.comboDifficulties = [null, null];
            document.querySelectorAll('.combo-diff-btn').forEach(btn => btn.classList.remove('selected'));

            // Setup combo sub-exercises
            exercise.subExercises.forEach((subEx, idx) => {
                const num = idx + 1;
                document.getElementById(`combo-title-${num}`).textContent = subEx.name;
                document.getElementById(`combo-weight-${num}`).value = 0;

                // Show PR for sub-exercise
                const subPr = firebaseSync.getPersonalRecord(subEx.id, this.currentSeriesIndex);
                document.getElementById(`combo-pr-${num}`).textContent = `🏆 ${subPr !== null ? subPr : '--'}`;

                // Show previous difficulty
                const prevDiff = firebaseSync.getDifficultyRating(subEx.id, this.currentSeriesIndex);
                const labels = { easy: 'F', medium: 'M', hard: 'D' };
                document.getElementById(`combo-diff-prev-${num}`).textContent = prevDiff ? `Préc: ${labels[prevDiff]}` : '';
            });

            // Setup combo difficulty button handlers
            document.querySelectorAll('.combo-diff-btn').forEach(btn => {
                btn.onclick = () => {
                    const comboNum = parseInt(btn.dataset.combo);
                    // Remove selected from same group
                    document.querySelectorAll(`.combo-diff-btn[data-combo="${comboNum}"]`).forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    this.comboDifficulties[comboNum - 1] = btn.dataset.difficulty;
                };
            });
        } else {
            // Show single inputs, hide combo section
            comboSection.style.display = 'none';
            singleWeightSection.style.display = 'block';
            singleDiffSection.style.display = 'block';

            // Reset and setup difficulty rating
            this.currentDifficulty = null;
            const diffButtons = document.querySelectorAll('.difficulty-btn');
            diffButtons.forEach(btn => btn.classList.remove('selected'));

            // Show previous difficulty rating
            const previousDifficulty = firebaseSync.getDifficultyRating(exercise.id, this.currentSeriesIndex);
            const diffPreviousEl = document.getElementById('difficulty-previous');
            if (previousDifficulty) {
                const labels = { easy: 'Facile', medium: 'Moyen', hard: 'Difficile' };
                diffPreviousEl.textContent = `Précédent: ${labels[previousDifficulty]}`;
            } else {
                diffPreviousEl.textContent = '';
            }

            // Setup difficulty button handlers
            diffButtons.forEach(btn => {
                btn.onclick = () => {
                    diffButtons.forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    this.currentDifficulty = btn.dataset.difficulty;
                };
            });
        }
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

        // Check if this is a combo exercise
        const isCombo = exercise.isCombo && exercise.subExercises;

        if (isCombo) {
            // Save weights and difficulties for each sub-exercise
            exercise.subExercises.forEach((subEx, idx) => {
                const num = idx + 1;
                const weightInput = document.getElementById(`combo-weight-${num}`).value.replace(',', '.');
                const weight = parseFloat(weightInput) || 0;

                if (weight > 0) {
                    // Check for new PR
                    const currentPR = firebaseSync.getPersonalRecord(subEx.id, this.currentSeriesIndex);
                    if (currentPR === null || weight > currentPR) {
                        this.sessionData.newPRs.push({
                            exercise: subEx.name,
                            series: this.currentSeriesIndex + 1,
                            weight: weight,
                            previousPR: currentPR
                        });
                    }

                    // Store in session data
                    this.sessionData.exercises.push({
                        exerciseId: subEx.id,
                        exerciseName: subEx.name,
                        series: this.currentSeriesIndex + 1,
                        weight: weight,
                        reps: series.reps
                    });
                }

                // Save difficulty for sub-exercise
                if (this.comboDifficulties[idx]) {
                    this.sessionData.difficultyRatings.push({
                        exerciseId: subEx.id,
                        seriesIndex: this.currentSeriesIndex,
                        rating: this.comboDifficulties[idx]
                    });
                }
            });
        } else {
            // Standard single exercise handling
            const weightInput = document.getElementById('weight-input').value.replace(',', '.');
            const weight = parseFloat(weightInput) || 0;
            if (weight > 0) {
                // Check for new PR (based on current local data, will be saved on completion)
                const currentPR = firebaseSync.getPersonalRecord(exercise.id, this.currentSeriesIndex);
                if (currentPR === null || weight > currentPR) {
                    this.sessionData.newPRs.push({
                        exercise: exercise.name,
                        series: this.currentSeriesIndex + 1,
                        weight: weight,
                        previousPR: currentPR
                    });
                }

                // Store in session data - will be saved only on workout completion
                this.sessionData.exercises.push({
                    exerciseId: exercise.id,
                    exerciseName: exercise.name,
                    series: this.currentSeriesIndex + 1,
                    weight: weight,
                    reps: series.reps
                });
            }

            // Save difficulty rating if selected
            if (this.currentDifficulty) {
                this.sessionData.difficultyRatings.push({
                    exerciseId: exercise.id,
                    seriesIndex: this.currentSeriesIndex,
                    rating: this.currentDifficulty
                });
            }
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

        const workout = this.currentWorkout;
        const targetExercise = workout.exercises[this.currentExerciseIndex];
        let statsText = '';
        
        if (targetExercise && !targetExercise.isCombo) {
            const pr = firebaseSync.getPersonalRecord(targetExercise.id, this.currentSeriesIndex);
            const prevDiff = firebaseSync.getDifficultyRating(targetExercise.id, this.currentSeriesIndex);
            
            let statsParts = [];
            if (pr !== null) statsParts.push(`🏆 ${pr} kg`);
            if (prevDiff) {
                const labels = { easy: 'Facile', medium: 'Moyen', hard: 'Difficile' };
                statsParts.push(`Diff. Préc: ${labels[prevDiff]}`);
            }
            statsText = statsParts.join(' • ');
        } else if (targetExercise && targetExercise.isCombo) {
            let prs = [];
            targetExercise.subExercises.forEach(subEx => {
                const pr = firebaseSync.getPersonalRecord(subEx.id, this.currentSeriesIndex);
                if (pr !== null) prs.push(`${pr}kg`);
            });
            if (prs.length > 0) {
                statsText = `🏆 ${prs.join(' + ')}`;
            }
        }
        
        const statsEl = document.getElementById('next-series-stats');
        if (statsEl) {
            statsEl.textContent = statsText;
        }

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

        try {
            // Save all accumulated weights from the completed session
            for (const exerciseData of this.sessionData.exercises) {
                await firebaseSync.saveWeight(
                    exerciseData.exerciseId,
                    exerciseData.series - 1, // series is 1-indexed, convert to 0-indexed
                    exerciseData.weight
                );
            }

            // Save all difficulty ratings from the completed session
            for (const diffData of this.sessionData.difficultyRatings) {
                await firebaseSync.saveDifficultyRating(
                    diffData.exerciseId,
                    diffData.seriesIndex,
                    diffData.rating
                );
            }

            // Save workout to history
            await firebaseSync.saveWorkoutSession({
                workoutType: this.sessionData.workoutType,
                duration: duration,
                exerciseCount: new Set(this.sessionData.exercises.map(e => e.exerciseId)).size,
                totalSets: this.sessionData.exercises.length,
                totalVolume: this.sessionData.exercises.reduce((sum, e) => sum + e.weight, 0)
            });

            // Check and update objectives (non-blocking)
            try {
                await this.checkObjectives();
            } catch (err) {
                console.error('Error checking objectives:', err);
            }

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
        } catch (error) {
            console.error('Error completing workout:', error);
            alert('Erreur lors de la sauvegarde de la séance. Vos données sont peut-être sauvegardées localement.');
            // Try to navigate anyway if it was just a sync error
            this.navigateTo('complete');
        }
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
        const optionsHtml = exercises.map(ex => {
            const customName = firebaseSync.getCustomExerciseName(ex.id);
            const displayName = customName || ex.name;
            return `<option value="${ex.id}">${displayName} (${ex.workout})</option>`;
        }).join('');

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
    // Goal Section
    // ==========================================
    setupGoalSection() {
        // Load and display existing goal
        this.updateGoalDisplay();

        document.getElementById('save-goal-btn')?.addEventListener('click', () => {
            const targetBodyFat = parseFloat(document.getElementById('goal-bodyfat').value);
            const targetDate = document.getElementById('goal-date').value;

            if (targetBodyFat > 0 && targetDate) {
                localStorage.setItem('gymtracker_bodyfat_goal', JSON.stringify({
                    targetBodyFat,
                    targetDate
                }));
                this.updateGoalDisplay();
                alert('Objectif défini !');
            } else {
                alert('Veuillez entrer un taux cible et une date.');
            }
        });
    }

    updateGoalDisplay() {
        const goalData = localStorage.getItem('gymtracker_bodyfat_goal');
        const displayEl = document.getElementById('goal-display');

        if (!goalData) {
            displayEl.classList.remove('active');
            return;
        }

        const goal = JSON.parse(goalData);
        document.getElementById('goal-bodyfat').value = goal.targetBodyFat;
        document.getElementById('goal-date').value = goal.targetDate;

        // Get current body fat
        const latestData = firebaseSync.getLatestBodyData();
        let currentBodyFat = null;

        if (latestData && latestData.height && latestData.waist && latestData.neck) {
            currentBodyFat = 86.010 * Math.log10(latestData.waist - latestData.neck)
                - 70.041 * Math.log10(latestData.height)
                + 36.76;
            currentBodyFat = Math.round(currentBodyFat * 10) / 10;
        }

        // Calculate days remaining
        const today = new Date();
        const target = new Date(goal.targetDate);
        const daysRemaining = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

        // Calculate progress
        let progressHtml = '';
        if (currentBodyFat !== null) {
            const difference = currentBodyFat - goal.targetBodyFat;
            const percentageToGo = currentBodyFat > goal.targetBodyFat
                ? Math.abs(difference / currentBodyFat * 100)
                : 0;

            const progressPercentage = currentBodyFat > goal.targetBodyFat
                ? Math.max(0, Math.min(100, 100 - percentageToGo))
                : 100;

            progressHtml = `
                <div class="goal-info">
                    <div class="goal-stat">
                        <div class="goal-stat-label">Actuel</div>
                        <div class="goal-stat-value">${currentBodyFat}%</div>
                    </div>
                    <div class="goal-stat">
                        <div class="goal-stat-label">Objectif</div>
                        <div class="goal-stat-value">${goal.targetBodyFat}%</div>
                    </div>
                    <div class="goal-stat">
                        <div class="goal-stat-label">Reste</div>
                        <div class="goal-stat-value">${difference > 0 ? '-' : '+'}${Math.abs(difference).toFixed(1)}%</div>
                    </div>
                    <div class="goal-stat">
                        <div class="goal-stat-label">Jours restants</div>
                        <div class="goal-stat-value">${daysRemaining}</div>
                    </div>
                </div>
                <div class="goal-progress-bar">
                    <div class="goal-progress-fill" style="width: ${progressPercentage}%"></div>
                </div>
            `;
        } else {
            progressHtml = `
                <div style="text-align: center; color: var(--text-secondary);">
                    Entrez vos mesures corporelles pour voir votre progression.
                </div>
            `;
        }

        displayEl.innerHTML = progressHtml;
        displayEl.classList.add('active');
    }

    // ==========================================
    // Body Tracking Page
    // ==========================================
    setupBodyPage() {
        document.getElementById('save-body-data')?.addEventListener('click', async () => {
            const heightInput = document.getElementById('body-height').value.replace(',', '.');
            const waistInput = document.getElementById('body-waist').value.replace(',', '.');
            const neckInput = document.getElementById('body-neck').value.replace(',', '.');
            const ageInput = document.getElementById('body-age').value;

            const height = parseFloat(heightInput) || 0;
            const waist = parseFloat(waistInput) || 0;
            const neck = parseFloat(neckInput) || 0;
            const age = parseInt(ageInput) || 0;

            // All three measurements required for Navy formula
            if (height > 0 && waist > 0 && neck > 0) {
                // Save age to localStorage if provided
                if (age > 0) {
                    localStorage.setItem('gymtracker_user_age', age.toString());
                }

                await firebaseSync.saveBodyData(height, waist, neck);
                this.updateBodyPage();
                alert('Données enregistrées !');
            } else {
                alert('Veuillez entrer les 3 mesures (taille, tour de taille, tour de cou).');
            }
        });
    }

    updateBodyPage() {
        const latestData = firebaseSync.getLatestBodyData();

        // Load age from localStorage
        const savedAge = localStorage.getItem('gymtracker_user_age');
        if (savedAge) {
            document.getElementById('body-age').value = savedAge;
        }

        if (latestData && latestData.height && latestData.waist && latestData.neck) {
            // Pre-fill inputs from latest data
            document.getElementById('body-height').value = latestData.height || '';
            document.getElementById('body-waist').value = latestData.waist || '';
            document.getElementById('body-neck').value = latestData.neck || '';

            // Calculate Navy Body Fat % (Men)
            // Formula: 86.010 × log10(waist - neck) - 70.041 × log10(height) + 36.76
            const bodyFat = 86.010 * Math.log10(latestData.waist - latestData.neck)
                - 70.041 * Math.log10(latestData.height)
                + 36.76;

            const bodyFatRounded = Math.round(bodyFat * 10) / 10;

            // Calculate ±3% range
            const minBodyFat = Math.round((bodyFat - 3) * 10) / 10;
            const maxBodyFat = Math.round((bodyFat + 3) * 10) / 10;

            document.getElementById('bodyfat-value').textContent = `${bodyFatRounded}%`;
            document.getElementById('bodyfat-range').textContent = `±3% [${minBodyFat}% - ${maxBodyFat}%]`;

            // Calculate category based on age
            const age = parseInt(document.getElementById('body-age').value) || 30;
            const category = this.getBodyFatCategory(bodyFatRounded, age);
            const categoryEl = document.getElementById('bodyfat-category');
            categoryEl.textContent = category.label;
            categoryEl.style.color = category.color;
            categoryEl.style.borderColor = category.color;

            // Update gauge needle
            this.updateBodyFatGaugeNeedle(bodyFatRounded);
        } else {
            document.getElementById('bodyfat-value').textContent = '--';
            document.getElementById('bodyfat-range').textContent = '--';
            document.getElementById('bodyfat-category').textContent = '--';
            document.getElementById('bodyfat-category').style.color = '';
            document.getElementById('bodyfat-category').style.borderColor = '';
        }

        // Update chart
        chartsManager.updateBodyFatChart();
    }

    updateBodyFatGaugeNeedle(percentage) {
        const needle = document.getElementById('bodyfat-needle');
        if (!needle) return;

        // Map percentage (0-50%) to angle (0-180 degrees)
        // We use 50% as max for better visualization
        const maxPercentage = 50;
        const clampedPercentage = Math.min(percentage, maxPercentage);
        const angle = (clampedPercentage / maxPercentage) * 180;

        // Calculate needle endpoint
        const centerX = 100;
        const centerY = 100;
        const length = 60;
        const angleRad = (angle - 90) * (Math.PI / 180); // -90 to start from left

        const x2 = centerX + length * Math.cos(angleRad);
        const y2 = centerY + length * Math.sin(angleRad);

        needle.setAttribute('x2', x2);
        needle.setAttribute('y2', y2);
    }

    getBodyFatCategory(bodyFat, age) {
        // Define thresholds based on age groups (for men)
        let thresholds;
        if (age < 40) {
            thresholds = { essential: 5, athlete: 13, fitness: 17, average: 24 };
        } else if (age < 60) {
            thresholds = { essential: 5, athlete: 14, fitness: 19, average: 26 };
        } else {
            thresholds = { essential: 5, athlete: 15, fitness: 20, average: 27 };
        }

        if (bodyFat <= thresholds.essential) {
            return { label: 'Essentiel', color: '#60a5fa' };
        } else if (bodyFat <= thresholds.athlete) {
            return { label: 'Athlète', color: '#10b981' };
        } else if (bodyFat <= thresholds.fitness) {
            return { label: 'Fitness', color: '#14b8a6' };
        } else if (bodyFat <= thresholds.average) {
            return { label: 'Moyen', color: '#f59e0b' };
        } else {
            return { label: 'Obésité', color: '#ef4444' };
        }
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

        // User ID Management
        const userIdEl = document.getElementById('current-user-id');
        if (userIdEl) {
            userIdEl.textContent = firebaseSync.userId;
        }

        // Copy User ID
        document.getElementById('copy-user-id')?.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(firebaseSync.userId);
                alert('✅ User ID copié !');
            } catch (error) {
                const textArea = document.createElement('textarea');
                textArea.value = firebaseSync.userId;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('✅ User ID copié !');
            }
        });

        // Restore old User ID
        document.getElementById('restore-user-id-btn')?.addEventListener('click', async () => {
            const oldUserId = document.getElementById('restore-user-id').value.trim();

            if (!oldUserId) {
                alert('❌ Entre un User ID valide');
                return;
            }

            if (!oldUserId.startsWith('user_')) {
                alert('❌ Format invalide. Le User ID doit commencer par "user_"');
                return;
            }

            if (!confirm(`⚠️ Remplacer ton User ID actuel par:\n${oldUserId}\n\nCela va recharger l'app et récupérer les données Firebase associées.`)) {
                return;
            }

            // Update User ID
            localStorage.setItem('gymtracker_user_id', oldUserId);

            alert('✅ User ID restauré ! Reconnecte-toi à Firebase pour récupérer tes données.');
            window.location.reload();
        });
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new GymTrackerApp();
    app.init();
});
