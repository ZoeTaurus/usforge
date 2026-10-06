// In-game time. Minutes keep counting past midnight (e.g. 2 AM = 26 * 60).
HS.Clock = {
  minutes: HS.START_HOUR * 60,

  hour() {
    return this.minutes / 60;
  },

  format(m = this.minutes) {
    const h = Math.floor(m / 60) % 24;
    const mm = Math.floor(m % 60);
    const suffix = h < 12 ? 'AM' : 'PM';
    return `${h % 12 || 12}:${String(mm).padStart(2, '0')} ${suffix}`;
  },

  // 0 = full daylight, ~0.85 = deep night
  darkness() {
    const h = this.hour();
    if (h < 17) return 0;
    if (h < 20) return (h - 17) / 3 * 0.45;
    if (h < 22) return 0.45 + (h - 20) / 2 * 0.37;
    if (h < 28.5) return 0.82;
    return Math.max(0.3, 0.82 - (h - 28.5) / 1.5 * 0.5);
  },
};
