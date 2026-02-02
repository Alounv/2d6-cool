/**
 * Tooltip functionality
 */

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
