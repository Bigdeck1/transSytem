document.addEventListener("DOMContentLoaded", () => {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Step elements
    const stepForm = document.querySelector(".step-form");
    const stepVerify = document.querySelector(".step-verify");
    const stepReset = document.querySelector(".step-reset");
    const stepSuccess = document.querySelector(".step-success");

    // Step 1: Email form
    const forgotForm = document.getElementById("forgotForm");
    const emailInput = document.getElementById("email");
    const errorBox = document.getElementById("error");
    const submitBtn = document.getElementById("submitBtn");

    // Step 2: Verify code
    const verifyForm = document.getElementById("verifyForm");
    const codeInput = document.getElementById("code");
    const verifyError = document.getElementById("verifyError");
    const verifyBtn = document.getElementById("verifyBtn");
    const verifyEmailDisplay = document.getElementById("verifyEmailDisplay");
    const resendBtn = document.getElementById("resendBtn");

    // Step 3: New password
    const resetForm = document.getElementById("resetForm");
    const newPasswordInput = document.getElementById("newPassword");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const resetError = document.getElementById("resetError");
    const updateBtn = document.getElementById("updateBtn");

    // Step 4: Success
    const backBtn = document.getElementById("backBtn");
    const backToLogin = document.getElementById("backToLogin");

    // State
    let currentEmail = "";
    let currentCode = "";

    // Helper: show a specific step, hide all others
    function showStep(step) {
        [stepForm, stepVerify, stepReset, stepSuccess].forEach(s => {
            if (s) s.classList.add("hidden");
        });
        if (step) step.classList.remove("hidden");
        // Re-create icons for newly visible elements
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // =====================
    // STEP 1: Send Recovery Code
    // =====================
    forgotForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorBox.style.display = "none";

        const email = emailInput.value.trim();
        if (!email) {
            errorBox.textContent = "Please enter a valid email address.";
            errorBox.style.display = "block";
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Sending Code...";

        try {
            const result = await window.api.resetPassword(email);

            if (result.success) {
                currentEmail = email;
                verifyEmailDisplay.textContent = email;
                showStep(stepVerify);
            } else {
                errorBox.textContent = result.error || "Failed to send recovery code.";
                errorBox.style.display = "block";
            }
        } catch (err) {
            console.error("Send recovery code error:", err);
            errorBox.textContent = "An internal system error occurred.";
            errorBox.style.display = "block";
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Send Recovery Code";
        }
    });

    // =====================
    // STEP 2: Verify the Code
    // =====================
    verifyForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        verifyError.style.display = "none";

        const code = codeInput.value.trim();
        if (!code || code.length < 6) {
            verifyError.textContent = "Please enter the complete 6-digit code.";
            verifyError.style.display = "block";
            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.textContent = "Verifying...";

        try {
            const result = await window.api.verifyRecoveryCode(currentEmail, code);

            if (result.success) {
                currentCode = code;
                showStep(stepReset);
            } else {
                verifyError.textContent = result.error || "Verification failed.";
                verifyError.style.display = "block";
            }
        } catch (err) {
            console.error("Verify code error:", err);
            verifyError.textContent = "An internal system error occurred.";
            verifyError.style.display = "block";
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.textContent = "Verify Code";
        }
    });

    // Resend button
    if (resendBtn) {
        resendBtn.addEventListener("click", async () => {
            resendBtn.textContent = "Sending...";
            resendBtn.disabled = true;

            try {
                const result = await window.api.resetPassword(currentEmail);
                if (result.success) {
                    resendBtn.textContent = "Code Resent ✓";
                    codeInput.value = "";
                    setTimeout(() => {
                        resendBtn.textContent = "Resend Code";
                        resendBtn.disabled = false;
                    }, 3000);
                } else {
                    resendBtn.textContent = "Failed — Try Again";
                    resendBtn.disabled = false;
                }
            } catch {
                resendBtn.textContent = "Error — Try Again";
                resendBtn.disabled = false;
            }
        });
    }

    // =====================
    // STEP 3: Set New Password
    // =====================
    resetForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        resetError.style.display = "none";

        const newPass = newPasswordInput.value;
        const confirmPass = confirmPasswordInput.value;

        if (newPass.length < 8) {
            resetError.textContent = "Password must be at least 8 characters.";
            resetError.style.display = "block";
            return;
        }

        if (newPass !== confirmPass) {
            resetError.textContent = "Passwords do not match.";
            resetError.style.display = "block";
            return;
        }

        updateBtn.disabled = true;
        updateBtn.textContent = "Updating...";

        try {
            const result = await window.api.updatePasswordWithCode(currentEmail, currentCode, newPass);

            if (result.success) {
                showStep(stepSuccess);
            } else {
                resetError.textContent = result.error || "Failed to update password.";
                resetError.style.display = "block";
            }
        } catch (err) {
            console.error("Update password error:", err);
            resetError.textContent = "An internal system error occurred.";
            resetError.style.display = "block";
        } finally {
            updateBtn.disabled = false;
            updateBtn.textContent = "Update Password";
        }
    });

    // =====================
    // STEP 4: Back to Login
    // =====================
    if (backBtn) {
        backBtn.addEventListener("click", () => {
            window.location.href = "../html/index.html";
        });
    }

    if (backToLogin) {
        backToLogin.addEventListener("click", () => {
            window.location.href = "../html/index.html";
        });
    }
});
