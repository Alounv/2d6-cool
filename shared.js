const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

const COLORS = [
    "#e63946", "#f4a261", "#2a9d8f", "#264653", "#e9c46a",
    "#9b59b6", "#3498db", "#1abc9c", "#e74c3c", "#f39c12",
    "#8e44ad", "#2980b9", "#27ae60", "#d35400", "#c0392b",
    "#16a085", "#8e44ad", "#2c3e50", "#f1c40f", "#e67e22",
    "#9b59b6", "#1abc9c", "#34495e", "#e91e63", "#00bcd4",
    "#4caf50", "#ff9800", "#795548", "#607d8b", "#3f51b5",
];

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const BASE_WIDTH = 2500;
const MIN_CIRCLE_SIZE = 6;
const MAX_CIRCLE_SIZE = 40;

let videosData = null;
let zoomLevel = 1;
let sizeMode = "standard";
let sortMode = "last";

function updateZoom() {
    const w = BASE_WIDTH * zoomLevel + "px";
    $("chart").style.minWidth = $("yearHeader").style.minWidth = w;
    $("zoomLevel").textContent = Math.round(zoomLevel * 100) + "%";
}

function setupControls(sizeModes, sortModes, onSortChange) {
    const container = $("chartContainer");

    $("zoomIn").onclick = () => {
        zoomLevel = Math.min(MAX_ZOOM, zoomLevel * 1.25);
        updateZoom();
    };
    $("zoomOut").onclick = () => {
        zoomLevel = Math.max(MIN_ZOOM, zoomLevel / 1.25);
        updateZoom();
    };
    $("zoomReset").onclick = () => {
        zoomLevel = 1;
        updateZoom();
    };

    container.addEventListener(
        "wheel",
        (e) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left + container.scrollLeft;
            const oldZoom = zoomLevel;
            zoomLevel = e.deltaY < 0
                ? Math.min(MAX_ZOOM, zoomLevel * 1.1)
                : Math.max(MIN_ZOOM, zoomLevel / 1.1);
            updateZoom();
            container.scrollLeft = mouseX * (zoomLevel / oldZoom) - (e.clientX - rect.left);
        },
        { passive: false }
    );

    const setupSlider = (sliderId, options, modes, onChange) => {
        const slider = $(sliderId);
        const updateUI = () =>
            options.forEach((o, i) => o.classList.toggle("active", i === +slider.value));
        slider.oninput = () => {
            onChange(modes[slider.value]);
            updateUI();
        };
        options.forEach((o, i) => (o.onclick = () => {
            slider.value = i;
            onChange(modes[i]);
            updateUI();
        }));
        updateUI();
    };

    setupSlider(
        "sizeSlider",
        [...$$(".size-option")],
        sizeModes,
        (m) => {
            sizeMode = m;
            updateCircleSizes();
        }
    );
    setupSlider(
        "sortSlider",
        [...$$(".sort-option")],
        sortModes,
        (m) => {
            sortMode = m;
            onSortChange();
        }
    );

    container.onscroll = () =>
        ($("yearHeader").style.transform = `translateX(-${container.scrollLeft}px)`);
}

function updateCircleSizes() {
    if (!videosData) return;
    const videos = videosData.videos;
    const getRange = (key) => {
        const vals = videos.map((v) => v[key] || 0);
        return [Math.min(...vals), Math.max(...vals)];
    };
    const [minViews, maxViews] = getRange("viewCount");
    const [minLikes, maxLikes] = getRange("likeCount");

    $$(".episode").forEach((ep) => {
        let size = 14;
        if (sizeMode !== "standard") {
            const [value, min, max] =
                sizeMode === "views"
                    ? [+ep.dataset.views || 0, minViews, maxViews]
                    : [+ep.dataset.likes || 0, minLikes, maxLikes];
            const norm = (value - min) / (max - min || 1);
            const [minA, maxA] = [
                Math.PI * (MIN_CIRCLE_SIZE / 2) ** 2,
                Math.PI * (MAX_CIRCLE_SIZE / 2) ** 2,
            ];
            size = 2 * Math.sqrt((minA + norm * (maxA - minA)) / Math.PI);
        }
        ep.style.width = ep.style.height = size + "px";
    });
}

async function loadData(renderFn) {
    try {
        videosData = await (await fetch("./data/videos.json")).json();
        renderFn();
        updateCircleSizes();
        $("chartContainer").scrollLeft = $("chartContainer").scrollWidth;
    } catch (e) {
        $("chart").innerHTML = '<p style="padding:20px">Erreur lors du chargement de videos.json.</p>';
    }
}

function computeDateRange(videos) {
    const allDates = videos.map((v) => new Date(v.publishedAt));
    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));
    minDate.setMonth(minDate.getMonth() - 1);
    maxDate.setMonth(maxDate.getMonth() + 6);
    const totalMs = maxDate - minDate;
    const toPos = (d) => ((d - minDate) / totalMs) * 100;

    const years = [];
    for (let y = minDate.getFullYear(); y <= maxDate.getFullYear(); y++) {
        const d = new Date(y, 0, 1);
        if (d >= minDate && d <= maxDate) years.push({ year: y, pos: toPos(d) });
    }

    return { minDate, maxDate, toPos, years };
}

function renderYearHeader(years) {
    $("yearHeader").innerHTML =
        `<div class="year-header-spacer"></div><div class="year-header-timeline">${years.map((y) => `<div class="year-header-label" style="left:${y.pos}%">${y.year}</div>`).join("")}</div>`;
}

function renderYearLines(years) {
    return `<div class="year-lines">${years.map((y) => `<div class="year-line" style="left:${y.pos}%"></div>`).join("")}</div>`;
}

function buildEpisodeData(ep) {
    const thumb = ep.thumbnails?.medium?.url || ep.thumbnails?.default?.url || "";
    const desc = (ep.description || "").replace(/"/g, "&quot;").replace(/\n/g, " ");
    const date = new Date(ep.publishedAt).toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const players = (ep.players || []).join(", ");
    const serie = ep.serie || "";
    return { thumb, desc, date, players, serie };
}

function createEpisodeEl(ep, pos, color = null) {
    const { thumb, desc, date, players, serie } = buildEpisodeData(ep);
    const style = color
        ? `left:${pos}%;background:${color};color:${color}`
        : `left:${pos}%`;
    return `<div class="episode" style="${style}" data-title="${ep.title.replace(/"/g, "&quot;")}" data-serie="${serie}" data-date="${date}" data-duration="${ep.durationFormatted}" data-views="${ep.viewCount || 0}" data-likes="${ep.likeCount || 0}" data-comments="${ep.commentCount || 0}" data-thumbnail="${thumb}" data-description="${desc}" data-url="${ep.url}" data-players="${players}"></div>`;
}

function setupTooltip(showSerie = false) {
    const tooltip = $("tooltip");
    $$(".episode").forEach((ep) => {
        ep.onmouseenter = () => {
            const thumb = ep.dataset.thumbnail
                ? `<img class="tooltip-thumbnail" src="${ep.dataset.thumbnail}">`
                : "";
            const desc = ep.dataset.description
                ? `<div class="tooltip-description">${ep.dataset.description}</div>`
                : "";
            const players = ep.dataset.players
                ? `<div class="tooltip-players">🎭 ${ep.dataset.players}</div>`
                : "";
            const serie = showSerie && ep.dataset.serie
                ? `<div class="tooltip-serie">📺 ${ep.dataset.serie}</div>`
                : "";
            tooltip.innerHTML = `${thumb}<div class="tooltip-title">${ep.dataset.title}</div>${serie}<div class="tooltip-meta"><span>📅 ${ep.dataset.date}</span><span>⏱️ ${ep.dataset.duration}</span><span>👁️ ${(+ep.dataset.views).toLocaleString()}</span><span>👍 ${(+ep.dataset.likes).toLocaleString()}</span><span>💬 ${(+ep.dataset.comments).toLocaleString()}</span></div>${players}${desc}`;
            tooltip.style.display = "block";
        };
        ep.onmousemove = (e) => {
            const r = tooltip.getBoundingClientRect();
            let left = e.clientX + 15, top = e.clientY + 15;
            if (left + r.width > innerWidth) left = e.clientX - r.width - 15;
            if (top + r.height > innerHeight) top = e.clientY - r.height - 15;
            tooltip.style.left = Math.max(10, left) + "px";
            tooltip.style.top = Math.max(10, top) + "px";
        };
        ep.onmouseleave = () => (tooltip.style.display = "none");
        ep.onclick = () => window.open(ep.dataset.url, "_blank");
    });
}
