// The hosted admin panel: a single self-contained HTML page served by the
// Worker at /panel. It uses the same JSON API as everything else (all data
// calls require an admin token), so serving the page itself needs no auth.
// NOTE: the inner JavaScript deliberately avoids template literals so this
// file can hold it inside one TypeScript template string.

export const PANEL_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Dars-e-Nizami Admin</title>
<style>
:root { --navy:#001f3f; --teal:#2ec4b6; --bg:#f4f7f9; --border:#dbe2e8; --danger:#b3261e; }
* { box-sizing:border-box; }
body { margin:0; font-family:-apple-system,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:#1b2733; }
.topbar { background:var(--navy); color:#fff; padding:1rem 1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; }
.topbar .brand { color:#fff; font-weight:700; text-decoration:none; font-size:1.1rem; }
.topnav { display:flex; align-items:center; gap:1.25rem; }
.topnav a { color:#fff; text-decoration:none; font-size:0.95rem; cursor:pointer; }
.topnav a.logout { color:var(--teal); }
.content { max-width:800px; margin:2rem auto; padding:0 1rem; }
h1 { font-size:1.4rem; } h2 { font-size:1.1rem; }
.card { background:#fff; border:1px solid var(--border); border-radius:8px; padding:1.25rem; margin-top:1.5rem; }
.card.success { border-color:var(--teal); background:#ecfbf9; }
.login-card { max-width:340px; margin:4rem auto; }
form { display:flex; flex-direction:column; gap:0.5rem; }
form.inline-form { flex-direction:row; align-items:center; gap:0.4rem; flex-wrap:wrap; }
label { font-size:0.85rem; color:#52606d; }
input, button, select { padding:0.5rem; border-radius:6px; border:1px solid var(--border); font-size:0.95rem; }
input[type=checkbox] { width:auto; }
button { background:var(--navy); color:#fff; border:none; cursor:pointer; }
button.danger { background:var(--danger); }
button:disabled { opacity:0.5; cursor:default; }
button:hover:not(:disabled) { opacity:0.9; }
table { width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--border); border-radius:8px; overflow:hidden; margin-top:1rem; }
th, td { padding:0.6rem 0.8rem; border-bottom:1px solid var(--border); text-align:left; vertical-align:middle; }
td a { color:var(--navy); font-weight:600; text-decoration:none; cursor:pointer; }
.error { color:var(--danger); }
.hint { color:#52606d; font-size:0.85rem; }
.crumb { margin-bottom:0.5rem; }
.crumb a { color:var(--navy); cursor:pointer; text-decoration:none; }
.access-code { font-family:ui-monospace,Consolas,monospace; letter-spacing:0.08em; }
code.access-code { background:#fff; border:1px solid var(--border); border-radius:4px; padding:0.15rem 0.4rem; font-size:1rem; }
.checkbox-label { display:flex; align-items:center; gap:0.4rem; flex-direction:row; }
.download-btn { display:inline-block; background:var(--teal); color:#00312c; font-weight:700; text-decoration:none; padding:0.8rem 1.2rem; border-radius:10px; margin:0.5rem 0; }
.download-btn:hover { opacity:0.9; }
.login-card { text-align:left; }
progress { width:100%; height:12px; }
audio { width:100%; }
input.small { width:5.5rem; }
</style>
</head>
<body>
<header class="topbar">
  <a class="brand" href="#/">Dars-e-Nizami Admin</a>
  <nav class="topnav" id="nav" style="display:none">
    <a href="#/">Darjas</a>
    <a href="#/users">Users</a>
    <a href="/guide" target="_blank" rel="noopener">📖 Guide</a>
    <a class="logout" id="logout-link">Log out</a>
  </nav>
</header>
<main class="content" id="app"></main>
<script>
"use strict";
var TOKEN_KEY = "dars_admin_token";
// Public APK download (GitHub Release asset — no login needed to download).
var APK_URL = "https://github.com/asimkhanhammad823-design/Darse-Nizami-/releases/download/app-latest/dars-nizami.apk";
var app = document.getElementById("app");
var nav = document.getElementById("nav");

function token() { return localStorage.getItem(TOKEN_KEY); }
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function fmtMmss(total) {
  if (total == null) return "-";
  total = Math.floor(total);
  var h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  function p(n) { return (n < 10 ? "0" : "") + n; }
  return h > 0 ? h + ":" + p(m) + ":" + p(s) : p(m) + ":" + p(s);
}
function parseMmss(value) {
  var parts = String(value).trim().split(":");
  if (parts.length < 1 || parts.length > 3) return null;
  var nums = [];
  for (var i = 0; i < parts.length; i++) {
    if (!/^\\d+$/.test(parts[i].trim())) return null;
    nums.push(parseInt(parts[i], 10));
    if (i > 0 && nums[i] > 59) return null;
  }
  var t = 0;
  for (var j = 0; j < nums.length; j++) t = t * 60 + nums[j];
  return t;
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  location.hash = "#/";
  loginView(); // render directly — a hashchange may not fire if the hash didn't change
}
document.getElementById("logout-link").addEventListener("click", logout);

async function api(method, path, body) {
  var opts = { method: method, headers: { authorization: "Bearer " + token() } };
  if (body !== undefined) {
    opts.headers["content-type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  var res = await fetch(path, opts);
  if (res.status === 401) { logout(); throw new Error("Session expired — please log in again."); }
  var data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error((data && data.error) || ("Request failed (" + res.status + ")"));
  return data;
}

function showError(err) { alert(err && err.message ? err.message : String(err)); }

function confirmDelete(message, fn) {
  return async function () {
    if (!confirm(message)) return;
    try { await fn(); render(); } catch (e) { showError(e); }
  };
}

// ---- Views ----

function loginView(message) {
  nav.style.display = "none";
  app.innerHTML =
    '<div class="card login-card" style="text-align:center">' +
    "<h1>Dars-e-Nizami</h1>" +
    '<a class="download-btn" href="' + APK_URL + '">📥 Download the App (Android)</a>' +
    '<p class="hint">Students: install the app, then log in inside it with the username &amp; password your admin gave you.</p>' +
    "</div>" +
    '<div class="card login-card"><h2>Login</h2>' +
    (message ? '<p class="error">' + esc(message) + "</p>" : "") +
    '<form id="login-form">' +
    '<label for="username">Username</label>' +
    '<input id="username" autocapitalize="none" autocomplete="username" required autofocus />' +
    '<label for="password">Password</label>' +
    '<input type="password" id="password" autocomplete="current-password" required />' +
    "<button type=\\"submit\\">Log in</button></form></div>";
  document.getElementById("login-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var username = document.getElementById("username").value.trim();
    var password = document.getElementById("password").value;
    if (!username || !password) return;
    try {
      var res = await fetch("/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username, password: password }),
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      if (!data.is_admin) throw new Error("This is a student account. Please log in from the mobile app instead.");
      localStorage.setItem(TOKEN_KEY, data.token);
      location.hash = "#/";
      render();
    } catch (err) { loginView(err.message); }
  });
}

async function darajasView() {
  var darajas = await api("GET", "/darajas");
  var rows = "";
  for (var i = 0; i < darajas.length; i++) {
    var d = darajas[i];
    rows +=
      "<tr><td colspan=2>" +
      '<form class="inline-form" data-update-daraja="' + d.id + '">' +
      '<input name="name" value="' + esc(d.name) + '" required />' +
      '<input class="small" type="number" name="sort_order" value="' + d.sort_order + '" />' +
      "<button type=\\"submit\\">Save</button>" +
      '<a data-open-daraja="' + d.id + '" data-name="' + esc(d.name) + '">Open &rsaquo;</a>' +
      "</form></td>" +
      '<td><button class="danger" data-del-daraja="' + d.id + '">Delete</button></td></tr>';
  }
  app.innerHTML =
    "<h1>Darjas</h1><table><thead><tr><th colspan=2>Name / Sort</th><th></th></tr></thead><tbody>" +
    (rows || '<tr><td colspan=3 class="hint">No darajas yet — add one below.</td></tr>') +
    "</tbody></table>" +
    '<div class="card"><h2>Add Daraja</h2><form id="add-daraja">' +
    '<label>Name</label><input name="name" required />' +
    '<label>Sort order</label><input type="number" name="sort_order" value="0" />' +
    "<button type=\\"submit\\">Create</button></form></div>";
  wireDarajas();
}

function wireDarajas() {
  document.getElementById("add-daraja").addEventListener("submit", async function (e) {
    e.preventDefault();
    var f = e.target;
    try {
      await api("POST", "/admin/darajas", { name: f.name.value, sort_order: parseInt(f.sort_order.value || "0", 10) });
      render();
    } catch (err) { showError(err); }
  });
  app.querySelectorAll("[data-update-daraja]").forEach(function (f) {
    f.addEventListener("submit", async function (e) {
      e.preventDefault();
      try {
        await api("PUT", "/admin/darajas/" + f.dataset.updateDaraja, {
          name: f.name.value, sort_order: parseInt(f.sort_order.value || "0", 10),
        });
        render();
      } catch (err) { showError(err); }
    });
  });
  app.querySelectorAll("[data-open-daraja]").forEach(function (a) {
    a.addEventListener("click", function () {
      location.hash = "#/daraja/" + a.dataset.openDaraja + "/" + encodeURIComponent(a.dataset.name);
    });
  });
  app.querySelectorAll("[data-del-daraja]").forEach(function (b) {
    b.addEventListener("click", confirmDelete(
      "Delete this daraja and every book, lecture and audio file under it?",
      function () { return api("DELETE", "/admin/darajas/" + b.dataset.delDaraja); }
    ));
  });
}

async function booksView(darajaId, darajaName) {
  var books = await api("GET", "/darajas/" + darajaId + "/books");
  var rows = "";
  for (var i = 0; i < books.length; i++) {
    var b = books[i];
    rows +=
      "<tr><td colspan=2>" +
      '<form class="inline-form" data-update-book="' + b.id + '">' +
      '<input name="name" value="' + esc(b.name) + '" required />' +
      '<input class="small" type="number" name="sort_order" value="' + b.sort_order + '" />' +
      "<button type=\\"submit\\">Save</button>" +
      '<a data-open-book="' + b.id + '" data-name="' + esc(b.name) + '">Open &rsaquo;</a>' +
      "</form></td>" +
      '<td><button class="danger" data-del-book="' + b.id + '">Delete</button></td></tr>';
  }
  app.innerHTML =
    '<p class="crumb"><a href="#/">&larr; All darajas</a></p>' +
    "<h1>" + esc(darajaName) + " — Books</h1>" +
    "<table><thead><tr><th colspan=2>Name / Sort</th><th></th></tr></thead><tbody>" +
    (rows || '<tr><td colspan=3 class="hint">No books yet — add one below.</td></tr>') +
    "</tbody></table>" +
    '<div class="card"><h2>Add Book</h2><form id="add-book">' +
    '<label>Name</label><input name="name" required />' +
    '<label>Sort order</label><input type="number" name="sort_order" value="0" />' +
    "<button type=\\"submit\\">Create</button></form></div>";
  document.getElementById("add-book").addEventListener("submit", async function (e) {
    e.preventDefault();
    var f = e.target;
    try {
      await api("POST", "/admin/books", {
        daraja_id: parseInt(darajaId, 10), name: f.name.value,
        sort_order: parseInt(f.sort_order.value || "0", 10),
      });
      render();
    } catch (err) { showError(err); }
  });
  app.querySelectorAll("[data-update-book]").forEach(function (f) {
    f.addEventListener("submit", async function (e) {
      e.preventDefault();
      try {
        await api("PUT", "/admin/books/" + f.dataset.updateBook, {
          name: f.name.value, sort_order: parseInt(f.sort_order.value || "0", 10),
        });
        render();
      } catch (err) { showError(err); }
    });
  });
  app.querySelectorAll("[data-open-book]").forEach(function (a) {
    a.addEventListener("click", function () {
      location.hash = "#/book/" + a.dataset.openBook + "/" + encodeURIComponent(a.dataset.name) +
        "/" + darajaId + "/" + encodeURIComponent(darajaName);
    });
  });
  app.querySelectorAll("[data-del-book]").forEach(function (b) {
    b.addEventListener("click", confirmDelete(
      "Delete this book and every lecture and audio file under it?",
      function () { return api("DELETE", "/admin/books/" + b.dataset.delBook); }
    ));
  });
}

function audioDuration(file) {
  return new Promise(function (resolve) {
    var url = URL.createObjectURL(file);
    var a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = function () { URL.revokeObjectURL(url); resolve(isFinite(a.duration) ? Math.round(a.duration) : null); };
    a.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
    a.src = url;
  });
}

function uploadWithProgress(file, onProgress) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/admin/upload?filename=" + encodeURIComponent(file.name));
    xhr.setRequestHeader("authorization", "Bearer " + token());
    xhr.upload.onprogress = function (e) { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = function () {
      try {
        var data = JSON.parse(xhr.responseText);
        if (xhr.status >= 400) reject(new Error(data.error || "Upload failed (" + xhr.status + ")"));
        else resolve(data);
      } catch (e) { reject(new Error("Upload failed (" + xhr.status + ")")); }
    };
    xhr.onerror = function () { reject(new Error("Upload failed — check your connection.")); };
    xhr.send(file);
  });
}

async function lecturesView(bookId, bookName, darajaId, darajaName) {
  var lectures = await api("GET", "/books/" + bookId + "/lectures");
  var rows = "";
  for (var i = 0; i < lectures.length; i++) {
    var l = lectures[i];
    rows +=
      "<tr><td colspan=2>" +
      '<form class="inline-form" data-update-lecture="' + l.id + '">' +
      '<input name="title" value="' + esc(l.title) + '" required />' +
      '<input class="small" type="number" name="sort_order" value="' + l.sort_order + '" />' +
      "<button type=\\"submit\\">Save</button>" +
      "<span class=hint>" + fmtMmss(l.duration_seconds) + "</span>" +
      '<a data-open-lecture="' + l.id + '" data-title="' + esc(l.title) + '">Markers &rsaquo;</a>' +
      "</form></td>" +
      '<td><button class="danger" data-del-lecture="' + l.id + '">Delete</button></td></tr>';
  }
  app.innerHTML =
    '<p class="crumb"><a href="#/daraja/' + darajaId + "/" + encodeURIComponent(darajaName) + '">&larr; Back to books</a></p>' +
    "<h1>" + esc(bookName) + " — Lectures</h1>" +
    "<table><thead><tr><th colspan=2>Title / Sort / Duration</th><th></th></tr></thead><tbody>" +
    (rows || '<tr><td colspan=3 class="hint">No lectures yet — upload one below.</td></tr>') +
    "</tbody></table>" +
    '<div class="card"><h2>Add Lecture (upload audio)</h2><form id="add-lecture">' +
    '<label>Title</label><input name="title" required />' +
    '<label>Audio file (mp3 / m4a / aac / ogg / opus / wav / flac)</label>' +
    '<input type="file" name="audio" accept="audio/*" required />' +
    '<label>Sort order</label><input type="number" name="sort_order" value="0" />' +
    '<button type="submit" id="upload-btn">Upload &amp; Create</button>' +
    '<progress id="upload-progress" value="0" max="1" style="display:none"></progress>' +
    '<p class="hint">Uploads up to ~100 MB per file (about 3 hours at 64 kbps).</p>' +
    "</form></div>";
  document.getElementById("add-lecture").addEventListener("submit", async function (e) {
    e.preventDefault();
    var f = e.target;
    var file = f.audio.files[0];
    if (!file) return;
    var btn = document.getElementById("upload-btn");
    var bar = document.getElementById("upload-progress");
    btn.disabled = true;
    bar.style.display = "block";
    try {
      var duration = await audioDuration(file);
      var uploaded = await uploadWithProgress(file, function (p) { bar.value = p; });
      await api("POST", "/admin/lectures", {
        book_id: parseInt(bookId, 10),
        title: f.title.value,
        audio_key: uploaded.audio_key,
        duration_seconds: duration,
        sort_order: parseInt(f.sort_order.value || "0", 10),
      });
      render();
    } catch (err) {
      btn.disabled = false;
      bar.style.display = "none";
      showError(err);
    }
  });
  app.querySelectorAll("[data-update-lecture]").forEach(function (f) {
    f.addEventListener("submit", async function (e) {
      e.preventDefault();
      try {
        await api("PUT", "/admin/lectures/" + f.dataset.updateLecture, {
          title: f.title.value, sort_order: parseInt(f.sort_order.value || "0", 10),
        });
        render();
      } catch (err) { showError(err); }
    });
  });
  app.querySelectorAll("[data-open-lecture]").forEach(function (a) {
    a.addEventListener("click", function () {
      location.hash = "#/lecture/" + a.dataset.openLecture + "/" + encodeURIComponent(a.dataset.title) +
        "/" + bookId + "/" + encodeURIComponent(bookName) +
        "/" + darajaId + "/" + encodeURIComponent(darajaName);
    });
  });
  app.querySelectorAll("[data-del-lecture]").forEach(function (b) {
    b.addEventListener("click", confirmDelete(
      "Delete this lecture, its markers, and its audio file?",
      function () { return api("DELETE", "/admin/lectures/" + b.dataset.delLecture); }
    ));
  });
}

async function markersView(lectureId, title, bookId, bookName, darajaId, darajaName) {
  var markers = await api("GET", "/lectures/" + lectureId + "/markers");
  var stream = await api("GET", "/lectures/" + lectureId + "/stream-url");
  var rows = "";
  for (var i = 0; i < markers.length; i++) {
    var m = markers[i];
    rows +=
      "<tr><td>" +
      '<form class="inline-form" data-update-marker="' + m.id + '">' +
      '<input class="small" name="time_mmss" value="' + fmtMmss(m.time_seconds) + '" />' +
      '<input class="small" type="number" name="page_number" value="' + m.page_number + '" min="1" />' +
      '<label class="hint">' + (m.has_image ? "🖼️ image set — replace:" : "add image:") + "</label>" +
      '<input type="file" name="image" accept="image/*" />' +
      "<button type=\\"submit\\">Save</button></form></td>" +
      '<td><button class="danger" data-del-marker="' + m.id + '">Delete</button></td></tr>';
  }
  app.innerHTML =
    '<p class="crumb"><a href="#/book/' + bookId + "/" + encodeURIComponent(bookName) +
    "/" + darajaId + "/" + encodeURIComponent(darajaName) + '">&larr; Back to lectures</a></p>' +
    "<h1>" + esc(title) + "</h1>" +
    '<div class="card"><audio id="player" controls preload="metadata" src="' + esc(stream.url) + '"></audio>' +
    '<p class="hint">The stream link expires after ' + Math.round(stream.expires_in / 60) + " minutes — reload this page if playback stops.</p></div>" +
    "<table><thead><tr><th>Time / Page / Image</th><th></th></tr></thead><tbody>" +
    (rows || '<tr><td colspan=2 class="hint">No markers yet — add the first one below.</td></tr>') +
    "</tbody></table>" +
    '<div class="card"><h2>Add Marker</h2><form id="add-marker">' +
    '<label>Time (mm:ss)</label>' +
    '<div class="inline-form" style="display:flex;gap:0.4rem">' +
    '<input class="small" id="time_mmss" placeholder="10:00" required />' +
    '<button type="button" id="mark-now">Mark current time</button></div>' +
    '<label>Page number</label><input type="number" id="page_number" min="1" required />' +
    '<label>Page image (optional — jpg/png; shown to students on this page)</label>' +
    '<input type="file" id="page_image" accept="image/*" />' +
    '<progress id="marker-progress" value="0" max="1" style="display:none"></progress>' +
    '<button type="submit" id="add-marker-btn">Add Marker</button></form></div>';
  document.getElementById("mark-now").addEventListener("click", function () {
    var player = document.getElementById("player");
    document.getElementById("time_mmss").value = fmtMmss(Math.floor(player.currentTime));
  });
  document.getElementById("add-marker").addEventListener("submit", async function (e) {
    e.preventDefault();
    var t = parseMmss(document.getElementById("time_mmss").value);
    var page = parseInt(document.getElementById("page_number").value, 10);
    if (t == null) { showError(new Error("Time must look like 12:30 (mm:ss) or plain seconds.")); return; }
    var btn = document.getElementById("add-marker-btn");
    var bar = document.getElementById("marker-progress");
    var file = document.getElementById("page_image").files[0];
    btn.disabled = true;
    try {
      var body = { time_seconds: t, page_number: page };
      if (file) {
        bar.style.display = "block";
        var up = await uploadWithProgress(file, function (p) { bar.value = p; });
        body.image_key = up.key;
      }
      await api("POST", "/admin/lectures/" + lectureId + "/markers", body);
      render();
    } catch (err) { btn.disabled = false; bar.style.display = "none"; showError(err); }
  });
  app.querySelectorAll("[data-update-marker]").forEach(function (f) {
    f.addEventListener("submit", async function (e) {
      e.preventDefault();
      var t = parseMmss(f.time_mmss.value);
      if (t == null) { showError(new Error("Time must look like 12:30 (mm:ss) or plain seconds.")); return; }
      var file = f.image.files[0];
      try {
        var body = { time_seconds: t, page_number: parseInt(f.page_number.value, 10) };
        if (file) {
          var up = await uploadWithProgress(file, function () {});
          body.image_key = up.key;
        }
        await api("PUT", "/admin/markers/" + f.dataset.updateMarker, body);
        render();
      } catch (err) { showError(err); }
    });
  });
  app.querySelectorAll("[data-del-marker]").forEach(function (b) {
    b.addEventListener("click", confirmDelete("Delete this marker?", function () {
      return api("DELETE", "/admin/markers/" + b.dataset.delMarker);
    }));
  });
}

async function usersView(created) {
  var users = await api("GET", "/admin/users");
  var rows = "";
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    rows +=
      "<tr><td>" +
      '<form class="inline-form" data-update-user="' + u.id + '">' +
      '<input name="name" value="' + esc(u.name) + '" placeholder="(no name)" />' +
      '<input class="access-code" name="username" value="' + esc(u.username) + '" required title="username" />' +
      '<input class="access-code" name="password" value="' + esc(u.password) + '" required title="password" />' +
      '<label class="checkbox-label"><input type="checkbox" name="is_admin"' + (u.is_admin ? " checked" : "") + " /> admin</label>" +
      "<button type=\\"submit\\">Save</button></form></td>" +
      '<td><button class="danger" data-del-user="' + u.id + '">Delete</button></td></tr>';
  }
  app.innerHTML =
    "<h1>Users &amp; Logins</h1>" +
    (created
      ? '<div class="card success"><strong>User created.</strong><br/>Username: <code class="access-code">' +
        esc(created.username) + '</code> &nbsp; Password: <code class="access-code">' +
        esc(created.password) + "</code><br/>Give these to the student — they log in with them inside the app.</div>"
      : "") +
    '<p class="hint">Each row: name, username, password, admin. Edit any field and press Save. Columns are the login the student/admin uses.</p>' +
    "<table><thead><tr><th>Name / Username / Password / Admin</th><th></th></tr></thead><tbody>" +
    (rows || '<tr><td colspan=2 class="hint">No users yet.</td></tr>') +
    "</tbody></table>" +
    '<div class="card"><h2>Add User</h2><form id="add-user">' +
    "<label>Name (optional, e.g. the student's name)</label><input name=\\"name\\" />" +
    '<label>Username (leave blank to auto-generate)</label>' +
    '<input name="username" class="access-code" placeholder="auto-generate" autocapitalize="none" />' +
    '<label>Password (leave blank to auto-generate)</label>' +
    '<input name="password" class="access-code" placeholder="auto-generate" />' +
    '<label class="checkbox-label"><input type="checkbox" name="is_admin" /> Admin (can use this panel)</label>' +
    "<button type=\\"submit\\">Create user</button></form></div>";
  document.getElementById("add-user").addEventListener("submit", async function (e) {
    e.preventDefault();
    var f = e.target;
    var body = { is_admin: f.is_admin.checked };
    if (f.name.value.trim()) body.name = f.name.value.trim();
    if (f.username.value.trim()) body.username = f.username.value.trim();
    if (f.password.value.trim()) body.password = f.password.value.trim();
    try {
      var newUser = await api("POST", "/admin/users", body);
      usersView(newUser);
    } catch (err) { showError(err); }
  });
  app.querySelectorAll("[data-update-user]").forEach(function (f) {
    f.addEventListener("submit", async function (e) {
      e.preventDefault();
      try {
        await api("PUT", "/admin/users/" + f.dataset.updateUser, {
          name: f.name.value.trim() || null,
          username: f.username.value.trim(),
          password: f.password.value.trim(),
          is_admin: f.is_admin.checked,
        });
        render();
      } catch (err) { showError(err); }
    });
  });
  app.querySelectorAll("[data-del-user]").forEach(function (b) {
    b.addEventListener("click", confirmDelete(
      "Remove this user? Their access code will stop working immediately.",
      function () { return api("DELETE", "/admin/users/" + b.dataset.delUser); }
    ));
  });
}

// ---- Router ----

// Renders are serialized: a hashchange plus a direct render() call must not
// run two async view builds concurrently (the loser would overwrite the
// winner's DOM, wiping anything the user had started typing).
var rendering = false;
var renderQueued = false;
async function render() {
  if (rendering) { renderQueued = true; return; }
  rendering = true;
  try {
    await renderView();
  } finally {
    rendering = false;
    if (renderQueued) { renderQueued = false; render(); }
  }
}

async function renderView() {
  if (!token()) { loginView(); return; }
  nav.style.display = "flex";
  var parts = location.hash.replace(/^#\\/?/, "").split("/");
  try {
    if (parts[0] === "users") { await usersView(); return; }
    if (parts[0] === "daraja" && parts[1]) {
      await booksView(parts[1], decodeURIComponent(parts[2] || ""));
      return;
    }
    if (parts[0] === "book" && parts[1]) {
      await lecturesView(parts[1], decodeURIComponent(parts[2] || ""), parts[3] || "0", decodeURIComponent(parts[4] || ""));
      return;
    }
    if (parts[0] === "lecture" && parts[1]) {
      await markersView(
        parts[1], decodeURIComponent(parts[2] || ""),
        parts[3] || "0", decodeURIComponent(parts[4] || ""),
        parts[5] || "0", decodeURIComponent(parts[6] || "")
      );
      return;
    }
    await darajasView();
  } catch (err) {
    if (token()) {
      app.innerHTML = '<div class="card"><p class="error">' + esc(err.message || err) + "</p>" +
        '<button onclick="render()">Retry</button></div>';
    }
  }
}
window.addEventListener("hashchange", render);
render();
</script>
</body>
</html>`;
