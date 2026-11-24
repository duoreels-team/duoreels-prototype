/** Date wording used across the app: "Fri, Nov 14 · 6 pm". */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Fri, Nov 14" */
export function dayLabel(d: Date) {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "6 pm" or "6:30 pm" */
export function timeLabel(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}

/** "Fri, Nov 14 · 6 pm" */
export function firstCutLabel(d: Date) {
  return `${dayLabel(d)} · ${timeLabel(d)}`;
}

/** 7 days from today at 6 pm. */
export function defaultFirstCut() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(18, 0, 0, 0);
  return d;
}

/** Local calendar day as "YYYY-MM-DD" (for projects.due_date). */
export function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
