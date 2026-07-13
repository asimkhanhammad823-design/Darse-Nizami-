# استعمال کی گائیڈ — Admin ke liye (aasan Urdu)

Yeh guide un ke liye hai jo content manage karenge (admin). Aap ko sirf ek
browser chahiye — mobile ya computer, kuch install nahi karna.

## Panel kholna

1. Browser mein yeh link kholen (owner se milega):
   `https://dars-worker.<subdomain>.workers.dev/`
2. Neeche **Login** mein apna **username aur password** daal kar **Log in**
   dabayen. Admin login karte hi panel khul jayega.
3. Isi page par upar **📥 Download the App** button bhi hai — app isi se
   download hoti hai (admin aur students dono yahin se).
4. Tip: is page ko bookmark kar lein ya home screen par add kar lein.

## Darja / Kitab / Lecture banana

1. Pehli screen par **Darjas** ki list hai. Neeche "Add Daraja" mein naam
   likh kar **Create** dabayen (misal: "Darja Awwal").
   - "Sort order" sirf tarteeb ke liye hai — chhota number pehle aata hai.
2. Kisi darja ke aage **Open ›** dabayen → us ki **Books** khul jayengi.
   Neeche se nai kitab add karen (misal: "Nahw Meer").
3. Kitab **Open ›** karen → **Lectures**. Naya lecture add karne ke liye:
   - Title likhen (misal: "Sabaq 1")
   - **Audio file** choose karen (mp3/m4a waghaira)
   - **Upload & Create** dabayen — progress bar chalegi, mukammal hone tak
     page band na karen. Dars ki lambai (duration) khud note ho jati hai.

## Safa (page) markers lagana

Har lecture ke aage **Markers ›** dabayen:

1. Upar player mein audio chalayen.
2. Jab ustaad naya safa shuru karen, **Mark current time** dabayen — waqt
   khud bhar jayega.
3. **Page number** likh kar **Add Marker** dabayen.
4. **Page ki tasveer (optional):** "Page image" mein us safa ki photo/scan
   choose kar ke add karen — phir student ko sunte waqt woh tasveer screen
   par dikhegi (number ki jagah). Tasveer na den to sirf number dikhega.
   Kisi marker ki tasveer badalni ho to us row mein nai file choose kar ke
   **Save** — purani khud delete ho jayegi.
5. Ghalti ho jaye to kisi bhi marker ka waqt/page badal kar **Save**, ya
   **Delete** kar den.

Ab student ki app mein audio ke sath sahi safa number khud dikhega.

## Students ko access dena (Users page)

Upar **Users** kholen:

1. Student ka naam likhen. **Username aur password khali chhor den** to panel
   khud bana dega (ya apni marzi ke likh dein). **Create user** dabayen.
2. Panel **username aur password** dono dikhayega — **yehi do cheezein
   student ko den**, isi se woh app mein login karega.
3. Kisi student ka password badalna ho to us row mein naya password likh kar
   **Save**; access khatam karna ho to **Delete** — foran band ho jayega.
4. Kisi aur ko admin banana ho to us ke "admin" par tick laga kar **Save**.

> Aap ka apna (main admin) username/password bhi isi table mein hai — chahen
> to yahan se badal sakte hain.

## Student app (students ko yeh batayen)

1. App download karen: landing page ke **📥 Download the App** button se, ya
   owner APK file bhej dega. Pehli baar phone "unknown apps" ki ijazat mange
   to de dein.
2. App khol kar apna **username aur password** daalen.
3. Darja → Kitab → Lecture chunen aur sunen:
   - Speed 1x / 1.25x / 1.5x / 2x, 10-second aage/peechhe.
   - Jahan chhora tha, agli baar wahi se shuru hoga — aur home screen ka
     **Continue listening** card aakhri dars foran khol deta hai.
   - Lecture list mein har dars ke neeche progress bar dikhti hai (kitna
     sun chuke hain).
   - Screen par bara **Safa** number audio ke sath badalta rahega — aur agar
     admin ne us safa ki **tasveer** lagai hai to number ki jagah wohi
     tasveer dikhegi (zoom bhi kar sakte hain). Audio isi dauran chalti
     rahegi.
   - **Safa list** button se kisi bhi safa par seedha jump kar sakte hain.
   - **Sleep timer** (chand ka nishan): 15/30/60 minute baad audio khud
     ruk jayegi — raat ko sunne ke liye.
4. Screenshot / screen-recording app ke andar kaam nahi karegi — yeh jaan
   boojh kar band hai taake audio mehfooz rahe.

## Aam masail

- **"Session expired" aaye** → dobara login kar len (mahine mein ek aadh
  baar normal hai).
- **Audio ruk jaye / na chale** → internet check karen, page reload karen.
- **Upload fail ho** → file 100 MB se choti rakhen (64 kbps par ~3 ghante).
  Boht bari file ho to owner se keh kar chhote hisson mein taqseem karwa len.
- **"Too many login attempts"** → 5 minute ruk kar dobara koshish karen.
