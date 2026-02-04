(function () {
  var TRIMESTER_FEE = 6500;
  var SCHOLARSHIP_RATES = { none: 1.0, 20: 0.8, 25: 0.75, 50: 0.5, 100: 0.0 };
  var INSTALLMENT_RATES = { first: 0.4, second: 0.3, third: 0.3 };

  var creditsInput = document.getElementById("totalCreditsInput");
  var perCreditFeeInput = document.getElementById("perCreditFee");
  var scholarshipSelect = document.getElementById("scholarshipType");
  var calculateBtn = document.getElementById("calculateTuition");
  var resultCard = document.getElementById("tuitionResult");

  function formatCurrency(amount) {
    return "৳" + amount.toLocaleString("en-BD");
  }

  function calculateTuition() {
    var credits = parseInt(creditsInput.value) || 0;
    var perCreditFee = parseFloat(perCreditFeeInput.value) || 0;
    var scholarshipType = scholarshipSelect.value;

    if (credits <= 0) {
      alert("Please enter valid number of credits");
      return;
    }
    if (perCreditFee <= 0) {
      alert("Please enter valid per-credit fee");
      return;
    }

    var baseTuition = credits * perCreditFee;
    var scholarshipMultiplier = SCHOLARSHIP_RATES[scholarshipType];
    var discountedTuition = baseTuition * scholarshipMultiplier;
    var scholarshipDiscount = baseTuition - discountedTuition;
    var totalPayable = discountedTuition + TRIMESTER_FEE;

    var installment1 = Math.round(totalPayable * INSTALLMENT_RATES.first);
    var installment2 = Math.round(totalPayable * INSTALLMENT_RATES.second);
    var installment3 = totalPayable - installment1 - installment2;

    document.getElementById("baseTuition").textContent =
      formatCurrency(baseTuition);
    document.getElementById("scholarshipDiscount").textContent =
      formatCurrency(scholarshipDiscount);
    document.getElementById("totalPayable").textContent =
      formatCurrency(totalPayable);
    document.getElementById("installment1").textContent =
      formatCurrency(installment1);
    document.getElementById("installment2").textContent =
      formatCurrency(installment2);
    document.getElementById("installment3").textContent =
      formatCurrency(installment3);

    resultCard.style.display = "block";
    resultCard.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  calculateBtn.addEventListener("click", calculateTuition);
})();
