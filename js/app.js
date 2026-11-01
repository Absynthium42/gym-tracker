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
        this.exerciseSeriesIndices = {}; // Track current series index per exercise
        this.sessionData = {
            workoutType: null,
            startTime: null,
            sets: {}, // { `${exerciseId}_${seriesIndex}`: { ... } }
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

        // Restore session if one exists
        this.restoreSessionState();
    }

    saveSessionState() {
        if (!this.currentWorkout) return;
        const state = {
            workoutType: Object.keys(WORKOUTS).find(k => WORKOUTS[k] === this.currentWorkout),
            exerciseIndex: this.currentExerciseIndex,
            seriesIndex: this.currentSeriesIndex,
            exerciseSeriesIndices: this.exerciseSeriesIndices || {},
            sessionData: this.sessionData,
            comboDifficulties: this.comboDifficulties,
            timestamp: Date.now()
        };
        localStorage.setItem('gymTrackerSession', JSON.stringify(state));
    }

    clearSessionState() {
        localStorage.removeItem('gymTrackerSession');
    }

    restoreSessionState() {
        try {
            const saved = localStorage.getItem('gymTrackerSession');
            if (saved) {
                const state = JSON.parse(saved);
                // Restore if less than 12 hours old
                if (Date.now() - state.timestamp < 12 * 60 * 60 * 1000 && state.workoutType && WORKOUTS[state.workoutType]) {
                    this.currentWorkout = WORKOUTS[state.workoutType];
                    this.currentExerciseIndex = state.exerciseIndex || 0;
                    this.currentSeriesIndex = state.seriesIndex || 0;
                    this.exerciseSeriesIndices = state.exerciseSeriesIndices || {};
                    this.sessionData = state.sessionData || { startTime: Date.now(), sets: {}, exercises: [], newPRs: [], difficultyRatings: [] };
                    if (!this.sessionData.sets) {
                        this.sessionData.sets = {};
                        if (this.sessionData.exercises) {
                            this.sessionData.exercises.forEach(e => {
                                this.sessionData.sets[`${e.exerciseId}_${e.series - 1}`] = {
                                    ...e,
                                    seriesIndex: e.series - 1
                                };
                            });
                        }
                    }
                    this.comboDifficulties = state.comboDifficulties || [null, null];

                    this.navigateTo('workout');
                    this.showExercise();
                    return true;
                } else {
                    this.clearSessionState();
                }
            }
        } catch (e) {
            console.error('Failed to restore session', e);
            this.clearSessionState();
        }
        return false;
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
        const cards = document.querySelectorAll('.workout-link');
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
        this.exerciseSeriesIndices = {};

        this.sessionData = {
            workoutType: workoutType,
            startTime: new Date(),
            sets: {},
            exercises: [],
            newPRs: [],
            difficultyRatings: []
        };

        this.saveSessionState();

        this.showExercise();
        this.navigateTo('workout');
    }

    // ==========================================
    // Workout Session
    // ==========================================
    // Helper methods for non-linear workout navigation and data preservation
    isSeriesValidated(exerciseIndex, seriesIndex) {
        if (!this.currentWorkout || !this.sessionData.sets) return false;
        const exercise = this.currentWorkout.exercises[exerciseIndex];
        if (!exercise) return false;

        if (exercise.isCombo && exercise.subExercises) {
            return exercise.subExercises.every(subEx => {
                const key = `${subEx.id}_${seriesIndex}`;
                return !!this.sessionData.sets[key];
            });
        } else {
            const key = `${exercise.id}_${seriesIndex}`;
            return !!this.sessionData.sets[key];
        }
    }

    getCompletedSeriesCount(exerciseIndex) {
        if (!this.currentWorkout) return 0;
        const exercise = this.currentWorkout.exercises[exerciseIndex];
        if (!exercise) return 0;

        let count = 0;
        for (let s = 0; s < exercise.series.length; s++) {
            if (this.isSeriesValidated(exerciseIndex, s)) count++;
        }
        return count;
    }

    isExerciseComplete(exerciseIndex) {
        if (!this.currentWorkout) return false;
        const exercise = this.currentWorkout.exercises[exerciseIndex];
        if (!exercise) return false;
        return this.getCompletedSeriesCount(exerciseIndex) === exercise.series.length;
    }

    getFirstIncompleteSeries(exerciseIndex) {
        if (!this.currentWorkout) return 0;
        const exercise = this.currentWorkout.exercises[exerciseIndex];
        if (!exercise) return 0;

        for (let s = 0; s < exercise.series.length; s++) {
            if (!this.isSeriesValidated(exerciseIndex, s)) return s;
        }
        return 0;
    }

    areAllExercisesComplete() {
        if (!this.currentWorkout) return false;
        for (let i = 0; i < this.currentWorkout.exercises.length; i++) {
            if (!this.isExerciseComplete(i)) return false;
        }
        return true;
    }

    goToExercise(targetIndex) {
        if (!this.currentWorkout) return;
        if (targetIndex < 0 || targetIndex >= this.currentWorkout.exercises.length) return;

        if (!this.exerciseSeriesIndices) this.exerciseSeriesIndices = {};
        this.exerciseSeriesIndices[this.currentExerciseIndex] = this.currentSeriesIndex;

        this.currentExerciseIndex = targetIndex;

        if (this.exerciseSeriesIndices[targetIndex] !== undefined) {
            this.currentSeriesIndex = this.exerciseSeriesIndices[targetIndex];
        } else {
            this.currentSeriesIndex = this.getFirstIncompleteSeries(targetIndex);
            this.exerciseSeriesIndices[targetIndex] = this.currentSeriesIndex;
        }

        this.showExercise();
        this.saveSessionState();
    }

    goToSeries(targetSeriesIndex) {
        if (!this.currentWorkout) return;
        const exercise = this.currentWorkout.exercises[this.currentExerciseIndex];
        if (!exercise) return;
        if (targetSeriesIndex < 0 || targetSeriesIndex >= exercise.series.length) return;

        this.currentSeriesIndex = targetSeriesIndex;
        if (!this.exerciseSeriesIndices) this.exerciseSeriesIndices = {};
        this.exerciseSeriesIndices[this.currentExerciseIndex] = targetSeriesIndex;

        this.showExercise();
        this.saveSessionState();
    }

    showExerciseListModal() {
        const workout = this.currentWorkout;
        if (!workout) return;

        let modal = document.getElementById('exercise-list-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'exercise-list-modal';
            modal.className = 'modal';
            document.getElementById('app').appendChild(modal);
        }

        const itemsHtml = workout.exercises.map((ex, idx) => {
            const customName = firebaseSync.getCustomExerciseName(ex.id) || ex.name;
            const completedCount = this.getCompletedSeriesCount(idx);
            const total = ex.series.length;
            const isCurrent = (idx === this.currentExerciseIndex);
            const isAllDone = (completedCount === total);

            let statusText = `${completedCount}/${total}`;
            let statusStyle = 'background: rgba(255,255,255,0.15); color: #fff;';
            if (isAllDone) {
                statusText = `✓ ${total}/${total}`;
                statusStyle = 'background: #4ADE80; color: #000; font-weight: 700;';
            } else if (completedCount > 0) {
                statusStyle = 'background: #F59E0B; color: #000; font-weight: 700;';
            }

            return `
                <div class="exercise-modal-item ${isCurrent ? 'current' : ''}" data-index="${idx}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; margin-bottom: 8px; border-radius: 12px; background: ${isCurrent ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}; cursor: pointer; border: ${isCurrent ? '1.5px solid #fff' : '1px solid rgba(255,255,255,0.1)'};">
                    <div style="display: flex; align-items: center; gap: 10px; font-weight: ${isCurrent ? '700' : '500'};">
                        <span style="font-size: 0.85rem; opacity: 0.8;">${idx + 1}.</span>
                        <span>${customName}</span>
                    </div>
                    <span style="font-size: 0.8rem; padding: 2px 8px; border-radius: 12px; ${statusStyle}">${statusText}</span>
                </div>
            `;
        }).join('');

        modal.innerHTML = `
            <div class="modal-content neumorphic-modal" style="max-height: 80vh; overflow-y: auto;">
                <h3 style="margin-bottom: 12px; text-align: center;">EXERCICES DE LA SÉANCE</h3>
                <div class="exercise-modal-list">
                    ${itemsHtml}
                </div>
                <button class="btn-primary" style="margin-top: 12px; padding: 10px;" id="close-exercise-list-modal">Fermer</button>
            </div>
        `;

        modal.querySelectorAll('.exercise-modal-item').forEach(item => {
            item.onclick = () => {
                const index = parseInt(item.dataset.index);
                modal.classList.remove('active');
                this.goToExercise(index);
            };
        });

        document.getElementById('close-exercise-list-modal').onclick = () => {
            modal.classList.remove('active');
        };

        setTimeout(() => modal.classList.add('active'), 10);
    }

    setupWorkoutControls() {
        // Back / Close button - show cancel or finish modal
        document.getElementById('back-to-home')?.addEventListener('click', () => {
            this.showCancelConfirmation();
        });

        // Next button (validates set)
        document.getElementById('next-btn')?.addEventListener('click', () => {
            this.nextStep();
        });

        // Navigate between exercises (both directions)
        document.getElementById('prev-exercise-btn')?.addEventListener('click', () => {
            this.goToExercise(this.currentExerciseIndex - 1);
        });

        document.getElementById('next-exercise-btn')?.addEventListener('click', () => {
            this.goToExercise(this.currentExerciseIndex + 1);
        });

        // Navigate between series within current exercise
        document.getElementById('prev-series-btn')?.addEventListener('click', () => {
            this.goToSeries(this.currentSeriesIndex - 1);
        });

        document.getElementById('next-series-btn')?.addEventListener('click', () => {
            this.goToSeries(this.currentSeriesIndex + 1);
        });

        // Click exercise counter to open full list modal
        document.getElementById('workout-progress-btn')?.addEventListener('click', () => {
            this.showExerciseListModal();
        });
    }

    showExercise() {
        const workout = this.currentWorkout;
        const exercise = workout.exercises[this.currentExerciseIndex];
        const series = exercise.series[this.currentSeriesIndex];

        // 1. Update navigation arrows
        const prevExBtn = document.getElementById('prev-exercise-btn');
        const nextExBtn = document.getElementById('next-exercise-btn');
        if (prevExBtn) {
            prevExBtn.disabled = (this.currentExerciseIndex <= 0);
            prevExBtn.classList.toggle('disabled', this.currentExerciseIndex <= 0);
        }
        if (nextExBtn) {
            nextExBtn.disabled = (this.currentExerciseIndex >= workout.exercises.length - 1);
            nextExBtn.classList.toggle('disabled', this.currentExerciseIndex >= workout.exercises.length - 1);
        }

        // 2. Update series navigation arrows
        const prevSeriesBtn = document.getElementById('prev-series-btn');
        const nextSeriesBtn = document.getElementById('next-series-btn');
        if (prevSeriesBtn) {
            prevSeriesBtn.disabled = (this.currentSeriesIndex <= 0);
            prevSeriesBtn.classList.toggle('disabled', this.currentSeriesIndex <= 0);
        }
        if (nextSeriesBtn) {
            nextSeriesBtn.disabled = (this.currentSeriesIndex >= exercise.series.length - 1);
            nextSeriesBtn.classList.toggle('disabled', this.currentSeriesIndex >= exercise.series.length - 1);
        }

        // 3. Update header progress
        document.getElementById('current-exercise-num').textContent = this.currentExerciseIndex + 1;
        document.getElementById('total-exercises').textContent = workout.exercises.length;

        let totalSeriesAll = 0;
        let completedSeriesAll = 0;
        workout.exercises.forEach((ex, exIdx) => {
            totalSeriesAll += ex.series.length;
            completedSeriesAll += this.getCompletedSeriesCount(exIdx);
        });
        const progress = totalSeriesAll > 0 ? (completedSeriesAll / totalSeriesAll) * 100 : 0;
        document.getElementById('progress-fill').style.width = `${progress}%`;

        // 4. Update exercise info
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
                this.showExercise();
            }
        };

        document.getElementById('current-series').textContent = this.currentSeriesIndex + 1;
        document.getElementById('total-series').textContent = exercise.series.length;
        document.getElementById('target-reps-header').textContent = series.reps;

        // Series validation status badge
        const isSeriesDone = this.isSeriesValidated(this.currentExerciseIndex, this.currentSeriesIndex);
        const statusBadge = document.getElementById('series-status-badge');
        if (statusBadge) {
            if (isSeriesDone) {
                statusBadge.textContent = '✓ Validée';
                statusBadge.classList.add('validated');
            } else {
                statusBadge.textContent = '';
                statusBadge.classList.remove('validated');
            }
        }

        // Update historical PR weight
        const lastW = firebaseSync.getLastWeight(exercise.id, this.currentSeriesIndex);
        const prValue = document.getElementById('pr-value');
        if (prValue) {
            prValue.textContent = lastW !== null ? lastW : '--';
        }

        // Single vs Combo
        const isCombo = exercise.isCombo && exercise.subExercises;
        const comboSection = document.getElementById('combo-section');
        const singleWeightSection = document.querySelector('#page-workout .neumorphic-panel');
        const singleDiffSection = document.getElementById('difficulty-section-single');

        if (isCombo) {
            comboSection.style.display = 'block';
            singleWeightSection.style.display = 'none';
            singleDiffSection.style.display = 'none';

            this.comboDifficulties = [null, null];
            document.querySelectorAll('.combo-diff-btn').forEach(btn => btn.classList.remove('selected'));

            exercise.subExercises.forEach((subEx, idx) => {
                const num = idx + 1;
                const subCustomName = firebaseSync.getCustomExerciseName(subEx.id);
                const subDisplayName = subCustomName || subEx.name;
                document.getElementById(`combo-title-${num}`).textContent = subDisplayName;

                const subKey = `${subEx.id}_${this.currentSeriesIndex}`;
                const validatedSubSet = this.sessionData.sets ? this.sessionData.sets[subKey] : null;

                if (validatedSubSet) {
                    document.getElementById(`combo-weight-${num}`).value = validatedSubSet.weight;
                    document.getElementById(`combo-reps-${num}`).value = validatedSubSet.repsDone;
                    if (validatedSubSet.difficulty) {
                        this.comboDifficulties[idx] = validatedSubSet.difficulty;
                        const btn = document.querySelector(`.combo-diff-btn[data-combo="${num}"][data-difficulty="${validatedSubSet.difficulty}"]`);
                        if (btn) btn.classList.add('selected');
                    }
                } else {
                    document.getElementById(`combo-weight-${num}`).value = 0;
                    const subLastReps = firebaseSync.getLastRepsCount(subEx.id, this.currentSeriesIndex);
                    document.getElementById(`combo-reps-${num}`).value = subLastReps || 0;
                }

                const subLastW = firebaseSync.getLastWeight(subEx.id, this.currentSeriesIndex);
                document.getElementById(`combo-pr-${num}`).textContent = `Préc: ${subLastW !== null ? subLastW : '--'}`;

                const prevDiff = firebaseSync.getDifficultyRating(subEx.id, this.currentSeriesIndex);
                const labels = { easy: 'F', medium: 'M', hard: 'D', extreme: 'E' };
                document.getElementById(`combo-diff-prev-${num}`).textContent = prevDiff ? `Préc: ${labels[prevDiff]}` : '';
            });

            document.querySelectorAll('.combo-diff-btn').forEach(btn => {
                btn.onclick = () => {
                    const comboNum = parseInt(btn.dataset.combo);
                    document.querySelectorAll(`.combo-diff-btn[data-combo="${comboNum}"]`).forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    this.comboDifficulties[comboNum - 1] = btn.dataset.difficulty;
                };
            });
        } else {
            comboSection.style.display = 'none';
            singleWeightSection.style.display = 'block';
            singleDiffSection.style.display = 'block';

            const setKey = `${exercise.id}_${this.currentSeriesIndex}`;
            const validatedSet = this.sessionData.sets ? this.sessionData.sets[setKey] : null;

            if (validatedSet) {
                document.getElementById('weight-input').value = validatedSet.weight;
                document.getElementById('reps-done-input').value = validatedSet.repsDone;
                this.currentDifficulty = validatedSet.difficulty || null;
            } else {
                document.getElementById('weight-input').value = 0;
                const lastReps = firebaseSync.getLastRepsCount(exercise.id, this.currentSeriesIndex);
                document.getElementById('reps-done-input').value = lastReps || 0;
                this.currentDifficulty = null;
            }

            const diffButtons = document.querySelectorAll('.difficulty-btn');
            diffButtons.forEach(btn => {
                btn.classList.toggle('selected', btn.dataset.difficulty === this.currentDifficulty);
                btn.onclick = () => {
                    diffButtons.forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    this.currentDifficulty = btn.dataset.difficulty;
                };
            });

            const previousDifficulty = firebaseSync.getDifficultyRating(exercise.id, this.currentSeriesIndex);
            const diffPreviousEl = document.getElementById('difficulty-previous');
            if (previousDifficulty) {
                const labels = { easy: 'Facile', medium: 'Moyen', hard: 'Difficile', extreme: 'Extrême' };
                diffPreviousEl.textContent = `Précédent: ${labels[previousDifficulty]}`;
            } else {
                diffPreviousEl.textContent = '';
            }
        }

        // 5. Update bottom action button text
        const nextBtn = document.getElementById('next-btn');
        if (nextBtn) {
            const nextBtnSpan = nextBtn.querySelector('span');
            const allDone = this.areAllExercisesComplete();
            if (allDone) {
                if (nextBtnSpan) nextBtnSpan.textContent = 'Terminer la séance';
            } else if (isSeriesDone) {
                if (nextBtnSpan) nextBtnSpan.textContent = 'Enregistrer les modifs';
            } else {
                if (nextBtnSpan) nextBtnSpan.textContent = 'Suivant';
            }
        }
    }

    showCancelConfirmation() {
        let modal = document.getElementById('cancel-workout-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'cancel-workout-modal';
            modal.className = 'modal';
            document.getElementById('app').appendChild(modal);
        }

        const hasValidatedSets = this.sessionData.sets && Object.keys(this.sessionData.sets).length > 0;

        modal.innerHTML = `
            <div class="modal-content neumorphic-modal">
                <h3 style="text-align: center; margin-bottom: 8px;">QUITTER LA SÉANCE ?</h3>
                <p style="margin-bottom: 20px; font-size: 0.9rem; text-align: center; color: rgba(255,255,255,0.85);">
                    ${hasValidatedSets ? 'Tu as déjà validé des séries dans cette séance.' : 'La progression actuelle sera perdue.'}
                </p>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button class="difficulty-btn" style="opacity: 1; border: 1px solid rgba(255,255,255,0.25); border-radius: 8px; padding: 12px;" id="cancel-workout-no">
                        <span style="font-weight: 800; font-size: 0.9rem;">CONTINUER LA SÉANCE</span>
                    </button>
                    ${hasValidatedSets ? `
                    <button class="difficulty-btn" style="opacity: 1; background: #4ADE80; color: #000; border-radius: 8px; padding: 12px;" id="cancel-workout-save">
                        <span style="font-weight: 800; font-size: 0.9rem;">TERMINER & ENREGISTRER</span>
                    </button>
                    ` : ''}
                    <button class="difficulty-btn" style="opacity: 1; background: #e74c3c; color: white; border-radius: 8px; padding: 12px;" id="cancel-workout-yes">
                        <span style="font-weight: 800; font-size: 0.9rem; color: white;">ABANDONNER SANS ENREGISTRER</span>
                    </button>
                </div>
            </div>
        `;

        document.getElementById('cancel-workout-no').addEventListener('click', () => {
            modal.classList.remove('active');
        });

        if (hasValidatedSets) {
            document.getElementById('cancel-workout-save')?.addEventListener('click', async () => {
                modal.classList.remove('active');
                restTimer.stop();
                await this.completeWorkout();
            });
        }

        document.getElementById('cancel-workout-yes').addEventListener('click', () => {
            modal.classList.remove('active');
            restTimer.stop();
            this.clearSessionState();
            this.navigateTo('home');
        });

        setTimeout(() => modal.classList.add('active'), 10);
    }

    async nextStep() {
        const workout = this.currentWorkout;
        const exercise = workout.exercises[this.currentExerciseIndex];
        const series = exercise.series[this.currentSeriesIndex];
        const isCombo = exercise.isCombo && exercise.subExercises;

        if (!this.sessionData.sets) this.sessionData.sets = {};

        const wasAlreadyDone = this.isSeriesValidated(this.currentExerciseIndex, this.currentSeriesIndex);

        if (isCombo) {
            exercise.subExercises.forEach((subEx, idx) => {
                const num = idx + 1;
                const weightInput = document.getElementById(`combo-weight-${num}`).value.replace(',', '.');
                const weight = parseFloat(weightInput) || 0;
                const comboReps = parseInt(document.getElementById(`combo-reps-${num}`).value) || 0;
                const diff = this.comboDifficulties[idx] || null;

                const subKey = `${subEx.id}_${this.currentSeriesIndex}`;
                this.sessionData.sets[subKey] = {
                    exerciseId: subEx.id,
                    exerciseName: (firebaseSync.getCustomExerciseName(subEx.id) || subEx.name),
                    series: this.currentSeriesIndex + 1,
                    seriesIndex: this.currentSeriesIndex,
                    weight: weight,
                    reps: series.reps,
                    repsDone: comboReps,
                    difficulty: diff
                };
            });
        } else {
            const weightInput = document.getElementById('weight-input').value.replace(',', '.');
            const weight = parseFloat(weightInput) || 0;
            const repsDone = parseInt(document.getElementById('reps-done-input').value) || 0;
            const setKey = `${exercise.id}_${this.currentSeriesIndex}`;

            this.sessionData.sets[setKey] = {
                exerciseId: exercise.id,
                exerciseName: (firebaseSync.getCustomExerciseName(exercise.id) || exercise.name),
                series: this.currentSeriesIndex + 1,
                seriesIndex: this.currentSeriesIndex,
                weight: weight,
                reps: series.reps,
                repsDone: repsDone,
                difficulty: this.currentDifficulty || null
            };
        }

        // Rebuild flat structures from sets (no duplicates!)
        this.sessionData.exercises = Object.values(this.sessionData.sets).filter(s => s.weight > 0);
        this.sessionData.difficultyRatings = Object.values(this.sessionData.sets)
            .filter(s => s.difficulty)
            .map(s => ({ exerciseId: s.exerciseId, seriesIndex: s.seriesIndex, rating: s.difficulty }));

        // Recalculate PRs
        this.sessionData.newPRs = [];
        Object.values(this.sessionData.sets).forEach(s => {
            if (s.weight > 0) {
                const currentPR = firebaseSync.getPersonalRecord(s.exerciseId, s.seriesIndex);
                if (currentPR === null || s.weight > currentPR) {
                    this.sessionData.newPRs.push({
                        exercise: s.exerciseName,
                        series: s.series,
                        weight: s.weight,
                        previousPR: currentPR
                    });
                }
            }
        });

        this.saveSessionState();

        // If all exercises are now complete, finish workout!
        if (this.areAllExercisesComplete()) {
            await this.completeWorkout();
            return;
        }

        // If user was simply modifying an already validated series:
        if (wasAlreadyDone) {
            if (this.currentSeriesIndex < exercise.series.length - 1) {
                this.goToSeries(this.currentSeriesIndex + 1);
            } else {
                // Find next incomplete exercise
                let targetEx = -1;
                for (let i = this.currentExerciseIndex + 1; i < workout.exercises.length; i++) {
                    if (!this.isExerciseComplete(i)) { targetEx = i; break; }
                }
                if (targetEx === -1) {
                    for (let i = 0; i < this.currentExerciseIndex; i++) {
                        if (!this.isExerciseComplete(i)) { targetEx = i; break; }
                    }
                }
                if (targetEx !== -1) {
                    this.goToExercise(targetEx);
                } else {
                    this.showExercise();
                }
            }
            return;
        }

        // Standard progression (newly completed series):
        if (this.currentSeriesIndex < exercise.series.length - 1) {
            this.currentSeriesIndex++;
            if (!this.exerciseSeriesIndices) this.exerciseSeriesIndices = {};
            this.exerciseSeriesIndices[this.currentExerciseIndex] = this.currentSeriesIndex;

            if (series.rest > 0) {
                this.startRest(series.rest, `Série ${this.currentSeriesIndex + 1}`);
            } else {
                this.showExercise();
            }
        } else {
            // Finished all series of current exercise! Find next incomplete exercise
            let nextIncompleteIndex = -1;
            for (let i = this.currentExerciseIndex + 1; i < workout.exercises.length; i++) {
                if (!this.isExerciseComplete(i)) {
                    nextIncompleteIndex = i;
                    break;
                }
            }
            if (nextIncompleteIndex === -1) {
                for (let i = 0; i < this.currentExerciseIndex; i++) {
                    if (!this.isExerciseComplete(i)) {
                        nextIncompleteIndex = i;
                        break;
                    }
                }
            }

            if (nextIncompleteIndex !== -1) {
                this.currentExerciseIndex = nextIncompleteIndex;
                this.currentSeriesIndex = this.getFirstIncompleteSeries(nextIncompleteIndex);
                if (!this.exerciseSeriesIndices) this.exerciseSeriesIndices = {};
                this.exerciseSeriesIndices[nextIncompleteIndex] = this.currentSeriesIndex;

                const nextEx = workout.exercises[nextIncompleteIndex];
                const nextExName = firebaseSync.getCustomExerciseName(nextEx.id) || nextEx.name;

                if (series.rest > 0) {
                    this.startRest(series.rest, `${nextExName} - Série ${this.currentSeriesIndex + 1}`);
                } else {
                    this.showExercise();
                }
            } else {
                // All exercises are complete!
                await this.completeWorkout();
            }
        }

        this.saveSessionState();
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
            const lastWeight = firebaseSync.getLastWeight(targetExercise.id, this.currentSeriesIndex);
            const prevDiff = firebaseSync.getDifficultyRating(targetExercise.id, this.currentSeriesIndex);
            
            let statsParts = [];
            if (lastWeight !== null) {
                const lastReps = firebaseSync.getLastRepsCount(targetExercise.id, this.currentSeriesIndex);
                let weightStr = `Préc: ${lastWeight} kg`;
                if (lastReps) weightStr += ` × ${lastReps} reps`;
                statsParts.push(weightStr);
            }
            if (prevDiff) {
                const labels = { easy: 'Facile', medium: 'Moyen', hard: 'Difficile', extreme: 'Extrême' };
                statsParts.push(`Diff: ${labels[prevDiff]}`);
            }
            statsText = statsParts.join(' • ');
        } else if (targetExercise && targetExercise.isCombo) {
            let weights = [];
            targetExercise.subExercises.forEach(subEx => {
                const lastWeight = firebaseSync.getLastWeight(subEx.id, this.currentSeriesIndex);
                if (lastWeight !== null) weights.push(`${lastWeight}kg`);
            });
            if (weights.length > 0) {
                statsText = `Préc: ${weights.join(' + ')}`;
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

            // Save all reps counts from the completed session
            for (const exerciseData of this.sessionData.exercises) {
                if (exerciseData.repsDone > 0) {
                    await firebaseSync.saveRepsCount(
                        exerciseData.exerciseId,
                        exerciseData.series - 1,
                        exerciseData.repsDone
                    );
                }
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
                this.clearSessionState();
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
                        <h4>${exercise ? (firebaseSync.getCustomExerciseName(exercise.id) || exercise.name) : obj.exerciseId}</h4>
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
            const weightInput = document.getElementById('body-weight').value.replace(',', '.');
            const weight = parseFloat(weightInput) || 0;

            if (weight > 0) {
                await firebaseSync.saveBodyWeight(weight);
                this.updateBodyPage();
                alert('Poids enregistré !');
            } else {
                alert('Veuillez entrer votre poids.');
            }
        });
    }

    updateBodyPage() {
        const bodyData = firebaseSync.getBodyData();
        const weightEntries = bodyData.filter(e => e.weight);
        const latest = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1] : null;

        if (latest) {
            document.getElementById('body-weight').value = latest.weight;
        }

        // Display weight stats
        const statsEl = document.getElementById('weight-stats');
        if (statsEl && weightEntries.length > 0) {
            const weights = weightEntries.map(e => e.weight);
            const currentWeight = weights[weights.length - 1];
            const minWeight = Math.min(...weights);
            const maxWeight = Math.max(...weights);

            let deltaHtml = '';
            if (weightEntries.length >= 2) {
                const previousWeight = weights[weights.length - 2];
                const delta = currentWeight - previousWeight;
                const sign = delta >= 0 ? '+' : '';
                const color = delta <= 0 ? 'var(--success)' : 'var(--danger)';
                deltaHtml = `
                    <div class="stat-card">
                        <div class="stat-value" style="color: ${color}">${sign}${delta.toFixed(1)}</div>
                        <div class="stat-label">Variation (kg)</div>
                    </div>
                `;
            }

            statsEl.innerHTML = `
                <div class="stats-cards">
                    <div class="stat-card">
                        <div class="stat-value">${currentWeight}</div>
                        <div class="stat-label">Actuel (kg)</div>
                    </div>
                    ${deltaHtml}
                    <div class="stat-card">
                        <div class="stat-value">${minWeight}</div>
                        <div class="stat-label">Min (kg)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${maxWeight}</div>
                        <div class="stat-label">Max (kg)</div>
                    </div>
                </div>
            `;
        } else if (statsEl) {
            statsEl.innerHTML = '';
        }

        // Update chart
        chartsManager.updateBodyFatChart();
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
