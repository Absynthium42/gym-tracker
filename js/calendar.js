// ==========================================
// Gym Tracker - Calendar Module (French)
// ==========================================

class CalendarManager {
    constructor() {
        this.currentYear = new Date().getFullYear();
        this.currentMonth = new Date().getMonth();
        this.monthNames = [
            'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
            'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];
    }

    init() {
        this.render();
        this.setupNavigation();
    }

    setupNavigation() {
        document.getElementById('prev-month')?.addEventListener('click', () => {
            this.currentMonth--;
            if (this.currentMonth < 0) {
                this.currentMonth = 11;
                this.currentYear--;
            }
            this.render();
        });

        document.getElementById('next-month')?.addEventListener('click', () => {
            this.currentMonth++;
            if (this.currentMonth > 11) {
                this.currentMonth = 0;
                this.currentYear++;
            }
            this.render();
        });
    }

    render() {
        const monthLabel = document.getElementById('calendar-month');
        const grid = document.getElementById('calendar-grid');

        if (!monthLabel || !grid) return;

        monthLabel.textContent = `${this.monthNames[this.currentMonth]} ${this.currentYear}`;

        // Keep day headers, remove day cells
        const dayHeaders = grid.querySelectorAll('.day-header');
        grid.innerHTML = '';
        dayHeaders.forEach(h => grid.appendChild(h));

        // Get first day of month (0 = Sunday, convert to Monday-based)
        const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
        const firstDayMondayBased = firstDay === 0 ? 6 : firstDay - 1;

        // Get days in month
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

        // Get days in previous month
        const daysInPrevMonth = new Date(this.currentYear, this.currentMonth, 0).getDate();

        // Get workouts for this month
        const workouts = firebaseSync.getWorkoutsForMonth(this.currentYear, this.currentMonth);
        const workoutDays = {};
        workouts.forEach(w => {
            const day = new Date(w.date).getDate();
            workoutDays[day] = w.workoutType;
        });

        const today = new Date();
        const isCurrentMonth = today.getFullYear() === this.currentYear &&
            today.getMonth() === this.currentMonth;

        // Add prev month days
        for (let i = firstDayMondayBased - 1; i >= 0; i--) {
            const dayEl = this.createDayElement(daysInPrevMonth - i, true);
            grid.appendChild(dayEl);
        }

        // Add current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const isToday = isCurrentMonth && day === today.getDate();
            const workoutType = workoutDays[day];
            const dayEl = this.createDayElement(day, false, isToday, workoutType);
            grid.appendChild(dayEl);
        }

        // Add next month days to fill grid (6 rows max)
        const totalCells = firstDayMondayBased + daysInMonth;
        const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);

        for (let day = 1; day <= remainingCells; day++) {
            const dayEl = this.createDayElement(day, true);
            grid.appendChild(dayEl);
        }
    }

    createDayElement(day, isOtherMonth = false, isToday = false, workoutType = null) {
        const div = document.createElement('div');
        div.className = 'calendar-day';
        div.textContent = day;

        if (isOtherMonth) {
            div.classList.add('other-month');
        }
        if (isToday) {
            div.classList.add('today');
        }
        if (workoutType) {
            div.classList.add('has-workout', `workout-${workoutType}`);
        }

        return div;
    }

    refresh() {
        this.render();
    }
}

// Global instance
const calendarManager = new CalendarManager();
