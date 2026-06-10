const DATA_FILE = "iching-hexagrams.json";
const VALID_VALUES = [6, 7, 8, 9];
const TRIGRAM_VISIONS = {
  乾: { nature: "天", creature: "马", glyph: "☀", detail: "天 / 圆日" },
  坤: { nature: "地", creature: "牛", glyph: "▤", detail: "田垄 / 大地" },
  震: { nature: "雷", creature: "龙", glyph: "ϟ", detail: "闪电 / 雷动" },
  巽: { nature: "风", creature: "鸡冠与木", glyph: "〰", detail: "大风 / 木" },
  坎: { nature: "水", creature: "猪", glyph: "≋", detail: "波涛汹涌的水" },
  离: { nature: "火", creature: "贝", glyph: "△", detail: "火焰 / 贝壳" },
  艮: { nature: "山", creature: "狗（鼠）", glyph: "▵", detail: "山峰" },
  兑: { nature: "泽", creature: "羊", glyph: "◡", detail: "平静的水 / 湖面波纹" }
};

const state = {
  hexagrams: [],
  byBinary: new Map(),
  randomLines: [],
  castRequestId: 0
};

const $ = (selector) => document.querySelector(selector);

const elements = {
  dataStatus: $("#dataStatus"),
  modeTabs: document.querySelectorAll(".mode-tab"),
  manualMode: $("#manualMode"),
  randomMode: $("#randomMode"),
  lineInputs: $("#lineInputs"),
  quickInput: $("#quickInput"),
  coinBoard: $("#coinBoard"),
  coinRitual: $("#coinRitual"),
  manualCastButton: $("#manualCastButton"),
  randomCastButton: $("#randomCastButton"),
  copyRandomButton: $("#copyRandomButton"),
  clearButton: $("#clearButton"),
  resultPanel: $("#resultPanel"),
  baguaOverlay: $("#baguaOverlay"),
  errorMessage: $("#errorMessage"),
  emptyState: $("#emptyState"),
  resultContent: $("#resultContent"),
  primaryName: $("#primaryName"),
  changedName: $("#changedName"),
  primaryTheme: $("#primaryTheme"),
  changedTheme: $("#changedTheme"),
  primaryHexagram: $("#primaryHexagram"),
  changedHexagram: $("#changedHexagram"),
  primaryTrigrams: $("#primaryTrigrams"),
  changedTrigrams: $("#changedTrigrams"),
  changedCard: $("#changedCard"),
  readingRule: $("#readingRule"),
  readingTexts: $("#readingTexts"),
  rawLines: $("#rawLines")
};

init();

async function init() {
  renderManualInputs();
  bindEvents();

  try {
    const response = await fetch(DATA_FILE);
    if (!response.ok) {
      throw new Error(`无法读取 ${DATA_FILE}`);
    }

    const data = await response.json();
    state.hexagrams = data.hexagrams || [];
    state.byBinary = new Map(state.hexagrams.map((hexagram) => [hexagram.binary, hexagram]));

    if (state.hexagrams.length !== 64) {
      throw new Error("卦库不是 64 卦，请检查 JSON 文件。");
    }

    elements.dataStatus.textContent = "卦库已就绪";
    elements.dataStatus.classList.add("is-ready");
  } catch (error) {
    elements.dataStatus.textContent = "卦库未读取";
    elements.dataStatus.classList.add("is-error");
    showError(`${error.message}。请确认 ${DATA_FILE} 和网页文件放在同一目录，并通过本地服务器打开。`);
  }
}

function bindEvents() {
  elements.modeTabs.forEach((button) => {
    button.addEventListener("click", () => switchMode(button.dataset.mode));
  });

  elements.manualCastButton.addEventListener("click", () => {
    const values = getManualValues();
    if (values) {
      flashButton(elements.manualCastButton, "已刷新");
      delayedCast(values);
    }
  });

  elements.randomCastButton.addEventListener("click", async () => {
    await randomCastWithAnimation();
  });

  elements.quickInput.addEventListener("input", () => {
    const digits = elements.quickInput.value.replace(/\D/g, "").slice(0, 6);
    elements.quickInput.value = digits;
    fillSplitInputs(digits);

    if (digits.length === 6 && [...digits].every((digit) => VALID_VALUES.includes(Number(digit)))) {
      clearError();
    }
  });

  elements.quickInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const values = getManualValues();
    if (values) {
      flashButton(elements.manualCastButton, "已刷新");
      delayedCast(values);
    }
  });

  elements.lineInputs.addEventListener("input", (event) => {
    if (!event.target.matches("input")) return;
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 1);
    syncQuickInput();
  });

  elements.lineInputs.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const values = getManualValues();
    if (values) {
      flashButton(elements.manualCastButton, "已刷新");
      delayedCast(values);
    }
  });

  elements.copyRandomButton.addEventListener("click", () => {
    if (state.randomLines.length !== 6) {
      showError("请先随机起卦，再填入手动输入。");
      return;
    }

    const inputs = document.querySelectorAll(".line-input-row input");
    state.randomLines.forEach((line, index) => {
      inputs[index].value = line.total;
    });
    syncQuickInput();
    switchMode("manual");
  });

  elements.clearButton.addEventListener("click", () => {
    elements.quickInput.value = "";
    document.querySelectorAll(".line-input-row input").forEach((input) => {
      input.value = "";
    });
    clearError();
    elements.emptyState.hidden = false;
    elements.resultContent.hidden = true;
  });
}

function switchMode(mode) {
  elements.modeTabs.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });

  elements.manualMode.classList.toggle("is-active", mode === "manual");
  elements.randomMode.classList.toggle("is-active", mode === "random");
}

function renderManualInputs() {
  elements.lineInputs.innerHTML = Array.from({ length: 6 }, (_, index) => {
    const position = index + 1;
    const label = position === 1 ? "初爻" : position === 6 ? "上爻" : `${position}爻`;
    return `
      <div class="line-input-row">
        <label for="line-${position}">${label}</label>
        <input id="line-${position}" inputmode="numeric" maxlength="1" placeholder="6 / 7 / 8 / 9" aria-label="${label}数字" />
      </div>
    `;
  }).join("");
}

function getManualValues() {
  const values = [...document.querySelectorAll(".line-input-row input")].map((input) => Number(input.value.trim()));
  const invalidIndex = values.findIndex((value) => !VALID_VALUES.includes(value));

  if (invalidIndex !== -1) {
    showError(`第 ${invalidIndex + 1} 爻请输入 6、7、8、9 其中一个数字。`);
    return null;
  }

  return values;
}

function fillSplitInputs(digits) {
  const inputs = [...document.querySelectorAll(".line-input-row input")];
  inputs.forEach((input, index) => {
    input.value = digits[index] || "";
  });
}

function syncQuickInput() {
  elements.quickInput.value = [...document.querySelectorAll(".line-input-row input")]
    .map((input) => input.value.trim())
    .join("")
    .slice(0, 6);
}

function tossLine() {
  const coins = Array.from({ length: 3 }, () => Math.random() < 0.5 ? 2 : 3);
  return {
    coins,
    total: coins.reduce((sum, value) => sum + value, 0)
  };
}

async function randomCastWithAnimation() {
  if (!state.hexagrams.length) {
    showError(`卦库还没有读取成功，请确认 ${DATA_FILE} 已放好。`);
    return;
  }

  clearError();
  state.randomLines = [];
  elements.coinBoard.innerHTML = "";
  elements.randomCastButton.disabled = true;
  elements.copyRandomButton.disabled = true;
  elements.coinRitual.classList.remove("is-complete");
  elements.coinRitual.classList.add("is-rolling");
  elements.coinRitual.querySelector("p").textContent = "请默念您的问题，硬币正在翻滚。";

  for (let index = 0; index < 6; index += 1) {
    const line = tossLine();
    renderRollingCoins(index + 1);
    await wait(650);
    revealRollingCoins(line, index + 1);
    await wait(420);
    state.randomLines.push(line);
    renderCoins(state.randomLines);
    if (index < 5) {
      elements.coinRitual.classList.add("is-rolling");
    }
  }

  elements.coinRitual.classList.remove("is-rolling");
  elements.coinRitual.classList.add("is-complete");
  elements.coinRitual.querySelector("p").textContent = "已抛完六爻，正在生成卦象。";
  await delayedCast(state.randomLines.map((line) => line.total));
  elements.coinRitual.querySelector("p").textContent = "已抛完六爻，请看右侧卦象。";
  elements.randomCastButton.disabled = false;
  elements.copyRandomButton.disabled = false;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function renderRollingCoins(position) {
  elements.coinRitual.querySelector("p").textContent = `正在抛第 ${position} 爻，请保持问题在心里。`;
  elements.coinRitual.querySelector(".rolling-coins").innerHTML = Array.from({ length: 3 }, () => (
    '<span class="rolling-coin is-hidden-face">?</span>'
  )).join("");
}

function revealRollingCoins(line, position) {
  elements.coinRitual.classList.remove("is-rolling");
  elements.coinRitual.querySelector("p").textContent = `第 ${position} 爻结果：${line.coins.join(" + ")} = ${line.total}`;
  elements.coinRitual.querySelector(".rolling-coins").innerHTML = line.coins
    .map((coin) => `<span class="rolling-coin coin-${coin} is-revealed">${coin}</span>`)
    .join("");
}

function renderCoins(lines) {
  elements.coinBoard.innerHTML = lines.map((line, index) => {
    const position = index + 1;
    const label = position === 1 ? "初爻" : position === 6 ? "上爻" : `${position}爻`;
    return `
      <div class="coin-row">
        <span>${label}</span>
        <div class="coins">${line.coins.map((coin) => `<span class="coin coin-${coin}">${coin}</span>`).join("")}</div>
        <strong>${line.total}</strong>
      </div>
    `;
  }).join("");
}

function cast(values) {
  clearError();

  if (!state.hexagrams.length) {
    showError(`卦库还没有读取成功，请确认 ${DATA_FILE} 已放好。`);
    return;
  }

  const primaryBits = values.map(valueToPrimaryBit);
  const changedBits = values.map(valueToChangedBit);
  const changingPositions = values
    .map((value, index) => [value, index + 1])
    .filter(([value]) => value === 6 || value === 9)
    .map(([, position]) => position);
  const stablePositions = [1, 2, 3, 4, 5, 6].filter((position) => !changingPositions.includes(position));

  const primary = state.byBinary.get(primaryBits.join(""));
  const changed = state.byBinary.get(changedBits.join(""));

  if (!primary || !changed) {
    showError("没有在卦库中找到对应卦，请检查 JSON 里的 binary 编码。");
    return;
  }

  const reading = buildReading(primary, changed, changingPositions, stablePositions);
  renderResult({ values, primaryBits, changedBits, changingPositions, primary, changed, reading });
}

async function delayedCast(values) {
  const requestId = state.castRequestId + 1;
  state.castRequestId = requestId;
  clearError();
  elements.resultPanel.classList.add("is-thinking");
  elements.resultContent.classList.add("is-pending-refresh");
  showBaguaOverlay();
  scrollResultToTop();
  await wait(1000);

  if (requestId !== state.castRequestId) return;

  elements.resultPanel.classList.remove("is-thinking");
  elements.resultContent.classList.remove("is-pending-refresh");
  hideBaguaOverlay();
  cast(values);
}

function valueToPrimaryBit(value) {
  return value === 7 || value === 9 ? "1" : "0";
}

function valueToChangedBit(value) {
  if (value === 6) return "1";
  if (value === 9) return "0";
  return valueToPrimaryBit(value);
}

function buildReading(primary, changed, changingPositions, stablePositions) {
  const count = changingPositions.length;

  if (count === 0) {
    return {
      rule: "无变爻：以本卦卦辞、卦意为主，不看变卦。",
      items: [hexagramReading(primary, "本卦卦辞")]
    };
  }

  if (count === 1) {
    return {
      rule: `一个变爻：以第${toChineseNumber(changingPositions[0])}爻的爻辞为主。`,
      items: [lineReading(primary, changingPositions[0], "变爻爻辞")]
    };
  }

  if (count === 2) {
    const positions = [...changingPositions].sort((a, b) => b - a);
    return {
      rule: `两个变爻：看两个变爻爻辞，以上方的第${toChineseNumber(positions[0])}爻为主，第${toChineseNumber(positions[1])}爻为辅。`,
      items: positions.map((position, index) => lineReading(primary, position, index === 0 ? "主爻" : "辅爻"))
    };
  }

  if (count === 3) {
    return {
      rule: "三个变爻：本卦与变卦兼看，本卦为因，变卦为果。",
      items: [hexagramReading(primary, "本卦为因"), hexagramReading(changed, "变卦为果")]
    };
  }

  if (count === 4) {
    const positions = [...stablePositions].sort((a, b) => a - b);
    return {
      rule: `四个变爻：以两个未变爻为主，通常以下方的第${toChineseNumber(positions[0])}爻为主，第${toChineseNumber(positions[1])}爻为辅。`,
      items: positions.map((position, index) => lineReading(primary, position, index === 0 ? "主爻" : "辅爻"))
    };
  }

  if (count === 5) {
    return {
      rule: `五个变爻：以唯一未变的第${toChineseNumber(stablePositions[0])}爻爻辞为主。`,
      items: [lineReading(primary, stablePositions[0], "唯一未变爻")]
    };
  }

  return {
    rule: "六个变爻：直接用变卦之后的卦辞解释。",
    items: [hexagramReading(changed, "变卦卦辞")]
  };
}

function hexagramReading(hexagram, label) {
  return {
    title: `${label}：${hexagram.name}卦 ${hexagram.title}`,
    texts: [
      textBlock("卦辞", originalText(hexagram.judgment)),
      textBlock("彖辞", originalText(hexagram.tuan)),
      textBlock("象辞", originalText(hexagram.image))
    ].filter((block) => block.content),
    interpretation: [
      plainText(hexagram.judgment) || hexagram.plainExplanation,
      plainText(hexagram.tuan),
      plainText(hexagram.image)
    ].map(normalizeText).filter(Boolean).join("\n\n")
  };
}

function lineReading(hexagram, position, label) {
  const line = hexagram.lines.find((item) => item.position === position);
  const linePlainAndImagery = [line?.imagery, line?.plainExplanation, plainText(line?.xiang)]
    .map(normalizeText)
    .filter(Boolean)
    .join("\n\n");

  return {
    title: `${label}：${hexagram.name}卦第 ${position} 爻 ${line?.name || ""}`,
    texts: [
      textBlock("爻辞", line?.text || "卦库中缺少这一爻。"),
      textBlock("小象", originalText(line?.xiang))
    ].filter((block) => block.content),
    interpretation: linePlainAndImagery
  };
}

function textBlock(label, content) {
  return { label, content: normalizeText(content) };
}

function originalText(value) {
  return typeof value === "object" && value !== null ? value.original : value;
}

function plainText(value) {
  return typeof value === "object" && value !== null ? value.plainExplanation : "";
}

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function renderReadingItem(item) {
  return `
    <article class="reading-item">
      <strong>${escapeHtml(item.title)}</strong>
      ${item.texts.length ? `<div class="reading-blocks reading-texts">${item.texts.map(renderReadingBlock).join("")}</div>` : ""}
      ${item.interpretation ? `
        <section class="reading-block interpretation-block">
          <span class="reading-label">意象&解读与白话</span>
          <p>${formatText(item.interpretation)}</p>
        </section>
      ` : ""}
    </article>
  `;
}

function renderReadingBlock(block) {
  return `
    <section class="reading-block">
      <span class="reading-label">${escapeHtml(block.label)}</span>
      <p>${formatText(block.content)}</p>
    </section>
  `;
}

function formatText(value) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatHexagramTitle(hexagram) {
  const number = hexagram.kingWenNumber || hexagram.id;
  return `${hexagram.symbol} 第${toChineseNumber(number)}卦 ${hexagram.name}卦`;
}

function toChineseNumber(number) {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (number <= 10) {
    return number === 10 ? "十" : digits[number];
  }
  if (number < 20) {
    return `十${digits[number % 10]}`;
  }

  const tens = Math.floor(number / 10);
  const ones = number % 10;
  return ones === 0 ? `${digits[tens]}十` : `${digits[tens]}十${digits[ones]}`;
}

function renderResult(result) {
  clearError();
  elements.emptyState.hidden = true;
  elements.resultContent.hidden = false;
  elements.readingTexts.classList.remove("error-message");

  elements.primaryName.textContent = formatHexagramTitle(result.primary);
  elements.primaryTheme.textContent = result.primary.theme || "";
  elements.changedName.textContent = result.changingPositions.length
    ? formatHexagramTitle(result.changed)
    : "无变卦";
  elements.changedTheme.textContent = result.changingPositions.length ? result.changed.theme || "" : "";

  elements.changedCard.hidden = result.changingPositions.length === 0;
  elements.primaryTrigrams.innerHTML = renderTrigramVisions(result.primary);
  elements.changedTrigrams.innerHTML = renderTrigramVisions(result.changed);
  elements.primaryHexagram.innerHTML = renderHexagramLines(result.primaryBits, result.changingPositions);
  elements.changedHexagram.innerHTML = renderHexagramLines(result.changedBits, result.changingPositions);
  elements.readingRule.textContent = result.reading.rule;
  elements.readingTexts.innerHTML = result.reading.items.map(renderReadingItem).join("");

  elements.rawLines.innerHTML = result.values.map((value, index) => {
    const position = index + 1;
    const isChanging = value === 6 || value === 9;
    const original = result.primaryBits[index] === "1" ? "阳爻" : "阴爻";
    const changed = result.changedBits[index] === "1" ? "阳爻" : "阴爻";
    return `
      <div class="raw-line">
        <strong>第${position}爻</strong>
        <span>${value}</span>
        <span>${original}${isChanging ? ` 变为 ${changed}` : " 不变"}</span>
      </div>
    `;
  }).join("");

  animateResultRefresh();
  scrollResultToTop();
}

function renderTrigramVisions(hexagram) {
  return [
    renderTrigramVision("上卦", hexagram.upperTrigram),
    renderTrigramVision("下卦", hexagram.lowerTrigram)
  ].join("");
}

function renderTrigramVision(label, trigram) {
  const name = trigram?.name || "";
  const vision = TRIGRAM_VISIONS[name] || { nature: "", creature: "", glyph: "·", detail: "" };
  return `
    <div class="trigram-vision trigram-${escapeHtml(name)}">
      <span class="vision-icon" data-trigram="${escapeHtml(name)}">${escapeHtml(vision.glyph)}</span>
      <div>
        <strong>${label} ${escapeHtml(name)} · ${escapeHtml(vision.nature)}</strong>
        <p>${escapeHtml(vision.detail)} / 代表物为${escapeHtml(vision.creature)}</p>
      </div>
    </div>
  `;
}

function renderHexagramLines(bits, changingPositions) {
  return bits
    .map((bit, index) => {
      const position = index + 1;
      const kind = bit === "1" ? "yang" : "yin";
      const changing = changingPositions.includes(position) ? " is-changing" : "";
      const segments = bit === "1"
        ? '<span class="yao-segment"></span>'
        : '<span class="yao-segment"></span><span class="yao-segment"></span>';
      return `<div class="yao ${kind}${changing}" aria-label="第${position}爻">${segments}</div>`;
    })
    .reverse()
    .join("");
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.hidden = false;
  elements.emptyState.hidden = false;
  elements.resultContent.hidden = true;
  scrollResultToTop();
}

function clearError() {
  elements.errorMessage.textContent = "";
  elements.errorMessage.hidden = true;
}

function scrollResultToTop() {
  elements.resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function animateResultRefresh() {
  elements.resultPanel.classList.remove("is-refreshed");
  elements.resultContent.classList.remove("is-refreshing");
  void elements.resultPanel.offsetWidth;
  elements.resultPanel.classList.add("is-refreshed");
  elements.resultContent.classList.add("is-refreshing");
}

function showBaguaOverlay() {
  elements.baguaOverlay.hidden = false;
  elements.baguaOverlay.classList.remove("is-spinning");
  void elements.baguaOverlay.offsetWidth;
  elements.baguaOverlay.classList.add("is-spinning");
}

function hideBaguaOverlay() {
  elements.baguaOverlay.classList.remove("is-spinning");
  elements.baguaOverlay.hidden = true;
}

function flashButton(button, text) {
  const originalText = button.textContent;
  button.textContent = text;
  window.setTimeout(() => {
    button.textContent = originalText;
  }, 700);
}
