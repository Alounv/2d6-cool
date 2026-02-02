/**
 * Core timeline utilities and shared state
 */

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

const MIN_CIRCLE_SIZE = 6;
const MAX_CIRCLE_SIZE = 40;

let videosData = null;
let sizeMode = "standard";
let sortMode = "last";

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
