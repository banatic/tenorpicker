/**
 * CoolMessenger Tenor Picker — 메인 스크립트
 * Tauri 2.0: window.__TAURI__ 글로벌 API 사용 (CDN ESM import 없음)
 */

// ─── Tauri API 래퍼 ────────────────────────────────────────
// Tauri 2.0은 WebView에 __TAURI__ 글로벌을 자동 주입
function invoke(cmd, args) {
    return window.__TAURI__.core.invoke(cmd, args);
}
function listen(event, handler) {
    return window.__TAURI__.event.listen(event, handler);
}
function getCurrentWindow() {
    return window.__TAURI__.window.getCurrentWindow();
}

/* =========================================================
   상태
   ========================================================= */
let currentQuery = "";
let isLoading = false;
let searchTimer = null;

/* =========================================================
   DOM 요소
   ========================================================= */
const searchInput = document.getElementById("search-input");
const btnClear = document.getElementById("btn-clear");
const gifGrid = document.getElementById("gif-grid");
const statusText = document.getElementById("status-text");
const countBadge = document.getElementById("count-badge");
const btnLoadMore = document.getElementById("btn-load-more");
const emptyState = document.getElementById("empty-state");
const toast = document.getElementById("toast");
const toastMsg = document.getElementById("toast-msg");
const attachIndicator = document.getElementById("attach-indicator");

/* =========================================================
   초기화
   ========================================================= */
async function init() {
    // 주입 확인
    if (!window.__TAURI__) {
        statusText.textContent = "⚠️ Tauri API를 초기화하는 중...";
        // 최대 3초 대기
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 100));
            if (window.__TAURI__) break;
        }
        if (!window.__TAURI__) {
            statusText.textContent = "❌ Tauri API를 불러올 수 없어요";
            return;
        }
    }

    // 초기 트렌딩 로드
    statusText.textContent = "트렌딩 GIF 로딩 중...";
    await loadGifs("");

    // 이벤트 바인딩
    searchInput.addEventListener("input", onSearchInput);
    searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { clearTimeout(searchTimer); doSearch(); }
        if (e.key === "Escape") { searchInput.value = ""; onSearchInput(); }
    });
    btnClear.addEventListener("click", () => {
        searchInput.value = "";
        btnClear.classList.remove("visible");
        doSearch();
    });
    btnLoadMore.addEventListener("click", () => {
        if (!isLoading) doSearch(); // 크롤링은 페이지 단위 → 재검색
    });

    // Tauri 이벤트 리스닝
    await listen("target-window-found", () => {
        attachIndicator.classList.add("visible");
    });
    await listen("target-window-moved", () => {
        attachIndicator.classList.add("visible");
    });
    await listen("target-window-lost", () => {
        attachIndicator.classList.remove("visible");
    });
}

/* =========================================================
   검색 디바운스
   ========================================================= */
function onSearchInput() {
    const val = searchInput.value;
    btnClear.classList.toggle("visible", val.length > 0);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(doSearch, 600); // 크롤링이라 약간 느려도 됨
}

function doSearch() {
    loadGifs(searchInput.value.trim());
}

/* =========================================================
   GIF 로드 (크롤링)
   ========================================================= */
async function loadGifs(query) {
    if (isLoading) return;
    isLoading = true;
    currentQuery = query;

    gifGrid.innerHTML = "";
    btnLoadMore.classList.remove("visible");
    emptyState.style.display = "none";
    showSkeletons(9);

    const label = query ? `"${query}" 크롤링 중...` : "Tenor 트렌딩 로딩 중...";
    statusText.textContent = label;
    countBadge.textContent = "";

    try {
        const result = await invoke("cmd_search_tenor", {
            query: query,
            offset: 0,
        });

        gifGrid.innerHTML = "";

        const { gifs, total_count } = result;

        if (!gifs || gifs.length === 0) {
            emptyState.style.display = "block";
            statusText.textContent = "결과 없음";
            countBadge.textContent = "";
        } else {
            gifs.forEach(appendGifCard);
            statusText.textContent = query ? `"${query}" 검색 결과` : "Tenor 트렌딩";
            countBadge.textContent = `${gifs.length}개`;
        }
    } catch (err) {
        console.error("Tenor 크롤링 오류:", err);
        gifGrid.innerHTML = "";
        const errMsg = String(err).slice(0, 80);
        statusText.textContent = `⚠️ ${errMsg}`;
        countBadge.textContent = "";
    } finally {
        isLoading = false;
    }
}

/* =========================================================
   GIF 카드 생성
   ========================================================= */
function appendGifCard(gif) {
    const card = document.createElement("div");
    card.className = "gif-card";
    card.title = gif.title || "GIF";

    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = gif.title || "GIF";
    img.style.opacity = "0";
    img.style.transition = "opacity 0.3s";
    img.onload = () => { img.style.opacity = "1"; };
    img.onerror = () => { card.style.display = "none"; };

    // IntersectionObserver로 뷰포트 진입 시 로드
    img.dataset.src = gif.preview_url;
    imgObserver.observe(img);

    card.appendChild(img);
    card.addEventListener("click", () => onGifClick(gif));
    gifGrid.appendChild(card);
}

/* =========================================================
   Lazy Load
   ========================================================= */
const imgObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                imgObserver.unobserve(img);
            }
        });
    },
    { rootMargin: "120px" }
);

/* =========================================================
   스켈레톤
   ========================================================= */
function showSkeletons(count) {
    for (let i = 0; i < count; i++) {
        const sk = document.createElement("div");
        sk.className = "gif-skeleton";
        gifGrid.appendChild(sk);
    }
}

/* =========================================================
   GIF 클릭 → 클립보드 복사
   ========================================================= */
async function onGifClick(gif) {
    const html = `<img src="${gif.embed_url}" alt="${escapeHtml(gif.title)}" />`;
    try {
        await invoke("cmd_copy_html", { html });
        showToast("✅", "클립보드에 복사됨!");
    } catch (err) {
        console.error("복사 실패:", err);
        showToast("❌", "복사 실패: " + String(err).slice(0, 40));
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/* =========================================================
   토스트
   ========================================================= */
let toastTimer = null;
function showToast(icon, msg) {
    document.getElementById("toast-icon").textContent = icon;
    toastMsg.textContent = msg;
    toast.classList.remove("toast-hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("toast-hidden"), 2200);
}

/* =========================================================
   실행
   ========================================================= */
init().catch((err) => {
    console.error("init failed:", err);
    statusText.textContent = "❌ 초기화 실패: " + String(err).slice(0, 60);
});
