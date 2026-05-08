async function askGemini() {
    let userInput = document.getElementById("userInput").value;
    let aiResponse = document.getElementById("aiResponse");

    if (!userInput) {
        aiResponse.textContent = "Please enter something.";
        return;
    }

    aiResponse.textContent = "Thinking...";

    try {
        let response = await fetch("http://localhost:3000/ask", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ userInput }),
        });

        let data = await response.json();
        console.log(data);

        if (data.candidates?.length) {
            aiResponse.textContent =
                data.candidates[0].content.parts[0].text;
        } else if (data.error) {
            aiResponse.textContent = "API Error: " + data.error.message;
        } else {
            aiResponse.textContent = "No response from AI";
        }

    } catch (error) {
        aiResponse.textContent = "Error connecting to server.";
        console.log(error);
    }
}


/* underline*/
  document.addEventListener('DOMContentLoaded', () => {
    // Select all your sections (make sure your top-most div/header has class="section" or add its class here)
    const sections = document.querySelectorAll('.section');
    const navLinks = document.querySelectorAll('.nav-links a, .nav__links a');

    // Update active link on scroll
    window.addEventListener('scroll', () => {
      let current = '';

      sections.forEach(section => {
        const sectionTop = section.offsetTop;
        // The 200px offset triggers the underline right as the section comes into view
        if (window.scrollY >= sectionTop - 200) { 
          current = section.getAttribute('id');
        }
      });

      navLinks.forEach(link => {
        link.classList.remove('active');
        
        // THE FIX: We make sure 'current' actually has a name, and we check for an exact match
        if (current && link.getAttribute('href') === `#${current}`) {
          link.classList.add('active');
        }
      });
    });

    // Smoothly handle clicks
    navLinks.forEach(link => {
      link.addEventListener('click', function() {
        navLinks.forEach(l => l.classList.remove('active'));
        this.classList.add('active');
      });
    });
  });

document.addEventListener('DOMContentLoaded', () => {
  
  // Modal Elements
  const desktopLoginBtn = document.getElementById('desktopLoginBtn');
  const mobileLoginBtn = document.getElementById('mobileLoginBtn');
  const authModal = document.getElementById('authModal');
  const closeModal = document.getElementById('closeModal');
  const modalOverlay = document.getElementById('modalOverlay');

  // View Toggle Elements
  const loginView = document.getElementById('loginView');
  const signupView = document.getElementById('signupView');
  const showSignupBtn = document.getElementById('showSignup');
  const showLoginBtn = document.getElementById('showLogin');

  // --- Modal Open/Close Logic ---
  function openModal(e) {
    if(e) e.preventDefault(); 
    if (authModal) authModal.classList.add('active');
  }

  function hideModal() {
    if (authModal) {
      authModal.classList.remove('active');
      // Reset to login view when closed, just to be clean
      setTimeout(() => {
        loginView.style.display = 'block';
        signupView.style.display = 'none';
      }, 300); // Waits for the close animation to finish
    }
  }

  // --- View Swapping Logic ---
  if (showSignupBtn) {
    showSignupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loginView.style.display = 'none';
      signupView.style.display = 'block';
    });
  }

  if (showLoginBtn) {
    showLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      signupView.style.display = 'none';
      loginView.style.display = 'block';
    });
  }

  // Attach Event Listeners
  if (desktopLoginBtn) desktopLoginBtn.addEventListener('click', openModal);
  if (mobileLoginBtn) mobileLoginBtn.addEventListener('click', openModal);
  if (closeModal) closeModal.addEventListener('click', hideModal);
  if (modalOverlay) modalOverlay.addEventListener('click', hideModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && authModal && authModal.classList.contains('active')) {
      hideModal();
    }
  });
  
});
// ==========================================
// 1. YOUR EXISTING MODAL LOGIC (Leave this as is!)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // ... all your modal code ...
});


// ==========================================
// 2. FIREBASE AUTHENTICATION & DATABASE LOGIC
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

// NEW: Firebase Firestore (Database) Imports
import { 
  getFirestore, 
  collection, 
  doc,
  getDoc,
  query, 
  where, 
  getDocs,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAETyqOQAUdpUWjAkbtEJI_QFXf4nrGoos",
  authDomain: "mockmate-ai-dc73f.firebaseapp.com",
  projectId: "mockmate-ai-dc73f",
  storageBucket: "mockmate-ai-dc73f.firebasestorage.app",
  messagingSenderId: "493275586457",
  appId: "1:493275586457:web:839dd3a7bdd2eb8cab7d08",
  measurementId: "G-0YK5X7ZPF4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // NEW: Initialize the Database!

const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const logoutBtn = document.getElementById('logoutBtn');
const landingPage = document.getElementById('landingPage');
const dashboardPage = document.getElementById('dashboardPage');
const authModal = document.getElementById('authModal');

if(signupForm) {
  signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    createUserWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {
        console.log("Signed up successfully:", userCredential.user);
        await setDoc(doc(db, "users", userCredential.user.uid), {
          name,
          email,
          createdAt: new Date()
        });
        if(authModal) authModal.classList.remove('active');
        signupForm.reset();
      })
      .catch((error) => {
        alert("Error signing up: " + error.message);
      });
  });
}

if(loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        console.log("Logged in successfully:", userCredential.user);
        if(authModal) authModal.classList.remove('active');
        loginForm.reset();
      })
      .catch((error) => {
        alert("Invalid email or password.");
      });
  });
}

if(logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
      console.log("User signed out.");
      let login_text = document.getElementById('desktopLoginBtn');
      if (login_text) login_text.style.display = 'block'; // Your custom tweak!
    }).catch((error) => {
      console.error("Error signing out:", error);
    });
  });
}

// ==========================================
// FETCH USER DASHBOARD DATA
// ==========================================
async function loadDashboardData(user) {
  const historyList = document.getElementById('historyList');
  const totalInterviewsEl = document.getElementById('totalInterviews');
  const avgScoreEl = document.getElementById('avgScore');

  if(historyList) historyList.innerHTML = '<p style="color: #888; text-align: center; padding: 2rem 0;">Loading your history...</p>';

  try {
    const q = query(collection(db, "interviews"), where("userId", "==", user.uid));
    const querySnapshot = await getDocs(q);

    // If they have NO history, show the blank/empty state!
    if (querySnapshot.empty) {
      if(historyList) historyList.innerHTML = `
        <div style="text-align: center; padding: 2rem; background: #1a1a1a; border-radius: 8px; border: 1px dashed #333;">
          <p style="color: #aaa; margin-bottom: 1rem;">You haven't completed any mock interviews yet.</p>
          <a href="interview.html" class="btn btn--primary btn--small">Start Your First Interview</a>
        </div>
      `;
      if(totalInterviewsEl) totalInterviewsEl.textContent = "0";
      if(avgScoreEl) avgScoreEl.textContent = "--/100";
      return; 
    }

    // If they DO have history, build the list
    let totalScore = 0;
    let interviewCount = 0;
    let historyHTML = ''; 

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      totalScore += data.score || 0;
      interviewCount++;

      const badgeClass = data.score >= 80 ? 'badge-green' : 'badge-yellow';
      const dateString = data.date || 'Recently';

      historyHTML += `
        <div class="history-item">
          <div class="history-info">
            <h4>${data.role || 'General Mock Interview'}</h4>
            <span class="history-date">${dateString}</span>
          </div>
          <div class="history-score">
            <span class="score ${badgeClass}">${data.score || 0}/100</span>
            <button class="btn btn--outline btn--small">Review</button>
          </div>
        </div>
      `;
    });

    if(historyList) historyList.innerHTML = historyHTML;
    if(totalInterviewsEl) totalInterviewsEl.textContent = interviewCount;
    if(avgScoreEl) {
      const avg = Math.round(totalScore / interviewCount);
      avgScoreEl.textContent = `${avg}/100`;
    }

  } catch (error) {
    console.error("Error fetching history:", error);
    if(historyList) historyList.innerHTML = '<p style="color: #ff4444; text-align: center;">Error loading history. Check console.</p>';
  }
}

async function loadUserProfileName(user) {
  try {
    const profileSnap = await getDoc(doc(db, "users", user.uid));
    const profile = profileSnap.exists() ? profileSnap.data() : {};
    return String(profile.name || profile.fullName || profile.displayName || "").trim();
  } catch (error) {
    console.warn("Could not load user profile name:", error);
    return "";
  }
}

onAuthStateChanged(auth, async (user) => {
  const userIcon = document.getElementById('icon');
  const loginBtn = document.getElementById('desktopLoginBtn');
  const userEmailDisplay = document.getElementById('userEmailDisplay');

  if (user) {
    if (landingPage) landingPage.style.display = 'block'; // keep landing visible
    if (dashboardPage) dashboardPage.style.display = 'none'; // hide until icon click
    if (userIcon) userIcon.style.display = 'block';
    if (loginBtn) loginBtn.style.display = 'none';
    if (userEmailDisplay) {
      const profileName = await loadUserProfileName(user);
      userEmailDisplay.textContent = profileName || user.displayName || user.email.split('@')[0];
    }

    // Attach click listener here so icon is guaranteed to exist
    userIcon.addEventListener('click', () => {
      if(dashboardPage.style.display === 'block'){
        dashboardPage.style.display = 'none';
      }
      else{
        dashboardPage.style.display = 'block';
      }
      if(landingPage.style.display === 'none'){
        landingPage.style.display = 'block';
      }
      else{
        landingPage.style.display = 'none';
      }
    });

    loadDashboardData(user);
  } else {
    if (landingPage) landingPage.style.display = 'block';
    if (dashboardPage) dashboardPage.style.display = 'none';
    if (userIcon) userIcon.style.display = 'none';
  }
});
