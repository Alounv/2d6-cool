/**
 * Zoom and control functionality
 *
 * Zoom uses an internal scale where 1.0 = 100% displayed.
 * The BASE_WIDTH is the chart width at 100% zoom.
 */

const DEFAULT_ZOOM = 1;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const BASE_WIDTH = 1250;

let zoomLevel = DEFAULT_ZOOM;

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
    zoomLevel = DEFAULT_ZOOM;
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
      zoomLevel =
        e.deltaY < 0
          ? Math.min(MAX_ZOOM, zoomLevel * 1.1)
          : Math.max(MIN_ZOOM, zoomLevel / 1.1);
      updateZoom();
      container.scrollLeft =
        mouseX * (zoomLevel / oldZoom) - (e.clientX - rect.left);
    },
    { passive: false },
  );

  const setupSlider = (sliderId, options, modes, onChange) => {
    const slider = $(sliderId);
    if (!slider) return;
    const updateUI = () =>
      options.forEach((o, i) =>
        o.classList.toggle("active", i === +slider.value),
      );
    slider.oninput = () => {
      onChange(modes[slider.value]);
      updateUI();
    };
    options.forEach(
      (o, i) =>
        (o.onclick = () => {
          slider.value = i;
          onChange(modes[i]);
          updateUI();
        }),
    );
    updateUI();
  };

  setupSlider("sizeSlider", [...$$(".size-option")], sizeModes, (m) => {
    sizeMode = m;
    updateCircleSizes();
  });
  setupSlider("sortSlider", [...$$(".sort-option")], sortModes, (m) => {
    sortMode = m;
    onSortChange();
  });

  container.onscroll = () =>
    ($("yearHeader").style.transform =
      `translateX(-${container.scrollLeft}px)`);
}
