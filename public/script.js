document.addEventListener("DOMContentLoaded", function () {

    let currentStep = 0;
    const steps = document.querySelectorAll('.question-step');
    const totalSteps = steps.length;
    let answers = {}; // تغيير من const إلى let لسهولة التحكم
    const timerDisplay = document.getElementById('timer');
    const form = document.getElementById('examForm');

    // عرض أول سؤال
    showStep(currentStep);

    // ================= Navigation =================
    function showStep(n) {
        steps.forEach((step, i) => {
            step.style.display = (i === n) ? 'block' : 'none';
        });

        if (document.getElementById('prevBtn')) document.getElementById('prevBtn').disabled = (n === 0);
        if (document.getElementById('nextBtn')) document.getElementById('nextBtn').style.display = (n === totalSteps - 1) ? 'none' : 'inline';
        if (document.getElementById('submitBtn')) document.getElementById('submitBtn').style.display = (n === totalSteps - 1) ? 'inline' : 'none';
    }

    window.changeQuestion = function (n) {
        saveAnswer(currentStep);
        currentStep += n;
        if (currentStep < 0) currentStep = 0;
        if (currentStep >= totalSteps) currentStep = totalSteps - 1;
        showStep(currentStep);
        loadAnswer(currentStep);
    }

    // ================= Save & Load =================
    function saveAnswer(n) {
        const step = steps[n];
        if (!step) return;
        const inputs = step.querySelectorAll('input[type="radio"], textarea');

        inputs.forEach(input => {
            if (input.type === 'radio' && input.checked) {
                answers[input.name] = input.value;
            }
            else if (input.tagName === 'TEXTAREA') {
                answers[input.name] = input.value;
            }
        });
    }

    function loadAnswer(n) {
        const step = steps[n];
        if (!step) return;
        const inputs = step.querySelectorAll('input[type="radio"], textarea');

        inputs.forEach(input => {
            if (answers[input.name]) {
                if (input.type === 'radio' && input.value === answers[input.name]) {
                    input.checked = true;
                }
                else if (input.tagName === 'TEXTAREA') {
                    input.value = answers[input.name];
                }
            }
        });
    }

    // ================= Timer 90 Minutes =================
    let timeLeft = 5400; // 90 minutes

    function updateTimer() {
        if (!timerDisplay) return;

        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;

        timerDisplay.textContent = `Time Left: ${mins}:${secs < 10 ? '0' : ''}${secs}`;

        if (timeLeft <= 0) {
            alert("Time's up! Submitting your exam...");
            submitExam();
        } else {
            timeLeft--;
            setTimeout(updateTimer, 1000);
        }
    }

    updateTimer();

    // ================= Submit Exam =================
    async function submitExam() {
        saveAnswer(currentStep);

        try {
            const response = await fetch('/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    studentName: localStorage.getItem('studentName') || 'Unknown', // نجلب الاسم من التخزين المؤقت
                    answers: answers 
                })
            });

            const data = await response.json();

            if (data.success) {
                alert("Exam submitted successfully!");
                window.onbeforeunload = null;
                window.location.href = "/";
            } else {
                alert("Submission failed: " + (data.message || "Unknown error"));
            }

        } catch (err) {
            console.error("Submission Error:", err);
            alert("Server error. Please check your connection.");
        }
    }

    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (confirm("Are you sure you want to submit the exam?")) {
                submitExam();
            }
        });
    }

    window.onbeforeunload = function () {
        return "Are you sure you want to leave the exam? Your progress might be lost.";
    };
});