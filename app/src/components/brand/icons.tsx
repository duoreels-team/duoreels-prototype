/**
 * Duoreels icon set — same 51 icons (and names) as the HTML prototype's ICO map.
 * 24×24 grid, 1.75 stroke, round caps/joins. Filled variants: `<name>-filled`.
 * `spark` (every AI action) carries the Creator-plan crown in its top-right corner.
 * Source of truth: design/duoreels-logo-icon-library.html
 */
import { SvgXml } from 'react-native-svg';

import { Color } from '@/constants/brand';

const PATHS = {
  "back": "<path d=\"m14.5 5.5-6.5 6.5 6.5 6.5\"/>",
  "chev": "<path d=\"m9.5 5.5 6.5 6.5-6.5 6.5\"/>",
  "down": "<path d=\"m6 9.5 6 6 6-6\"/>",
  "up": "<path d=\"M12 19.5V5M6 11l6-6 6 6\"/>",
  "close": "<path d=\"M6.5 6.5l11 11M17.5 6.5l-11 11\"/>",
  "plus": "<path d=\"M12 5v14M5 12h14\"/>",
  "minus": "<path d=\"M5 12h14\"/>",
  "more": "<circle cx=\"5.5\" cy=\"12\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"12\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"18.5\" cy=\"12\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/>",
  "search": "<circle cx=\"10.75\" cy=\"10.75\" r=\"6.25\"/><path d=\"m15.5 15.5 4.5 4.5\"/>",
  "filter": "<path d=\"M4 7h16M7 12h10M10 17h4\"/>",
  "check": "<path d=\"m5.5 12.5 4 4 9-9.5\"/>",
  "undo": "<path d=\"M9 14 4.5 9.5 9 5\"/><path d=\"M4.5 9.5H15a4.5 4.5 0 0 1 0 9h-4\"/>",
  "swap": "<path d=\"M16.5 3.5 20 7l-3.5 3.5M20 7H8.5M7.5 13.5 4 17l3.5 3.5M4 17h11.5\"/>",
  "projects": "<path d=\"M6.5 8H17l-2.5 12H4z\"/><path d=\"M9.66 8 10.5 4H21l-2.5 12h-3.17\"/>",
  "projects-filled": "<path d=\"M6.5 8H17l-2.5 12H4z\" fill=\"currentColor\"/><path d=\"M9.66 8 10.5 4H21l-2.5 12h-3.17\"/><path d=\"m9.3 11.7 3.5 2.3-3.5 2.3z\" fill=\"#000\" stroke=\"#000\" stroke-width=\"1\"/>",
  "market": "<path d=\"M4.5 9.5 6 4.5h12l1.5 5\"/><path d=\"M4.5 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0\"/><path d=\"M5.5 12.5v6a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-6\"/><path d=\"M10 20v-4h4v4\"/>",
  "market-filled": "<path d=\"M4.5 9.5 6 4.5h12l1.5 5z\" fill=\"currentColor\"/><path d=\"M4.5 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0\"/><path d=\"M5.5 12.5v6a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-6z\" fill=\"currentColor\"/><path d=\"M10 20v-4h4v4z\" fill=\"#000\" stroke=\"#000\" stroke-width=\"1\"/>",
  "me": "<circle cx=\"12\" cy=\"8.5\" r=\"4\"/><path d=\"M4.5 20.5c.8-3.7 3.8-5.5 7.5-5.5s6.7 1.8 7.5 5.5\"/>",
  "me-filled": "<circle cx=\"12\" cy=\"8.5\" r=\"4\" fill=\"currentColor\"/><path d=\"M4.5 20.5c.8-3.7 3.8-5.5 7.5-5.5s6.7 1.8 7.5 5.5z\" fill=\"currentColor\"/>",
  "bell": "<path d=\"M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z\"/><path d=\"M10 20.5h4\"/>",
  "mic": "<rect x=\"9\" y=\"3\" width=\"6\" height=\"11\" rx=\"3\"/><path d=\"M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21\"/>",
  "chat": "<path d=\"M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5z\"/>",
  "pen": "<path d=\"M4 20h4L19 9l-4-4L4 16z\"/><path d=\"m13.5 6.5 4 4\"/>",
  "range": "<path d=\"M4 5v14M20 5v14M8 12h8M10.5 9.5 8 12l2.5 2.5M13.5 9.5 16 12l-2.5 2.5\"/>",
  "cover": "<rect x=\"6\" y=\"3\" width=\"12\" height=\"18\" rx=\"2.5\"/><circle cx=\"12\" cy=\"10\" r=\"2.25\"/><path d=\"M8.5 17h7\"/>",
  "spark": "<path d=\"M10.5 5c.55 4 2.5 6 6.75 7.75-4.25 1.75-6.2 3.75-6.75 7.75-.55-4-2.5-6-6.75-7.75C8 11 9.95 9 10.5 5z\"/>",
  "play": "<path d=\"M7.5 5.6v12.8a1 1 0 0 0 1.5.86l10.6-6.4a1 1 0 0 0 0-1.72L9 4.74a1 1 0 0 0-1.5.86z\" fill=\"currentColor\"/>",
  "playf": "<path d=\"M7.5 5.6v12.8a1 1 0 0 0 1.5.86l10.6-6.4a1 1 0 0 0 0-1.72L9 4.74a1 1 0 0 0-1.5.86z\" fill=\"currentColor\"/>",
  "pause": "<rect x=\"6.5\" y=\"5\" width=\"3.5\" height=\"14\" rx=\"1\" fill=\"currentColor\"/><rect x=\"14\" y=\"5\" width=\"3.5\" height=\"14\" rx=\"1\" fill=\"currentColor\"/>",
  "compare": "<rect x=\"3.5\" y=\"4\" width=\"17\" height=\"16\" rx=\"2.5\"/><path d=\"M12 4v16\"/>",
  "full": "<path d=\"M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15\"/>",
  "restart": "<path d=\"M4.5 12a7.5 7.5 0 1 0 2.2-5.3\"/><path d=\"M4.5 4.5V9H9\"/>",
  "cut": "<circle cx=\"6.5\" cy=\"7\" r=\"2.5\"/><circle cx=\"6.5\" cy=\"17\" r=\"2.5\"/><path d=\"M8.6 8.4 20 18M8.6 15.6 20 6\"/>",
  "footage": "<rect x=\"3.5\" y=\"5\" width=\"17\" height=\"14\" rx=\"2.5\"/><path d=\"M10 9.25v5.5l4.75-2.75z\" fill=\"currentColor\"/>",
  "video": "<rect x=\"3\" y=\"6.5\" width=\"12.5\" height=\"11\" rx=\"2.5\"/><path d=\"m15.5 10.5 5-3v9l-5-3\"/>",
  "camera": "<path d=\"M4 8.5A1.5 1.5 0 0 1 5.5 7h2L9 4.5h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z\"/><circle cx=\"12\" cy=\"12.75\" r=\"3.25\"/>",
  "image": "<rect x=\"3.5\" y=\"5\" width=\"17\" height=\"14\" rx=\"2.5\"/><circle cx=\"9\" cy=\"10\" r=\"1.75\"/><path d=\"m4 17.5 5-4.5 4 3.5 3-2.5 4 3.5\"/>",
  "upload": "<path d=\"M12 15.5V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14\"/>",
  "dl": "<path d=\"M12 4v11.5M7.5 11 12 15.5l4.5-4.5M5 19.5h14\"/>",
  "archive": "<rect x=\"3.5\" y=\"4.5\" width=\"17\" height=\"4.5\" rx=\"1.5\"/><path d=\"M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4\"/>",
  "trash": "<path d=\"M4.5 7h15M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 7l.9 11.6A1.5 1.5 0 0 0 8.9 20h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7\"/>",
  "doc": "<path d=\"M7 3.5h6.5L18 8v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5z\"/><path d=\"M13 3.5V8.5h5M9.5 12.5h5M9.5 16h5\"/>",
  "list": "<path d=\"M9.5 6.5h10M9.5 12h10M9.5 17.5h10\"/><circle cx=\"5\" cy=\"6.5\" r=\".9\" fill=\"currentColor\"/><circle cx=\"5\" cy=\"12\" r=\".9\" fill=\"currentColor\"/><circle cx=\"5\" cy=\"17.5\" r=\".9\" fill=\"currentColor\"/>",
  "cal": "<rect x=\"4\" y=\"5\" width=\"16\" height=\"15\" rx=\"2.5\"/><path d=\"M4 10h16M9 3v4M15 3v4\"/>",
  "link": "<path d=\"M10 14a4 4 0 0 0 5.66 0l3-3A4 4 0 0 0 13 5.34l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3A4 4 0 0 0 11 18.66l1-1\"/>",
  "share": "<path d=\"M12 15V3.5M7.5 8 12 3.5 16.5 8\"/><path d=\"M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6\"/>",
  "copy": "<rect x=\"8\" y=\"8\" width=\"12\" height=\"12\" rx=\"2.5\"/><path d=\"M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2\"/>",
  "people": "<circle cx=\"9\" cy=\"9\" r=\"3.25\"/><path d=\"M3.5 19.5c.8-3 3-4.75 5.5-4.75s4.7 1.75 5.5 4.75\"/><circle cx=\"16.5\" cy=\"8\" r=\"2.5\"/><path d=\"M16.25 13.5c2.25 0 3.75 1.4 4.25 3.75\"/>",
  "money": "<rect x=\"3\" y=\"6\" width=\"18\" height=\"12\" rx=\"2.5\"/><circle cx=\"12\" cy=\"12\" r=\"2.5\"/>",
  "bag": "<path d=\"M5.5 8h13l-.9 11a1.5 1.5 0 0 1-1.5 1.4H7.9a1.5 1.5 0 0 1-1.5-1.4z\"/><path d=\"M9 10V7a3 3 0 0 1 6 0v3\"/>",
  "heart": "<path d=\"M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z\"/>",
  "heart-filled": "<path d=\"M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z\" fill=\"currentColor\"/>",
  "star": "<path d=\"m12 3.75 2.5 5.1 5.6.8-4.05 3.95.95 5.6L12 16.55l-5 2.65.95-5.6L3.9 9.65l5.6-.8z\" fill=\"currentColor\"/>",
  "starf": "<path d=\"m12 3.75 2.5 5.1 5.6.8-4.05 3.95.95 5.6L12 16.55l-5 2.65.95-5.6L3.9 9.65l5.6-.8z\" fill=\"currentColor\"/>",
  "bolt": "<path d=\"M13 3 5 13.5h6l-1 7.5 8-10.5h-6z\"/>",
} as const;

export type IconName = keyof typeof PATHS;

const CROWN = "<defs><linearGradient id=\"a\" x1=\"50\" y1=\"50\" x2=\"81\" y2=\"18\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#C8B3FF\"/><stop offset=\"1\" stop-color=\"#F4EEFF\"/></linearGradient><linearGradient id=\"b\" x1=\"81\" y1=\"18\" x2=\"116\" y2=\"51\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#B49BFF\"/><stop offset=\"1\" stop-color=\"#8460F5\"/></linearGradient><linearGradient id=\"c\" x1=\"50\" y1=\"51\" x2=\"81\" y2=\"96\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#A487FF\"/><stop offset=\"1\" stop-color=\"#EFE8FF\"/></linearGradient><linearGradient id=\"d\" x1=\"116\" y1=\"51\" x2=\"81\" y2=\"96\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#6D45E4\"/><stop offset=\"1\" stop-color=\"#5A33D2\"/></linearGradient><linearGradient id=\"e\" x1=\"20\" y1=\"44\" x2=\"42\" y2=\"96\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#7A54EE\"/><stop offset=\"1\" stop-color=\"#5B34D4\"/></linearGradient><linearGradient id=\"f\" x1=\"45\" y1=\"51\" x2=\"70\" y2=\"96\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#8C69FA\"/><stop offset=\"1\" stop-color=\"#CDBAFF\"/></linearGradient><linearGradient id=\"g\" x1=\"118\" y1=\"51\" x2=\"100\" y2=\"96\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#7651EC\"/><stop offset=\"1\" stop-color=\"#9677FF\"/></linearGradient><linearGradient id=\"h\" x1=\"142\" y1=\"44\" x2=\"122\" y2=\"96\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#B096FF\"/><stop offset=\"1\" stop-color=\"#7B55EE\"/></linearGradient><linearGradient id=\"bar\" x1=\"44\" x2=\"118\" y1=\"0\" y2=\"0\" gradientUnits=\"userSpaceOnUse\"><stop stop-color=\"#E4DAFF\"/><stop offset=\".55\" stop-color=\"#9373FF\"/><stop offset=\".8\" stop-color=\"#7A55F0\"/><stop offset=\"1\" stop-color=\"#C9B6FF\"/></linearGradient><radialGradient id=\"ball\" cx=\".36\" cy=\".32\" r=\".75\"><stop stop-color=\"#fff\"/><stop offset=\".5\" stop-color=\"#EAE2FF\"/><stop offset=\"1\" stop-color=\"#9B7BFF\"/></radialGradient></defs><path d=\"M20 44 45 51 40 96Z\" fill=\"url(#e)\"/><path d=\"M45 51 81 96H40Z\" fill=\"url(#f)\"/><path d=\"M45 51 81 16V51Z\" fill=\"url(#a)\"/><path d=\"M45 51H81V96Z\" fill=\"url(#c)\"/><path d=\"M81 16 117 51H81Z\" fill=\"url(#b)\"/><path d=\"M81 51H117L81 96Z\" fill=\"url(#d)\"/><path d=\"M117 51 81 96H122Z\" fill=\"url(#g)\"/><path d=\"M117 51 142 44 122 96Z\" fill=\"url(#h)\"/><path d=\"M45 51H117\" stroke=\"#fff\" stroke-opacity=\".28\"/><path d=\"M81 18V96\" stroke=\"#fff\" stroke-opacity=\".9\" stroke-width=\"1.4\"/><path d=\"M40 96H122\" stroke=\"#EDE6FF\" stroke-opacity=\".7\" stroke-width=\"1.2\"/><circle cx=\"20\" cy=\"40\" r=\"7\" fill=\"url(#ball)\"/><circle cx=\"81\" cy=\"12\" r=\"8\" fill=\"url(#ball)\"/><circle cx=\"142\" cy=\"40\" r=\"7\" fill=\"url(#ball)\"/><rect x=\"45\" y=\"103\" width=\"72\" height=\"7\" rx=\"2.5\" fill=\"url(#bar)\"/><path d=\"M139 3c.8 4 2 5.2 6 6-4 .8-5.2 2-6 6-.8-4-2-5.2-6-6 4-.8 5.2-2 6-6Z\" fill=\"#fff\" fill-opacity=\".85\"/><path d=\"M12 84c.5 2.6 1.4 3.5 4 4-2.6.5-3.5 1.4-4 4-.5-2.6-1.4-3.5-4-4 2.6-.5 3.5-1.4 4-4Z\" fill=\"#fff\" fill-opacity=\".6\"/>";

function xmlFor(name: IconName, strokeWidth: number) {
  const body = PATHS[name];
  const stroke = `stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`;
  if (name !== 'spark') {
    return `<svg viewBox="0 0 24 24" fill="none" ${stroke}>${body}</svg>`;
  }
  const cw = 10.6;
  const ch = (cw * 116) / 162;
  return `<svg viewBox="0 0 24 24" fill="none"><defs><mask id="crownCut"><rect width="24" height="24" fill="#fff"/><rect x="11.6" y="-2" width="${cw + 4}" height="${(ch + 3.4).toFixed(2)}" rx="3" fill="#000"/></mask></defs><g mask="url(#crownCut)" ${stroke}>${body}</g><svg x="13.2" y="0.4" width="${cw}" height="${ch.toFixed(2)}" viewBox="0 0 162 116">${CROWN}</svg></svg>`;
}

export function Icon({
  name,
  size = 24,
  color = Color.white,
  strokeWidth = 1.75,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return <SvgXml xml={xmlFor(name, strokeWidth)} width={size} height={size} color={color} />;
}

