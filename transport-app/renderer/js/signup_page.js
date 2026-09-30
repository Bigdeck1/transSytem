/**
 * renderer/js/signup_page.js
 * Handles the 3-step registration flow:
 *   1. Registration form → 2. Email verification → 3. Pending approval
 */

document.addEventListener("DOMContentLoaded", () => {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // ─── DOM Elements ───
    const signupForm = document.getElementById('signupForm');
    const signupBtn = document.getElementById('signupBtn');
    const debugPanel = document.getElementById('debugPanel');

    // Steps
    const registrationStep = document.getElementById('registrationStep');
    const verificationStep = document.getElementById('verificationStep');
    const pendingApprovalStep = document.getElementById('pendingApprovalStep');

    // Verification
    const verifyEmailDisplay = document.getElementById('verifyEmailDisplay');
    const verifyBtn = document.getElementById('verifyBtn');
    const resendLink = document.getElementById('resendLink');
    const codeDigits = document.querySelectorAll('.code-digit');

    // Form Fields
    const usernameInput = document.getElementById('username');
    const firstnameInput = document.getElementById('firstname');
    const lastnameInput = document.getElementById('lastname');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    let isSubmitting = false;
    let registeredEmail = '';

    // ─── Utility Functions ───
    function logDebug(message, type = 'info') {
        console.log(`[DEBUG][${type.toUpperCase()}]`, message);
        if (!debugPanel) return;
        
        debugPanel.textContent = message;
        switch(type) {
            case 'error': debugPanel.style.color = '#dc2626'; break;
            case 'success': debugPanel.style.color = '#16a34a'; break;
            default: debugPanel.style.color = '#64748b'; break;
        }
    }

    function setLoading(btn, state, loadingText = 'Processing...', originalHTML = '') {
        if (!btn) return;
        if (state) {
            btn.disabled = true;
            btn.innerHTML = loadingText;
        } else {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    function showStep(step) {
        registrationStep.style.display = 'none';
        verificationStep.classList.remove('active');
        pendingApprovalStep.classList.remove('active');

        if (step === 'registration') {
            registrationStep.style.display = 'block';
        } else if (step === 'verification') {
            verificationStep.classList.add('active');
            if (typeof lucide !== 'undefined') lucide.createIcons();
            // Focus first code input
            setTimeout(() => codeDigits[0]?.focus(), 300);
        } else if (step === 'pending') {
            pendingApprovalStep.classList.add('active');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    function getCodeValue() {
        return Array.from(codeDigits).map(input => input.value).join('');
    }

    // ─── Code Input Behavior ───
    codeDigits.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            
            // Only allow digits
            if (!/^\d$/.test(value)) {
                e.target.value = '';
                return;
            }

            // Mark as filled
            e.target.classList.toggle('filled', !!value);

            // Auto-advance to next input
            if (value && index < codeDigits.length - 1) {
                codeDigits[index + 1].focus();
            }

            // Auto-verify when all 6 digits are filled
            const code = getCodeValue();
            if (code.length === 6) {
                handleVerification();
            }
        });

        input.addEventListener('keydown', (e) => {
            // Backspace: go to previous input
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                codeDigits[index - 1].focus();
                codeDigits[index - 1].value = '';
                codeDigits[index - 1].classList.remove('filled');
            }
        });

        // Handle paste
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = (e.clipboardData || window.clipboardData).getData('text').trim();
            if (/^\d{6}$/.test(pastedData)) {
                pastedData.split('').forEach((digit, i) => {
                    if (codeDigits[i]) {
                        codeDigits[i].value = digit;
                        codeDigits[i].classList.add('filled');
                    }
                });
                codeDigits[5]?.focus();
                // Auto-verify
                setTimeout(() => handleVerification(), 200);
            }
        });
    });

    // ─── Guard ───
    if (!signupForm || !signupBtn) {
        console.error("Signup form elements missing.");
        return;
    }

    // ═══════════════════════════════════════
    // STEP 1: Registration Form Submit
    // ═══════════════════════════════════════
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (isSubmitting) return;

        const userData = {
            username: usernameInput.value.trim(),
            firstname: firstnameInput.value.trim(),
            lastname: lastnameInput.value.trim(),
            email: emailInput.value.trim(),
            password: passwordInput.value.trim()
        };

        if (!userData.username || !userData.email || !userData.password) {
            logDebug("Please fill in all required fields.", "error");
            return;
        }

        if (userData.password.length < 8) {
            logDebug("Password must be at least 8 characters.", "error");
            return;
        }

        isSubmitting = true;
        setLoading(signupBtn, true, 'Creating Account...', '');
        logDebug("Registering account...");

        try {
            const result = await window.api.register(userData);

            console.log("[DEBUG] Registration result:", result);

            if (result.success) {
                registeredEmail = userData.email;

                if (result.requiresVerification) {
                    // Show verification step
                    verifyEmailDisplay.textContent = registeredEmail;
                    logDebug("Verification code sent to your email.", "success");
                    showStep('verification');
                } else {
                    // Fallback: no verification needed (shouldn't happen with new code)
                    logDebug("Registration successful!", "success");
                    showStep('pending');
                }
            } else {
                logDebug(result.error || "Registration failed. Please try again.", "error");
                alert(result.error || "Registration failed.");
            }
        } catch (err) {
            console.error("Registration error:", err);
            logDebug("Critical Error: " + (err.message || "Failed to reach system."), "error");
        } finally {
            isSubmitting = false;
            setLoading(signupBtn, false, '', 'Complete Registration <i data-lucide="check" size="18"></i>');
        }
    });

    // ═══════════════════════════════════════
    // STEP 2: Email Verification
    // ═══════════════════════════════════════
    async function handleVerification() {
        const code = getCodeValue();

        if (code.length !== 6) {
            logDebug("Please enter all 6 digits.", "error");
            return;
        }

        if (isSubmitting) return;
        isSubmitting = true;
        setLoading(verifyBtn, true, 'Verifying...', '');
        logDebug("Verifying code...");

        try {
            const result = await window.api.verifySignupCode(registeredEmail, code);

            if (result.success) {
                logDebug("Email verified! Account pending approval.", "success");
                showStep('pending');
            } else {
                logDebug(result.error || "Verification failed.", "error");
                // Clear code inputs
                codeDigits.forEach(input => {
                    input.value = '';
                    input.classList.remove('filled');
                });
                codeDigits[0]?.focus();
            }
        } catch (err) {
            console.error("Verification error:", err);
            logDebug("Error: " + (err.message || "Failed to verify."), "error");
        } finally {
            isSubmitting = false;
            setLoading(verifyBtn, false, '', 'Verify Email <i data-lucide="check-circle" size="18"></i>');
        }
    }

    if (verifyBtn) {
        verifyBtn.addEventListener('click', handleVerification);
    }

    // ─── Resend Code ───
    if (resendLink) {
        resendLink.addEventListener('click', async (e) => {
            e.preventDefault();

            if (resendLink.classList.contains('disabled') || !registeredEmail) return;

            resendLink.classList.add('disabled');
            resendLink.textContent = 'Sending...';

            try {
                const result = await window.api.resendSignupCode(registeredEmail);
                if (result.success) {
                    logDebug("New verification code sent!", "success");
                    resendLink.textContent = 'Code Sent!';
                    // Cooldown: 60 seconds
                    let countdown = 60;
                    const interval = setInterval(() => {
                        countdown--;
                        resendLink.textContent = `Resend in ${countdown}s`;
                        if (countdown <= 0) {
                            clearInterval(interval);
                            resendLink.textContent = 'Resend Code';
                            resendLink.classList.remove('disabled');
                        }
                    }, 1000);
                } else {
                    logDebug(result.error || "Failed to resend code.", "error");
                    resendLink.textContent = 'Resend Code';
                    resendLink.classList.remove('disabled');
                }
            } catch (err) {
                logDebug("Error resending code.", "error");
                resendLink.textContent = 'Resend Code';
                resendLink.classList.remove('disabled');
            }
        });
    }

    // ─── Auto-verify from query parameters ───
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('verify') === 'true' && urlParams.get('email')) {
        registeredEmail = urlParams.get('email').trim();
        verifyEmailDisplay.textContent = registeredEmail;
        logDebug("Please enter the verification code sent to your email.", "info");
        showStep('verification');
        
        // Auto request a code resend on load
        window.api.resendSignupCode(registeredEmail).then(res => {
            if (res.success) {
                logDebug("A verification code has been sent to your email.", "success");
            } else {
                logDebug(res.error || "Failed to send code.", "error");
            }
        }).catch(err => {
            console.error("Auto-resend error:", err);
        });
    }
});
