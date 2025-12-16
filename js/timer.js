// ==========================================
// Gym Tracker - Timer Module
// ==========================================

class RestTimer {
    constructor() {
        this.duration = 0;
        this.remaining = 0;
        this.intervalId = null;
        this.onTick = null;
        this.onComplete = null;
        this.timerCircle = document.getElementById('timer-circle');
        this.timerText = document.getElementById('timer-text');
    }

    start(seconds, callbacks = {}) {
        this.stop();
        this.duration = seconds;
        this.remaining = seconds;
        this.onTick = callbacks.onTick || null;
        this.onComplete = callbacks.onComplete || null;

        this.updateDisplay();

        this.intervalId = setInterval(() => {
            this.remaining--;
            this.updateDisplay();

            if (this.onTick) {
                this.onTick(this.remaining);
            }

            if (this.remaining <= 0) {
                this.stop();
                if (this.onComplete) {
                    this.onComplete();
                }
            }
        }, 1000);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    skip() {
        this.stop();
        if (this.onComplete) {
            this.onComplete();
        }
    }

    updateDisplay() {
        const minutes = Math.floor(this.remaining / 60);
        const seconds = this.remaining % 60;

        if (this.timerText) {
            this.timerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        if (this.timerCircle) {
            const circumference = 2 * Math.PI * 45;
            const progress = (this.duration - this.remaining) / this.duration;
            const offset = circumference * progress;
            this.timerCircle.style.strokeDasharray = circumference;
            this.timerCircle.style.strokeDashoffset = circumference - offset;
            this.timerCircle.style.stroke = this.getProgressColor(progress);
        }
    }

    getProgressColor(progress) {
        if (progress < 0.5) return '#6366f1';
        if (progress < 0.8) return '#f59e0b';
        return '#ef4444';
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Global timer instance
const restTimer = new RestTimer();
