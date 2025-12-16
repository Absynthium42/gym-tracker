// ==========================================
// Gym Tracker - Firebase Sync Module
// ==========================================

class FirebaseSync {
    constructor() {
        this.db = null;
        this.connected = false;
        this.userId = this.getOrCreateUserId();
        this.syncStatusEl = document.getElementById('sync-status');
        this.localStorageKey = 'gymtracker_data';
    }

    getOrCreateUserId() {
        let userId = localStorage.getItem('gymtracker_user_id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('gymtracker_user_id', userId);
        }
        return userId;
    }

    async connect(firebaseUrl) {
        try {
            if (!firebaseUrl) {
                throw new Error('URL Firebase manquante');
            }

            // Clean URL - remove trailing slashes and any path
            let cleanUrl = firebaseUrl.trim();
            // Remove trailing slash
            cleanUrl = cleanUrl.replace(/\/+$/, '');
            // Remove any path after the domain (keep only the root URL)
            const urlMatch = cleanUrl.match(/^(https:\/\/[^\/]+)/);
            if (urlMatch) {
                cleanUrl = urlMatch[1];
            }

            console.log('Connecting to Firebase:', cleanUrl);

            // Initialize Firebase with the provided URL
            const firebaseConfig = {
                databaseURL: cleanUrl
            };

            // Delete existing apps and reinitialize
            if (firebase.apps.length > 0) {
                await Promise.all(firebase.apps.map(app => app.delete()));
            }

            firebase.initializeApp(firebaseConfig);
            this.db = firebase.database();

            // Test connection with timeout (10 seconds)
            const testRef = this.db.ref(`users/${this.userId}/test`);

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout - Vérifiez les règles Firebase')), 10000);
            });

            const testPromise = (async () => {
                await testRef.set({ timestamp: Date.now() });
                await testRef.remove();
            })();

            await Promise.race([testPromise, timeoutPromise]);

            this.connected = true;
            localStorage.setItem('gymtracker_firebase_url', cleanUrl);
            this.updateSyncStatus('Connecté ✓', true);

            // Set up real-time sync
            this.setupRealtimeSync();

            return true;
        } catch (error) {
            console.error('Firebase connection error:', error);
            this.connected = false;
            this.updateSyncStatus('Non connecté', false);
            throw error;
        }
    }

    setupRealtimeSync() {
        if (!this.db) return;

        const userRef = this.db.ref(`users/${this.userId}/data`);

        userRef.on('value', (snapshot) => {
            const remoteData = snapshot.val();
            if (remoteData) {
                const localData = this.getLocalData();

                // Merge data - remote wins if newer
                if (!localData.lastModified || remoteData.lastModified > localData.lastModified) {
                    this.setLocalData(remoteData);
                    this.updateSyncStatus('Synchronisé ✓', true);
                    // Trigger UI refresh
                    window.dispatchEvent(new CustomEvent('dataSync'));
                }
            }
        });
    }

    async syncToRemote(data) {
        if (!this.connected || !this.db) {
            // Save locally only
            this.setLocalData(data);
            return;
        }

        try {
            data.lastModified = Date.now();
            const userRef = this.db.ref(`users/${this.userId}/data`);
            await userRef.set(data);
            this.setLocalData(data);
            this.updateSyncStatus('Synchronisé ✓', true);
        } catch (error) {
            console.error('Sync error:', error);
            this.setLocalData(data);
            this.updateSyncStatus('Erreur sync', false);
        }
    }

    getLocalData() {
        try {
            const data = localStorage.getItem(this.localStorageKey);
            return data ? JSON.parse(data) : this.getDefaultData();
        } catch {
            return this.getDefaultData();
        }
    }

    setLocalData(data) {
        localStorage.setItem(this.localStorageKey, JSON.stringify(data));
    }

    getDefaultData() {
        return {
            weights: {},           // { exerciseId_seriesIndex: [{ date, weight }, ...] }
            workoutHistory: [],    // [{ date, workoutType, duration, exercises: [...] }]
            bodyData: [],          // [{ date, weight, height }]
            objectives: [],        // [{ exerciseId, targetWeight, createdAt }]
            lastModified: null
        };
    }

    updateSyncStatus(message, isConnected) {
        if (this.syncStatusEl) {
            this.syncStatusEl.textContent = message;
            this.syncStatusEl.classList.toggle('connected', isConnected);
        }
    }

    // Data access methods
    getData() {
        return this.getLocalData();
    }

    async saveData(data) {
        await this.syncToRemote(data);
    }

    // Weight records
    async saveWeight(exerciseId, seriesIndex, weight) {
        const data = this.getData();
        const key = `${exerciseId}_${seriesIndex}`;

        if (!data.weights[key]) {
            data.weights[key] = [];
        }

        data.weights[key].push({
            date: new Date().toISOString(),
            weight: weight
        });

        await this.saveData(data);
    }

    getWeightHistory(exerciseId, seriesIndex = null) {
        const data = this.getData();

        if (seriesIndex !== null) {
            const key = `${exerciseId}_${seriesIndex}`;
            return data.weights[key] || [];
        }

        // Get all series for this exercise
        const allWeights = [];
        for (const key of Object.keys(data.weights)) {
            if (key.startsWith(exerciseId + '_')) {
                allWeights.push(...data.weights[key]);
            }
        }
        return allWeights.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    getPersonalRecord(exerciseId, seriesIndex = null) {
        const history = this.getWeightHistory(exerciseId, seriesIndex);
        if (history.length === 0) return null;
        return Math.max(...history.map(h => h.weight));
    }

    // Workout history
    async saveWorkoutSession(session) {
        const data = this.getData();
        data.workoutHistory.push({
            ...session,
            date: new Date().toISOString()
        });
        await this.saveData(data);
    }

    getWorkoutHistory() {
        return this.getData().workoutHistory || [];
    }

    getWorkoutsForMonth(year, month) {
        const history = this.getWorkoutHistory();
        return history.filter(w => {
            const date = new Date(w.date);
            return date.getFullYear() === year && date.getMonth() === month;
        });
    }

    // Body data
    async saveBodyData(weight, height) {
        const data = this.getData();
        data.bodyData.push({
            date: new Date().toISOString(),
            weight: weight,
            height: height
        });
        await this.saveData(data);
    }

    getBodyData() {
        return this.getData().bodyData || [];
    }

    getLatestBodyData() {
        const bodyData = this.getBodyData();
        return bodyData.length > 0 ? bodyData[bodyData.length - 1] : null;
    }

    // Objectives
    async saveObjective(exerciseId, targetWeight) {
        const data = this.getData();
        data.objectives.push({
            id: Date.now().toString(),
            exerciseId: exerciseId,
            targetWeight: targetWeight,
            createdAt: new Date().toISOString(),
            achieved: false
        });
        await this.saveData(data);
    }

    async deleteObjective(objectiveId) {
        const data = this.getData();
        data.objectives = data.objectives.filter(o => o.id !== objectiveId);
        await this.saveData(data);
    }

    async markObjectiveAchieved(objectiveId) {
        const data = this.getData();
        const objective = data.objectives.find(o => o.id === objectiveId);
        if (objective) {
            objective.achieved = true;
            objective.achievedAt = new Date().toISOString();
        }
        await this.saveData(data);
    }

    getObjectives() {
        return this.getData().objectives || [];
    }

    // Export / Import
    exportData() {
        const data = this.getData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gymtracker_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    exportCSV() {
        const data = this.getData();
        let csv = 'Date,Exercice,Série,Poids (kg)\n';

        for (const key of Object.keys(data.weights)) {
            const [exerciseId, seriesIndex] = key.split('_');
            const exercise = getExerciseById(exerciseId);
            const exerciseName = exercise ? exercise.name : exerciseId;

            for (const record of data.weights[key]) {
                csv += `${record.date},${exerciseName},${parseInt(seriesIndex) + 1},${record.weight}\n`;
            }
        }

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gymtracker_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    importedData.lastModified = Date.now();
                    await this.saveData(importedData);
                    resolve(true);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    async clearAllData() {
        const confirmed = confirm('Êtes-vous sûr de vouloir effacer toutes les données ? Cette action est irréversible.');
        if (confirmed) {
            await this.saveData(this.getDefaultData());
            return true;
        }
        return false;
    }

    // Auto-connect on init
    async autoConnect() {
        const savedUrl = localStorage.getItem('gymtracker_firebase_url');
        if (savedUrl) {
            try {
                await this.connect(savedUrl);
            } catch (e) {
                console.log('Auto-connect failed:', e);
            }
        } else {
            this.updateSyncStatus('Hors ligne', false);
        }
    }
}

// Global instance
const firebaseSync = new FirebaseSync();
