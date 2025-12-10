// ----------------- Tribute helpers -----------------
const form = document.getElementById('tributeForm');
const nameInput = document.getElementById('name');
const relationInput = document.getElementById('relation');
const messageInput = document.getElementById('message');
const submit = document.getElementById('submitTribute');
const clearLocal = document.getElementById('clearLocal');

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
  if (!s) return '';
  return (s + '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ----------------- Enhanced Tribute Grid Display -----------------
function renderTributeGrid(tributes = loadTributes()) {
  const grid = document.getElementById('tributeGrid');
  const noTributesMessage = document.getElementById('noTributesMessage');
  
  // If no grid on page, return
  if (!grid) return;
  
  grid.innerHTML = '';
  
  if (!tributes || !tributes.length) {
    if (noTributesMessage) noTributesMessage.style.display = 'block';
    grid.innerHTML = '<p class="muted" style="text-align:center; padding: 40px;">No tributes yet — be the first to share a memory.</p>';
    return;
  }
  
  if (noTributesMessage) noTributesMessage.style.display = 'none';

  // Show ALL tributes on tributes page, only 4 on home page
  const isTributesPage = window.location.pathname.includes('tributes.html');
  const displayTributes = isTributesPage ? 
    tributes.slice().reverse() : // All tributes on tributes page
    tributes.slice(-4).reverse(); // First 4 tributes on home page
  
  displayTributes.forEach(t => {
    const el = document.createElement('div');
    el.className = 'tribute-card';
    el.dataset.uuid = t.uuid || '';
    el.dataset.id = t.id || '';

    const name = escapeHtml(t.name || 'Anonymous');
    const relation = escapeHtml(t.relation || 'Friend');
    const message = escapeHtml(t.message);
    const date = formatDate(t.ts);
    const canDelete = t.uuid === userUUID;

    el.innerHTML = `
      <div class="tribute-header">
        <div>
          <div class="tribute-name">${name}</div>
          <div class="tribute-relation">${relation}</div>
        </div>
        ${canDelete ? '<button class="delete-btn" title="Delete tribute">✕</button>' : ''}
      </div>
      <div class="tribute-message">${message}</div>
      <div class="tribute-footer">
        <small class="tribute-date">${date}</small>
      </div>`;

    grid.appendChild(el);

    if (canDelete) {
      el.querySelector('.delete-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete your tribute?')) {
          await deleteTribute(t.id, t.uuid);
          const updated = loadTributes().filter(x => x.id !== t.id);
          saveTributes(updated);
          renderTributeGrid(updated);
        }
      });
    }
  });
}

// ----------------- Legacy Tribute List Display (if needed) -----------------
function renderTributes(tributes = loadTributes()) {
  const list = document.getElementById('tributeList');
  if (!list) return;
  
  list.innerHTML = '';
  if (!tributes.length) {
    list.innerHTML = '<p class="muted" style="text-align:center">No tributes yet — be the first to share a memory.</p>';
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
      <div style="margin-top:8px">${escapeHtml(t.message)}</div>
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
  formData.append('name', name || 'Anonymous');
  formData.append('relation', relation || 'Friend');
  formData.append('message', message);
  formData.append('uuid', userUUID);
  formData.append('ts', Date.now());

  try {
    if (submit) submit.disabled = true;
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (submit) submit.disabled = false;

    if (data.status === 'success') return data.id;

    alert('Failed to submit tribute: ' + (data.message || 'Unknown error'));
    return null;

  } catch (err) {
    if (submit) submit.disabled = false;
    alert('Network or CORS error. Make sure the Apps Script is deployed and accessible.');
    console.error(err);
    return null;
  }
}

// ----------------- DELETE tribute -----------------
async function deleteTribute(id) {
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
      return true;
    } else {
      console.warn('Delete failed or not found', id);
      return false;
    }
  } catch (err) {
    console.error('Error deleting tribute:', err);
    return false;
  }
}

// ----------------- GET tributes -----------------
async function loadAllTributes() {
  try {
    const res = await fetch(SCRIPT_URL);
    const json = await res.json();

    const tributes = json?.data || [];
    saveTributes(tributes);
    return tributes;
  } catch (err) {
    console.error('Error loading tributes from server:', err);
    return loadTributes(); // Fallback to local storage
  }
}

// ----------------- Form handling -----------------
function setupFormHandlers() {
  submit?.addEventListener('click', async e => {
    e.preventDefault();
    const name = nameInput?.value.trim();
    const relation = relationInput?.value.trim();
    const message = messageInput?.value.trim();

    if (!message || message.length < 10) {
      alert('Please write a meaningful tribute (at least 10 characters).');
      messageInput?.focus();
      return;
    }

    const id = await submitToWebApp(name, relation, message);
    if (!id) return;

    const tribute = { 
      id, 
      name: name || 'Anonymous', 
      relation: relation || 'Friend', 
      message, 
      ts: Date.now(), 
      uuid: userUUID 
    };
    
    const arr = loadTributes();
    arr.push(tribute);
    saveTributes(arr);
    
    // Refresh the appropriate view
    initializePage();
    
    // Clear form
    if (nameInput) nameInput.value = '';
    if (relationInput) relationInput.value = '';
    if (messageInput) messageInput.value = '';
    
    // Show success message
    alert('Thank you for sharing your tribute!');
    
    // Scroll to top of tributes
    setTimeout(() => {
      const grid = document.getElementById('tributeGrid');
      if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  });

  // Clear all locally cached tributes
  clearLocal?.addEventListener('click', () => {
    if (confirm('This will clear all tributes stored locally on your device. Continue?')) {
      localStorage.removeItem('tributes_v1');
      location.reload();
    }
  });
}

// ----------------- Page-specific rendering -----------------
function initializePage() {
  // Always use tribute grid for both pages for consistency
  renderTributeGrid();
  
  // Also update tribute count on home page if needed
  const seeMoreBtn = document.querySelector('a[href="tributes.html"]');
  if (seeMoreBtn) {
    const tributes = loadTributes();
    if (tributes.length > 4) {
      seeMoreBtn.innerHTML = `See All ${tributes.length} Tributes →`;
    }
  }
}

// ----------------- Initialize based on page -----------------
document.addEventListener('DOMContentLoaded', async function() {
  // Load all tributes from server first
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
      const visibleStartIndex = currentPage * perPage;

      container.innerHTML = '';
      pages = [];
      for (let i = 0; i < originalThumbs.length; i += perPage) {
        const page = document.createElement('div');
        page.className = 'gallery-page';
        const grid = document.createElement('div');
        grid.className = 'gallery-grid';
        const slice = originalThumbs.slice(i, i + perPage);
        slice.forEach(t => grid.appendChild(t));
        page.appendChild(grid);
        container.appendChild(page);
        pages.push(page);
      }

      currentPage = Math.min(Math.floor(visibleStartIndex / perPage), Math.max(0, pages.length - 1));
      requestAnimationFrame(() => {
        container.scrollTo({ left: currentPage * container.clientWidth, behavior: 'auto' });
      });

      attachThumbHandlers();
    }

    function attachThumbHandlers() {
      const imgs = container.querySelectorAll('.thumb img');
      imgs.forEach(img => {
        img.onclick = () => {
          openLightbox(img);
        };
      });
    }

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

    function pauseThenResume() {
      stopAutoSlide();
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        if (!isPaused) startAutoSlide();
      }, 3000);
    }

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

    function openLightbox(imgEl) {
      if (!lightbox || !lightboxImg) return;
      isPaused = true;
      stopAutoSlide();
      lightboxImg.src = imgEl.src;
      lightboxImg.alt = imgEl.alt || '';
      lightbox.classList.add('show');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      if (!lightbox) return;
      lightbox.classList.remove('show');
      document.body.style.overflow = '';
      isPaused = false;
      setTimeout(() => startAutoSlide(), 250);
    }

    if (lightbox) {
      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target === lightboxImg) {
          closeLightbox();
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
      });
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const oldPer = perPage;
        perPage = calcPerPage();
        if (perPage !== oldPer) {
          buildPages();
        } else {
          container.scrollTo({ left: currentPage * container.clientWidth, behavior: 'auto' });
        }
      }, 220);
    });

    buildPages();
    startAutoSlide();
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
    let isKikuyu = false;

    switchBtn.addEventListener('click', () => {
      isKikuyu = !isKikuyu;
      switchBtn.textContent = isKikuyu ? 'Change to English' : 'Change to Kikuyu';

      document.querySelectorAll('.timeline, .mutes, .muted').forEach(p => {
        const text = isKikuyu ? p.dataset.ki : p.dataset.en;
        if (text) p.innerHTML = text;
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

    // Close menu when clicking on links
    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.remove('open');
      });
    });
  }

  // Highlight active nav link
  const currentPage = window.location.pathname;
  const navLinks = document.querySelectorAll('.navbar-nav a');
  navLinks.forEach(link => {
    if (link.getAttribute('href') === currentPage || 
        (currentPage.includes('tributes.html') && link.getAttribute('href').includes('tributes'))) {
      link.classList.add('active');
    }
  });
});

// ----------------- Download Handler -----------------
function showDownloadMessage(event) {
  event.preventDefault();
  const link = event.currentTarget;
  const progressContainer = document.getElementById('downloadProgress');
  const fill = document.querySelector('.progress-fill');

  if (progressContainer) {
    progressContainer.style.display = 'block';
    fill.style.width = '0%';
  }
  
  alert('Your download is starting...\n\nPlease keep this page open.');

  if (fill) setTimeout(() => fill.style.width = '100%', 100);

  setTimeout(() => {
    const a = document.createElement('a');
    a.href = link.getAttribute('href');
    a.download = link.getAttribute('download');
    a.click();

    alert('✅ Download complete! Check your downloads folder.');
    if (progressContainer) progressContainer.style.display = 'none';
  }, 2500);
}

// Export functions for debugging
window.tributeFunctions = {
  loadTributes,
  saveTributes,
  renderTributeGrid,
  loadAllTributes
};