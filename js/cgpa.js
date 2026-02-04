(function () {
  // --- Tabs Logic ---
  const tabs = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => c.classList.remove("active"));

      tab.classList.add("active");
      const tabId = tab.dataset.tab;
      document.getElementById(`${tabId}-tab`).classList.add("active");
    });
  });

  // --- Shared Utilities ---
  function getGradeLetter(point) {
    const p = parseFloat(point);
    if (p >= 4.0) return "A";
    if (p >= 3.67) return "A-";
    if (p >= 3.33) return "B+";
    if (p >= 3.0) return "B";
    if (p >= 2.67) return "B-";
    if (p >= 2.33) return "C+";
    if (p >= 2.0) return "C";
    if (p >= 1.67) return "C-";
    if (p >= 1.33) return "D+";
    if (p >= 1.0) return "D";
    return "F";
  }

  // --- Tab 1: CGPA Calculator ---
  const coursesList = document.getElementById("coursesList");
  const retakesList = document.getElementById("retakesList");
  const resultCard = document.getElementById("cgpaResult");

  // Inputs
  const currentCgpaInput = document.getElementById("currentCgpa");
  const attCreditsInput = document.getElementById("attemptedCredits");
  const earnedCreditsInput = document.getElementById("earnedCredits");

  // Add Course/Retake Inputs
  const newCredSel = document.getElementById("newCourseCredit");
  const newGradeSel = document.getElementById("newCourseGrade");
  const retakeCredSel = document.getElementById("retakeCredit");
  const retakeOldSel = document.getElementById("retakeOldGrade");
  const retakeNewSel = document.getElementById("retakeNewGrade");

  let courses = [];
  let retakes = [];
  let calculationCache = {};

  function renderItems() {
    coursesList.innerHTML = courses
      .map(
        (c, i) => `
            <div class="added-item">
                <span class="item-info"><strong>${c.credit} Cr</strong> - Grade: ${getGradeLetter(c.grade)} (${c.grade.toFixed(2)})</span>
                <button class="btn-remove-item" onclick="removeCourse(${i})"><i class="fas fa-times"></i></button>
            </div>
        `,
      )
      .join("");

    retakesList.innerHTML = retakes
      .map(
        (r, i) => `
            <div class="added-item retake">
                <span class="item-info"><strong>${r.credit} Cr</strong> - ${getGradeLetter(r.oldGrade)} → ${getGradeLetter(r.newGrade)}</span>
                <button class="btn-remove-item" onclick="removeRetake(${i})"><i class="fas fa-times"></i></button>
            </div>
        `,
      )
      .join("");
  }

  window.removeCourse = (i) => {
    courses.splice(i, 1);
    renderItems();
  };
  window.removeRetake = (i) => {
    retakes.splice(i, 1);
    renderItems();
  };

  document.getElementById("addCourse").addEventListener("click", () => {
    const cr = parseFloat(newCredSel.value);
    const gr = parseFloat(newGradeSel.value);
    if (!cr || isNaN(gr)) return alert("Please select Credit and Grade");
    courses.push({ credit: cr, grade: gr });
    renderItems();
    newCredSel.value = "";
    newGradeSel.value = "";
  });

  document.getElementById("addRetake").addEventListener("click", () => {
    const cr = parseFloat(retakeCredSel.value);
    const oldG = parseFloat(retakeOldSel.value);
    const newG = parseFloat(retakeNewSel.value);
    if (!cr || isNaN(oldG) || isNaN(newG))
      return alert("Please select all retake fields");
    retakes.push({ credit: cr, oldGrade: oldG, newGrade: newG });
    renderItems();
    retakeCredSel.value = "";
    retakeOldSel.value = "";
    retakeNewSel.value = "";
  });

  document.getElementById("resetAll").addEventListener("click", () => {
    courses = [];
    retakes = [];
    currentCgpaInput.value = "";
    attCreditsInput.value = "";
    earnedCreditsInput.value = "";
    renderItems();
    resultCard.style.display = "none";
  });

  document.getElementById("calculateCgpa").addEventListener("click", () => {
    // --- 1. Validation ---
    const curCgpa = parseFloat(currentCgpaInput.value);
    const attCr = parseFloat(attCreditsInput.value);
    const ernCr = parseFloat(earnedCreditsInput.value);

    if (courses.length === 0 && retakes.length === 0)
      return alert("Please add at least one course or retake.");

    const hasInitial = !isNaN(curCgpa) && !isNaN(attCr) && !isNaN(ernCr);

    if (hasInitial) {
      if (ernCr > attCr)
        return alert(
          "Earned credits cannot be greater than attempted credits.",
        );
      if (curCgpa * attCr > ernCr * 4.0)
        return alert("Invalid CGPA! Impossible academic standing detected.");
      if (curCgpa < 0 || curCgpa > 4.0)
        return alert("CGPA must be between 0.00 and 4.00");
    }

    if (retakes.length > 0 && !hasInitial) {
      return alert(
        "To calculate retakes, you MUST enter complete and valid Current Standing.",
      );
    }

    // --- 2. Calculation Logic ---

    // Initial Stats
    let totalPoints = hasInitial ? curCgpa * attCr : 0;
    let totalAttempted = hasInitial ? attCr : 0;
    let totalEarned = hasInitial ? ernCr : 0;

    let trimesterPoints = 0;
    let trimesterCredits = 0; // For Trimester GPA: New + Retake Credits
    let retakeAdj = 0;

    // Process NEW Courses
    courses.forEach((c) => {
      const coursePoints = c.credit * c.grade;

      totalPoints += coursePoints;
      totalAttempted += c.credit; // Increases denominator
      if (c.grade > 0) totalEarned += c.credit;

      trimesterPoints += coursePoints;
      trimesterCredits += c.credit;
    });

    // Process RETAKE Courses
    retakes.forEach((r) => {
      const oldPoints = r.credit * r.oldGrade;
      const newPoints = r.credit * r.newGrade;
      const ptDiff = newPoints - oldPoints;

      totalPoints += ptDiff;
      retakeAdj += ptDiff;

      // Retake impacts Earned Credits if passing a previously failed course
      if (r.oldGrade === 0 && r.newGrade > 0) {
        totalEarned += r.credit;
      } else if (r.oldGrade > 0 && r.newGrade === 0) {
        totalEarned -= r.credit;
      }

      // Retakes count towards Trimester work load
      trimesterPoints += newPoints;
      trimesterCredits += r.credit;
    });

    // --- 3. Final Computation ---
    const finalCgpa = totalAttempted > 0 ? totalPoints / totalAttempted : 0;
    const trimGpa =
      trimesterCredits > 0 ? trimesterPoints / trimesterCredits : 0;

    // --- 4. Display Results ---
    document.getElementById("newCgpa").textContent = finalCgpa.toFixed(2);
    document.getElementById("trimesterGpa").textContent = trimGpa.toFixed(2);
    document.getElementById("totalAttempted").textContent = totalAttempted;
    document.getElementById("totalEarned").textContent = totalEarned;

    if (retakes.length > 0) {
      document.getElementById("retakeImpact").style.display = "flex";
      document.getElementById("pointsAdjusted").textContent =
        (retakeAdj >= 0 ? "+" : "") + retakeAdj.toFixed(2);
    } else {
      document.getElementById("retakeImpact").style.display = "none";
    }

    // Standing Message
    const msgEl = document.getElementById("standingMessage");
    if (finalCgpa >= 3.8) msgEl.textContent = "Outstanding Performance! 🌟";
    else if (finalCgpa >= 3.5) msgEl.textContent = "Excellent Work! 🎓";
    else if (finalCgpa >= 3.0) msgEl.textContent = "Good Standing 👍";
    else if (finalCgpa >= 2.5) msgEl.textContent = "Keep Pushing! 💪";
    else msgEl.textContent = "Needs Improvement ⚠️";

    resultCard.style.display = "block";
    resultCard.scrollIntoView({ behavior: "smooth", block: "center" });

    // Cache for planner
    calculationCache = {
      cgpa: finalCgpa,
      credits: totalAttempted,
      totalPoints: totalPoints,
    };
  });

  // Planner Logic
  document.getElementById("calcTarget").addEventListener("click", () => {
    if (!calculationCache.cgpa)
      return alert("Please calculate your CGPA first!");

    const target = parseFloat(document.getElementById("targetCgpa").value);
    const nextCr = parseFloat(document.getElementById("targetCredits").value);

    if (!target || !nextCr) return;

    const currentPoints = calculationCache.totalPoints;
    const currentCr = calculationCache.credits;

    const totalTargetPoints = target * (currentCr + nextCr);
    const neededPoints = totalTargetPoints - currentPoints;
    const neededGpa = neededPoints / nextCr;

    const resEl = document.getElementById("targetResult");
    resEl.style.display = "block";

    if (neededGpa > 4.0)
      resEl.innerHTML = `Impossible! You'd need GPA <strong style="color:var(--error);">${neededGpa.toFixed(2)}</strong>`;
    else if (neededGpa < 0) resEl.innerHTML = `You can chill! Even 0.00 works.`;
    else
      resEl.innerHTML = `You need a GPA of: <strong style="color:var(--primary); font-size: 1.2rem;">${neededGpa.toFixed(2)}</strong>`;
  });

  // Future CGPA Planner (Inline)
  const plannerGpa = document.getElementById("plannerGpa");
  const plannerCredits = document.getElementById("plannerCredits");

  function updatePlanner() {
    if (!calculationCache.cgpa) return;
    const pGpa = parseFloat(plannerGpa.value);
    const pCr = parseFloat(plannerCredits.value);

    if (isNaN(pGpa) || isNaN(pCr))
      return (document.getElementById("plannerResult").textContent = "__");

    const newPoints = calculationCache.totalPoints + pGpa * pCr;
    const newTotal = calculationCache.credits + pCr;
    const projected = newPoints / newTotal;

    document.getElementById("plannerResult").textContent = projected.toFixed(2);
  }
  plannerGpa.addEventListener("input", updatePlanner);
  plannerCredits.addEventListener("input", updatePlanner);

  // --- Tab 2: Course Grade Calculator ---
  document.getElementById("addCt").addEventListener("click", () => {
    const div = document.createElement("input");
    div.type = "number";
    div.className = "form-group input ct-score";
    div.placeholder = `CT (20)`;
    div.max = 20;
    document.getElementById("ctInputs").appendChild(div);
  });

  document.getElementById("calcCourseGrade").addEventListener("click", () => {
    const ass =
      parseFloat(document.getElementById("marksAssignment").value) || 0;
    const att =
      parseFloat(document.getElementById("marksAttendance").value) || 0;
    const mid = parseFloat(document.getElementById("marksMidterm").value) || 0;
    const fin = parseFloat(document.getElementById("marksFinal").value) || 0;

    // CT Calculation (Best 3 Average)
    const ctInputs = Array.from(document.querySelectorAll(".ct-score"));
    const ctScores = ctInputs
      .map((i) => parseFloat(i.value) || 0)
      .sort((a, b) => b - a);
    const best3 = ctScores.slice(0, 3);
    const avgCt = best3.reduce((a, b) => a + b, 0) / 3;

    const total = Math.min(100, ass + att + mid + fin + avgCt);

    let grade = "F",
      point = "0.00";
    if (total >= 90) {
      grade = "A";
      point = "4.00";
    } else if (total >= 86) {
      grade = "A-";
      point = "3.67";
    } else if (total >= 82) {
      grade = "B+";
      point = "3.33";
    } else if (total >= 78) {
      grade = "B";
      point = "3.00";
    } else if (total >= 74) {
      grade = "B-";
      point = "2.67";
    } else if (total >= 70) {
      grade = "C+";
      point = "2.33";
    } else if (total >= 66) {
      grade = "C";
      point = "2.00";
    } else if (total >= 62) {
      grade = "C-";
      point = "1.67";
    } else if (total >= 58) {
      grade = "D+";
      point = "1.33";
    } else if (total >= 55) {
      grade = "D";
      point = "1.00";
    }

    document.getElementById("finalGradeLetter").textContent = grade;
    document.getElementById("finalGradePoint").textContent = `${point} Points`;
    document.getElementById("totalMarks").textContent = total.toFixed(2);

    const res = document.getElementById("courseGradeResult");
    res.style.display = "block";
    res.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // --- Tab 3: Credit Tracker ---
  document.getElementById("calcTracker").addEventListener("click", () => {
    const completed = parseFloat(
      document.getElementById("trackerCredits").value,
    );
    const trimesters = parseFloat(
      document.getElementById("trackerTrimesters").value,
    );

    if (!completed || !trimesters) return alert("Please enter valid numbers");

    const required = 138;
    const remaining = required - completed;
    const avg = completed / trimesters;
    const estLeft = Math.ceil(remaining / avg);

    document.getElementById("creditsRemaining").textContent = remaining;
    document.getElementById("avgCredits").textContent = avg.toFixed(1);
    document.getElementById("estTimeLeft").textContent =
      estLeft > 0 ? estLeft : 0;

    document.getElementById("trackerResult").style.display = "block";
  });
})();
