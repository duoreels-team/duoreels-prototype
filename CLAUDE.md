# Duoreels
Mobile app where creators and video editors work on vertical videos together — share footage, review versions, leave notes.

## Stack & files
Expo + Expo Router + TypeScript + Supabase (auth, database). App code lives in /app. Repo root = HTML prototype on GitHub Pages: never edit or delete it. Never commit .env or keys.

## Design: Duoreels Design System V3 (Figma, Week 8)
https://www.figma.com/design/tXUx0gcvnPVMjTKqhNopHB/AI-Studio--Team-4?node-id=10035-2501
Match the Figma. Use tokens, never ad-hoc values.
- Colour: Black #000000 stage · Surface #1C1C1E cards/sheets · Control #2C2C30 chips, secondary buttons · White #FFFFFF text · Text 2 #B0B0B8 · Meta #8A8A92. Brand = Violet #8E6CFF only (main button, selected, links, the creator). States: Green #3DE0A0 done/new · Yellow #FFC94D waiting. People: creator violet, first editor Blue #3D8BFF, then #FF9A4D, #2EC4B6, #C08BFF. Glass = black 55% + blur 20, only over video. No red, no pink.
- Type: Big Shoulders Display Black, caps only — wordmark 48, main button 21 (max 4 words), tags 15. Geist for everything you read — title Bold 28, heading Bold 20, row SemiBold 16, body 15/140%, label SemiBold 13 (minimum). Geist Mono 12 only for time and eyebrows. No italics.
- Spacing: 8 base · 16 screen edges · 8 between covers · 12 rows · 24 between groups. Canvas 390×844. Tap targets ≥ 44.
- Radius: cards 16 · covers 12 · inputs 12 · tags 6 · buttons and chips full pill · video 0.
- Buttons: pill, 52 high. Main = violet + Big Shoulders; secondary = Control + Geist 15. One main button per screen. The slant is for brand graphics only, never on buttons.
- Video is vertical 9:16, edge to edge. Covers are square, centre-cropped; All projects grid = 3 per row.
- Tab bar: Projects · Marketplace · Me (glass).

## Voice
Like a good editor friend: short, specific, on your side. Sentence case. Name the person ("Leo · v3 to review"). Times, not adjectives ("due Fri", "0:12"). One line. No blame, no hype. States: Your turn · Editing · Waiting · Done.

## Every screen
Handles empty, loading and error states (e.g. "Nothing needs you now.").

## Workflow
One screen at a time. When something works, commit it, then remind me to click "Push origin" in GitHub Desktop.
