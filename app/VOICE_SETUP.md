# Voice setup (free, about 3 minutes)

Voice notes, the voice brief and Record in Add note turn your voice into text on our
server with Groq's free Whisper. It needs one free key, stored only in Supabase.

## 1. Get a free Groq key

1. Go to **console.groq.com** and sign up (free).
2. Open **API Keys** → **Create API Key**.
3. Give it a name (for example `duoreels`) and copy the key.

Don't paste the key anywhere else: not in the app, not in GitHub, not in chat.

## 2. Put the key in Supabase

1. Open the **Supabase dashboard** → our project **duoreels**.
2. Go to **Edge Functions** → **Secrets**.
3. Add a new secret:
   - Name: `GROQ_API_KEY`
   - Value: paste the key from step 1
4. Click **Save**.

## 3. That's it

Open the app in **Expo Go** and try it:

- **Voice note:** open a project, play the video, tap **Voice**, talk, tap **DONE**.
  You get one note per sentence, pinned where you said it.
- **Voice brief:** New project → the mic next to the brief → talk → tap the mic again.
- **Add note:** tap the video → the mic in the note → talk → stop.

English and Chinese both work.

If you see **"Couldn't hear anything"**, check that the key is saved as `GROQ_API_KEY`
(exact spelling), then try again a little closer to the phone.
If the mic never starts, allow it in **Settings → Expo Go → Microphone**.
