/**
 * alarm_service.js — Audio Alarm & Real-time Notification System for JRR Transport Hub
 */

(function () {
  if (typeof window === "undefined") return;

  class JRRAlarmService {
    constructor() {
      this.audioCtx = null;
      this.isAlarmPlaying = false;
      this.alarmOscillators = [];
      this.alarmInterval = null;
      this.initNotificationPermissions();
      this.initAlarmModal();
      this.listenToRealtimeAlarms();
    }

    initNotificationPermissions() {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }

    getAudioContext() {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
      return this.audioCtx;
    }

    playChime(type = "normal") {
      try {
        const ctx = this.getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        if (type === "urgent") {
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(880, now);
          osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.5);
        } else {
          osc.type = "sine";
          osc.frequency.setValueAtTime(523.25, now); // C5
          osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.4);
        }
      } catch (err) {
        console.warn("[AlarmService] Chime audio error:", err);
      }
    }

    startContinuousAlarm(title, message) {
      if (this.isAlarmPlaying) return;
      this.isAlarmPlaying = true;

      const triggerBeep = () => {
        try {
          const ctx = this.getAudioContext();
          if (!ctx) return;
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(960, now);
          osc.frequency.linearRampToValueAtTime(600, now + 0.3);

          gain.gain.setValueAtTime(0.5, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.35);
        } catch (err) {}
      };

      triggerBeep();
      this.alarmInterval = setInterval(triggerBeep, 600);
      this.showAlarmModal(title, message);

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`🚨 URGENT ALARM: ${title}`, {
          body: message,
          icon: "../../assets/logo.png",
          requireInteraction: true,
        });
      }
    }

    stopContinuousAlarm() {
      this.isAlarmPlaying = false;
      if (this.alarmInterval) {
        clearInterval(this.alarmInterval);
        this.alarmInterval = null;
      }
      this.hideAlarmModal();
    }

    initAlarmModal() {
      if (document.getElementById("jrr-alarm-modal-container")) return;

      const container = document.createElement("div");
      container.id = "jrr-alarm-modal-container";
      container.innerHTML = `
        <style>
          .jrr-alarm-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s ease;
          }
          .jrr-alarm-overlay.active {
            opacity: 1;
            pointer-events: all;
          }
          .jrr-alarm-card {
            background: #ffffff;
            border-radius: 20px;
            padding: 32px;
            max-width: 480px;
            width: 90%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(220, 38, 38, 0.4);
            border: 2px solid #ef4444;
            animation: pulseCard 1s infinite alternate;
          }
          @keyframes pulseCard {
            0% { transform: scale(1); box-shadow: 0 0 20px rgba(239, 68, 68, 0.3); }
            100% { transform: scale(1.02); box-shadow: 0 0 35px rgba(239, 68, 68, 0.6); }
          }
          .jrr-alarm-icon {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            background: #fee2e2;
            color: #dc2626;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            margin: 0 auto 16px;
          }
          .jrr-alarm-title {
            font-size: 22px;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 8px;
          }
          .jrr-alarm-msg {
            font-size: 15px;
            color: #475569;
            line-height: 1.5;
            margin-bottom: 24px;
          }
          .jrr-alarm-btn {
            background: #dc2626;
            color: #ffffff;
            border: none;
            padding: 14px 28px;
            font-size: 15px;
            font-weight: 700;
            border-radius: 12px;
            cursor: pointer;
            width: 100%;
            transition: background 0.2s;
          }
          .jrr-alarm-btn:hover {
            background: #b91c1c;
          }
        </style>
        <div class="jrr-alarm-overlay" id="jrrAlarmOverlay">
          <div class="jrr-alarm-card">
            <div class="jrr-alarm-icon">🚨</div>
            <h3 class="jrr-alarm-title" id="jrrAlarmTitle">Emergency / Urgent Alert</h3>
            <p class="jrr-alarm-msg" id="jrrAlarmMessage">An urgent fleet condition requires your immediate attention.</p>
            <button class="jrr-alarm-btn" id="jrrAlarmAckBtn">Acknowledge & Dismiss Alarm</button>
          </div>
        </div>
      `;
      document.body.appendChild(container);

      const ackBtn = document.getElementById("jrrAlarmAckBtn");
      if (ackBtn) {
        ackBtn.addEventListener("click", () => this.stopContinuousAlarm());
      }
    }

    showAlarmModal(title, message) {
      const overlay = document.getElementById("jrrAlarmOverlay");
      const titleEl = document.getElementById("jrrAlarmTitle");
      const msgEl = document.getElementById("jrrAlarmMessage");
      if (titleEl) titleEl.textContent = title || "Urgent Alarm";
      if (msgEl) msgEl.textContent = message || "Requires administrative attention.";
      if (overlay) overlay.classList.add("active");
    }

    hideAlarmModal() {
      const overlay = document.getElementById("jrrAlarmOverlay");
      if (overlay) overlay.classList.remove("active");
    }

    listenToRealtimeAlarms() {
      // Supabase realtime listener if client is available
      if (typeof window.supabase !== "undefined" || window.api?.onRealtime) {
        const SUPABASE_URL = "https://uocavssoqmwjstmvdgwq.supabase.co";
        const SUPABASE_ANON_KEY =
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvY2F2c3NvcW13anN0bXZkZ3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5OTg2NjEsImV4cCI6MjA3NzU3NDY2MX0.Ki2CEQ7Wqt4eTCOHs1o0mxKdcywtBh7eEk0JAe9H4xk";

        if (window.supabase?.createClient) {
          const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
          client
            .channel("admin-notifications-alarm")
            .on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "notifications" },
              (payload) => {
                const notif = payload.new;
                if (notif.urgency === "alarm" || notif.type === "alert") {
                  this.startContinuousAlarm(notif.title, notif.message);
                } else {
                  this.playChime(notif.urgency === "urgent" ? "urgent" : "normal");
                }
              }
            )
            .subscribe();
        }
      }
    }
  }

  window.alarmService = new JRRAlarmService();
})();
