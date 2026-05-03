(() => {
  const STORE_KEY = "memo-map-state-v1";
  const UI_STORE_KEY = "memo-map-ui-state-v1";
  const STAGE = { width: 16000, height: 11000 };

  const palette = [
    "#1F6F64",
    "#C9563D",
    "#B9802E",
    "#3C5966",
    "#2F4858",
    "#7B4E2C",
    "#375E97",
    "#6B6B3F",
    "#8B3E55",
    "#24292F",
    "#0F766E",
    "#A23C28",
  ];

  const fontOptions = [
    {
      label: "기본",
      value: "system",
      family:
        'Inter, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif',
    },
    {
      label: "명조",
      value: "serif",
      family: 'Georgia, "Noto Serif KR", "Batang", serif',
    },
    {
      label: "둥근",
      value: "rounded",
      family: '"Trebuchet MS", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
    },
    {
      label: "고정폭",
      value: "mono",
      family: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
    },
    {
      label: "손글씨",
      value: "hand",
      family: '"Segoe Print", "Comic Sans MS", cursive',
    },
  ];

  const iconCategories = createIconCatalog();
  const iconLookup = new Map(
    iconCategories.flatMap((category) =>
      category.icons.map((icon) => [icon.key, { ...icon, category: category.label }]),
    ),
  );

  const els = {
    categoryCount: document.querySelector("#categoryCount"),
    categoryForm: document.querySelector("#categoryForm"),
    categoryInput: document.querySelector("#categoryInput"),
    categoryList: document.querySelector("#categoryList"),
    edgeLayer: document.querySelector("#edgeLayer"),
    inspector: document.querySelector("#inspector"),
    localFileInput: document.querySelector("#localFileInput"),
    mapContent: document.querySelector("#mapContent"),
    mapSpace: document.querySelector("#mapSpace"),
    mapViewport: document.querySelector("#mapViewport"),
    nodeLayer: document.querySelector("#nodeLayer"),
    noteCount: document.querySelector("#noteCount"),
    noteForm: document.querySelector("#noteForm"),
    noteInput: document.querySelector("#noteInput"),
    noteList: document.querySelector("#noteList"),
    searchInput: document.querySelector("#searchInput"),
    threeBackdrop: document.querySelector("#threeBackdrop"),
    toolbar: document.querySelector(".toolbar"),
    viewButtons: document.querySelectorAll("[data-view]"),
    zoomInput: document.querySelector("#zoomInput"),
  };

  let state = loadState();
  upgradeGeneratedArt(state);
  let panelState = loadPanelState();
  let didInitialCenter = false;
  let drag = null;
  let resize = null;
  let pan = null;
  let multiSelection = new Set();
  let selectionBox = null;
  let threeView = null;
  let recorder = null;
  let recognition = null;
  let recordingNote = null;
  let recordingChunks = [];
  let transcriptBuffer = "";
  let recordingFinalText = "";
  let recordingNotice = { noteId: null, text: "", warning: false };
  const LOCALHOST_URL = "http://localhost:4173/";

  function uid(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now()
      .toString(36)
      .slice(-4)}`;
  }

  function makeNote(title, body, x, y, color = "#2F4858", font = "system") {
    return {
      id: uid("note"),
      title,
      body,
      color,
      font,
      opacity: 0.94,
      titleStyle: defaultTextStyle(color, font, 16),
      bodyStyle: defaultTextStyle(color, font, 12),
      x,
      y,
      width: 156,
      height: 118,
      audioDataUrl: null,
      audioMimeType: "",
      iconSvg: "",
      iconKey: "",
      iconSeed: "",
      iconVersion: 4,
      details: [],
    };
  }

  function makeDetail(title, body, x, y, color = "#375E97", font = "system") {
    return {
      id: uid("detail"),
      title,
      body,
      color,
      font,
      opacity: 0.92,
      titleStyle: defaultTextStyle(color, font, 14),
      bodyStyle: defaultTextStyle(color, font, 11),
      x,
      y,
      width: 132,
      height: 78,
    };
  }

  function makeCategory(title, x, y, color = "#1F6F64", font = "system") {
    return {
      id: uid("cat"),
      title,
      color,
      font,
      opacity: 0.94,
      titleStyle: defaultTextStyle(color, font, 16),
      x,
      y,
      notes: [],
    };
  }

  function defaultState() {
    const ideas = makeCategory("아이디어", 7600, 5150, "#1F6F64", "system");
    ideas.notes = [
      makeNote("제품 콘셉트", "핵심 흐름과 첫 화면을 빠르게 잡기", 7940, 5040, "#C9563D"),
      makeNote("참고 링크", "좋아 보이는 화면과 문장 모아두기", 7910, 5270, "#3C5966"),
    ];

    const work = makeCategory("할 일", 8460, 5130, "#B9802E", "rounded");
    work.notes = [
      makeNote("오늘", "우선순위 높은 작업부터 정리", 8820, 5030, "#2F4858"),
      makeNote("나중에", "급하지 않지만 잊으면 안 되는 것", 8810, 5270, "#7B4E2C"),
    ];

    const archive = makeCategory("읽을거리", 7840, 5790, "#375E97", "serif");
    archive.notes = [
      makeNote("문장", "다시 꺼내보고 싶은 표현", 8200, 5670, "#8B3E55", "serif"),
      makeNote("자료", "프로젝트별 참고 자료", 8220, 5920, "#0F766E"),
    ];

    return {
      activeCategoryId: ideas.id,
      boardVersion: 3,
      categories: [ideas, work, archive],
      search: "",
      selected: { type: "category", categoryId: ideas.id },
      view: "all",
      zoom: 1,
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved && Array.isArray(saved.categories)) {
        const normalized = normalizeState(saved);
        if (normalized.boardVersion !== saved.boardVersion) {
          localStorage.setItem(STORE_KEY, JSON.stringify(normalized));
        }
        return normalized;
      }
    } catch {
      localStorage.removeItem(STORE_KEY);
    }

    return defaultState();
  }

  function loadPanelState() {
    try {
      const saved = JSON.parse(localStorage.getItem(UI_STORE_KEY));
      return {
        leftCollapsed: Boolean(saved?.leftCollapsed),
        rightCollapsed: Boolean(saved?.rightCollapsed),
      };
    } catch {
      localStorage.removeItem(UI_STORE_KEY);
      return { leftCollapsed: false, rightCollapsed: false };
    }
  }

  function savePanelState() {
    localStorage.setItem(UI_STORE_KEY, JSON.stringify(panelState));
  }

  function applyPanelState() {
    document.body.classList.toggle("left-collapsed", panelState.leftCollapsed);
    document.body.classList.toggle("right-collapsed", panelState.rightCollapsed);
  }

  function togglePanel(side) {
    if (side === "left") {
      panelState.leftCollapsed = !panelState.leftCollapsed;
    }
    if (side === "right") {
      panelState.rightCollapsed = !panelState.rightCollapsed;
    }
    savePanelState();
    applyPanelState();
    window.setTimeout(() => {
      renderEdges();
      resizeThreeBackdrop();
      syncThreeCamera();
    }, 220);
  }

  function upgradeGeneratedArt(nextState) {
    let changed = false;
    nextState.categories.forEach((category) => {
      category.notes.forEach((note) => {
        if (note.iconSvg && note.iconVersion !== 4) {
          note.iconKey = chooseSuggestedIcon(note, category);
          note.iconSvg = iconSvgFromKey(note.iconKey, note.color || category.color);
          note.iconSeed = note.iconKey;
          note.iconVersion = 4;
          changed = true;
        }
      });
    });
    if (changed) {
      localStorage.setItem(STORE_KEY, JSON.stringify(nextState));
    }
  }

  function normalizeState(nextState) {
    const normalized = {
      ...defaultState(),
      ...nextState,
      boardVersion: Number.isFinite(nextState.boardVersion) ? nextState.boardVersion : 1,
      categories: nextState.categories.map((category, categoryIndex) => ({
        id: category.id || uid("cat"),
        title: category.title || `카테고리 ${categoryIndex + 1}`,
        color: category.color || palette[categoryIndex % palette.length],
        font: category.font || "system",
        opacity: normalizedOpacity(category.opacity),
        titleStyle: normalizedTextStyle(category.titleStyle, {
          color: category.color || palette[categoryIndex % palette.length],
          font: category.font || "system",
          size: 16,
        }),
        x: Number.isFinite(category.x) ? category.x : 280 + categoryIndex * 280,
        y: Number.isFinite(category.y) ? category.y : 240,
        notes: Array.isArray(category.notes)
          ? category.notes.map((note, noteIndex) => ({
              id: note.id || uid("note"),
              title: note.title || `메모 ${noteIndex + 1}`,
              body: note.body || "",
              color: note.color || "#2F4858",
              font: note.font || "system",
              opacity: normalizedOpacity(note.opacity),
              titleStyle: normalizedTextStyle(note.titleStyle, {
                color: note.color || "#2F4858",
                font: note.font || "system",
                size: 16,
              }),
              bodyStyle: normalizedTextStyle(note.bodyStyle, {
                color: note.color || "#2F4858",
                font: note.font || "system",
                size: 12,
              }),
              width: normalizedNoteWidth(note.width, note.iconSvg),
              height: normalizedNoteHeight(note.height),
              x: Number.isFinite(note.x)
                ? note.x
                : 520 + categoryIndex * 280 + noteIndex * 60,
              y: Number.isFinite(note.y) ? note.y : 320 + noteIndex * 80,
              audioDataUrl: note.audioDataUrl || null,
              audioMimeType: note.audioMimeType || "",
              iconSvg: note.iconSvg || "",
              iconKey: note.iconKey || "",
              iconSeed: note.iconSeed || "",
              iconVersion: Number.isFinite(note.iconVersion) ? note.iconVersion : 0,
              details: Array.isArray(note.details)
                ? note.details.map((detail, detailIndex) => ({
                    id: detail.id || uid("detail"),
                    title: detail.title || `\uc138\ubd80\uc0ac\ud56d ${detailIndex + 1}`,
                    body: detail.body || "",
                    color: detail.color || note.color || "#375E97",
                    font: detail.font || note.font || "system",
                    opacity: normalizedOpacity(detail.opacity),
                    titleStyle: normalizedTextStyle(detail.titleStyle, {
                      color: detail.color || note.color || "#375E97",
                      font: detail.font || note.font || "system",
                      size: 14,
                    }),
                    bodyStyle: normalizedTextStyle(detail.bodyStyle, {
                      color: detail.color || note.color || "#375E97",
                      font: detail.font || note.font || "system",
                      size: 11,
                    }),
                    width: normalizedDetailWidth(detail.width),
                    height: normalizedDetailHeight(detail.height),
                    x: Number.isFinite(detail.x)
                      ? detail.x
                      : (Number.isFinite(note.x) ? note.x : 520 + categoryIndex * 280) + 210,
                    y: Number.isFinite(detail.y)
                      ? detail.y
                      : (Number.isFinite(note.y) ? note.y : 320 + noteIndex * 80) + detailIndex * 90,
                  }))
                : [],
            }))
          : [],
      })),
    };

    if (!normalized.categories.some((category) => category.id === normalized.activeCategoryId)) {
      normalized.activeCategoryId = normalized.categories[0]?.id || null;
    }

    if (!isSelectionValid(normalized.selected, normalized.categories)) {
      normalized.selected = normalized.activeCategoryId
        ? { type: "category", categoryId: normalized.activeCategoryId }
        : null;
    }

    normalized.view = normalized.view === "active" ? "active" : "all";
    normalized.zoom = Number.isFinite(normalized.zoom) ? normalized.zoom : 1;
    normalized.search = normalized.search || "";
    if (normalized.boardVersion < 2) {
      moveLegacyBoardToDeepSpace(normalized);
    } else if (normalized.boardVersion < 3) {
      shrinkDeepSpaceBoard(normalized);
    }
    return normalized;
  }

  function moveLegacyBoardToDeepSpace(nextState) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    nextState.categories.forEach((category) => {
      minX = Math.min(minX, category.x);
      minY = Math.min(minY, category.y);
      maxX = Math.max(maxX, category.x);
      maxY = Math.max(maxY, category.y);
      category.notes.forEach((note) => {
        minX = Math.min(minX, note.x);
        minY = Math.min(minY, note.y);
        maxX = Math.max(maxX, note.x);
        maxY = Math.max(maxY, note.y);
        note.details?.forEach((detail) => {
          minX = Math.min(minX, detail.x);
          minY = Math.min(minY, detail.y);
          maxX = Math.max(maxX, detail.x);
          maxY = Math.max(maxY, detail.y);
        });
      });
    });
    const currentCenterX = Number.isFinite(minX) ? (minX + maxX) / 2 : STAGE.width / 2;
    const currentCenterY = Number.isFinite(minY) ? (minY + maxY) / 2 : STAGE.height / 2;
    const shiftX = STAGE.width / 2 - currentCenterX;
    const shiftY = STAGE.height / 2 - currentCenterY;
    nextState.categories.forEach((category) => {
      category.x = clamp(category.x + shiftX, 40, STAGE.width - 240);
      category.y = clamp(category.y + shiftY, 40, STAGE.height - 180);
      category.notes.forEach((note) => {
        note.x = clamp(note.x + shiftX, 40, STAGE.width - 230);
        note.y = clamp(note.y + shiftY, 40, STAGE.height - 170);
        note.details?.forEach((detail) => {
          detail.x = clamp(detail.x + shiftX, 40, STAGE.width - 190);
          detail.y = clamp(detail.y + shiftY, 40, STAGE.height - 130);
        });
      });
    });
    nextState.boardVersion = 3;
    nextState.zoom = Math.min(nextState.zoom || 1, 0.8);
  }

  function shrinkDeepSpaceBoard(nextState) {
    nextState.categories.forEach((category) => {
      category.x = clamp(category.x / 2, 40, STAGE.width - 240);
      category.y = clamp(category.y / 2, 40, STAGE.height - 180);
      category.notes.forEach((note) => {
        note.x = clamp(note.x / 2, 40, STAGE.width - 230);
        note.y = clamp(note.y / 2, 40, STAGE.height - 170);
        note.details?.forEach((detail) => {
          detail.x = clamp(detail.x / 2, 40, STAGE.width - 190);
          detail.y = clamp(detail.y / 2, 40, STAGE.height - 130);
        });
      });
    });
    nextState.boardVersion = 3;
    nextState.zoom = Math.min(Math.max(nextState.zoom || 0.8, 0.08), 1.1);
  }

  function isSelectionValid(selection, categories) {
    if (!selection) return false;
    if (selection.type === "category") {
      return categories.some((category) => category.id === selection.categoryId);
    }
    if (selection.type === "note") {
      const category = categories.find((item) => item.id === selection.categoryId);
      return Boolean(category?.notes.some((note) => note.id === selection.noteId));
    }
    if (selection.type === "detail") {
      const category = categories.find((item) => item.id === selection.categoryId);
      const note = category?.notes.find((item) => item.id === selection.noteId);
      return Boolean(note?.details?.some((detail) => detail.id === selection.detailId));
    }
    return false;
  }

  function saveState() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function boardFilePayload() {
    return {
      app: "memo-map",
      version: 1,
      exportedAt: new Date().toISOString(),
      state,
    };
  }

  function boardFileName() {
    const label = (activeCategory()?.title || "memo-map")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 32);
    const date = new Date().toISOString().slice(0, 10);
    return `${label || "memo-map"}-${date}.json`;
  }

  async function saveBoardToLocalFile() {
    const contents = JSON.stringify(boardFilePayload(), null, 2);
    const suggestedName = boardFileName();

    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: "Memo Map JSON",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(new Blob([contents], { type: "application/json" }));
        await writable.close();
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = suggestedName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function loadBoardFromLocalFile() {
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: "Memo Map JSON",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        if (handle) {
          await importBoardFile(await handle.getFile());
        }
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    els.localFileInput?.click();
  }

  async function importBoardFile(file) {
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const importedState = parsed?.state || parsed;
      if (!importedState || !Array.isArray(importedState.categories)) {
        window.alert("메모맵 저장 파일이 아닙니다.");
        return;
      }
      const ok = window.confirm("현재 보드를 불러온 파일 내용으로 바꿀까요?");
      if (!ok) return;
      state = normalizeState(importedState);
      upgradeGeneratedArt(state);
      multiSelection = new Set();
      didInitialCenter = false;
      saveState();
      render();
    } catch {
      window.alert("파일을 불러올 수 없습니다. JSON 저장 파일인지 확인해주세요.");
    }
  }

  function fontFamily(value) {
    return fontOptions.find((font) => font.value === value)?.family || fontOptions[0].family;
  }

  function activeCategory() {
    return state.categories.find((category) => category.id === state.activeCategoryId) || null;
  }

  function selectedEntity() {
    if (!state.selected) return null;
    const category = state.categories.find((item) => item.id === state.selected.categoryId);
    if (!category) return null;

    if (state.selected.type === "category") {
      return { type: "category", category, item: category };
    }

    const note = category.notes.find((item) => item.id === state.selected.noteId);
    if (!note) return null;

    if (state.selected.type === "note") {
      return { type: "note", category, note, item: note };
    }

    const detail = note.details?.find((item) => item.id === state.selected.detailId);
    return detail ? { type: "detail", category, note, item: detail } : null;
  }

  function itemFromKey(key) {
    const [type, categoryId, itemId, detailId] = key.split(":");
    const category = state.categories.find((item) => item.id === categoryId);
    if (!category) return null;
    if (type === "category") return { type, category, item: category, itemId };
    const note = category.notes.find((item) => item.id === itemId);
    if (!note) return null;
    if (type === "note") return { type, category, note, item: note, itemId };
    const detail = note.details?.find((item) => item.id === detailId);
    return detail ? { type, category, note, item: detail, itemId, detailId } : null;
  }

  function setSingleMultiSelection(type, categoryId, itemId, detailId = "") {
    multiSelection = new Set([nodeKey(type, categoryId, itemId, detailId)]);
    updateMapSelection();
  }

  function clearMultiSelection() {
    if (multiSelection.size === 0) return;
    multiSelection = new Set();
    updateMapSelection();
  }

  function commit(options = {}) {
    saveState();
    if (options.mapOnly) {
      renderMap();
      return;
    }
    render();
  }

  function setStageSize() {
    els.mapContent.style.width = `${STAGE.width}px`;
    els.mapContent.style.height = `${STAGE.height}px`;
    els.edgeLayer.setAttribute("viewBox", `0 0 ${STAGE.width} ${STAGE.height}`);
    els.edgeLayer.setAttribute("width", STAGE.width);
    els.edgeLayer.setAttribute("height", STAGE.height);
    applyZoom();
  }

  function applyZoom() {
    const zoom = state.zoom;
    els.mapContent.style.transform = `scale(${zoom})`;
    els.mapSpace.style.width = `${STAGE.width * zoom}px`;
    els.mapSpace.style.height = `${STAGE.height * zoom}px`;
    syncThreeCamera();
  }

  function setZoom(nextZoom, anchor = null) {
    const viewport = els.mapViewport;
    const previousZoom = state.zoom;
    const zoom = clamp(nextZoom, 0.05, 2.2);
    if (Math.abs(zoom - previousZoom) < 0.001) return;

    const rect = viewport.getBoundingClientRect?.() || { left: 0, top: 0 };
    const anchorX = anchor ? anchor.clientX - rect.left : viewport.clientWidth / 2;
    const anchorY = anchor ? anchor.clientY - rect.top : viewport.clientHeight / 2;
    const boardX = (viewport.scrollLeft + anchorX) / previousZoom;
    const boardY = (viewport.scrollTop + anchorY) / previousZoom;

    state.zoom = zoom;
    applyZoom();
    els.zoomInput.value = String(Math.round(zoom * 100));
    viewport.scrollLeft = boardX * zoom - anchorX;
    viewport.scrollTop = boardY * zoom - anchorY;
    saveState();
  }

  function smartZoomFromWheel(event, nextZoom) {
    if (nextZoom > state.zoom) {
      const category = activeCategory();
      if (category) {
        setZoomCenteredOnItem(category, nextZoom);
        return;
      }
    }

    if (nextZoom > state.zoom && state.zoom <= 0.34) {
      const target = nearestNodeAnchor(event);
      if (target) {
        setZoom(nextZoom, target);
        return;
      }
    }
    setZoom(nextZoom, event);
  }

  function setZoomCenteredOnItem(item, nextZoom) {
    state.zoom = clamp(nextZoom, 0.05, 2.2);
    applyZoom();
    els.zoomInput.value = String(Math.round(state.zoom * 100));
    saveState();
    centerMap(item, "auto");
  }

  function nearestNodeAnchor(event) {
    const nodes = [...els.nodeLayer.querySelectorAll(".mind-node")];
    if (nodes.length === 0) return null;

    let closest = null;
    let closestDistance = Infinity;
    const rect = els.mapViewport.getBoundingClientRect();
    nodes.forEach((node) => {
      const x = (parseFloat(node.style.left) + node.offsetWidth / 2) * state.zoom - els.mapViewport.scrollLeft;
      const y = (parseFloat(node.style.top) + node.offsetHeight / 2) * state.zoom - els.mapViewport.scrollTop;
      const clientX = rect.left + x;
      const clientY = rect.top + y;
      const distance = Math.hypot(event.clientX - clientX, event.clientY - clientY);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = { node, clientX, clientY };
      }
    });

    return closestDistance <= 180 ? closest : null;
  }

  function render() {
    renderSidebar();
    renderControls();
    renderMap();
    renderInspector();

    if (!didInitialCenter) {
      didInitialCenter = true;
      window.setTimeout(() => centerMap(), 80);
    }
  }

  function renderControls() {
    els.searchInput.value = state.search;
    els.zoomInput.value = String(Math.round(state.zoom * 100));
    els.viewButtons.forEach((button) => {
      const active = button.dataset.view === state.view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  function renderSidebar() {
    els.categoryCount.textContent = String(state.categories.length);
    els.categoryList.replaceChildren(
      ...state.categories.map((category) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "list-item";
        button.classList.toggle("active", category.id === state.activeCategoryId);
        button.dataset.categoryId = category.id;
        button.style.color = category.color;

        const dot = document.createElement("span");
        dot.className = "item-dot";
        dot.style.background = category.color;

        const main = document.createElement("span");
        main.className = "item-main";

        const title = document.createElement("span");
        title.className = "item-title";
        title.style.fontFamily = fontFamily(category.font);
        title.textContent = category.title;

        const subtitle = document.createElement("span");
        subtitle.className = "item-subtitle";
        subtitle.textContent = `${category.notes.length}개 메모`;

        const arrow = document.createElement("span");
        arrow.className = "item-arrow";
        arrow.innerHTML = '<svg><use href="#icon-chevron"></use></svg>';

        main.append(title, subtitle);
        button.append(dot, main, arrow);
        button.addEventListener("click", () => selectCategory(category.id, { focus: true }));
        return button;
      }),
    );

    const category = activeCategory();
    els.noteInput.disabled = !category;
    els.noteForm.querySelector("button").disabled = !category;
    els.noteCount.textContent = String(category?.notes.length || 0);
    els.noteList.replaceChildren(
      ...(category?.notes.map((note) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "list-item";
        button.classList.toggle(
          "active",
          state.selected?.noteId === note.id,
        );
        button.dataset.noteId = note.id;
        button.style.color = note.color;

        const dot = document.createElement("span");
        dot.className = "item-dot";
        dot.style.background = note.color;

        const main = document.createElement("span");
        main.className = "item-main";

        const title = document.createElement("span");
        title.className = "item-title";
        title.style.fontFamily = fontFamily(note.font);
        title.textContent = note.title;

        const subtitle = document.createElement("span");
        subtitle.className = "item-subtitle";
        subtitle.textContent = `${note.details?.length || 0}개 세부사항`;

        const arrow = document.createElement("span");
        arrow.className = "item-arrow";
        arrow.innerHTML = '<svg><use href="#icon-chevron"></use></svg>';

        main.append(title, subtitle);
        button.append(dot, main, arrow);
        button.addEventListener("click", () => selectNote(category.id, note.id, { focus: true }));
        return button;
      }) || []),
    );

    if (category && category.notes.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "메모 없음";
      els.noteList.append(empty);
    }
  }

  function visibleMapGroups() {
    const query = state.search.trim().toLowerCase();
    const source =
      state.view === "active"
        ? state.categories.filter((category) => category.id === state.activeCategoryId)
        : state.categories;

    return source
      .map((category) => {
        const categoryMatch = category.title.toLowerCase().includes(query);
        const notes = category.notes
          .map((note) => {
            const noteMatch = `${note.title} ${note.body}`.toLowerCase().includes(query);
            const details = (note.details || []).filter((detail) => {
              if (!query || categoryMatch || noteMatch) return true;
              return `${detail.title} ${detail.body}`.toLowerCase().includes(query);
            });
            if (!query || categoryMatch || noteMatch || details.length > 0) {
              return { note, details };
            }
            return null;
          })
          .filter(Boolean);

        if (query && !categoryMatch && notes.length === 0) return null;
        return { category, notes };
      })
      .filter(Boolean);
  }

  function renderMap() {
    els.nodeLayer.replaceChildren();
    els.edgeLayer.replaceChildren();

    visibleMapGroups().forEach(({ category, notes }) => {
      els.nodeLayer.append(createCategoryNode(category));
      notes.forEach(({ note, details }) => {
        els.nodeLayer.append(createNoteNode(category, note));
        details.forEach((detail) => els.nodeLayer.append(createDetailNode(category, note, detail)));
      });
    });

    updateMapSelection();
    renderEdges();
    renderThreeMarkers();
  }

  function nodeKey(type, categoryId, itemId, detailId = "") {
    return `${type}:${categoryId}:${itemId}:${detailId}`;
  }

  function keyFromNode(node) {
    return nodeKey(node.dataset.type, node.dataset.categoryId, node.dataset.itemId, node.dataset.detailId || "");
  }

  function createCategoryNode(category) {
    const node = baseNode("category", category.id, category.id);
    node.style.left = `${category.x}px`;
    node.style.top = `${category.y}px`;
    node.style.color = category.color;
    node.style.fontFamily = fontFamily(category.font);
    node.style.setProperty("--block-opacity", String(normalizedOpacity(category.opacity)));

    const kicker = document.createElement("span");
    kicker.className = "node-kicker";
    kicker.textContent = "CATEGORY";

    const title = document.createElement("span");
    title.className = "node-title";
    title.textContent = category.title;
    applyTextStyle(title, category.titleStyle, {
      color: category.color,
      font: category.font,
      size: 16,
    });

    const meta = document.createElement("span");
    meta.className = "node-meta";
    meta.textContent = `${category.notes.length}개 메모`;

    node.append(kicker, title, meta);
    return node;
  }

  function createNoteNode(category, note) {
    const node = baseNode("note", category.id, note.id);
    node.classList.toggle("has-visual", Boolean(note.iconSvg));
    node.style.left = `${note.x}px`;
    node.style.top = `${note.y}px`;
    node.style.width = `${normalizedNoteWidth(note.width, note.iconSvg)}px`;
    node.style.minHeight = `${normalizedNoteHeight(note.height)}px`;
    node.style.color = note.color;
    node.style.fontFamily = fontFamily(note.font);
    node.style.setProperty("--block-opacity", String(normalizedOpacity(note.opacity)));

    const visual = document.createElement("span");
    visual.className = "node-visual";
    if (note.iconSvg) {
      const image = document.createElement("img");
      image.alt = "";
      image.src = svgToDataUrl(note.iconSvg);
      visual.append(image);
    }

    const kicker = document.createElement("span");
    kicker.className = "node-kicker";
    kicker.textContent = category.title;

    const title = document.createElement("span");
    title.className = "node-title";
    title.textContent = note.title;
    applyTextStyle(title, note.titleStyle, {
      color: note.color,
      font: note.font,
      size: 16,
    });

    const body = document.createElement("span");
    body.className = "node-body";
    body.textContent = note.body;
    applyTextStyle(body, note.bodyStyle, {
      color: note.color,
      font: note.font,
      size: 12,
    });

    const resizeHandle = document.createElement("span");
    resizeHandle.className = "resize-handle";
    resizeHandle.title = "메모 크기 조절";
    resizeHandle.addEventListener("pointerdown", startResize);

    node.append(visual, kicker, title);
    if (note.body.trim()) node.append(body);
    node.append(resizeHandle);
    return node;
  }

  function createDetailNode(category, note, detail) {
    const node = baseNode("detail", category.id, note.id, detail.id);
    node.style.left = `${detail.x}px`;
    node.style.top = `${detail.y}px`;
    node.style.width = `${normalizedDetailWidth(detail.width)}px`;
    node.style.minHeight = `${normalizedDetailHeight(detail.height)}px`;
    node.style.color = detail.color;
    node.style.fontFamily = fontFamily(detail.font);
    node.style.setProperty("--block-opacity", String(normalizedOpacity(detail.opacity)));

    const kicker = document.createElement("span");
    kicker.className = "node-kicker";
    kicker.textContent = "\uc138\ubd80\uc0ac\ud56d";

    const title = document.createElement("span");
    title.className = "node-title";
    title.textContent = detail.title;
    applyTextStyle(title, detail.titleStyle, {
      color: detail.color,
      font: detail.font,
      size: 14,
    });

    const body = document.createElement("span");
    body.className = "node-body";
    body.textContent = detail.body;
    applyTextStyle(body, detail.bodyStyle, {
      color: detail.color,
      font: detail.font,
      size: 11,
    });

    node.append(kicker, title);
    if (detail.body.trim()) node.append(body);
    return node;
  }

  function baseNode(type, categoryId, itemId, detailId = "") {
    const node = document.createElement("button");
    node.type = "button";
    node.className = `mind-node ${type}`;
    node.dataset.type = type;
    node.dataset.categoryId = categoryId;
    node.dataset.itemId = itemId;
    if (detailId) node.dataset.detailId = detailId;
    node.addEventListener("pointerdown", startDrag);
    node.addEventListener("dblclick", () => {
      const selected = selectedEntity();
      if (selected?.item) {
        zoomToItem(selected.item, type === "category" ? 0.72 : type === "detail" ? 1.05 : 0.92);
      }
    });
    return node;
  }

  function renderEdges() {
    els.edgeLayer.replaceChildren();
    visibleMapGroups().forEach(({ category, notes }) => {
      const categoryNode = nodeElement("category", category.id, category.id);
      if (!categoryNode) return;
      notes.forEach(({ note, details }) => {
        const noteNode = nodeElement("note", category.id, note.id);
        if (!noteNode) return;
        const start = nodeCenter(categoryNode);
        const end = nodeCenter(noteNode);
        const midX = start.x + (end.x - start.x) * 0.5;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute(
          "d",
          `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`,
        );
        path.classList.toggle(
          "selected",
          (state.selected?.type === "category" && state.selected.categoryId === category.id) ||
            (state.selected?.type === "note" && state.selected.noteId === note.id),
        );
        els.edgeLayer.append(path);
        details.forEach((detail) => {
          const detailNode = nodeElement("detail", category.id, note.id, detail.id);
          if (!detailNode) return;
          const detailStart = nodeCenter(noteNode);
          const detailEnd = nodeCenter(detailNode);
          const detailMidX = detailStart.x + (detailEnd.x - detailStart.x) * 0.52;
          const detailPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
          detailPath.setAttribute(
            "d",
            `M ${detailStart.x} ${detailStart.y} C ${detailMidX} ${detailStart.y}, ${detailMidX} ${detailEnd.y}, ${detailEnd.x} ${detailEnd.y}`,
          );
          detailPath.classList.toggle(
            "selected",
            (state.selected?.type === "note" && state.selected.noteId === note.id) ||
              (state.selected?.type === "detail" && state.selected.detailId === detail.id),
          );
          els.edgeLayer.append(detailPath);
        });
      });
    });
  }

  function nodeElement(type, categoryId, itemId, detailId = "") {
    const detailSelector = detailId ? `[data-detail-id="${detailId}"]` : "";
    return els.nodeLayer.querySelector(
      `.mind-node[data-type="${type}"][data-category-id="${categoryId}"][data-item-id="${itemId}"]${detailSelector}`,
    );
  }

  function nodeCenter(node) {
    return {
      x: parseFloat(node.style.left) + node.offsetWidth / 2,
      y: parseFloat(node.style.top) + node.offsetHeight / 2,
    };
  }

  function updateMapSelection() {
    els.nodeLayer.querySelectorAll(".mind-node").forEach((node) => {
      const isSingleSelected = selectionMatchesNode(state.selected, node);
      const isMultiSelected = multiSelection.has(keyFromNode(node));
      node.classList.toggle("selected", isSingleSelected || isMultiSelected);
      node.classList.toggle("multi-selected", isMultiSelected && multiSelection.size > 1);
    });
  }

  function selectionMatchesNode(selection, node) {
    if (!selection || selection.type !== node.dataset.type) return false;
    if (selection.categoryId !== node.dataset.categoryId) return false;
    if (node.dataset.type === "category") return true;
    if (node.dataset.type === "note") return selection.noteId === node.dataset.itemId;
    return selection.noteId === node.dataset.itemId && selection.detailId === node.dataset.detailId;
  }

  function renderInspector() {
    els.inspector.replaceChildren();
    const selected = selectedEntity();

    if (!selected) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "선택 없음";
      els.inspector.append(empty);
      return;
    }

    const block = document.createElement("div");
    block.className = "editor-block";

    const header = document.createElement("div");
    header.className = "editor-header";

    const headingWrap = document.createElement("div");
    const eyebrow = document.createElement("span");
    eyebrow.className = "editor-eyebrow";
    eyebrow.textContent = selected.type === "category" ? "CATEGORY" : selected.type === "detail" ? "DETAIL" : "MEMO";
    const heading = document.createElement("h2");
    if (selected.type === "detail") heading.textContent = "\uc138\ubd80\uc0ac\ud56d \ud3b8\uc9d1";
    heading.textContent = selected.type === "category" ? "카테고리 편집" : "메모 편집";
    if (selected.type === "detail") heading.textContent = "\uc138\ubd80\uc0ac\ud56d \ud3b8\uc9d1";
    headingWrap.append(eyebrow, heading);

    header.append(headingWrap);
    block.append(header);

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.maxLength = selected.type === "category" ? 32 : 48;
    titleInput.value = selected.item.title;
    titleInput.addEventListener("input", () => {
      selected.item.title = titleInput.value;
      refreshEditedSelection();
    });
    titleInput.addEventListener("blur", () => {
      if (!selected.item.title.trim()) {
        selected.item.title = selected.type === "category" ? "새 카테고리" : selected.type === "detail" ? "새 세부사항" : "새 메모";
        render();
      }
    });
    block.append(field("제목", titleInput));

    if (selected.type === "note" || selected.type === "detail") {
      const bodyInput = document.createElement("textarea");
      bodyInput.maxLength = 320;
      bodyInput.value = selected.item.body;
      bodyInput.addEventListener("input", () => {
        selected.item.body = bodyInput.value;
        refreshEditedSelection();
      });
      block.append(field("내용", bodyInput));

    }

    if (selected.type === "note" || selected.type === "detail") {
      const detailParent = selected.type === "note" ? selected.item : selected.note;
      const addDetailButton = iconTextButton("secondary-button", "icon-plus", "\uc138\ubd80\uc0ac\ud56d \ucd94\uac00");
      addDetailButton.addEventListener("click", () => {
        addDetail(selected.category.id, detailParent.id);
      });
      block.append(addDetailButton);
    }

    if (selected.type === "note") {
      const artBlock = document.createElement("div");
      artBlock.className = "field";
      const artTitle = document.createElement("span");
      artTitle.className = "field-title";
      artTitle.textContent = "메모 이미지";

      artTitle.textContent = "메모 아이콘";
      const artPreview = document.createElement("div");
      artPreview.className = "note-art-preview";
      if (selected.item.iconSvg) {
        const previewImage = document.createElement("img");
        previewImage.alt = "";
        previewImage.src = svgToDataUrl(selected.item.iconSvg);
        artPreview.append(previewImage);
      } else {
        artPreview.textContent = "생성된 이미지 없음";
      }

      if (!selected.item.iconSvg) artPreview.textContent = "선택된 아이콘 없음";

      const iconControls = document.createElement("div");
      iconControls.className = "icon-picker-controls";
      const iconCategorySelect = document.createElement("select");
      iconCategories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = `${category.label} (${category.icons.length})`;
        iconCategorySelect.append(option);
      });
      const suggestedIconKey = selected.item.iconKey || chooseSuggestedIcon(selected.item, selected.category);
      const initialCategory =
        iconCategories.find((category) => category.icons.some((icon) => icon.key === suggestedIconKey)) ||
        iconCategories[0];
      iconCategorySelect.value = initialCategory.id;

      const suggestIconButton = iconTextButton("secondary-button", "icon-spark", "추천");
      suggestIconButton.addEventListener("click", () => {
        selectMemoIcon(selected.item, chooseSuggestedIcon(selected.item, selected.category));
        refreshEditedSelection();
        renderInspector();
      });
      iconControls.append(iconCategorySelect, suggestIconButton);

      const iconGrid = document.createElement("div");
      iconGrid.className = "icon-picker-grid";
      const renderIconChoices = () => {
        const category = iconCategories.find((item) => item.id === iconCategorySelect.value) || iconCategories[0];
        iconGrid.replaceChildren(
          ...category.icons.map((icon) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "icon-choice";
            button.classList.toggle("active", selected.item.iconKey === icon.key);
            button.title = icon.label;
            button.innerHTML = iconSvgFromKey(icon.key, selected.item.color || selected.category.color);
            button.addEventListener("click", () => {
              selectMemoIcon(selected.item, icon.key);
              refreshEditedSelection();
              renderInspector();
            });
            return button;
          }),
        );
      };
      iconCategorySelect.addEventListener("change", renderIconChoices);
      renderIconChoices();

      const artButtons = document.createElement("div");
      artButtons.className = "button-row";
      const generateArtButton = iconTextButton("secondary-button", "icon-spark", "생성");
      generateArtButton.querySelector("span").textContent = "추천";
      generateArtButton.addEventListener("click", () => {
        selectMemoIcon(selected.item, chooseSuggestedIcon(selected.item, selected.category));
        refreshEditedSelection();
        renderInspector();
      });
      const clearArtButton = iconTextButton("secondary-button", "icon-trash", "비우기");
      clearArtButton.disabled = !selected.item.iconSvg;
      clearArtButton.addEventListener("click", () => {
        selected.item.iconSvg = "";
        selected.item.iconKey = "";
        selected.item.iconSeed = "";
        selected.item.iconVersion = 4;
        refreshEditedSelection();
        renderInspector();
      });
      artButtons.append(generateArtButton, clearArtButton);
      artBlock.append(artTitle, artPreview, iconControls, iconGrid, artButtons);
      block.append(artBlock);

      const recordingBlock = document.createElement("div");
      recordingBlock.className = "field";
      const recordingTitle = document.createElement("span");
      recordingTitle.className = "field-title";
      recordingTitle.textContent = "녹음";

      const recordButton = iconTextButton(
        "record-button",
        "icon-mic",
        isRecordingSelected(selected.item.id) ? "정지" : "녹음",
      );
      recordButton.classList.toggle("recording", isRecordingSelected(selected.item.id));
      recordButton.addEventListener("click", () => toggleRecording(selected.category.id, selected.item.id));

      const status = document.createElement("span");
      status.className = "recording-status";
      status.classList.toggle("warning", recordingNotice.noteId === selected.item.id && recordingNotice.warning);
      status.textContent = recordingStatusText(selected.item);

      recordingBlock.append(recordingTitle, recordButton, status);
      if (selected.item.audioDataUrl) {
        const audio = document.createElement("audio");
        audio.className = "audio-player";
        audio.controls = true;
        audio.src = selected.item.audioDataUrl;
        recordingBlock.append(audio);
      }
      block.append(recordingBlock);
    }

    block.append(textStyleEditor("제목 스타일", selected.item.titleStyle, selected.item, "title"));
    if (selected.type === "note" || selected.type === "detail") {
      block.append(textStyleEditor("내용 스타일", selected.item.bodyStyle, selected.item, "body"));
    }

    const fontSelect = document.createElement("select");
    fontOptions.forEach((font) => {
      const option = document.createElement("option");
      option.value = font.value;
      option.textContent = font.label;
      option.selected = selected.item.font === font.value;
      fontSelect.append(option);
    });
    fontSelect.addEventListener("change", () => {
      selected.item.font = fontSelect.value;
      refreshEditedSelection();
    });
    block.append(field("블록 기본 글자체", fontSelect));

    const opacityInput = document.createElement("input");
    opacityInput.type = "range";
    opacityInput.className = "opacity-range";
    opacityInput.min = "35";
    opacityInput.max = "100";
    opacityInput.step = "1";
    opacityInput.value = String(Math.round(normalizedOpacity(selected.item.opacity) * 100));

    const opacityValue = document.createElement("span");
    opacityValue.className = "range-value";
    opacityValue.textContent = `${opacityInput.value}%`;

    const opacityRow = document.createElement("div");
    opacityRow.className = "range-row";
    opacityRow.append(opacityInput, opacityValue);

    opacityInput.addEventListener("input", () => {
      selected.item.opacity = normalizedOpacity(Number(opacityInput.value) / 100);
      opacityValue.textContent = `${opacityInput.value}%`;
      refreshEditedSelection();
    });

    const opacityBlock = document.createElement("div");
    opacityBlock.className = "field";
    const opacityTitle = document.createElement("span");
    opacityTitle.className = "field-title";
    opacityTitle.textContent = "투명도";
    opacityBlock.append(opacityTitle, opacityRow);
    block.append(opacityBlock);

    const colorBlock = document.createElement("div");
    colorBlock.className = "field";

    const colorTitle = document.createElement("span");
    colorTitle.className = "field-title";
    colorTitle.textContent = "블록 기본색";

    const swatches = document.createElement("div");
    swatches.className = "color-grid";
    palette.forEach((color) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "swatch";
      button.classList.toggle("active", color.toLowerCase() === selected.item.color.toLowerCase());
      button.style.background = color;
      button.title = color;
      button.addEventListener("click", () => {
        selected.item.color = color;
        refreshEditedSelection();
        renderInspector();
      });
      swatches.append(button);
    });

    const customRow = document.createElement("div");
    customRow.className = "color-input-row";
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = toHexColor(selected.item.color);
    colorInput.addEventListener("input", () => {
      selected.item.color = colorInput.value;
      refreshEditedSelection();
    });
    const colorText = document.createElement("input");
    colorText.type = "text";
    colorText.value = toHexColor(selected.item.color).toUpperCase();
    colorText.maxLength = 7;
    colorText.addEventListener("input", () => {
      const nextColor = colorText.value.trim();
      if (/^#[0-9a-f]{6}$/i.test(nextColor)) {
        selected.item.color = nextColor;
        colorInput.value = nextColor;
        refreshEditedSelection();
      }
    });
    customRow.append(colorInput, colorText);
    colorBlock.append(colorTitle, swatches, customRow);
    block.append(colorBlock);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger-button";
    deleteButton.innerHTML = '<svg><use href="#icon-trash"></use></svg><span>삭제</span>';
    deleteButton.addEventListener("click", () => {
      if (selected.type === "category") {
        deleteCategory(selected.category.id);
      } else if (selected.type === "note") {
        deleteNote(selected.category.id, selected.item.id);
      } else {
        deleteDetail(selected.category.id, selected.note.id, selected.item.id);
      }
    });
    block.append(deleteButton);

    els.inspector.append(block);
  }

  function iconTextButton(className, symbolId, text) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.innerHTML = `<svg><use href="#${symbolId}"></use></svg><span>${text}</span>`;
    return button;
  }

  function textStyleEditor(titleText, style, item, kind) {
    const styleState = normalizedTextStyle(style, {
      color: item.color,
      font: item.font,
      size: kind === "body" ? 12 : 16,
    });
    item[`${kind}Style`] = styleState;

    const wrapper = document.createElement("div");
    wrapper.className = "field text-style-editor";

    const title = document.createElement("span");
    title.className = "field-title";
    title.textContent = titleText;

    const grid = document.createElement("div");
    grid.className = "style-grid";

    const fontSelect = document.createElement("select");
    fontOptions.forEach((font) => {
      const option = document.createElement("option");
      option.value = font.value;
      option.textContent = font.label;
      option.selected = styleState.font === font.value;
      fontSelect.append(option);
    });
    fontSelect.addEventListener("change", () => {
      styleState.font = fontSelect.value;
      refreshEditedSelection();
    });
    grid.append(field("글자체", fontSelect));

    const sizeInput = document.createElement("input");
    sizeInput.type = "range";
    sizeInput.min = "10";
    sizeInput.max = "28";
    sizeInput.step = "1";
    sizeInput.value = String(styleState.size);
    const sizeValue = document.createElement("span");
    sizeValue.className = "range-value";
    sizeValue.textContent = `${styleState.size}px`;
    const sizeRow = document.createElement("div");
    sizeRow.className = "range-row";
    sizeRow.append(sizeInput, sizeValue);
    sizeInput.addEventListener("input", () => {
      styleState.size = normalizedTextSize(Number(sizeInput.value), kind === "body" ? 12 : 16);
      sizeValue.textContent = `${styleState.size}px`;
      refreshEditedSelection();
    });
    const sizeField = document.createElement("div");
    sizeField.className = "field";
    const sizeTitle = document.createElement("span");
    sizeTitle.className = "field-title";
    sizeTitle.textContent = "글자크기";
    sizeField.append(sizeTitle, sizeRow);
    grid.append(sizeField);

    grid.append(styleColorControl("글자색", styleState, "color", false));
    grid.append(styleColorControl("글자 배경색", styleState, "background", true));

    wrapper.append(title, grid);
    return wrapper;
  }

  function styleColorControl(labelText, styleState, key, allowClear) {
    const wrapper = document.createElement("div");
    wrapper.className = "field";
    const title = document.createElement("span");
    title.className = "field-title";
    title.textContent = labelText;

    const row = document.createElement("div");
    row.className = allowClear ? "color-input-row with-clear" : "color-input-row";

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = isHexColor(styleState[key]) ? styleState[key] : "#ffffff";
    colorInput.addEventListener("input", () => {
      styleState[key] = colorInput.value;
      textInput.value = colorInput.value.toUpperCase();
      refreshEditedSelection();
    });

    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.value = isHexColor(styleState[key]) ? styleState[key].toUpperCase() : "transparent";
    textInput.addEventListener("input", () => {
      const next = textInput.value.trim();
      if (allowClear && next.toLowerCase() === "transparent") {
        styleState[key] = "transparent";
        refreshEditedSelection();
        return;
      }
      if (isHexColor(next)) {
        styleState[key] = next;
        colorInput.value = next;
        refreshEditedSelection();
      }
    });

    row.append(colorInput, textInput);
    if (allowClear) {
      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.className = "clear-color-button";
      clearButton.textContent = "없음";
      clearButton.addEventListener("click", () => {
        styleState[key] = "transparent";
        textInput.value = "transparent";
        refreshEditedSelection();
      });
      row.append(clearButton);
    }

    wrapper.append(title, row);
    return wrapper;
  }

  function isRecordingSelected(noteId) {
    return Boolean(recordingNote && recordingNote.noteId === noteId);
  }

  function recordingStatusText(note) {
    if (recordingNotice.noteId === note.id && recordingNotice.text) {
      return recordingNotice.text;
    }
    if (isRecordingSelected(note.id)) {
      return recognition ? "녹음 중입니다. 말한 내용은 가능한 경우 텍스트로도 저장됩니다." : "녹음 중입니다.";
    }
    if (note.audioDataUrl) {
      return note.body.trim() ? "오디오와 텍스트가 저장되어 있습니다." : "오디오가 저장되어 있습니다.";
    }
    if (location.protocol === "file:") {
      return `현재 파일 주소라 마이크가 차단될 수 있습니다. ${LOCALHOST_URL}로 열면 권한을 다시 받을 수 있습니다.`;
    }
    return speechRecognitionCtor()
      ? "녹음하면 오디오가 저장되고, 인식된 말은 메모 내용에 추가됩니다."
      : "이 브라우저는 음성 텍스트 변환을 지원하지 않아 오디오만 저장됩니다.";
  }

  function setRecordingNotice(noteId, text, warning = false) {
    recordingNotice = { noteId, text, warning };
    renderInspector();
  }

  async function toggleRecording(categoryId, noteId) {
    if (recordingNote) {
      stopRecording();
      return;
    }

    const category = state.categories.find((item) => item.id === categoryId);
    const note = category?.notes.find((item) => item.id === noteId);
    if (!note) return;

    if (location.protocol === "file:") {
      setRecordingNotice(
        noteId,
        `파일 주소에서는 마이크 권한이 자주 차단됩니다. ${LOCALHOST_URL}로 다시 열어주세요.`,
        true,
      );
      return;
    }

    if (!window.isSecureContext) {
      setRecordingNotice(noteId, "브라우저 보안 정책 때문에 이 주소에서는 마이크를 사용할 수 없습니다.", true);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setRecordingNotice(noteId, "이 브라우저에서는 녹음을 사용할 수 없습니다.", true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingChunks = [];
      transcriptBuffer = "";
      recordingFinalText = "";
      recordingNote = { categoryId, noteId, stream };
      recordingNotice = { noteId, text: "", warning: false };
      const mimeType = supportedAudioMimeType();
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) recordingChunks.push(event.data);
      });
      recorder.addEventListener("stop", () => finishRecording(categoryId, noteId));
      recorder.start();
      startSpeechRecognition();
      renderInspector();
    } catch (error) {
      const message =
        error?.name === "NotAllowedError"
          ? "마이크 권한이 차단되어 녹음을 시작하지 못했습니다."
          : "녹음을 시작하지 못했습니다. 브라우저 마이크 권한을 확인해주세요.";
      recordingNote?.stream?.getTracks().forEach((track) => track.stop());
      recorder = null;
      recordingNote = null;
      setRecordingNotice(noteId, message, true);
    }
  }

  function supportedAudioMimeType() {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    return types.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || "";
  }

  function stopRecording() {
    if (recognition) {
      recognition.onend = null;
      recognition.stop();
      recognition = null;
    }
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else if (recordingNote) {
      recordingNote.stream?.getTracks().forEach((track) => track.stop());
      recordingNote = null;
      renderInspector();
    }
  }

  function finishRecording(categoryId, noteId) {
    const category = state.categories.find((item) => item.id === categoryId);
    const note = category?.notes.find((item) => item.id === noteId);
    const stream = recordingNote?.stream;
    stream?.getTracks().forEach((track) => track.stop());

    if (note && recordingChunks.length) {
      const mimeType = recorder?.mimeType || "audio/webm";
      const blob = new Blob(recordingChunks, { type: mimeType });
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        note.audioDataUrl = reader.result;
        note.audioMimeType = mimeType;
        if (transcriptBuffer.trim()) {
          const prefix = note.body.trim() ? "\n\n" : "";
          note.body = `${note.body}${prefix}${transcriptBuffer.trim()}`;
        }
        recordingNotice = { noteId, text: "녹음이 저장되었습니다.", warning: false };
        cleanupRecording();
        commit();
      });
      reader.addEventListener("error", () => {
        cleanupRecording();
        setRecordingNotice(noteId, "녹음 파일을 저장하지 못했습니다.", true);
      });
      reader.readAsDataURL(blob);
      return;
    }

    cleanupRecording();
    setRecordingNotice(noteId, "녹음된 소리가 없어 저장하지 않았습니다.", true);
  }

  function cleanupRecording() {
    recorder = null;
    recordingNote = null;
    recordingChunks = [];
    transcriptBuffer = "";
    recordingFinalText = "";
  }

  function startSpeechRecognition() {
    const Recognition = speechRecognitionCtor();
    if (!Recognition) return;

    try {
      recognition = new Recognition();
      recognition.lang = "ko-KR";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        const interim = [];
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const text = event.results[index][0].transcript;
          if (event.results[index].isFinal) {
            recordingFinalText = `${recordingFinalText} ${text}`.trim();
          } else {
            interim.push(text);
          }
        }
        transcriptBuffer = `${recordingFinalText} ${interim.join(" ")}`.trim();
      };
      recognition.onerror = () => {
        recognition = null;
      };
      recognition.start();
    } catch {
      recognition = null;
    }
  }

  function speechRecognitionCtor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function field(labelText, control) {
    const wrapper = document.createElement("div");
    wrapper.className = "field";
    const label = document.createElement("label");
    label.textContent = labelText;
    label.append(control);
    wrapper.append(label);
    return wrapper;
  }

  function defaultTextStyle(color = "#2F4858", font = "system", size = 16) {
    return {
      color,
      background: "transparent",
      font,
      size,
    };
  }

  function normalizedTextStyle(style = {}, fallback = {}) {
    const font = fontOptions.some((option) => option.value === style.font)
      ? style.font
      : fallback.font || "system";
    return {
      color: isHexColor(style.color) ? style.color : fallback.color || "#2F4858",
      background:
        style.background === "transparent" || isHexColor(style.background)
          ? style.background
          : "transparent",
      font,
      size: normalizedTextSize(style.size, fallback.size || 16),
    };
  }

  function normalizedTextSize(value, fallback = 16) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? clamp(Math.round(numeric), 10, 28) : fallback;
  }

  function applyTextStyle(element, style, fallback) {
    const next = normalizedTextStyle(style, fallback);
    element.style.color = next.color;
    element.style.fontFamily = fontFamily(next.font);
    element.style.fontSize = `${next.size}px`;
    element.style.backgroundColor = next.background;
    element.style.borderRadius = next.background === "transparent" ? "0" : "4px";
    element.style.padding = next.background === "transparent" ? "0" : "2px 4px";
  }

  function toHexColor(value) {
    return isHexColor(value) ? value : "#1F6F64";
  }

  function isHexColor(value) {
    return /^#[0-9a-f]{6}$/i.test(value);
  }

  function createIconCatalog() {
    const categorySpecs = [
      {
        id: "work",
        label: "업무",
        shapes: ["check", "target", "flag", "calendar", "briefcase", "chart", "clock", "bolt"],
      },
      {
        id: "idea",
        label: "아이디어",
        shapes: ["spark", "bulb", "rocket", "planet", "wand", "gem", "layers", "orbit"],
      },
      {
        id: "study",
        label: "학습",
        shapes: ["book", "pen", "cap", "atom", "brain", "puzzle", "code", "microscope"],
      },
      {
        id: "life",
        label: "생활",
        shapes: ["home", "heart", "cup", "leaf", "sun", "moon", "basket", "umbrella"],
      },
      {
        id: "finance",
        label: "금융",
        shapes: ["coin", "wallet", "card", "safe", "trend", "receipt", "bank", "diamond"],
      },
      {
        id: "travel",
        label: "여행",
        shapes: ["map", "pin", "compass", "plane", "camera", "mountain", "wave", "ticket"],
      },
      {
        id: "creative",
        label: "창작",
        shapes: ["brush", "palette", "music", "film", "image", "penTool", "cube", "theater"],
      },
      {
        id: "health",
        label: "건강",
        shapes: ["plus", "pulse", "drop", "apple", "shoe", "medal", "lotus", "shield"],
      },
      {
        id: "social",
        label: "관계",
        shapes: ["chat", "users", "mail", "phone", "link", "gift", "hand", "smile"],
      },
      {
        id: "system",
        label: "도구",
        shapes: ["gear", "key", "lock", "database", "server", "wifi", "terminal", "sliders"],
      },
    ];

    return categorySpecs.map((category) => ({
      id: category.id,
      label: category.label,
      icons: Array.from({ length: 24 }, (_, index) => {
        const shape = category.shapes[index % category.shapes.length];
        return {
          key: `${category.id}-${shape}-${index + 1}`,
          label: `${category.label} ${index + 1}`,
          shape,
          variant: index,
        };
      }),
    }));
  }

  function selectMemoIcon(note, iconKey) {
    note.iconKey = iconKey;
    note.iconSvg = iconSvgFromKey(iconKey, note.color);
    note.iconSeed = iconKey;
    note.iconVersion = 4;
  }

  function chooseSuggestedIcon(note, category) {
    const text = `${category?.title || ""} ${note?.title || ""} ${note?.body || ""}`.toLowerCase();
    const matchedCategory =
      [
        ["work", /업무|일정|회의|보고|프로젝트|task|todo|work|done|체크/],
        ["idea", /아이디어|생각|기획|브레인|창의|idea|concept/],
        ["study", /공부|학습|책|강의|논문|코드|study|learn|book/],
        ["life", /생활|집|가족|요리|정리|life|home/],
        ["finance", /돈|비용|예산|금융|투자|매출|finance|money/],
        ["travel", /여행|지도|장소|예약|trip|travel/],
        ["creative", /디자인|그림|음악|영상|글쓰기|creative|design/],
        ["health", /건강|운동|병원|휴식|health|fitness/],
        ["social", /친구|연락|메일|모임|social|message/],
        ["system", /설정|서버|데이터|툴|시스템|system|server|data/],
      ].find(([, pattern]) => pattern.test(text))?.[0] || "idea";
    const categoryIcons = iconCategories.find((item) => item.id === matchedCategory)?.icons || iconCategories[0].icons;
    return categoryIcons[hashText(text || matchedCategory) % categoryIcons.length].key;
  }

  function iconSvgFromKey(iconKey, color = "#1F6F64") {
    const icon = iconLookup.get(iconKey) || iconCategories[0].icons[0];
    const base = toHexColor(color);
    const accent = palette[(icon.variant + icon.shape.length) % palette.length];
    const soft = palette[(icon.variant * 3 + 5) % palette.length];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="memo icon">
      <defs>
        <linearGradient id="icon-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#111827"/>
          <stop offset="0.58" stop-color="${base}"/>
          <stop offset="1" stop-color="#050816"/>
        </linearGradient>
        <filter id="icon-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="${accent}" flood-opacity="0.48"/>
        </filter>
      </defs>
      <rect width="160" height="160" rx="${18 + (icon.variant % 4) * 5}" fill="url(#icon-bg)"/>
      <circle cx="${24 + (icon.variant % 5) * 5}" cy="${28 + (icon.variant % 3) * 9}" r="${24 + (icon.variant % 4) * 6}" fill="#ffffff" opacity="0.09"/>
      <circle cx="${124 - (icon.variant % 4) * 4}" cy="${124 - (icon.variant % 5) * 5}" r="${30 + (icon.variant % 3) * 7}" fill="${soft}" opacity="0.2"/>
      <g transform="translate(80 80) rotate(${(icon.variant % 8) * 6 - 18}) scale(${0.92 + (icon.variant % 4) * 0.04})" filter="url(#icon-glow)">
        ${iconSymbolSvg(icon.shape, accent, icon.variant)}
      </g>
      <path d="M20 130 C48 116, 72 146, 140 120" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="7" stroke-linecap="round"/>
    </svg>`;
  }

  function iconSymbolSvg(shape, accent, variant = 0) {
    const stroke = "#ffffff";
    const fill = accent;
    const common = `stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
    const filled = `fill="${fill}" opacity="0.92"`;
    const dot = `<circle cx="${-30 + (variant % 4) * 20}" cy="34" r="5" fill="#ffffff" opacity="0.72"/>`;
    const symbols = {
      check: `<path ${common} d="M-38 0 L-12 26 L42 -32"/>${dot}`,
      target: `<circle ${common} cx="0" cy="0" r="42"/><circle ${common} cx="0" cy="0" r="19"/><path ${common} d="M0 -54v18M0 36v18M-54 0h18M36 0h18"/>`,
      flag: `<path ${common} d="M-32 42V-42M-30 -38H34L18 -10L34 18H-30"/>`,
      calendar: `<rect ${common} x="-42" y="-32" width="84" height="72" rx="10"/><path ${common} d="M-20 -46v22M20 -46v22M-42 -8h84"/>`,
      briefcase: `<rect ${common} x="-44" y="-18" width="88" height="58" rx="10"/><path ${common} d="M-18 -18v-15h36v15M-44 6h88"/>`,
      chart: `<path ${common} d="M-42 34H42M-30 34V2M0 34V-24M30 34V-8"/>`,
      clock: `<circle ${common} cx="0" cy="0" r="42"/><path ${common} d="M0 -22V4L20 18"/>`,
      bolt: `<path ${filled} d="M8-54-38 8h28l-8 48L38-18H8z"/>`,
      spark: `<path ${filled} d="M0-55 13-14 55 0 13 14 0 55-13 14-55 0-13-14z"/>`,
      bulb: `<path ${common} d="M-28 -2a28 28 0 1 1 56 0c0 15-12 22-15 34h-26C-16 20-28 13-28-2zM-14 46h28"/>`,
      rocket: `<path ${common} d="M-28 30C-18-22 9-44 42-48 38-16 16 14-34 28zM-18 18l-24 24M18-18l24-24"/><circle cx="12" cy="-18" r="7" fill="#ffffff"/>`,
      planet: `<circle ${common} cx="0" cy="0" r="30"/><ellipse ${common} cx="0" cy="0" rx="54" ry="16" transform="rotate(-18)"/>`,
      wand: `<path ${common} d="M-38 38 34-34M20-48l3 13 13 3-13 3-3 13-3-13-13-3 13-3z"/>`,
      gem: `<path ${common} d="M-38-20-18-42h36l20 22L0 44zM-18-42 0 44 18-42M-38-20h76"/>`,
      layers: `<path ${common} d="M0-42 44-18 0 6-44-18zM-36 8 0 28 36 8M-36 28 0 48 36 28"/>`,
      orbit: `<circle ${filled} cx="0" cy="0" r="13"/><ellipse ${common} cx="0" cy="0" rx="54" ry="18"/><ellipse ${common} cx="0" cy="0" rx="54" ry="18" transform="rotate(62)"/>`,
      book: `<path ${common} d="M-44-38h34c12 0 18 6 18 18v60c0-10-8-16-20-16h-32zM8-20c0-12 6-18 18-18h18v62H24c-10 0-16 6-16 16z"/>`,
      pen: `<path ${common} d="M-36 38-26 6 20-40 40-20-6 26zM20-40l20 20"/>`,
      cap: `<path ${common} d="M-50-12 0-38 50-12 0 14zM-28 2v26c18 12 38 12 56 0V2"/>`,
      atom: `<circle ${filled} cx="0" cy="0" r="8"/><ellipse ${common} cx="0" cy="0" rx="50" ry="16"/><ellipse ${common} cx="0" cy="0" rx="50" ry="16" transform="rotate(60)"/><ellipse ${common} cx="0" cy="0" rx="50" ry="16" transform="rotate(120)"/>`,
      brain: `<path ${common} d="M-12 40c-26 0-38-18-30-36-12-24 16-42 34-24 20-26 58-2 42 26 14 20-4 42-30 34M-4-28v68"/>`,
      puzzle: `<path ${common} d="M-42-32h28c-4-18 24-18 20 0h36v30c-18-4-18 24 0 20v28H-42V18c18 4 18-24 0-20z"/>`,
      code: `<path ${common} d="M-22-34-52 0l30 34M22-34 52 0 22 34M8-42-8 42"/>`,
      microscope: `<path ${common} d="M-10-44 22-22 8 0-24-22zM8 0l20 20M-42 44h82M-20 44c0-22 18-38 42-38"/>`,
      home: `<path ${common} d="M-46 2 0-38 46 2M-34-6v48h68V-6M-10 42V12h20v30"/>`,
      heart: `<path ${filled} d="M0 42C-50 8-48-28-22-34-7-38 0-26 0-26s7-12 22-8C48-28 50 8 0 42z"/>`,
      cup: `<path ${common} d="M-34-30h58v46c0 17-12 28-29 28s-29-11-29-28zM24-18h16c10 0 10 24 0 24H24"/>`,
      leaf: `<path ${common} d="M-38 30C-24-28 12-44 44-38 38 0 12 34-38 30zM-38 30 18-12"/>`,
      sun: `<circle ${common} cx="0" cy="0" r="24"/><path ${common} d="M0-56v16M0 40v16M-56 0h16M40 0h16M-40-40l12 12M28 28l12 12M40-40 28-28M-28 28l-12 12"/>`,
      moon: `<path ${filled} d="M24 44C-20 36-42 2-28-34-12-18 12-8 38-16 30-2 28 22 24 44z"/>`,
      basket: `<path ${common} d="M-44-8h88l-10 50h-68zM-22-8 0-40 22-8M-22 10v16M0 10v16M22 10v16"/>`,
      umbrella: `<path ${common} d="M-50 2C-40-30 40-30 50 2M0 2v34c0 14 18 14 18 0"/>`,
      coin: `<circle ${common} cx="0" cy="0" r="42"/><path ${common} d="M16-22H-6c-18 0-18 18 0 18h12c18 0 18 20 0 20H-18M0-34v68"/>`,
      wallet: `<rect ${common} x="-48" y="-30" width="96" height="64" rx="12"/><path ${common} d="M18-4h34v28H18c-18 0-18-28 0-28z"/><circle cx="30" cy="10" r="4" fill="#ffffff"/>`,
      card: `<rect ${common} x="-48" y="-30" width="96" height="60" rx="10"/><path ${common} d="M-48-10h96M-30 12h24"/>`,
      safe: `<rect ${common} x="-44" y="-38" width="88" height="76" rx="12"/><circle ${common} cx="0" cy="0" r="18"/><path ${common} d="M0-18v36M-18 0h36"/>`,
      trend: `<path ${common} d="M-46 32-14 0 8 18 44-28M22-28h22v22"/>`,
      receipt: `<path ${common} d="M-34-44h68v88l-14-8-14 8-14-8-14 8-12-8zM-16-16h32M-16 8h32"/>`,
      bank: `<path ${common} d="M-48-14 0-42 48-14zM-38-14v48M-12-14v48M12-14v48M38-14v48M-48 42h96"/>`,
      diamond: `<path ${common} d="M-42-20-18-44h36l24 24L0 44z"/>`,
      map: `<path ${common} d="M-46-34-16-44 16-34 46-44v78L16 44-16 34-46 44zM-16-44v78M16-34v78"/>`,
      pin: `<path ${filled} d="M0 50C-26 18-36 0-32-20c4-22 22-34 32-34s28 12 32 34C36 0 26 18 0 50z"/><circle cx="0" cy="-18" r="11" fill="#ffffff"/>`,
      compass: `<circle ${common} cx="0" cy="0" r="46"/><path ${filled} d="M18-34 6 12-18 34-6-12z"/>`,
      plane: `<path ${filled} d="M-54 8 50-42 22 8l26 28-16 8-32-22-28 16-8-10 22-20-32-12z"/>`,
      camera: `<rect ${common} x="-46" y="-26" width="92" height="62" rx="12"/><circle ${common} cx="0" cy="6" r="20"/><path ${common} d="M-18-26-10-40h20l8 14"/>`,
      mountain: `<path ${common} d="M-54 38-18-26 2 8 18-18 54 38zM-18-26l20 64"/>`,
      wave: `<path ${common} d="M-52 16c20-28 38-28 58 0 16 22 30 22 50 0M-52 38c18-12 34-12 52 0 18 12 36 12 54 0"/>`,
      ticket: `<path ${common} d="M-48-24h96v20c-16 0-16 24 0 24v20h-96V20c16 0 16-24 0-24z"/>`,
      brush: `<path ${common} d="M-8 18 34-36c8-10 24 4 14 14L-8 18zM-8 18c-4 22-22 30-40 24 14-8 12-28 40-24z"/>`,
      palette: `<path ${common} d="M4 42c-32 0-54-20-50-48 4-28 32-44 62-34 30 10 40 40 26 58-8 10-19 2-26 8-7 5 3 16-12 16z"/><circle cx="-18" cy="-16" r="5" fill="#ffffff"/><circle cx="4" cy="-24" r="5" fill="#ffffff"/><circle cx="22" cy="-8" r="5" fill="#ffffff"/>`,
      music: `<path ${common} d="M-12 26V-38l46-10v58M-12 26c0 12-28 12-28 0s28-12 28 0M34 10c0 12-28 12-28 0s28-12 28 0"/>`,
      film: `<rect ${common} x="-46" y="-36" width="92" height="72" rx="10"/><path ${common} d="M-22-36v72M22-36v72M-46-12h92M-46 12h92"/>`,
      image: `<rect ${common} x="-46" y="-34" width="92" height="68" rx="10"/><circle cx="20" cy="-10" r="8" fill="#ffffff"/><path ${common} d="M-36 26-8 0 10 18 24 6 40 26"/>`,
      penTool: `<path ${common} d="M0-48 30 18 0 44-30 18zM0-48V8M0 8l-30 10M0 8l30 10"/><circle cx="0" cy="8" r="6" fill="#ffffff"/>`,
      cube: `<path ${common} d="M0-44 40-22v44L0 44-40 22v-44zM-40-22 0 0l40-22M0 0v44"/>`,
      theater: `<path ${common} d="M-44-34c28-12 50-12 88 0v28c0 30-20 48-44 54-24-6-44-24-44-54zM-20-8h1M20-8h1M-20 22c14 8 26 8 40 0"/>`,
      plus: `<path ${common} d="M0-46v92M-46 0h92"/>`,
      pulse: `<path ${common} d="M-54 6h24l12-30 24 58 14-28h34"/>`,
      drop: `<path ${filled} d="M0-52C28-18 40 4 34 24 28 44 10 54 0 54s-28-10-34-30C-40 4-28-18 0-52z"/>`,
      apple: `<path ${common} d="M-4-30c10-16 22-16 30-10M0-26c-28-20-58 4-42 44 10 26 26 34 42 20 16 14 32 6 42-20 16-40-14-64-42-44z"/>`,
      shoe: `<path ${common} d="M-50 18c28 2 42-4 54-24l12 22 34 14c10 4 8 16-4 16h-96z"/>`,
      medal: `<circle ${common} cx="0" cy="14" r="28"/><path ${common} d="M-22-46-6-12M22-46 6-12M-10 14l8 8 14-16"/>`,
      lotus: `<path ${common} d="M0 36C-16 18-14-8 0-28 14-8 16 18 0 36zM0 36c-28-8-38-28-34-50 22 2 34 22 34 50zM0 36c28-8 38-28 34-50-22 2-34 22-34 50z"/>`,
      shield: `<path ${common} d="M0-48 42-30v30c0 30-18 48-42 58-24-10-42-28-42-58v-30zM-18 0l12 12 26-28"/>`,
      chat: `<path ${common} d="M-46-26h92v54h-54l-24 20V28h-14z"/>`,
      users: `<circle ${common} cx="-18" cy="-12" r="18"/><circle ${common} cx="26" cy="-8" r="14"/><path ${common} d="M-50 42c6-26 58-26 64 0M12 38c6-18 40-18 44 0"/>`,
      mail: `<rect ${common} x="-48" y="-32" width="96" height="64" rx="10"/><path ${common} d="M-48-22 0 10 48-22"/>`,
      phone: `<path ${common} d="M-22-46h44v92h-44zM-6 32h12"/>`,
      link: `<path ${common} d="M-10-24 2-36c14-14 38 10 24 24L10 4M10 24-2 36c-14 14-38-10-24-24L-10-4"/>`,
      gift: `<rect ${common} x="-42" y="-10" width="84" height="52" rx="8"/><path ${common} d="M0-10v52M-42 8h84M-24-10c-22-18 8-34 24 0M24-10c22-18-8-34-24 0"/>`,
      hand: `<path ${common} d="M-34 8v-24c0-12 16-12 16 0v18-32c0-12 16-12 16 0v30-34c0-12 16-12 16 0v36-24c0-12 16-12 16 0v36c0 28-16 42-38 42-18 0-32-12-46-32-8-12 6-22 16-10z"/>`,
      smile: `<circle ${common} cx="0" cy="0" r="44"/><circle cx="-16" cy="-10" r="5" fill="#ffffff"/><circle cx="16" cy="-10" r="5" fill="#ffffff"/><path ${common} d="M-20 14c12 14 28 14 40 0"/>`,
      gear: `<path ${common} d="M0-52v16M0 36v16M-52 0h16M36 0h16M-36-36l12 12M24 24l12 12M36-36 24-24M-24 24l-12 12"/><circle ${common} cx="0" cy="0" r="22"/>`,
      key: `<circle ${common} cx="-22" cy="-6" r="20"/><path ${common} d="M-4 8 44 56M24 36l12-12M34 46l12-12"/>`,
      lock: `<rect ${common} x="-40" y="-4" width="80" height="52" rx="10"/><path ${common} d="M-24-4v-18c0-30 48-30 48 0v18"/>`,
      database: `<ellipse ${common} cx="0" cy="-28" rx="42" ry="16"/><path ${common} d="M-42-28v56c0 9 19 16 42 16s42-7 42-16v-56M-42 0c0 9 19 16 42 16s42-7 42-16"/>`,
      server: `<rect ${common} x="-46" y="-38" width="92" height="32" rx="8"/><rect ${common} x="-46" y="6" width="92" height="32" rx="8"/><circle cx="24" cy="-22" r="4" fill="#ffffff"/><circle cx="24" cy="22" r="4" fill="#ffffff"/>`,
      wifi: `<path ${common} d="M-48-12c28-26 68-26 96 0M-30 8c18-16 42-16 60 0M-12 28c8-8 16-8 24 0"/><circle cx="0" cy="42" r="6" fill="#ffffff"/>`,
      terminal: `<path ${common} d="M-44-32h88v64h-88zM-30-10-12 4-30 18M-2 20h24"/>`,
      sliders: `<path ${common} d="M-44-24h88M-44 0h88M-44 24h88"/><circle ${filled} cx="-18" cy="-24" r="10"/><circle ${filled} cx="22" cy="0" r="10"/><circle ${filled} cx="-4" cy="24" r="10"/>`,
    };
    return symbols[shape] || symbols.spark;
  }

  function svgToDataUrl(svg) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function generateMemoArt(note, category) {
    return iconSvgFromKey(chooseSuggestedIcon(note, category), note.color || category.color);
    const text = `${note.title} ${note.body}`.trim() || "memo";
    const seed = hashText(text);
    const base = note.color || category.color || "#1F6F64";
    const accent = palette[(seed + 2) % palette.length];
    const topic = memoTopic(text);
    const titleLines = wrapSvgText(note.title || topic.label, 11, 2);
    const bodyLines = wrapSvgText(note.body || topic.reason, 17, 2);
    const keywords = extractKeywords(text, topic.label).slice(0, 3);
    const constellation = Array.from({ length: 5 }, (_, index) => {
      const local = hashText(`${text}-star-${index}`);
      return {
        x: 18 + (local % 124),
        y: 18 + ((local >> 5) % 62),
      };
    });
    const starDots = constellation
      .map((star, index) => {
        const next = constellation[index + 1];
        const line = next
          ? `<line x1="${star.x}" y1="${star.y}" x2="${next.x}" y2="${next.y}" stroke="#ffffff" stroke-opacity="0.18" stroke-width="1"/>`
          : "";
        return `${line}<circle cx="${star.x}" cy="${star.y}" r="${index % 3 === 0 ? 1.8 : 1.1}" fill="#ffffff" opacity="${index % 2 ? 0.74 : 0.95}"/>`;
      })
      .join("");

    const chipText = keywords
      .map((keyword, index) => {
        const x = 18 + index * 43;
        return `<rect x="${x}" y="132" width="38" height="14" rx="7" fill="#ffffff" opacity="0.86"/><text x="${x + 19}" y="142" text-anchor="middle" font-family="Inter, Malgun Gothic, sans-serif" font-size="6.5" font-weight="800" fill="#16202f">${escapeXml(keyword)}</text>`;
      })
      .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="${escapeXml(note.title || "memo")}">
      <defs>
        <linearGradient id="memo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#10162d"/>
          <stop offset="0.52" stop-color="${base}"/>
          <stop offset="1" stop-color="#050713"/>
        </linearGradient>
        <filter id="memo-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="${accent}" flood-opacity="0.55"/>
        </filter>
      </defs>
      <rect width="160" height="160" rx="16" fill="url(#memo-bg)"/>
      <circle cx="124" cy="28" r="34" fill="${accent}" opacity="0.18"/>
      <circle cx="18" cy="112" r="48" fill="#ffffff" opacity="0.08"/>
      ${starDots}
      <g transform="translate(80 58)" filter="url(#memo-glow)">
        ${keywordSymbol(text, accent)}
      </g>
      <rect x="10" y="101" width="140" height="29" rx="8" fill="rgba(255,255,255,0.9)"/>
      <text x="80" y="113" text-anchor="middle" font-family="Inter, Malgun Gothic, sans-serif" font-size="9.5" font-weight="900" fill="#16202f">${titleLines.map(escapeXml).join("</text><text x=\"80\" dy=\"11\" text-anchor=\"middle\" font-family=\"Inter, Malgun Gothic, sans-serif\" font-size=\"9.5\" font-weight=\"900\" fill=\"#16202f\">")}</text>
      <text x="80" y="153" text-anchor="middle" font-family="Inter, Malgun Gothic, sans-serif" font-size="6.8" font-weight="800" fill="#ffffff" opacity="0.88">${bodyLines.map(escapeXml).join("</text><text x=\"80\" dy=\"8\" text-anchor=\"middle\" font-family=\"Inter, Malgun Gothic, sans-serif\" font-size=\"6.8\" font-weight=\"800\" fill=\"#ffffff\" opacity=\"0.88\">")}</text>
      ${chipText}
      <text x="80" y="13" text-anchor="middle" font-family="Inter, Malgun Gothic, sans-serif" font-size="8" font-weight="800" fill="#ffffff" opacity="0.82">${escapeXml(topic.label)}</text>
    </svg>`;
  }

  function memoTopic(text) {
    const lower = text.toLowerCase();
    if (/우선순위|체크|할 일|todo|task|done|오늘|완료|정리/.test(lower)) {
      return { label: "할일", reason: "체크리스트" };
    }
    if (/일정|시간|회의|내일|달력|schedule|meeting|time|예약/.test(lower)) {
      return { label: "일정", reason: "시간 관리" };
    }
    if (/제품|콘셉트|컨셉|브랜드|출시|서비스|product|launch/.test(lower)) {
      return { label: "제품", reason: "제품 구상" };
    }
    if (/아이디어|생각|기획|idea|plan|concept|흐름|화면/.test(lower)) {
      return { label: "아이디어", reason: "기획" };
    }
    if (/자료|링크|문서|읽|책|reference|doc|book|link/.test(lower)) {
      return { label: "자료", reason: "참고 자료" };
    }
    if (/문장|표현|카피|글|쓰기|quote|copy|writing/.test(lower)) {
      return { label: "문장", reason: "문장 보관" };
    }
    if (/돈|예산|구매|가격|비용|money|budget|buy|price/.test(lower)) {
      return { label: "예산", reason: "비용" };
    }
    if (/나중|언젠가|보류|later|someday|backlog/.test(lower)) {
      return { label: "나중", reason: "보류" };
    }
    return { label: "메모", reason: "기록" };
  }

  function keywordSymbol(text, accent) {
    const topic = memoTopic(text).label;
    if (topic === "할일") {
      return `<rect x="-34" y="-30" width="68" height="60" rx="12" fill="#fff"/><path d="M-20 -10l8 8 17-19M-20 12l8 8 17-19M10 -7h15M10 15h15" fill="none" stroke="#16202f" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="-24" cy="-19" r="6" fill="${accent}"/>`;
    }
    if (topic === "제품") {
      return `<path d="M0 -38c17 7 30 24 30 43 0 24-30 45-30 45S-30 29-30 5c0-19 13-36 30-43Z" fill="#fff"/><circle cx="0" cy="-2" r="11" fill="${accent}"/><path d="M-20 22c-10 8-16 17-17 29 12-2 22-7 29-17M20 22c10 8 16 17 17 29-12-2-22-7-29-17" fill="#fff" stroke="#16202f" stroke-width="4" stroke-linejoin="round"/>`;
    }
    if (topic === "일정") {
      return `<rect x="-29" y="-29" width="58" height="56" rx="10" fill="#fff"/><path d="M-16 -34v13M16 -34v13M-29 -11h58" stroke="#16202f" stroke-width="5" stroke-linecap="round"/><circle cx="-12" cy="8" r="5" fill="${accent}"/><circle cx="11" cy="8" r="5" fill="#1F6F64"/>`;
    }
    if (topic === "아이디어") {
      return `<path d="M0 -35c18 0 31 13 31 29 0 11-6 19-15 25v8h-32v-8C-25 13-31 5-31-6c0-16 13-29 31-29Z" fill="#fff"/><path d="M-12 35h24M-8 46H8" stroke="#16202f" stroke-width="5" stroke-linecap="round"/><path d="M-10 -4 0 9 13 -10" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    if (topic === "자료") {
      return `<path d="M-28 -34h39l17 17v51h-56Z" fill="#fff"/><path d="M11 -34v17h17M-15 -3h30M-15 12H9" fill="none" stroke="#16202f" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="22" cy="24" r="7" fill="${accent}"/>`;
    }
    if (topic === "문장") {
      return `<rect x="-34" y="-24" width="68" height="48" rx="11" fill="#fff"/><path d="M-17 -6c0-10 6-18 15-22M15 -6c0-10 6-18 15-22M-19 7h17M13 7h17" fill="none" stroke="#16202f" stroke-width="5" stroke-linecap="round"/><circle cx="-22" cy="18" r="5" fill="${accent}"/>`;
    }
    if (topic === "예산") {
      return `<circle cx="0" cy="0" r="34" fill="#fff"/><path d="M0 -21v42M13 -13C10 -20 1 -23-8 -19c-11 4-10 17 3 20l9 3c14 4 13 18 2 21-10 3-20-1-24-10" fill="none" stroke="#16202f" stroke-width="5" stroke-linecap="round"/>`;
    }
    if (topic === "나중") {
      return `<path d="M-24 -34h48M-24 34h48M-18 -34c0 22 36 22 36 68M18 -34c0 22-36 22-36 68" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M-12 -15h24M-10 17h20" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>`;
    }
    return `<rect x="-31" y="-25" width="62" height="50" rx="11" fill="#fff"/><path d="M-16 -5h32M-16 10H8" stroke="#16202f" stroke-width="5" stroke-linecap="round"/><path d="M20 -34 29 -20 43 -16 29 -12 20 3 11 -12 -3 -16 11 -20Z" fill="${accent}"/>`;
  }

  function extractKeywords(text, fallback) {
    const cleaned = String(text || "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 2 && !["그리고", "하지만", "있는", "없는", "하기", "하기로"].includes(word));
    const unique = [...new Set(cleaned)];
    return unique.length ? unique : [fallback];
  }

  function wrapSvgText(text, maxChars, maxLines) {
    const clean = String(text || "").trim();
    if (!clean) return [];
    const words = clean.includes(" ") ? clean.split(/\s+/) : clean.match(new RegExp(`.{1,${maxChars}}`, "g"));
    const lines = [];
    words.forEach((word) => {
      const current = lines[lines.length - 1] || "";
      if (!current) {
        lines.push(word);
      } else if (`${current} ${word}`.length <= maxChars) {
        lines[lines.length - 1] = `${current} ${word}`;
      } else if (lines.length < maxLines) {
        lines.push(word);
      }
    });
    return lines.slice(0, maxLines);
  }

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function hashText(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
  }

  function refreshEditedSelection() {
    saveState();
    renderSidebar();
    renderMap();
  }

  function selectCategory(categoryId, options = {}) {
    if (!options.keepMulti) multiSelection = new Set();
    state.activeCategoryId = categoryId;
    state.selected = { type: "category", categoryId };
    saveState();
    renderSidebar();
    renderInspector();
    if (options.preserveMap) {
      updateMapSelection();
      renderEdges();
    } else {
      renderMap();
    }
    if (options.focus && state.zoom <= 0.24) {
      zoomToItem(selectedEntity()?.item, 0.72);
    }
  }

  function selectNote(categoryId, noteId, options = {}) {
    if (!options.keepMulti) multiSelection = new Set();
    state.activeCategoryId = categoryId;
    state.selected = { type: "note", categoryId, noteId };
    saveState();
    renderSidebar();
    renderInspector();
    if (options.preserveMap) {
      updateMapSelection();
      renderEdges();
    } else {
      renderMap();
    }
    if (options.focus && state.zoom <= 0.24) {
      zoomToItem(selectedEntity()?.item, 0.96);
    }
  }

  function selectDetail(categoryId, noteId, detailId, options = {}) {
    if (!options.keepMulti) multiSelection = new Set();
    state.activeCategoryId = categoryId;
    state.selected = { type: "detail", categoryId, noteId, detailId };
    saveState();
    renderSidebar();
    renderInspector();
    if (options.preserveMap) {
      updateMapSelection();
      renderEdges();
    } else {
      renderMap();
    }
    if (options.focus && state.zoom <= 0.24) {
      zoomToItem(selectedEntity()?.item, 1.05);
    }
  }

  function addCategory(title) {
    const index = state.categories.length;
    const angle = -Math.PI / 2 + index * 0.82;
    const category = makeCategory(
      title || `카테고리 ${index + 1}`,
      clamp(activeCategory()?.x + Math.cos(angle) * 520 || STAGE.width / 2, 40, STAGE.width - 230),
      clamp(activeCategory()?.y + Math.sin(angle) * 380 || STAGE.height / 2, 40, STAGE.height - 160),
      palette[index % palette.length],
      "system",
    );
    state.categories.push(category);
    state.activeCategoryId = category.id;
    state.selected = { type: "category", categoryId: category.id };
    commit();
    centerMap(category);
  }

  function addNote(title) {
    const category = activeCategory();
    if (!category) return;
    const noteIndex = category.notes.length;
    const angle = -0.65 + noteIndex * 0.82;
    const note = makeNote(
      title || `새 메모 ${noteIndex + 1}`,
      "",
      clamp(category.x + 270 + Math.cos(angle) * 90, 40, STAGE.width - 230),
      clamp(category.y + 50 + Math.sin(angle) * 150, 40, STAGE.height - 170),
      palette[(noteIndex + 1) % palette.length],
      category.font,
    );
    category.notes.push(note);
    state.selected = { type: "note", categoryId: category.id, noteId: note.id };
    commit();
    centerMap(note);
  }

  function addDetail(categoryId, noteId, title = "") {
    const category = state.categories.find((item) => item.id === categoryId);
    const note = category?.notes.find((item) => item.id === noteId);
    if (!category || !note) return;
    if (!Array.isArray(note.details)) note.details = [];
    const detailIndex = note.details.length;
    const angle = -0.35 + detailIndex * 0.74;
    const detail = makeDetail(
      title || `\uc138\ubd80\uc0ac\ud56d ${detailIndex + 1}`,
      "",
      clamp(note.x + normalizedNoteWidth(note.width, note.iconSvg) + 170 + Math.cos(angle) * 70, 40, STAGE.width - 190),
      clamp(note.y + 18 + Math.sin(angle) * 120, 40, STAGE.height - 130),
      note.color,
      note.font,
    );
    note.details.push(detail);
    state.selected = { type: "detail", categoryId: category.id, noteId: note.id, detailId: detail.id };
    commit();
    centerMap(detail);
  }

  function addDetailFromCurrentSelection() {
    const selected = selectedEntity();
    if (selected?.type === "note") {
      addDetail(selected.category.id, selected.item.id);
      return;
    }
    if (selected?.type === "detail") {
      addDetail(selected.category.id, selected.note.id);
      return;
    }

    const category = selected?.category || activeCategory();
    if (!category) return;
    const existingNote = category.notes[0];
    if (existingNote) {
      selectNote(category.id, existingNote.id, { preserveMap: true });
      addDetail(category.id, existingNote.id);
      return;
    }

    const noteIndex = category.notes.length;
    const newNote = makeNote(
      `새 메모 ${noteIndex + 1}`,
      "",
      clamp(category.x + 270, 40, STAGE.width - 230),
      clamp(category.y + 50, 40, STAGE.height - 170),
      palette[(noteIndex + 1) % palette.length],
      category.font,
    );
    category.notes.push(newNote);
    addDetail(category.id, newNote.id);
  }

  function deleteCategory(categoryId) {
    const category = state.categories.find((item) => item.id === categoryId);
    if (!category) return;
    const ok =
      category.notes.length === 0 ||
      window.confirm(`"${category.title}" 카테고리와 메모 ${category.notes.length}개를 삭제할까요?`);
    if (!ok) return;

    state.categories = state.categories.filter((item) => item.id !== categoryId);
    state.activeCategoryId = state.categories[0]?.id || null;
    state.selected = state.activeCategoryId
      ? { type: "category", categoryId: state.activeCategoryId }
      : null;
    commit();
  }

  function deleteNote(categoryId, noteId) {
    const category = state.categories.find((item) => item.id === categoryId);
    if (!category) return;
    category.notes = category.notes.filter((note) => note.id !== noteId);
    state.selected = { type: "category", categoryId };
    commit();
  }

  function deleteDetail(categoryId, noteId, detailId) {
    const category = state.categories.find((item) => item.id === categoryId);
    const note = category?.notes.find((item) => item.id === noteId);
    if (!note) return;
    note.details = (note.details || []).filter((detail) => detail.id !== detailId);
    state.selected = { type: "note", categoryId, noteId };
    commit();
  }

  function arrangeMap() {
    const count = state.categories.length;
    if (count === 0) return;
    const columns = Math.min(3, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / columns);
    const gapX = Math.min(470, Math.max(340, (STAGE.width - 240) / columns));
    const gapY = Math.min(330, Math.max(260, (STAGE.height - 220) / rows));
    const startX = (STAGE.width - gapX * (columns - 1)) / 2 - 90;
    const startY = (STAGE.height - gapY * (rows - 1)) / 2 - 60;

    state.categories.forEach((category, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      category.x = clamp(startX + column * gapX, 40, STAGE.width - 240);
      category.y = clamp(startY + row * gapY, 40, STAGE.height - 180);
      arrangeNotesAround(category);
    });

    commit();
    centerMap();
  }

  function arrangeNotesAround(category) {
    const radiusX = 245;
    const radiusY = 145;
    const total = category.notes.length || 1;
    category.notes.forEach((note, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
      note.x = clamp(category.x + 80 + Math.cos(angle) * radiusX, 40, STAGE.width - 230);
      note.y = clamp(category.y + 50 + Math.sin(angle) * radiusY, 40, STAGE.height - 170);
      arrangeDetailsAround(note);
    });
  }

  function arrangeDetailsAround(note) {
    const total = note.details?.length || 0;
    if (!total) return;
    note.details.forEach((detail, index) => {
      const angle = -0.75 + index * 0.62;
      detail.x = clamp(note.x + normalizedNoteWidth(note.width, note.iconSvg) + 120 + Math.cos(angle) * 70, 40, STAGE.width - 190);
      detail.y = clamp(note.y + 12 + Math.sin(angle) * 110, 40, STAGE.height - 130);
    });
  }

  function centerMap(target = selectedEntity()?.item || activeCategory(), behavior = "smooth") {
    const zoom = state.zoom;
    const viewport = els.mapViewport;
    const item = target || { x: STAGE.width / 2, y: STAGE.height / 2 };
    const center = itemCenter(item);
    const x = center.x * zoom - viewport.clientWidth / 2;
    const y = center.y * zoom - viewport.clientHeight / 2;
    viewport.scrollTo({
      left: clamp(x, 0, Math.max(0, STAGE.width * zoom - viewport.clientWidth)),
      top: clamp(y, 0, Math.max(0, STAGE.height * zoom - viewport.clientHeight)),
      behavior,
    });
  }

  function itemCenter(item) {
    if (!item) return { x: STAGE.width / 2, y: STAGE.height / 2 };
    if (Array.isArray(item.notes)) {
      return { x: item.x + 68, y: item.y + 68 };
    }
    if (!Array.isArray(item.details)) {
      return {
        x: item.x + normalizedDetailWidth(item.width) / 2,
        y: item.y + normalizedDetailHeight(item.height) / 2,
      };
    }
    return {
      x: item.x + normalizedNoteWidth(item.width, item.iconSvg) / 2,
      y: item.y + normalizedNoteHeight(item.height) / 2,
    };
  }

  function zoomToItem(item = selectedEntity()?.item || activeCategory(), nextZoom = 0.9) {
    if (!item) return;
    setZoomCenteredOnItem(item, nextZoom);
  }

  function zoomToSelection() {
    const selected = selectedEntity();
    if (selected?.item) {
      zoomToItem(selected.item, selected.type === "category" ? 0.72 : 0.96);
      return;
    }
    centerMap();
  }

  function initThreeBackdrop() {
    if (!els.threeBackdrop || !window.THREE) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1000, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    els.threeBackdrop.replaceChildren(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.78);
    const key = new THREE.DirectionalLight(0xffffff, 0.62);
    key.position.set(0.25, 0.35, 1);
    scene.add(ambient, key);

    const starCount = 520;
    const starPositions = new Float32Array(starCount * 3);
    for (let index = 0; index < starCount; index += 1) {
      starPositions[index * 3] = Math.random();
      starPositions[index * 3 + 1] = Math.random();
      starPositions[index * 3 + 2] = -180 - Math.random() * 260;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starBasePositions = starPositions.slice();
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.8,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.78,
      }),
    );
    scene.add(stars);

    const planets = new THREE.Group();
    [
      { x: 0.16, y: 0.22, r: 42, color: 0x6f84ff, opacity: 0.3 },
      { x: 0.78, y: 0.18, r: 64, color: 0xff9a6f, opacity: 0.22 },
      { x: 0.68, y: 0.82, r: 52, color: 0x4bd6cc, opacity: 0.2 },
    ].forEach((planet) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(planet.r, 36, 18),
        new THREE.MeshStandardMaterial({
          color: planet.color,
          emissive: planet.color,
          emissiveIntensity: 0.18,
          roughness: 0.54,
          metalness: 0.05,
          transparent: true,
          opacity: planet.opacity,
        }),
      );
      mesh.userData = planet;
      planets.add(mesh);
    });
    scene.add(planets);

    const markers = new THREE.Group();
    scene.add(markers);

    threeView = {
      scene,
      camera,
      renderer,
      stars,
      starBasePositions,
      planets,
      markers,
      animationFrame: 0,
      lastAnimatedAt: 0,
    };
    resizeThreeBackdrop();
    renderThreeMarkers();
    drawThreeScene();
    animateThreeBackdrop();
  }

  function resizeThreeBackdrop() {
    if (!threeView) return;
    const width = Math.max(1, els.mapViewport.clientWidth);
    const height = Math.max(1, els.mapViewport.clientHeight);
    threeView.renderer.setSize(width, height, false);
    threeView.camera.left = 0;
    threeView.camera.right = width;
    threeView.camera.top = 0;
    threeView.camera.bottom = height;
    threeView.camera.updateProjectionMatrix();
    syncThreeCamera();
    drawThreeScene();
  }

  function syncThreeCamera() {
    if (!threeView) return;
    const width = Math.max(1, els.mapViewport.clientWidth);
    const height = Math.max(1, els.mapViewport.clientHeight);
    const positions = threeView.stars.geometry.attributes.position.array;
    for (let index = 0; index < positions.length; index += 3) {
      const depth = Math.abs(positions[index + 2]) / 280;
      positions[index] =
        ((threeView.starBasePositions[index] * width * 1.8 - els.mapViewport.scrollLeft * 0.04 * depth) %
          (width + 120)) -
        60;
      positions[index + 1] =
        ((threeView.starBasePositions[index + 1] * height * 1.8 - els.mapViewport.scrollTop * 0.04 * depth) %
          (height + 120)) -
        60;
    }
    threeView.stars.geometry.attributes.position.needsUpdate = true;

    threeView.planets.children.forEach((planet, index) => {
      const data = planet.userData;
      data.screenX = width * data.x - els.mapViewport.scrollLeft * (0.025 + index * 0.01);
      data.screenY = height * data.y - els.mapViewport.scrollTop * (0.018 + index * 0.008);
      planet.position.x = data.screenX;
      planet.position.y = data.screenY;
      planet.position.z = -120 - index * 30;
      planet.rotation.y = els.mapViewport.scrollLeft * 0.0008 + index;
    });
    renderThreeMarkers();
  }

  function renderThreeMarkers() {
    if (!threeView) return;
    threeView.markers.clear();
    visibleMapGroups().forEach(({ category, notes }) => {
      const categoryCenter = itemCenter(category);
      addThreeMarker(categoryCenter.x, categoryCenter.y, category.color, 18, 18);
      notes.forEach(({ note, details }) => {
        const noteCenter = itemCenter(note);
        addThreeMarker(noteCenter.x, noteCenter.y, note.color, 8, 8);
        details.forEach((detail) => {
          const detailCenter = itemCenter(detail);
          addThreeMarker(detailCenter.x, detailCenter.y, detail.color, 5, 5);
        });
      });
    });
    drawThreeScene();
  }

  function addThreeMarker(boardX, boardY, color, radius, depth) {
    const screenX = boardX * state.zoom - els.mapViewport.scrollLeft;
    const screenY = boardY * state.zoom - els.mapViewport.scrollTop;
    if (
      screenX < -80 ||
      screenY < -80 ||
      screenX > els.mapViewport.clientWidth + 80 ||
      screenY > els.mapViewport.clientHeight + 80
    ) {
      return;
    }

    const geometry = new THREE.SphereGeometry(radius, 24, 16);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.12,
      roughness: 0.48,
      metalness: 0.14,
      transparent: true,
      opacity: 0.72,
    });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(screenX, screenY, depth);
    threeView.markers.add(marker);
  }

  function drawThreeScene() {
    if (!threeView) return;
    threeView.renderer.render(threeView.scene, threeView.camera);
  }

  function animateThreeBackdrop(time = 0) {
    if (!threeView) return;

    if (time - threeView.lastAnimatedAt > 32) {
      threeView.lastAnimatedAt = time;
      const slow = time * 0.001;
      threeView.stars.position.x = Math.sin(slow * 0.17) * 14;
      threeView.stars.position.y = Math.cos(slow * 0.13) * 10;
      threeView.stars.material.opacity = 0.64 + Math.sin(slow * 1.7) * 0.14;

      threeView.planets.children.forEach((planet, index) => {
        const data = planet.userData;
        planet.rotation.x = Math.sin(slow * 0.19 + index) * 0.08;
        planet.rotation.y += 0.002 + index * 0.0008;
        planet.position.x = (data.screenX || planet.position.x) + Math.sin(slow * 0.11 + index) * 5;
        planet.position.y = (data.screenY || planet.position.y) + Math.cos(slow * 0.09 + index) * 4;
      });

      drawThreeScene();
    }

    threeView.animationFrame = window.requestAnimationFrame(animateThreeBackdrop);
  }

  function startPan(event) {
    if (event.button !== undefined && event.button !== 0 && event.button !== 2) return;
    if (event.target.closest?.(".mind-node, input, button, textarea, select, audio")) return;

    event.preventDefault();
    if (event.button === 2) {
      pan = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startScrollLeft: els.mapViewport.scrollLeft,
        startScrollTop: els.mapViewport.scrollTop,
      };
      els.mapViewport.classList.add("panning");
    } else {
      const start = boardPointFromEvent(event);
      selectionBox = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        currentClientX: event.clientX,
        currentClientY: event.clientY,
        startBoardX: start.x,
        startBoardY: start.y,
        element: null,
      };
      els.mapViewport.classList.add("selecting");
    }
    els.mapViewport.setPointerCapture?.(event.pointerId);
  }

  function movePan(event) {
    if (pan && event.pointerId === pan.pointerId) {
      els.mapViewport.scrollLeft = pan.startScrollLeft - (event.clientX - pan.startClientX);
      els.mapViewport.scrollTop = pan.startScrollTop - (event.clientY - pan.startClientY);
      syncThreeCamera();
      return;
    }
    if (selectionBox && event.pointerId === selectionBox.pointerId) {
      updateSelectionBox(event);
    }
  }

  function endPan(event) {
    if (pan && event.pointerId === pan.pointerId) {
      els.mapViewport.releasePointerCapture?.(event.pointerId);
      els.mapViewport.classList.remove("panning");
      pan = null;
      return;
    }
    if (selectionBox && event.pointerId === selectionBox.pointerId) {
      finishSelectionBox(event);
      els.mapViewport.releasePointerCapture?.(event.pointerId);
    }
  }

  function boardPointFromEvent(event) {
    const rect = els.mapViewport.getBoundingClientRect();
    return {
      x: (els.mapViewport.scrollLeft + event.clientX - rect.left) / state.zoom,
      y: (els.mapViewport.scrollTop + event.clientY - rect.top) / state.zoom,
    };
  }

  function updateSelectionBox(event) {
    selectionBox.currentClientX = event.clientX;
    selectionBox.currentClientY = event.clientY;
    const moved = Math.hypot(
      selectionBox.currentClientX - selectionBox.startClientX,
      selectionBox.currentClientY - selectionBox.startClientY,
    );
    if (moved < 5) return;

    if (!selectionBox.element) {
      selectionBox.element = document.createElement("div");
      selectionBox.element.className = "selection-box";
      els.mapViewport.append(selectionBox.element);
    }

    const rect = els.mapViewport.getBoundingClientRect();
    const left = Math.min(selectionBox.startClientX, event.clientX) - rect.left + els.mapViewport.scrollLeft;
    const top = Math.min(selectionBox.startClientY, event.clientY) - rect.top + els.mapViewport.scrollTop;
    const width = Math.abs(event.clientX - selectionBox.startClientX);
    const height = Math.abs(event.clientY - selectionBox.startClientY);
    selectionBox.element.style.left = `${left}px`;
    selectionBox.element.style.top = `${top}px`;
    selectionBox.element.style.width = `${width}px`;
    selectionBox.element.style.height = `${height}px`;
  }

  function finishSelectionBox(event) {
    const box = selectionBox;
    selectionBox = null;
    els.mapViewport.classList.remove("selecting");
    box.element?.remove();

    const moved = Math.hypot(event.clientX - box.startClientX, event.clientY - box.startClientY);
    if (moved < 5) {
      multiSelection = new Set();
      state.selected = null;
      saveState();
      renderSidebar();
      renderInspector();
      updateMapSelection();
      renderEdges();
      return;
    }

    const end = boardPointFromEvent(event);
    const rect = {
      left: Math.min(box.startBoardX, end.x),
      right: Math.max(box.startBoardX, end.x),
      top: Math.min(box.startBoardY, end.y),
      bottom: Math.max(box.startBoardY, end.y),
    };

    const selectedKeys = [];
    els.nodeLayer.querySelectorAll(".mind-node").forEach((node) => {
      const nodeRect = {
        left: parseFloat(node.style.left),
        top: parseFloat(node.style.top),
        right: parseFloat(node.style.left) + node.offsetWidth,
        bottom: parseFloat(node.style.top) + node.offsetHeight,
      };
      const intersects =
        nodeRect.left <= rect.right &&
        nodeRect.right >= rect.left &&
        nodeRect.top <= rect.bottom &&
        nodeRect.bottom >= rect.top;
      if (intersects) selectedKeys.push(keyFromNode(node));
    });

    multiSelection = new Set(selectedKeys);
    const first = selectedKeys.map(itemFromKey).find(Boolean);
    if (first) {
      state.activeCategoryId = first.category.id;
      state.selected =
        first.type === "category"
          ? { type: "category", categoryId: first.category.id }
          : first.type === "detail"
            ? { type: "detail", categoryId: first.category.id, noteId: first.note.id, detailId: first.item.id }
            : { type: "note", categoryId: first.category.id, noteId: first.item.id };
      saveState();
    } else {
      state.selected = null;
      saveState();
    }
    renderSidebar();
    renderInspector();
    updateMapSelection();
    renderEdges();
  }

  function startDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const node = event.currentTarget;
    const type = node.dataset.type;
    const categoryId = node.dataset.categoryId;
    const itemId = node.dataset.itemId;
    const detailId = node.dataset.detailId || "";
    const key = keyFromNode(node);

    if (!multiSelection.has(key) || multiSelection.size < 2) {
      if (type === "category") selectCategory(categoryId, { preserveMap: true });
      if (type === "note") selectNote(categoryId, itemId, { preserveMap: true });
      if (type === "detail") selectDetail(categoryId, itemId, detailId, { preserveMap: true });
      setSingleMultiSelection(type, categoryId, itemId, detailId);
    }

    const found = itemFromKey(key);
    const item = found?.item;

    if (!item) return;

    const dragItems =
      multiSelection.has(key) && multiSelection.size > 1
        ? [...multiSelection].map(dragItemFromKey).filter(Boolean)
        : [{ item, node, startX: item.x, startY: item.y }];

    const bounds = dragItems.reduce(
      (next, entry) => ({
        minX: Math.min(next.minX, entry.startX),
        minY: Math.min(next.minY, entry.startY),
        maxX: Math.max(next.maxX, entry.startX + entry.node.offsetWidth),
        maxY: Math.max(next.maxY, entry.startY + entry.node.offsetHeight),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );

    event.preventDefault();
    node.setPointerCapture?.(event.pointerId);
    drag = {
      items: dragItems,
      bounds,
      node,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };

    node.addEventListener("pointermove", moveDrag);
    node.addEventListener("pointerup", endDrag);
    node.addEventListener("pointercancel", endDrag);
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const rawDx = (event.clientX - drag.startClientX) / state.zoom;
    const rawDy = (event.clientY - drag.startClientY) / state.zoom;
    const dx = clamp(rawDx, 18 - drag.bounds.minX, STAGE.width - drag.bounds.maxX - 18);
    const dy = clamp(rawDy, 18 - drag.bounds.minY, STAGE.height - drag.bounds.maxY - 18);

    drag.items.forEach((entry) => {
      entry.item.x = entry.startX + dx;
      entry.item.y = entry.startY + dy;
      entry.node.style.left = `${entry.item.x}px`;
      entry.node.style.top = `${entry.item.y}px`;
    });
    renderEdges();
    renderThreeMarkers();
  }

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.node.removeEventListener("pointermove", moveDrag);
    drag.node.removeEventListener("pointerup", endDrag);
    drag.node.removeEventListener("pointercancel", endDrag);
    drag.node.releasePointerCapture?.(event.pointerId);
    saveState();
    drag = null;
  }

  function startResize(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const node = event.currentTarget.closest(".mind-node.note");
    if (!node) return;
    const categoryId = node.dataset.categoryId;
    const noteId = node.dataset.itemId;
    const category = state.categories.find((item) => item.id === categoryId);
    const note = category?.notes.find((item) => item.id === noteId);
    if (!note) return;

    event.preventDefault();
    event.stopPropagation();
    selectNote(categoryId, noteId, { preserveMap: true });
    node.classList.add("resizing");
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resize = {
      handle: event.currentTarget,
      node,
      note,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: normalizedNoteWidth(note.width, note.iconSvg),
      startHeight: normalizedNoteHeight(note.height),
      minWidth: note.iconSvg ? 206 : 156,
      minHeight: 118,
    };

    resize.handle.addEventListener("pointermove", moveResize);
    resize.handle.addEventListener("pointerup", endResize);
    resize.handle.addEventListener("pointercancel", endResize);
  }

  function moveResize(event) {
    if (!resize || event.pointerId !== resize.pointerId) return;
    const dx = (event.clientX - resize.startClientX) / state.zoom;
    const dy = (event.clientY - resize.startClientY) / state.zoom;
    const maxWidth = STAGE.width - resize.note.x - 18;
    const maxHeight = STAGE.height - resize.note.y - 18;
    resize.note.width = clamp(resize.startWidth + dx, resize.minWidth, Math.min(520, maxWidth));
    resize.note.height = clamp(resize.startHeight + dy, resize.minHeight, Math.min(420, maxHeight));
    resize.node.style.width = `${resize.note.width}px`;
    resize.node.style.minHeight = `${resize.note.height}px`;
    renderEdges();
    renderThreeMarkers();
  }

  function endResize(event) {
    if (!resize || event.pointerId !== resize.pointerId) return;
    resize.handle.removeEventListener("pointermove", moveResize);
    resize.handle.removeEventListener("pointerup", endResize);
    resize.handle.removeEventListener("pointercancel", endResize);
    resize.handle.releasePointerCapture?.(event.pointerId);
    resize.node.classList.remove("resizing");
    saveState();
    resize = null;
  }

  function dragItemFromKey(key) {
    const found = itemFromKey(key);
    if (!found) return null;
    const node = nodeElement(
      found.type,
      found.category.id,
      found.type === "detail" ? found.note.id : found.item.id,
      found.type === "detail" ? found.item.id : "",
    );
    if (!node) return null;
    return { item: found.item, node, startX: found.item.x, startY: found.item.y };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizedOpacity(value) {
    return Number.isFinite(value) ? clamp(value, 0.35, 1) : 0.94;
  }

  function normalizedNoteWidth(value, hasVisual = false) {
    const numeric = Number(value);
    const fallback = hasVisual ? 206 : 156;
    const min = hasVisual ? 206 : 156;
    return Number.isFinite(numeric) ? clamp(Math.round(numeric), min, 520) : fallback;
  }

  function normalizedNoteHeight(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? clamp(Math.round(numeric), 118, 420) : 118;
  }

  function normalizedDetailWidth(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? clamp(Math.round(numeric), 120, 360) : 132;
  }

  function normalizedDetailHeight(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? clamp(Math.round(numeric), 72, 260) : 78;
  }

  els.categoryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addCategory(els.categoryInput.value.trim());
    els.categoryInput.value = "";
  });

  els.noteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addNote(els.noteInput.value.trim());
    els.noteInput.value = "";
  });

  document.addEventListener("click", (event) => {
    const panelToggle = event.target.closest("[data-panel-toggle]");
    if (panelToggle) {
      togglePanel(panelToggle.dataset.panelToggle);
      return;
    }

    const button = event.target.closest("[data-action]");
    if (!button) return;

    if (button.dataset.action === "focus-category") {
      if (panelState.leftCollapsed) {
        panelState.leftCollapsed = false;
        savePanelState();
        applyPanelState();
      }
      els.categoryInput.focus();
    }
    if (button.dataset.action === "add-category") {
      addCategory("");
    }
    if (button.dataset.action === "add-note") {
      addNote("");
    }
    if (button.dataset.action === "add-detail") {
      addDetailFromCurrentSelection();
    }
    if (button.dataset.action === "arrange") {
      arrangeMap();
    }
    if (button.dataset.action === "center-map") {
      centerMap();
    }
    if (button.dataset.action === "zoom-selection") {
      zoomToSelection();
    }
    if (button.dataset.action === "save-board") {
      saveBoardToLocalFile();
    }
    if (button.dataset.action === "load-board") {
      loadBoardFromLocalFile();
    }
  });

  els.localFileInput?.addEventListener("change", () => {
    const [file] = els.localFileInput.files || [];
    importBoardFile(file);
    els.localFileInput.value = "";
  });

  els.viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      commit();
    });
  });

  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value;
    saveState();
    renderMap();
  });

  els.zoomInput.addEventListener("input", () => {
    setZoom(Number(els.zoomInput.value) / 100);
  });

  els.mapViewport.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      const factor = direction > 0 ? 1.12 : 0.88;
      smartZoomFromWheel(event, state.zoom * factor);
    },
    { passive: false },
  );

  els.mapViewport.addEventListener("pointerdown", startPan);
  els.mapViewport.addEventListener("pointermove", movePan);
  els.mapViewport.addEventListener("pointerup", endPan);
  els.mapViewport.addEventListener("pointercancel", endPan);
  els.mapViewport.addEventListener("contextmenu", (event) => {
    if (!event.target.closest?.(".mind-node, input, button, textarea, select, audio")) {
      event.preventDefault();
    }
  });
  els.mapViewport.addEventListener("scroll", () => {
    syncThreeCamera();
  });

  window.addEventListener("resize", () => {
    renderEdges();
    resizeThreeBackdrop();
  });

  applyPanelState();
  setStageSize();
  initThreeBackdrop();
  render();
})();
