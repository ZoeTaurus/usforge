// Shared namespace + tuning constants.
window.HS = window.HS || {};

HS.TILE = 16;              // pixels per tile (internal resolution)
HS.COLS = 30;
HS.ROWS = 20;              // rows visible on screen (the view scrolls)
HS.MAP_ROWS = 36;          // rows in the whole house
HS.W = HS.COLS * HS.TILE;  // 480
HS.H = HS.ROWS * HS.TILE;  // 320 (view height)
HS.MAP_H = HS.MAP_ROWS * HS.TILE;

HS.SECONDS_PER_HOUR = 14;  // real seconds per in-game hour
HS.START_HOUR = 8;         // 8 AM
HS.END_HOUR = 30;          // 6 AM the next morning (24 + 6)
HS.SLEEP_SPEED = 6;        // time multiplier while sleeping
HS.CHAOS_MAX = 100;
HS.DAYS = 7;
HS.DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

HS.FRIEND = 'Robin';
HS.FAKE = 'R0bin';
HS.HOUSE = 'House';

HS.hr = h => h * 60;
