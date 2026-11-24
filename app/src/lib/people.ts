/**
 * People in the prototype (PPL). Editors stay demo people (by letter) until a
 * real editor accepts an invite. Colours follow CLAUDE.md "People".
 */
export const PEOPLE = {
  M: { name: 'Maya', last: '', color: '#8E6CFF' },
  L: { name: 'Leo', last: 'Park', color: '#3D8BFF' },
  J: { name: 'Jon', last: 'Diaz', color: '#FF9A4D' },
  F: { name: 'Fay', last: '', color: '#2EC4B6' },
  K: { name: 'Kai', last: '', color: '#C08BFF' },
  S: { name: 'Sara', last: 'Kim', color: '#2EC4B6' },
  D: { name: 'Dani', last: '', color: '#2EC4B6' },
} as const;

export type PersonKey = keyof typeof PEOPLE;

export function person(key: string | null | undefined) {
  return PEOPLE[(key ?? 'L') as PersonKey] ?? PEOPLE.L;
}
