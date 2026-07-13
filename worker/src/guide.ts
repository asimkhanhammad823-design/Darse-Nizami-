// Public help guide served at GET /guide (no login needed).
export const GUIDE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dars-e-Nizami — Istemal ki Aasan Guide</title>
<style>
  :root {
    --navy: #012a4a;
    --navy-soft: #013a63;
    --teal: #2ec4b6;
    --teal-deep: #17998e;
    --bg: #f3f6f8;
    --surface: #ffffff;
    --ink: #17242e;
    --muted: #5b6b78;
    --border: #dde5ea;
    --gold: #c79a3a;
    --gold-bg: #fbf4e1;
    --shadow: 0 1px 2px rgba(1,42,74,.05), 0 8px 24px rgba(1,42,74,.06);
    --radius: 16px;
    --serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif;
    --sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --mono: ui-monospace, "SFMono-Regular", "Cascadia Mono", Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --navy: #6fd3ff;
      --navy-soft: #9adcff;
      --teal: #3fd9c9;
      --teal-deep: #2ec4b6;
      --bg: #0b1620;
      --surface: #121f2b;
      --ink: #e7eef3;
      --muted: #9db0bd;
      --border: #263644;
      --gold: #e3bd63;
      --gold-bg: #2a2412;
      --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
    }
  }
  :root[data-theme="dark"] {
    --navy: #6fd3ff; --navy-soft: #9adcff; --teal: #3fd9c9; --teal-deep: #2ec4b6;
    --bg: #0b1620; --surface: #121f2b; --ink: #e7eef3; --muted: #9db0bd;
    --border: #263644; --gold: #e3bd63; --gold-bg: #2a2412;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
  }
  :root[data-theme="light"] {
    --navy: #012a4a; --navy-soft: #013a63; --teal: #2ec4b6; --teal-deep: #17998e;
    --bg: #f3f6f8; --surface: #ffffff; --ink: #17242e; --muted: #5b6b78;
    --border: #dde5ea; --gold: #c79a3a; --gold-bg: #fbf4e1;
    --shadow: 0 1px 2px rgba(1,42,74,.05), 0 8px 24px rgba(1,42,74,.06);
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: var(--sans);
    line-height: 1.7;
    font-size: 17px;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 720px; margin: 0 auto; padding: 0 20px 80px; }

  /* ---- Hero ---- */
  .hero {
    background:
      radial-gradient(120% 120% at 85% -10%, rgba(46,196,182,.18), transparent 60%),
      linear-gradient(160deg, var(--navy-hero-a), var(--navy-hero-b));
    --navy-hero-a: #013a63;
    --navy-hero-b: #012033;
    color: #eaf4f7;
    border-radius: 0 0 28px 28px;
    padding: 60px 24px 52px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  @media (prefers-color-scheme: dark) {
    .hero { --navy-hero-a: #0a2740; --navy-hero-b: #06131f; }
  }
  :root[data-theme="dark"] .hero { --navy-hero-a: #0a2740; --navy-hero-b: #06131f; }
  :root[data-theme="light"] .hero { --navy-hero-a: #013a63; --navy-hero-b: #012033; }

  .hero .kicker {
    text-transform: uppercase;
    letter-spacing: .22em;
    font-size: 12px;
    color: var(--teal);
    font-weight: 700;
    margin: 0 0 14px;
  }
  .hero h1 {
    font-family: var(--serif);
    font-weight: 600;
    font-size: clamp(30px, 6.5vw, 46px);
    line-height: 1.12;
    margin: 0 0 14px;
    text-wrap: balance;
    color: #fff;
  }
  .hero p {
    margin: 0 auto;
    max-width: 40ch;
    color: #c9dbe4;
    font-size: 17px;
  }
  .crest {
    width: 54px; height: 54px; margin: 0 auto 22px;
    border: 2px solid var(--teal);
    border-radius: 50%;
    display: grid; place-items: center;
    font-family: var(--serif); font-size: 24px; color: var(--teal);
    background: rgba(46,196,182,.08);
  }

  /* ---- Intro ---- */
  .lede {
    margin: 34px 0 8px;
    font-size: 18px;
    color: var(--ink);
  }
  .lede strong { color: var(--navy); }

  /* ---- Key card (link + login) ---- */
  .keycard {
    margin-top: 26px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-top: 4px solid var(--teal);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 22px 22px 24px;
  }
  .keycard h2 { margin: 0 0 4px; font-family: var(--serif); font-size: 20px; color: var(--navy); font-weight: 600; }
  .keycard .sub { margin: 0 0 18px; color: var(--muted); font-size: 14.5px; }
  .field { margin-bottom: 14px; }
  .field:last-child { margin-bottom: 0; }
  .field .lab {
    text-transform: uppercase; letter-spacing: .12em; font-size: 11.5px;
    color: var(--muted); font-weight: 700; margin-bottom: 5px;
  }
  .field .val {
    font-family: var(--mono);
    background: var(--bg);
    border: 1px dashed var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 15px;
    color: var(--ink);
    word-break: break-all;
    display: block;
  }
  .cred-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .cred-row .field { flex: 1 1 140px; margin-bottom: 0; }
  .note {
    margin-top: 16px; font-size: 14px; color: var(--muted);
    border-top: 1px solid var(--border); padding-top: 14px;
  }
  .note b { color: var(--gold); }

  /* ---- Section headings ---- */
  .sec-head {
    display: flex; align-items: baseline; gap: 12px;
    margin: 52px 0 6px;
  }
  .sec-head .n {
    font-family: var(--serif);
    font-size: 15px; font-weight: 700;
    color: var(--teal-deep);
    border: 1.5px solid var(--teal);
    border-radius: 50%;
    width: 34px; height: 34px; flex: none;
    display: grid; place-items: center;
    background: color-mix(in srgb, var(--teal) 10%, transparent);
  }
  .sec-head h2 {
    font-family: var(--serif); font-weight: 600;
    font-size: clamp(22px, 4.5vw, 27px);
    color: var(--navy); margin: 0; line-height: 1.2; text-wrap: balance;
  }
  .sec-sub { color: var(--muted); margin: 2px 0 0 46px; font-size: 15px; }

  /* ---- Steps ---- */
  ol.steps { list-style: none; counter-reset: s; margin: 20px 0 0 0; padding: 0; }
  ol.steps > li {
    counter-increment: s;
    position: relative;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 16px 18px 16px 56px;
    margin-bottom: 12px;
    box-shadow: var(--shadow);
  }
  ol.steps > li::before {
    content: counter(s);
    position: absolute; left: 16px; top: 16px;
    width: 26px; height: 26px; border-radius: 50%;
    background: var(--navy); color: #fff;
    font-size: 14px; font-weight: 700;
    display: grid; place-items: center;
    font-variant-numeric: tabular-nums;
  }
  ol.steps > li b { color: var(--navy); font-weight: 600; }
  ol.steps > li .tip { display: block; margin-top: 6px; font-size: 14px; color: var(--muted); }

  .btn-chip, .ui {
    font-family: var(--sans); font-weight: 600; font-size: 13.5px;
    background: color-mix(in srgb, var(--teal) 16%, transparent);
    color: var(--teal-deep);
    border-radius: 7px; padding: 1px 8px; white-space: nowrap;
    border: 1px solid color-mix(in srgb, var(--teal) 30%, transparent);
  }

  /* ---- Callouts ---- */
  .callout {
    margin: 22px 0 0; padding: 16px 18px;
    background: var(--gold-bg);
    border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent);
    border-radius: 12px;
    font-size: 15px;
  }
  .callout .h { font-weight: 700; color: var(--gold); display: block; margin-bottom: 3px; }

  .divider { height: 1px; background: var(--border); border: 0; margin: 4px 0; }

  /* ---- FAQ ---- */
  .faq { margin-top: 18px; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: var(--surface); box-shadow: var(--shadow); }
  .faq details { border-bottom: 1px solid var(--border); }
  .faq details:last-child { border-bottom: 0; }
  .faq summary {
    cursor: pointer; padding: 15px 18px; font-weight: 600; color: var(--navy);
    list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 12px;
  }
  .faq summary::-webkit-details-marker { display: none; }
  .faq summary::after { content: "+"; color: var(--teal-deep); font-size: 20px; font-weight: 400; }
  .faq details[open] summary::after { content: "–"; }
  .faq .a { padding: 0 18px 16px; color: var(--muted); font-size: 15px; }

  footer { text-align: center; margin-top: 56px; color: var(--muted); font-size: 13.5px; }
  footer .dot { color: var(--teal); }

  a { color: var(--teal-deep); }
  @media (prefers-reduced-motion: no-preference) {
    .reveal { opacity: 0; transform: translateY(10px); animation: rise .6s ease forwards; }
    @keyframes rise { to { opacity: 1; transform: none; } }
  }
</style>
</head>
<body>


<div class="hero">
  <div class="crest">د</div>
  <p class="kicker">Dars-e-Nizami · Admin Guide</p>
  <h1>Aap ka apna Dars-e-Nizami system</h1>
  <p>Ek hi jagah se saara kaam — sabaq daalna, safa markers lagana, aur talaba ko access dena. Yeh guide qadam ba qadam aap ki rahnumai karti hai.</p>
</div>

<div class="wrap">

  <p class="lede reveal">
    <strong>Assalamu Alaikum.</strong> Yeh system aap ke liye banaya gaya hai — is se aap darsi kutub ke <strong>audio sabaq</strong> talaba tak pohanchate hain, har sabaq ke saath <strong>safa number ya safe ki tasveer</strong> dikhti hai, aur har talib-e-ilm ko aap apna <strong>username aur password</strong> dete hain. Sab kuch mobile ya computer ke browser se hota hai — kuch install karne ki zaroorat nahi.
  </p>

  <div class="keycard reveal">
    <h2>Aap ki do cheezein</h2>
    <p class="sub">Inhein sambhal kar rakhein — isi se aap panel mein dakhil hote hain.</p>
    <div class="field">
      <div class="lab">Panel ka Link (browser mein kholein)</div>
      <span class="val">https://dars-worker.ateekkhan-dars.workers.dev/</span>
    </div>
    <div class="cred-row">
      <div class="field">
        <div class="lab">Username</div>
        <span class="val">ateek7865</span>
      </div>
      <div class="field">
        <div class="lab">Password</div>
        <span class="val">ateek7865</span>
      </div>
    </div>
    <p class="note"><b>Pehli baar login ke baad:</b> "Users" page se apna username aur password apni marzi ka badal lein — taake sirf aap ko maloom ho.</p>
  </div>

  <!-- 1 -->
  <div class="sec-head reveal"><span class="n">۱</span><h2>Panel kholna aur login</h2></div>
  <p class="sec-sub">Sab se pehla qadam — apni pehchaan se andar aana.</p>
  <ol class="steps reveal">
    <li>Upar diya gaya <b>link</b> mobile ya computer ke browser (Chrome waghaira) mein kholein.</li>
    <li>Neeche <span class="ui">Login</span> mein apna <b>username</b> aur <b>password</b> likhein aur <span class="ui">Log in</span> dabayein. Andar aate hi panel khul jayega.</li>
    <li>Is page ko <b>bookmark</b> kar lein ya phone ki home screen par add kar lein — taake baar baar link na likhna pade.</li>
  </ol>
  <div class="callout">
    <span class="h">Isi page par app bhi hai</span>
    Usi page par ek <span class="ui">📥 Download the App</span> button hai. App yahin se download hoti hai — aap khud bhi aur talaba bhi.
  </div>

  <!-- 2 -->
  <div class="sec-head reveal"><span class="n">۲</span><h2>Sabaq daalna: Darja → Kitab → Lecture</h2></div>
  <p class="sec-sub">Content teen darjon mein tarteeb hota hai — jaise almaari, khaana, phir kitab.</p>
  <ol class="steps reveal">
    <li>Pehle safhe par <b>Darjas</b> ki fehrist hai. Neeche <span class="ui">Add Daraja</span> mein naam likh kar <span class="ui">Create</span> dabayein — misaal: <em>Darja Awwal</em>.
      <span class="tip">"Sort order" sirf tarteeb ke liye hai (chhota number pehle). Khali chhor dein to bhi theek.</span>
    </li>
    <li>Kisi darje ke aage <span class="ui">Open ›</span> dabayein → us ki <b>Kitabein (Books)</b> khulengi. Neeche se nai kitab add karein — misaal: <em>Nahw Meer</em>.</li>
    <li>Kitab <span class="ui">Open ›</span> karein → <b>Lectures</b>. Naya sabaq daalne ke liye:
      <span class="tip">• <b>Title</b> likhein (misaal: <em>Sabaq 1</em>) &nbsp; • <b>Audio file</b> (mp3) choose karein &nbsp; • <span class="ui">Upload &amp; Create</span> dabayein.</span>
    </li>
    <li>Upload hone tak <b>safha band na karein</b> — chhoti si progress bar chalti hai. Sabaq ki lambai (duration) khud note ho jati hai.</li>
  </ol>
  <div class="callout">
    <span class="h">Ghalti sudhaarna aasan hai</span>
    Har darje / kitab / sabaq ke aage <span class="ui">Save</span> se naam badal sakte hain aur <span class="ui">Delete</span> se hata sakte hain. Kuch delete karein to us ke andar ka sab (aur audio) khud saaf ho jata hai.
  </div>

  <!-- 3 -->
  <div class="sec-head reveal"><span class="n">۳</span><h2>Safa markers — number aur tasveer</h2></div>
  <p class="sec-sub">Yeh batata hai ke kaun se waqt par kaun sa safa chal raha hai — talib ko sunte waqt wohi safa dikhta hai.</p>
  <ol class="steps reveal">
    <li>Kisi sabaq ke aage <span class="ui">Markers ›</span> dabayein. Upar ek audio player khul jata hai.</li>
    <li>Audio chalayein. Jab ustaad naya safa shuru karein, us lamhe <span class="ui">Mark current time</span> dabayein — waqt khud bhar jayega.</li>
    <li><b>Page number</b> likhein.</li>
    <li><b>Page image (optional):</b> us safe ki photo/scan bhi laga sakte hain — phir talib ko number ki jagah <b>wohi tasveer</b> dikhegi (woh zoom bhi kar sakta hai). Tasveer na dein to sirf number dikhega.</li>
    <li><span class="ui">Add Marker</span> dabayein. Bas — us waqt par yeh safa set ho gaya.</li>
  </ol>
  <div class="callout">
    <span class="h">Misaal</span>
    Agar aap 12:30 par safa 9 ka marker lagate hain, to jab talib ka audio 12:30 par pohanchega, screen par khud-ba-khud "Safa 9" (ya us ki tasveer) aa jayega.
  </div>

  <!-- 4 -->
  <div class="sec-head reveal"><span class="n">۴</span><h2>Talaba ko login dena</h2></div>
  <p class="sec-sub">Har talib ka apna username aur password — jise aap banate aur, zaroorat par, band bhi kar sakte hain.</p>
  <ol class="steps reveal">
    <li>Upar <span class="ui">Users</span> kholein.</li>
    <li>Talib ka <b>naam</b> likhein. Username aur password <b>khali chhor dein</b> to system khud aasan sa bana deta hai (ya apni marzi ke likh dein). <span class="ui">Create user</span> dabayein.</li>
    <li>Panel <b>username aur password</b> dono dikhayega — <b>yehi do cheezein us talib ko dein</b>. Isi se woh app mein login karega.
      <span class="tip">Kisi ka password badalna ho to us ki row mein naya likh kar <span class="ui">Save</span>.</span>
    </li>
    <li>Kisi ka access <b>khatam</b> karna ho to us ke aage <span class="ui">Delete</span> — woh foran band ho jayega.</li>
  </ol>
  <div class="callout">
    <span class="h">Kisi ko apna madadgar (admin) banana ho</span>
    Us user ki row mein <span class="ui">admin</span> par nishan (tick) laga kar <span class="ui">Save</span> — phir woh bhi is panel mein aa sakega.
  </div>

  <!-- 5 -->
  <div class="sec-head reveal"><span class="n">۵</span><h2>Talaba app kaise chalayenge</h2></div>
  <p class="sec-sub">Yeh baat aap talaba ko bata sakte hain.</p>
  <ol class="steps reveal">
    <li>Wahi link kholein aur <span class="ui">📥 Download the App</span> se app install karein. (Pehli baar phone "unknown apps" ki ijazat mange to de dein.)</li>
    <li>App khol kar apna <b>username aur password</b> daalein.</li>
    <li>Darja → Kitab → Sabaq chunein aur sunein:
      <span class="tip">• Bara <b>Safa</b> number ya safe ki tasveer audio ke saath badalti rahegi &nbsp; • Raftaar 1x–2x, 10 second aage/peechhe &nbsp; • Jahan chhora tha wahin se dobara shuru &nbsp; • "Continue listening" se aakhri sabaq foran khulta hai.</span>
    </li>
  </ol>

  <!-- FAQ -->
  <div class="sec-head reveal"><span class="n">؟</span><h2>Aam sawaal</h2></div>
  <div class="faq reveal">
    <details>
      <summary>Login nahi ho raha / "Invalid username or password"</summary>
      <div class="a">Username aur password bilkul waise hi likhein jaise diye gaye hain (bare/chhote harf ka farq hota hai). Pehli baar ke liye woh dono <span class="ui">ateek7865</span> hain.</div>
    </details>
    <details>
      <summary>"Session expired" aa jaye</summary>
      <div class="a">Yeh mahine mein kabhi kabhi normal hai — bas dobara login kar lein.</div>
    </details>
    <details>
      <summary>Audio upload ya app slow lage</summary>
      <div class="a">Internet check karein aur safha reload karein. Bohat bara audio (100 MB se zyada) ho to use chhote hisson mein taqseem kar ke daalein.</div>
    </details>
    <details>
      <summary>Kya is sab ka koi kharcha hai?</summary>
      <div class="a">Nahi — poora system muft (free) chalta hai. Koi maahana fees nahi.</div>
    </details>
    <details>
      <summary>Kya main apna password badal sakta hoon?</summary>
      <div class="a">Ji haan. <span class="ui">Users</span> page par apni row mein naya username/password likh kar <span class="ui">Save</span> dabayein.</div>
    </details>
  </div>

  <footer>
    Dars-e-Nizami Audio System <span class="dot">•</span> Yeh guide sambhaal kar rakhein
  </footer>

</div>

</body>
</html>`;
