// ==========================================
// Gym Tracker - Workout Data
// ==========================================

const WORKOUTS = {
    push: {
        name: 'Push',
        description: 'Épaules & Pectoraux',
        icon: '💪',
        exercises: [
            {
                id: 'overhead_press',
                name: 'Overhead Press',
                gif: 'overhead_press.gif',
                series: [
                    { reps: '4-6', rest: 150 },  // 2'30"
                    { reps: '6-8', rest: 150 },
                    { reps: '8-10', rest: 150 }
                ],
                notes: 'Top set puis -10% du poids à chaque série'
            },
            {
                id: 'developpe_couche',
                name: 'Développé Couché',
                gif: 'bench_press.gif',
                series: [
                    { reps: '4-6', rest: 120 },  // 2'
                    { reps: '6-8', rest: 120 },
                    { reps: '8-10', rest: 120 }
                ],
                notes: 'Top set puis -10% du poids à chaque série'
            },
            {
                id: 'tractions_neutres',
                name: 'Tractions Neutres Focus',
                gif: 'neutral_grip_pullup.gif',
                series: [
                    { reps: '8-12', rest: 90 },  // 1'30"
                    { reps: '8-12', rest: 90 },
                    { reps: '8-12', rest: 90 }
                ],
                notes: 'Tirer avec les bras, pas avec le dos'
            },
            {
                id: 'oiseau_assis',
                name: 'Oiseau Assis Prise Neutre',
                gif: 'seated_rear_delt.gif',
                series: [
                    { reps: '10-15', rest: 60 },  // 1'
                    { reps: '10-15', rest: 60 },
                    { reps: '10-15', rest: 60 }
                ],
                notes: 'Coudes perpendiculaires au corps'
            },
            {
                id: 'upright_row',
                name: 'Upright Row',
                gif: 'upright_row.gif',
                series: [
                    { reps: '12-15', rest: 60 },
                    { reps: '8-12', rest: 60 },
                    { reps: '6-10 AMRAP', rest: 0 }
                ],
                notes: 'Augmenter le poids à chaque série'
            }
        ]
    },
    legs: {
        name: 'Legs',
        description: 'Jambes',
        icon: '🦵',
        exercises: [
            {
                id: 'squat_deadlift',
                name: 'High Bar Squat / Deadlift',
                gif: 'squat.gif',
                series: [
                    { reps: '6-10', rest: 120 },  // 2'
                    { reps: '6-10', rest: 120 },
                    { reps: '6-10', rest: 120 }
                ],
                notes: ''
            },
            {
                id: 'romanian_deadlift',
                name: 'Romanian Deadlift / Fentes',
                gif: 'romanian_deadlift.gif',
                series: [
                    { reps: '10-15', rest: 90 },  // 1'30"
                    { reps: '10-15', rest: 90 },
                    { reps: '10-15', rest: 90 }
                ],
                notes: 'Se reposer 30" entre chaque exercice'
            },
            {
                id: 'leg_curl_extension',
                name: 'Leg Curl + Leg Extension',
                gif: 'leg_curl.gif',
                series: [
                    { reps: '8-12', rest: 30 },
                    { reps: '8-12', rest: 30 },
                    { reps: '8-12', rest: 30 }
                ],
                notes: 'Tempo 1-2-1'
            },
            {
                id: 'extension_mollets',
                name: 'Extension Mollets',
                gif: 'calf_raise.gif',
                series: [
                    { reps: '12-15', rest: 60 },
                    { reps: '8-12', rest: 60 },
                    { reps: '6-10 AMRAP', rest: 0 }
                ],
                notes: 'Tempo 1-2-1'
            },
            {
                id: 'upright_row_penche',
                name: 'Upright Row Penché',
                gif: 'bent_over_row.gif',
                series: [
                    { reps: '15-20', rest: 60 },
                    { reps: '10-15', rest: 60 },
                    { reps: 'AMRAP', rest: 0 }
                ],
                notes: 'Augmenter le poids à chaque série'
            }
        ]
    },
    pull: {
        name: 'Pull',
        description: 'Dos & Biceps',
        icon: '🔙',
        exercises: [
            {
                id: 'developpe_incline',
                name: 'Développé Incliné',
                gif: 'incline_press.gif',
                series: [
                    { reps: '4-6', rest: 150 },  // 2'30"
                    { reps: '6-8', rest: 150 },
                    { reps: '8-10', rest: 150 }
                ],
                notes: 'Top set puis -10% du poids à chaque série'
            },
            {
                id: 'tractions_lestees',
                name: 'Tractions Lestées',
                gif: 'weighted_pullup.gif',
                series: [
                    { reps: '4-6', rest: 120 },  // 2'
                    { reps: '6-8', rest: 120 },
                    { reps: '8-10', rest: 120 }
                ],
                notes: 'Top set puis -10% du poids à chaque série'
            },
            {
                id: 'elevations_frontales',
                name: 'Élévations Frontales',
                gif: 'front_raise.gif',
                series: [
                    { reps: '10-15', rest: 90 },  // 1'30"
                    { reps: '10-15', rest: 90 },
                    { reps: '10-15', rest: 90 }
                ],
                notes: 'Pic de contraction 2" en haut'
            },
            {
                id: 'curl_incline',
                name: 'Curl Incliné Haltères',
                gif: 'incline_curl.gif',
                series: [
                    { reps: '8-12', rest: 90 },  // 1'30"
                    { reps: '8-12', rest: 90 },
                    { reps: '8-12', rest: 90 }
                ],
                notes: ''
            },
            {
                id: 'elevations_laterales',
                name: 'Élévations Latérales',
                gif: 'lateral_raise.gif',
                series: [
                    { reps: '15-20', rest: 60 },
                    { reps: '10-15', rest: 60 },
                    { reps: '8-10 AMRAP', rest: 0 }
                ],
                notes: 'Dernière série en dégressive mécanique'
            }
        ]
    }
};

// Get all exercises as flat array for dropdowns
function getAllExercises() {
    const exercises = [];
    for (const workoutKey of Object.keys(WORKOUTS)) {
        const workout = WORKOUTS[workoutKey];
        for (const exercise of workout.exercises) {
            exercises.push({
                id: exercise.id,
                name: exercise.name,
                workout: workout.name,
                seriesCount: exercise.series.length
            });
        }
    }
    return exercises;
}

// Get exercise by ID
function getExerciseById(exerciseId) {
    for (const workoutKey of Object.keys(WORKOUTS)) {
        const exercise = WORKOUTS[workoutKey].exercises.find(e => e.id === exerciseId);
        if (exercise) return exercise;
    }
    return null;
}
