document.getElementById("calculateBtn").addEventListener("click", calculateTax);
document.getElementById("filingStatus").addEventListener("change", updateDeductionNote);

function updateDeductionNote() {
  const filingStatus = document.getElementById("filingStatus").value;
  const note = document.getElementById("deductionNote");
  note.textContent = `2024 standard deduction for ${filingStatus === "single" ? "single" : "married"} filers`;
}

function calculateTax() {
  const gross = parseFloat(document.getElementById("grossSalary").value) || 0;
  const filingStatus = document.getElementById("filingStatus").value;
  const deductions = parseFloat(document.getElementById("deductions").value) || 0;

  const taxableIncome = Math.max(0, gross - deductions);

  // Federal tax
  let federalTax = 0;
  if (filingStatus === "single") {
    if (taxableIncome <= 11000) federalTax = taxableIncome * 0.1;
    else if (taxableIncome <= 44725) federalTax = 1100 + (taxableIncome - 11000) * 0.12;
    else if (taxableIncome <= 95375) federalTax = 5147 + (taxableIncome - 44725) * 0.22;
    else federalTax = 16290 + (taxableIncome - 95375) * 0.24;
  } else {
    if (taxableIncome <= 22000) federalTax = taxableIncome * 0.1;
    else if (taxableIncome <= 89075) federalTax = 2200 + (taxableIncome - 22000) * 0.12;
    else if (taxableIncome <= 190750) federalTax = 10294 + (taxableIncome - 89075) * 0.22;
    else federalTax = 32580 + (taxableIncome - 190750) * 0.24;
  }

  const socialSecurity = Math.min(gross * 0.062, 9932.4);
  const medicare = gross * 0.0145;
  const stateTax = gross * 0.05;

  const totalTax = federalTax + socialSecurity + medicare + stateTax;
  const netSalary = gross - totalTax;
  const effectiveRate = (totalTax / gross) * 100;

  // Update results
  const format = (n) => "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  document.getElementById("taxableIncome").textContent = format(taxableIncome);
  document.getElementById("federalTax").textContent = format(federalTax);
  document.getElementById("socialSecurity").textContent = format(socialSecurity);
  document.getElementById("medicare").textContent = format(medicare);
  document.getElementById("stateTax").textContent = format(stateTax);
  document.getElementById("totalTax").textContent = format(totalTax);
  document.getElementById("netSalary").textContent = format(netSalary);
  document.getElementById("monthlyNet").textContent = format(netSalary / 12) + " per month";
  document.getElementById("effectiveRate").textContent = effectiveRate.toFixed(2) + "% effective rate";

  document.getElementById("weekly").textContent = format(netSalary / 52);
  document.getElementById("biweekly").textContent = format(netSalary / 26);
  document.getElementById("semimonthly").textContent = format(netSalary / 24);
  document.getElementById("monthly").textContent = format(netSalary / 12);
}
