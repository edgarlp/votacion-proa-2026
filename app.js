import { firebaseConfig } from "./config.js";

const COURSES = ["1.º", "2.º A", "2.º B", "3.º A", "3.º B", "4.º", "5.º", "6.º"];
const CATEGORIES = {
  coreografia: "Coreografía o producción artística",
  decoracion: "Decoración del aula",
  accesorio: "Accesorio o vestimenta"
};
const AUTHORITY_EMAIL = "edgarfrosso@gmail.com";
const VOTING_DEADLINE = new Date("2026-09-21T15:00:00-03:00");

const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("PEGAR_");
const els = {
  voting: document.querySelector("#votingPanel"), success: document.querySelector("#successPanel"),
  auth: document.querySelector("#authPanel"), results: document.querySelector("#resultsPanel"), form: document.querySelector("#voteForm"),
  teacher: document.querySelector("#teacherName"), confirmation: document.querySelector("#confirmation"),
  message: document.querySelector("#formMessage"), submit: document.querySelector("#submitButton"),
  summary: document.querySelector("#voteSummary"), resultsContainer: document.querySelector("#resultsContainer"),
  totalVotes: document.querySelector("#totalVotes"), modeBadge: document.querySelector("#modeBadge"),
  participantsCount: document.querySelector("#participantsCount"), participantsList: document.querySelector("#participantsList"),
  authForm: document.querySelector("#authForm"), authEmail: document.querySelector("#authorityEmail"),
  authPassword: document.querySelector("#authorityPassword"), authMessage: document.querySelector("#authMessage"),
  loginButton: document.querySelector("#loginButton"), finalWinners: document.querySelector("#finalWinners"),
  countdownPanel: document.querySelector("#countdownPanel"), countdownLabel: document.querySelector("#countdownLabel"),
  countdown: document.querySelector("#countdown"), downloadPdfButton: document.querySelector("#downloadPdfButton")
};
els.registerButton = document.querySelector("#registerButton");
els.authTitle = document.querySelector("#authTitle");
els.authEyebrow = document.querySelector("#authEyebrow");
els.authCopy = document.querySelector("#authCopy");
els.participantsSection = document.querySelector("#participantsSection");
els.resultsEyebrow = document.querySelector("#resultsEyebrow");

let firestoreApi = null;
let authApi = null;
let latestVotes = [];
let deadlineHandled = false;
if (configured) {
  try {
    const appModule = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js");
    const dbModule = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
    const authenticationModule = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js");
    const app = appModule.initializeApp(firebaseConfig);
    firestoreApi = { db: dbModule.getFirestore(app), ...dbModule };
    authApi = { auth: authenticationModule.getAuth(app), ...authenticationModule };
  } catch (error) {
    console.error(error);
    els.message.textContent = "No se pudo conectar con la base de datos. Revisá tu conexión a Internet.";
  }
} else {
  els.modeBadge.classList.remove("hidden");
}

document.querySelectorAll(".category").forEach(fieldset => {
  const category = fieldset.dataset.category;
  const grid = fieldset.querySelector(".course-grid");
  grid.innerHTML = COURSES.map(course => `<label class="course-option"><input type="radio" name="${category}" value="${course}" required><span>${course}</span></label>`).join("");
});

function normalizeName(value) {
  return value.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function digestName(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function selectedVotes() {
  const data = new FormData(els.form);
  return Object.fromEntries(Object.keys(CATEGORIES).map(key => [key, data.get(key)]));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function voteDateTime(value) {
  if (!value) return { date: "Fecha pendiente", time: "" };
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "Fecha no disponible", time: "" };
  return {
    date: date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }),
    time: date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
  };
}

function isVotingClosed() {
  return Date.now() >= VOTING_DEADLINE.getTime();
}

function updateCountdown() {
  const remaining = Math.max(0, VOTING_DEADLINE.getTime() - Date.now());
  if (remaining === 0) {
    els.countdownPanel.classList.add("closed");
    els.countdownLabel.textContent = "La votación está cerrada. Ya podés consultar los resultados finales.";
    els.countdown.classList.add("hidden");
    els.submit.disabled = true;
    els.submit.textContent = "Votación cerrada";
    if (!deadlineHandled) {
      deadlineHandled = true;
      renderFinalWinners(latestVotes);
      if (authApi?.auth.currentUser && !els.voting.classList.contains("hidden")) showResults(false);
    }
    return;
  }
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  document.querySelector("#countdownDays").textContent = String(days).padStart(2, "0");
  document.querySelector("#countdownHours").textContent = String(hours).padStart(2, "0");
  document.querySelector("#countdownMinutes").textContent = String(minutes).padStart(2, "0");
  document.querySelector("#countdownSeconds").textContent = String(seconds).padStart(2, "0");
}

updateCountdown();
setInterval(updateCountdown, 1000);

function validate(name, votes) {
  if (name.trim().length < 5 || !name.trim().includes(" ")) return "Ingresá tu nombre y apellido completos.";
  if (Object.values(votes).some(value => !COURSES.includes(value))) return "Elegí un curso en las tres categorías.";
  if (!els.confirmation.checked) return "Marcá la confirmación antes de enviar.";
  return "";
}

async function saveVote(name, votes) {
  if (firestoreApi) {
    if (!authApi?.auth.currentUser) throw new Error("auth-required");
    const key = authApi.auth.currentUser.uid;
    const ref = firestoreApi.doc(firestoreApi.db, "votos", key);
    const existing = await firestoreApi.getDoc(ref);
    if (existing.exists()) throw new Error("duplicate");
    await firestoreApi.setDoc(ref, { docente: name.trim(), ...votes, creado: firestoreApi.serverTimestamp() });
    return;
  }
  const key = await digestName(normalizeName(name));
  const stored = JSON.parse(localStorage.getItem("proa_votos_demo") || "{}");
  if (stored[key]) throw new Error("duplicate");
  stored[key] = { docente: name.trim(), ...votes, creado: new Date().toISOString() };
  localStorage.setItem("proa_votos_demo", JSON.stringify(stored));
}

async function loadVotes() {
  if (firestoreApi) {
    const snapshot = await firestoreApi.getDocs(firestoreApi.collection(firestoreApi.db, "votos"));
    return snapshot.docs.map(item => item.data());
  }
  return Object.values(JSON.parse(localStorage.getItem("proa_votos_demo") || "{}"));
}

function showOnly(panel) {
  [els.voting, els.success, els.auth, els.results].forEach(item => item.classList.toggle("hidden", item !== panel));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderSummary(votes) {
  els.summary.innerHTML = Object.entries(CATEGORIES).map(([key, label]) => `<div class="summary-row"><span>${label}</span><strong>${votes[key]}</strong></div>`).join("");
}

function categoryCounts(votes, key) {
  const counts = Object.fromEntries(COURSES.map(course => [course, 0]));
  votes.forEach(vote => { if (counts[vote[key]] !== undefined) counts[vote[key]] += 1; });
  return counts;
}

function categoryWinners(votes, key) {
  const counts = categoryCounts(votes, key);
  const max = Math.max(0, ...Object.values(counts));
  return { counts, max, courses: max ? COURSES.filter(course => counts[course] === max) : [] };
}

function renderFinalWinners(votes) {
  if (!isVotingClosed()) {
    els.finalWinners.innerHTML = '<p class="winners-pending">🏆 Los ganadores finales aparecerán cuando cierre la votación.</p>';
    return;
  }
  els.finalWinners.innerHTML = Object.entries(CATEGORIES).map(([key, label]) => {
    const winner = categoryWinners(votes, key);
    const names = winner.courses.length ? winner.courses.join(" · ") : "Sin votos";
    const votesLabel = winner.max === 1 ? "1 voto" : `${winner.max} votos`;
    return `<article class="final-winner"><div class="trophy">🏆</div><small>${escapeHtml(label)}</small><strong>${escapeHtml(names)}</strong><span>${votesLabel}</span></article>`;
  }).join("");
}

function renderResults(votes) {
  latestVotes = votes;
  els.totalVotes.textContent = `${votes.length} ${votes.length === 1 ? "voto" : "votos"}`;
  renderFinalWinners(votes);
  els.resultsContainer.innerHTML = Object.entries(CATEGORIES).map(([key, label]) => {
    const counts = categoryCounts(votes, key);
    const max = Math.max(0, ...Object.values(counts));
    const rows = COURSES.map(course => {
      const count = counts[course];
      const width = votes.length ? (count / votes.length) * 100 : 0;
      const winner = max > 0 && count === max ? '<span class="winner">1.º</span>' : "";
      return `<div class="result-row"><span>${course}${winner}</span><div class="bar-track"><div class="bar" style="width:${width}%"></div></div><strong>${count}</strong></div>`;
    }).join("");
    return `<article class="result-category"><h3>${label}</h3>${rows}</article>`;
  }).join("");

  const participants = votes
    .filter(vote => typeof vote.docente === "string" && vote.docente.trim())
    .map(vote => ({ name: vote.docente.trim(), created: vote.creado }))
    .sort((first, second) => {
      const firstDate = first.created?.toDate?.() || new Date(first.created || 0);
      const secondDate = second.created?.toDate?.() || new Date(second.created || 0);
      return secondDate - firstDate || first.name.localeCompare(second.name, "es", { sensitivity: "base" });
    });

  els.participantsCount.textContent = `${participants.length} ${participants.length === 1 ? "docente" : "docentes"}`;
  els.participantsList.innerHTML = participants.length
    ? participants.map((participant, index) => {
        const votedAt = voteDateTime(participant.created);
        return `<div class="participant"><span>${index + 1}</span><div class="participant-info"><strong>${escapeHtml(participant.name)}</strong><small>${votedAt.date}${votedAt.time ? ` · ${votedAt.time} hs` : ""}</small></div></div>`;
      }).join("")
    : '<p class="no-participants">Todavía no hay docentes registrados.</p>';
}

async function showResults(authorityView = false) {
  try {
    renderResults(await loadVotes());
    els.participantsSection.classList.remove("hidden");
    els.resultsEyebrow.textContent = authorityView ? "Panel de autoridades" : "Resultados en vivo";
    els.downloadPdfButton.classList.toggle("hidden", !authorityView);
    document.querySelector(".authority-actions").classList.toggle("authority-mode", authorityView);
    showOnly(els.results);
  } catch {
    alert("No se pudieron cargar los resultados. Verificá la sesión y la conexión.");
  }
}

els.form.addEventListener("submit", async event => {
  event.preventDefault(); els.message.textContent = "";
  if (isVotingClosed()) {
    els.message.textContent = "La votación cerró el lunes 21/09/2026 a las 15:00 hs.";
    return;
  }
  const name = els.teacher.value; const votes = selectedVotes(); const error = validate(name, votes);
  if (error) { els.message.textContent = error; return; }
  els.submit.disabled = true; els.submit.textContent = "Guardando voto…";
  try {
    await saveVote(name, votes); renderSummary(votes); showOnly(els.success);
  } catch (errorSaving) {
    const duplicate = errorSaving.message === "duplicate";
    const closed = errorSaving.code === "permission-denied" && isVotingClosed();
    els.message.textContent = duplicate ? "Ese docente ya registró una votación." : closed ? "La votación ya está cerrada." : "No se pudo guardar el voto. Revisá la conexión e intentá nuevamente.";
  } finally {
    els.submit.disabled = false; els.submit.innerHTML = "Enviar mi votación <span>→</span>";
  }
});

const directResultsAccess = new URLSearchParams(window.location.search).get("resultados") === "proa2026";

document.querySelector("#finishButton").addEventListener("click", () => {
  showResults(false);
});
document.querySelector("#cancelLoginButton").addEventListener("click", () => { window.location.href = window.location.pathname; });
document.querySelector("#refreshResultsButton").addEventListener("click", () => showResults(directResultsAccess));
document.querySelector("#logoutButton").addEventListener("click", async () => {
  if (authApi) await authApi.signOut(authApi.auth);
});

function imageAsDataUrl(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", .88));
    };
    image.onerror = reject;
    image.src = source;
  });
}

async function downloadPdfReport() {
  if (!window.jspdf?.jsPDF) {
    alert("No se pudo preparar el PDF. Revisá la conexión e intentá nuevamente.");
    return;
  }
  els.downloadPdfButton.disabled = true;
  els.downloadPdfButton.textContent = "Generando PDF…";
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    let y = 18;
    try {
      const logo = await imageAsDataUrl("assets/logo-proa.jpg");
      doc.addImage(logo, "JPEG", 15, 10, 28, 28);
    } catch {}
    doc.setTextColor(31, 55, 92);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Votación Día del Estudiante 2026", 48, y);
    doc.setFontSize(11);
    doc.text("Escuela PROA Sede La Para", 48, y + 7);
    doc.setFont("helvetica", "normal");
    doc.text(isVotingClosed() ? "Informe final" : "Informe provisional", 48, y + 14);
    y = 48;

    const ensureSpace = (needed = 12) => {
      if (y + needed > 282) { doc.addPage(); y = 18; }
    };
    doc.setTextColor(30, 30, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`Total de votos: ${latestVotes.length}`, 15, y);
    y += 10;
    doc.text("Ganadores por categoría", 15, y);
    y += 7;
    doc.setFontSize(10);
    Object.entries(CATEGORIES).forEach(([key, label]) => {
      const winner = categoryWinners(latestVotes, key);
      const names = winner.courses.length ? winner.courses.join(", ") : "Sin votos";
      doc.setFont("helvetica", "bold");
      doc.text(label, 18, y);
      doc.setFont("helvetica", "normal");
      y += 5;
      doc.text(`${names} (${winner.max} ${winner.max === 1 ? "voto" : "votos"})`, 22, y);
      y += 8;
    });

    ensureSpace(25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Resultados completos", 15, y);
    y += 8;
    doc.setFontSize(9);
    Object.entries(CATEGORIES).forEach(([key, label]) => {
      ensureSpace(20);
      doc.setFont("helvetica", "bold");
      doc.text(label, 18, y);
      y += 5;
      const counts = categoryCounts(latestVotes, key);
      doc.setFont("helvetica", "normal");
      COURSES.forEach(course => {
        doc.text(`${course}: ${counts[course]} votos`, 22, y);
        y += 4.5;
      });
      y += 4;
    });

    ensureSpace(18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Docentes que votaron", 15, y);
    y += 8;
    doc.setFontSize(9);
    const participants = latestVotes
      .filter(vote => typeof vote.docente === "string" && vote.docente.trim())
      .sort((a, b) => (b.creado?.toDate?.() || new Date(b.creado || 0)) - (a.creado?.toDate?.() || new Date(a.creado || 0)));
    participants.forEach((vote, index) => {
      ensureSpace(8);
      const votedAt = voteDateTime(vote.creado);
      doc.setFont("helvetica", "bold");
      doc.text(`${index + 1}. ${vote.docente.trim()}`, 18, y);
      doc.setFont("helvetica", "normal");
      doc.text(`${votedAt.date}${votedAt.time ? ` - ${votedAt.time} hs` : ""}`, 145, y);
      y += 6;
    });
    const generated = new Date().toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
    ensureSpace(12);
    y += 3;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 110);
    doc.text(`Generado el ${generated} · Escuela PROA Sede La Para`, 15, y);
    doc.save(`Resultados_Votacion_PROA_2026_${isVotingClosed() ? "Final" : "Provisional"}.pdf`);
  } finally {
    els.downloadPdfButton.disabled = false;
    els.downloadPdfButton.textContent = "Descargar informe PDF";
  }
}

els.downloadPdfButton.addEventListener("click", downloadPdfReport);

els.authForm.addEventListener("submit", async event => {
  event.preventDefault();
  els.authMessage.textContent = "";
  els.loginButton.disabled = true;
  els.loginButton.textContent = "Ingresando…";
  try {
    if (!authApi) throw new Error("auth-unavailable");
    await authApi.signInWithEmailAndPassword(authApi.auth, els.authEmail.value.trim(), els.authPassword.value);
    els.authPassword.value = "";
  } catch (error) {
    console.error(error);
    els.authMessage.textContent = "Correo o contraseña incorrectos.";
  } finally {
    els.loginButton.disabled = false;
    els.loginButton.textContent = directResultsAccess ? "Ingresar al panel" : "Iniciar sesión";
  }
});

els.registerButton.addEventListener("click", async () => {
  els.authMessage.textContent = "";
  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !/^\d{6}$/.test(password)) {
    els.authMessage.textContent = "Ingresá un correo válido y una contraseña de exactamente 6 números.";
    return;
  }
  els.registerButton.disabled = true;
  els.registerButton.textContent = "Creando cuenta…";
  try {
    if (!authApi) throw new Error("auth-unavailable");
    await authApi.createUserWithEmailAndPassword(authApi.auth, email, password);
    els.authPassword.value = "";
  } catch (error) {
    console.error(error);
    els.authMessage.textContent = error.code === "auth/email-already-in-use"
      ? "Ese correo ya está registrado. Usá Iniciar sesión."
      : "No se pudo crear la cuenta. Revisá el correo y usá una contraseña de 6 números.";
  } finally {
    els.registerButton.disabled = false;
    els.registerButton.textContent = "Crear cuenta docente";
  }
});

async function openTeacherArea(user) {
  try {
    const voteRef = firestoreApi.doc(firestoreApi.db, "votos", user.uid);
    const vote = await firestoreApi.getDoc(voteRef);
    if (vote.exists() || isVotingClosed()) await showResults(false);
    else showOnly(els.voting);
  } catch {
    els.authMessage.textContent = "No se pudo comprobar la votación. Intentá nuevamente.";
    showOnly(els.auth);
  }
}

if (directResultsAccess) {
  els.authEyebrow.textContent = "Acceso privado";
  els.authTitle.textContent = "Panel de autoridades";
  els.authCopy.textContent = "Ingresá con la cuenta autorizada para consultar los resultados y los docentes participantes.";
  els.loginButton.textContent = "Ingresar al panel";
  els.registerButton.classList.add("hidden");
  document.querySelector("#cancelLoginButton").classList.remove("hidden");
  if (authApi) {
    authApi.onAuthStateChanged(authApi.auth, async user => {
      if (user && user.email?.toLowerCase() === AUTHORITY_EMAIL) await showResults(true);
      else if (user) {
        await authApi.signOut(authApi.auth);
        els.authMessage.textContent = "Esta cuenta no tiene permiso de autoridad.";
      }
      else showOnly(els.auth);
    });
  } else {
    els.authMessage.textContent = "No se pudo iniciar el acceso de autoridades.";
    showOnly(els.auth);
  }
} else if (authApi) {
  authApi.onAuthStateChanged(authApi.auth, async user => {
    if (user) await openTeacherArea(user);
    else showOnly(els.auth);
  });
} else {
  showOnly(els.voting);
}
