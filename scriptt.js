// ----------------- Tribute helpers -----------------
const form = document.getElementById('tributeForm');
const nameInput = document.getElementById('name');
const relationInput = document.getElementById('relation');
const messageInput = document.getElementById('message');
const list = document.getElementById('tributeList');
const submit = document.getElementById('submitTribute');
const clearAll = document.getElementById('clearAll');

// ✅ Your live Google Apps Script Web App URL (must end with /exec)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwQcs--tXnGIDnBj3chxePXcnEQB7ww_9bjLMkrrm5FYPuRyQ5fwYAmhSdW3A37qyy15g/exec';

// Unique user UUID for ownership tracking
if (!localStorage.getItem('user_uuid')) {
  localStorage.setItem('user_uuid', crypto.randomUUID());
}
const userUUID = localStorage.getItem('user_uuid');

function loadTributes() {
  const raw = localStorage.getItem('tributes_v1') || '[]';
  try { return JSON.parse(raw); } catch { return []; }
}

function saveTributes(arr) {
  localStorage.setItem('tributes_v1', JSON.stringify(arr));
}

function escapeHtml(s) {
  return (s + '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ----------------- Tribute Grid Display -----------------
function renderTributeGrid(tributes = loadTributes()) {
  const grid = document.getElementById('tributeGrid');
  if (!grid) return; // Only run on pages with tribute grid
  
  grid.innerHTML = '';
  
  if (!tributes.length) {
    grid.innerHTML = '<p class="muted">No tributes yet — be the first to share a memory.</p>';
    return;
  }

  // Show only the first 4 tributes
  const displayTributes = tributes.slice(-4).reverse();
  
  displayTributes.forEach(t => {
    const el = document.createElement('div');
    el.className = 'tribute-card';
    el.dataset.uuid = t.uuid || '';
    el.dataset.id = t.id || '';

    el.innerHTML = `
      <div class="tribute-header">
        <div>
          <div class="tribute-name">${escapeHtml(t.name || 'Anonymous')}</div>
          <div class="tribute-relation">${escapeHtml(t.relation || '')}</div>
        </div>
        ${t.uuid === userUUID ? '<button class="delete-btn">Delete</button>' : ''}
      </div>
      <div class="tribute-message">${escapeHtml(t.message)}</div>
      <div class="tribute-footer">
        <small class="tribute-date">${t.ts ? new Date(t.ts).toLocaleDateString() : ''}</small>
      </div>`;

    grid.appendChild(el);

    if (t.uuid === userUUID) {
      el.querySelector('.delete-btn').addEventListener('click', async () => {
        if (confirm('Delete your tribute?')) {
          await deleteTribute(t.id, t.uuid);
          const updated = loadTributes().filter(x => x.id !== t.id);
          saveTributes(updated);
          renderTributeGrid(updated);
        }
      });
    }
  });
}

function renderTributes(tributes = loadTributes()) {
  if (!list) return; // Only run on pages with tribute list
  
  list.innerHTML = '';
  if (!tributes.length) {
    list.innerHTML = '<p class="muted">No tributes yet — be the first to share a memory.</p>';
    return;
  }

  tributes.slice().reverse().forEach(t => {
    const el = document.createElement('div');
    el.className = 'tribute';
    el.dataset.uuid = t.uuid || '';
    el.dataset.id = t.id || '';

    el.innerHTML = `
      <strong>${escapeHtml(t.name || 'Anonymous')}</strong>
      <small>• ${escapeHtml(t.relation || '')}</small>
      <div style="margin-top:6px">${escapeHtml(t.message)}</div>
      ${t.uuid === userUUID ? '<button class="delete-btn">Delete</button>' : ''}
      <small class="muted">${t.ts ? new Date(t.ts).toLocaleString() : ''}</small>`;

    list.appendChild(el);

    if (t.uuid === userUUID) {
      el.querySelector('.delete-btn').addEventListener('click', async () => {
        if (confirm('Delete your tribute?')) {
          await deleteTribute(t.id, t.uuid);
          const updated = loadTributes().filter(x => x.id !== t.id);
          saveTributes(updated);
          renderTributes(updated);
        }
      });
    }
  });
}

// ----------------- POST new tribute -----------------
async function submitToWebApp(name, relation, message) {
  let userUUID = localStorage.getItem('user_uuid');
  if (!userUUID) {
    userUUID = crypto.randomUUID();
    localStorage.setItem('user_uuid', userUUID);
  }

  const formData = new URLSearchParams();
  formData.append('name', name);
  formData.append('relation', relation);
  formData.append('message', message);
  formData.append('uuid', userUUID);
  formData.append('ts', Date.now());

  try {
    submit.disabled = true;
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    submit.disabled = false;

    if (data.status === 'success') return data.id;

    alert('Failed to submit tribute: ' + (data.message || 'Unknown error'));
    return null;

  } catch (err) {
    submit.disabled = false;
    alert('Network or CORS error. Make sure the Apps Script is deployed and accessible.');
    console.error(err);
    return null;
  }
}

// ----------------- DELETE tribute -----------------
async function deleteTribute(id) {
  // only need id and uuid
  const payload = new FormData();
  payload.append('deleteId', id);
  payload.append('uuid', userUUID);

  try {
    const res = await fetch(SCRIPT_URL, { method: 'POST', body: payload });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { status: 'deleted' }; }

    if (data.status === 'deleted') {
      console.log(`Deleted tribute with id ${id}`);
    } else {
      console.warn('Delete failed or not found', id);
    }
  } catch (err) {
    console.error('Error deleting tribute:', err);
  }
}

// ----------------- GET tributes -----------------
async function loadAllTributes() {
  try {
    const res = await fetch(SCRIPT_URL);
    const json = await res.json();

    // Expect { status: 'success', data: [...] }
    const tributes = json?.data || [];
    saveTributes(tributes);
    return tributes;
  } catch (err) {
    console.error('Error loading tributes:', err);
    return loadTributes();
  }
}

// ----------------- Form handling -----------------
function setupFormHandlers() {
  submit?.addEventListener('click', async e => {
    e.preventDefault();
    const name = nameInput?.value.trim();
    const relation = relationInput?.value.trim();
    const message = messageInput?.value.trim();

    if (!message) {
      alert('Please write a short tribute.');
      messageInput.focus();
      return;
    }

    const id = await submitToWebApp(name, relation, message);
    if (!id) return;

    const tribute = { id, name, relation, message, ts: Date.now(), uuid: userUUID };
    const arr = loadTributes();
    arr.push(tribute);
    saveTributes(arr);
    
    // Refresh the appropriate view
    initializePage();
    
    // Clear form
    if (nameInput) nameInput.value = '';
    if (relationInput) relationInput.value = '';
    if (messageInput) messageInput.value = '';
  });

  // Clear all locally cached tributes
  clearAll?.addEventListener('click', () => {
    if (confirm('Clear all tributes stored locally?')) {
      localStorage.removeItem('tributes_v1');
      initializePage();
    }
  });
}

// ----------------- Page-specific rendering -----------------
function initializePage() {
  const tributeGrid = document.getElementById('tributeGrid');
  const tributeList = document.getElementById('tributeList');
  
  if (tributeGrid) {
    // This is the home page with grid view
    renderTributeGrid();
  } else if (tributeList) {
    // This is the tribute page with full list
    renderTributes();
  }
}

// ----------------- Initialize based on page -----------------
document.addEventListener('DOMContentLoaded', async function() {
  // Load all tributes from server
  await loadAllTributes();
  
  // Then initialize the appropriate view
  initializePage();
  
  // Setup form handlers
  setupFormHandlers();

  // ----------------- Accordion -----------------
  document.querySelectorAll('.accordion-header').forEach(button => {
    button.addEventListener('click', () => {
      const item = button.parentElement;
      const openItem = document.querySelector('.accordion-item.active');
      if (openItem && openItem !== item) {
        openItem.classList.remove('active');
        openItem.querySelector('.accordion-content').style.maxHeight = null;
      }
      item.classList.toggle('active');
      const content = item.querySelector('.accordion-content');
      if (item.classList.contains('active')) {
        content.style.maxHeight = content.scrollHeight + 'px';
      } else {
        content.style.maxHeight = null;
      }
    });
  });

  // ----------------- Gallery: responsive pages + auto-slide + lightbox -----------------
  const container = document.querySelector('.gallery-container');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = lightbox ? lightbox.querySelector('img') : null;
  
  if (container) {
    // store original thumbs (so we can rebuild pages on resize)
    const originalThumbs = Array.from(container.querySelectorAll('.thumb'));
    let pages = [];
    let currentPage = 0;
    let perPage = calcPerPage();
    let autoSlide = null;
    let isPaused = false;
    let resumeTimer = null;
    const AUTO_MS = 4000;

    function calcPerPage() {
      const w = window.innerWidth;
      if (w > 900) return 6; // 3 cols x 2 rows
      if (w > 600) return 4; // 2 cols x 2 rows
      return 2;               // 1 col x 2 rows
    }

    function buildPages() {
      perPage = calcPerPage();
      // keep a reference to which logical index we were showing
      const visibleStartIndex = currentPage * perPage;

      // clear container and rebuild pages by chunking originalThumbs
      container.innerHTML = '';
      pages = [];
      for (let i = 0; i < originalThumbs.length; i += perPage) {
        const page = document.createElement('div');
        page.className = 'gallery-page';
        const grid = document.createElement('div');
        grid.className = 'gallery-grid';
        // append up to perPage thumbs
        const slice = originalThumbs.slice(i, i + perPage);
        slice.forEach(t => grid.appendChild(t));
        page.appendChild(grid);
        container.appendChild(page);
        pages.push(page);
      }

      // clamp currentPage and scroll there
      currentPage = Math.min(Math.floor(visibleStartIndex / perPage), Math.max(0, pages.length - 1));
      requestAnimationFrame(() => {
        container.scrollTo({ left: currentPage * container.clientWidth, behavior: 'auto' });
      });

      attachThumbHandlers();
    }

    function attachThumbHandlers() {
      // attach click to each thumb image (these elements are reused)
      const imgs = container.querySelectorAll('.thumb img');
      imgs.forEach(img => {
        img.onclick = () => {
          openLightbox(img);
        };
      });
    }

    // Auto slide functions
    function startAutoSlide() {
      if (isPaused || pages.length <= 1) return;
      stopAutoSlide();
      autoSlide = setInterval(() => {
        currentPage = (currentPage + 1) % pages.length;
        container.scrollTo({ left: currentPage * container.clientWidth, behavior: 'smooth' });
      }, AUTO_MS);
    }
    function stopAutoSlide() {
      clearInterval(autoSlide);
      autoSlide = null;
    }

    // pause/resume helpers (used for manual scroll)
    function pauseThenResume() {
      stopAutoSlide();
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        if (!isPaused) startAutoSlide();
      }, 3000);
    }

    // scroll listener to update page index and pause/resume
    container.addEventListener('scroll', () => {
      clearTimeout(container._scrollTimeout);
      stopAutoSlide();
      container._scrollTimeout = setTimeout(() => {
        if (!isPaused) startAutoSlide();
      }, 3000);
      currentPage = Math.round(container.scrollLeft / Math.max(1, container.clientWidth));
    }, { passive: true });

    container.addEventListener('wheel', () => { pauseThenResume(); }, { passive: true });
    container.addEventListener('touchstart', () => { pauseThenResume(); }, { passive: true });

    // lightbox open/close
    function openLightbox(imgEl) {
      if (!lightbox || !lightboxImg) return;
      isPaused = true;
      stopAutoSlide();
      lightboxImg.src = imgEl.src;
      lightboxImg.alt = imgEl.alt || '';
      lightbox.classList.add('show');
    }

    function closeLightbox() {
      if (!lightbox) return;
      lightbox.classList.remove('show');
      isPaused = false;
      // small delay to prevent immediate auto scroll while closing animation
      setTimeout(() => startAutoSlide(), 250);
    }

    // lightbox close handlers
    if (lightbox) {
      lightbox.addEventListener('click', (e) => {
        // close if clicking outside the image or on the image
        if (e.target === lightbox || e.target === lightboxImg) {
          closeLightbox();
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
      });
    }

    // responsive rebuild with debounce
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const oldPer = perPage;
        perPage = calcPerPage();
        // rebuild pages only if per-page count changes
        if (perPage !== oldPer) {
          buildPages();
        } else {
          // still ensure pages width corrected (in case of width change)
          container.scrollTo({ left: currentPage * container.clientWidth, behavior: 'auto' });
        }
      }, 220);
    });

    // initial build + start auto
    buildPages();
    startAutoSlide();

    // expose a manual stop (useful for debugging)
    window.__galleryStop = stopAutoSlide;
    window.__galleryStart = startAutoSlide;
  }

  // ------------------ Farewell canvas (petals) ------------------
  const canvas = document.getElementById('farewellCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let petals = [];
    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    petals = Array.from({length: 40}, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: 2 + Math.random() * 3,
      speedY: 0.2 + Math.random() * 0.5,
      speedX: Math.random() * 0.3 - 0.15,
      opacity: 0.3 + Math.random() * 0.6
    }));

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      petals.forEach(p => {
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 182, 193, ${p.opacity})`;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        p.y -= p.speedY;
        p.x += p.speedX;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.x < -10) p.x = canvas.width + 10;
      });
      requestAnimationFrame(animate);
    }
    animate();
  }

  // ----------------- Language Switch -----------------
  const switchBtn = document.getElementById('langSwitch');
  if (switchBtn) {
    let isKikuyu = false; // default language = English

    // when clicked, toggle between English and Kikuyu
    switchBtn.addEventListener('click', () => {
      isKikuyu = !isKikuyu;
      switchBtn.textContent = isKikuyu ? 'Change to English' : 'Change to Kikuyu';

      document.querySelectorAll('.timeline, .mutes, .muted').forEach(p => {
        const text = isKikuyu ? p.dataset.ki : p.dataset.en;
        if (text) p.innerHTML = text; // ✅ changed from textContent to innerHTML
      });
    });
  }

  // ----------------- Navbar Toggle -----------------
  const toggle = document.getElementById("navbarToggle");
  const menu = document.getElementById("navMenu");

  if (toggle && menu) {
    toggle.addEventListener("click", () => {
      menu.classList.toggle("open");
    });
  }
});

// ----------------- Download Handler -----------------
function showDownloadMessage(event) {
  event.preventDefault(); // Stop immediate download
  const link = event.currentTarget;
  const progressContainer = document.getElementById('downloadProgress');
  const fill = document.querySelector('.progress-fill');

  // Show progress bar
  progressContainer.style.display = 'block';
  fill.style.width = '0%';
  
  // Show alert to user
  alert('Your download is starting...\n\nPlease keep this page open.');

  // Animate progress bar
  setTimeout(() => fill.style.width = '100%', 100);

  // Simulate download delay
  setTimeout(() => {
    // Trigger actual download
    const a = document.createElement('a');
    a.href = link.getAttribute('href');
    a.download = link.getAttribute('download');
    a.click();

    // Notify user
    alert('✅ Download complete! Check your downloads folder.');
    progressContainer.style.display = 'none';
  }, 2500);
}