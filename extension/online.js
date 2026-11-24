(() => {
  if (globalThis.noituOnline) return;

  const selectors = {
    queue: 'button[class*="ranked-lobby_tile_WORD_LINK__"]',
    searching: '[data-testid="ranked-searching"]',
    ready: 'button[class*="game-preparation_ready__"]',
    card: '[class*="word-link-multiple-mode_gameplayCard__"]',
    word: '[class*="word-link-multiple-mode_featuredWord__"]',
    chip: '[class*="word-list-display_chip__"]',
    remaining: '[class*="word-link-multiple-mode_warningPill__"]',
    input: 'input[class*="word-link-answer-input_input__"]',
    submit: 'button[aria-label="Gửi đáp án"]',
    result: '[data-testid="game-result"]',
    dialog: '.modal.is-active, [role="dialog"][aria-modal="true"]:not(.swal2-toast)',
    notice: '.swal2-popup',
    verification: '[data-testid="guest-verify"][aria-hidden="false"], iframe[src*="challenges.cloudflare.com"]',
  };

  const normalize = (text) => text.normalize('NFC').trim().toLocaleLowerCase('vi').replace(/\s+/gu, ' ');
  const ending = (word) => word.slice(word.lastIndexOf(' ') + 1);
  const rankedRoom = (path) => /^\/online\/ranked-word-link-(?!card-)[^/]+\/?$/u.test(path);
  const rankLobby = (path) => /^\/rank\/?$/u.test(path);
  const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const maxAttempts = 3;
  const replyDelayMs = 2000;
  const queueRetryMs = 5000;
  const previewSize = 6;
  const wordError = /không tồn tại từ|từ (?:này )?không (?:tồn tại|hợp lệ|có trong từ điển)|từ (?:này )?đã (?:được sử dụng|sử dụng|dùng)|(?:invalid word|word not found|word already (?:used|exists|played))/u;

  let session;
  let timer;
  let panel;
  let statusText;
  let statusButton;
  let continuationPanel;

  function visible(element) {
    return !!element?.getClientRects().length && getComputedStyle(element).visibility === 'visible';
  }

  function updateStatus(message) {
    if (!panel?.isConnected) {
      panel = document.createElement('div');
      panel.id = 'noitu-online-status';
      const progress = document.createElement('div');
      progress.className = 'noitu-online-progress';
      statusText = document.createElement('span');
      statusText.setAttribute('role', 'status');
      statusButton = document.createElement('button');
      statusButton.type = 'button';
      statusButton.addEventListener('click', () => {
        if (!session) return panel.remove();
        stop();
        chrome.runtime.sendMessage({ type: 'noitu-online-user-stop' }).catch(() => {});
      });
      progress.append(statusText, statusButton);
      continuationPanel = document.createElement('div');
      continuationPanel.className = 'noitu-online-continuations';
      continuationPanel.hidden = true;
      panel.append(progress, continuationPanel);
      document.body.append(panel);
    }

    const label = session ? 'Dừng' : 'Ẩn';
    if (statusText.textContent === message && statusButton.textContent === label) return;
    statusText.textContent = message;
    statusButton.textContent = label;
    chrome.runtime.sendMessage({ type: 'noitu-online-status', status: message }).catch(() => {});
  }

  function continuationList(words) {
    const list = document.createElement('ul');
    for (const word of words) {
      const item = document.createElement('li');
      item.textContent = word;
      list.append(item);
    }
    return list;
  }

  function showContinuations(choice) {
    continuationPanel.replaceChildren();
    continuationPanel.hidden = !choice;
    if (!choice) return;

    const heading = document.createElement('p');
    heading.className = 'noitu-online-continuation-title';
    heading.textContent = `Nối tiếp “${choice.word}”`;
    continuationPanel.append(heading);

    const replies = [...choice.replies].sort((a, b) => a.localeCompare(b, 'vi'));
    if (!replies.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Không còn từ nối trong bộ từ điển.';
      continuationPanel.append(empty);
      return;
    }

    continuationPanel.append(continuationList(replies.slice(0, previewSize)));
    const additional = replies.slice(previewSize);
    if (additional.length) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = `Xem thêm ${additional.length} từ`;
      const list = continuationList(additional);
      list.tabIndex = 0;
      list.setAttribute('aria-label', 'Các từ nối còn lại');
      details.append(summary, list);
      continuationPanel.append(details);
    }
  }

  function stop() {
    clearInterval(timer);
    session = undefined;
    updateStatus('Đã tắt tự động nối từ.');
    showContinuations(null);
  }

  function readWord(card) {
    const displayed = card.querySelector(selectors.word)?.cloneNode(true);
    displayed?.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
    return normalize(displayed?.textContent ?? '');
  }

  function chooseWord(prefix, used, attempted) {
    const availableCounts = new Map();
    function countAvailable(syllable) {
      if (!availableCounts.has(syllable)) {
        const count = (session.all.get(syllable) ?? []).filter((word) => !used.has(word)).length;
        availableCounts.set(syllable, count);
      }
      return availableCounts.get(syllable);
    }

    let best;
    for (const word of session.all.get(prefix) ?? []) {
      if (used.has(word) || attempted.has(word)) continue;

      const opponentPrefix = ending(word);
      const replies = (session.all.get(opponentPrefix) ?? [])
        .filter((reply) => reply !== word && !used.has(reply));
      if (best && !best.replies.length && replies.length) continue;

      let losingReplies = 0;
      let worstCase = Infinity;
      for (const reply of replies) {
        const nextPrefix = ending(reply);
        // The candidate and the opponent's reply both become used on this branch.
        const available = countAvailable(nextPrefix) - Number(nextPrefix === prefix) -
          Number(nextPrefix === opponentPrefix);
        if (available === 0) losingReplies++;
        worstCase = Math.min(worstCase, available);
      }

      // Prefer an immediate win, then fewer losing branches and a larger reserve on our next turn.
      const rank = [
        Number(replies.length > 0), losingReplies, -worstCase, replies.length,
        Number(!session.preferred.has(word)), word.length,
      ];
      const difference = best ? rank.findIndex((value, index) => value !== best.rank[index]) : -1;
      if (!best || (difference >= 0 && rank[difference] < best.rank[difference])) {
        best = { word, replies, rank };
      }
    }
    return best ?? null;
  }

  function newSearch(readyAt = 0) {
    return { readyAt, requested: 0, lastSeen: 0 };
  }

  function handleLobby(now) {
    if (session.match) {
      session.match = undefined;
      session.search = newSearch();
      showContinuations(null);
    }

    const search = session.search;
    const searching = document.querySelector(selectors.searching);
    if (visible(searching)) {
      search.lastSeen = now;
      return updateStatus('Đang tìm trận Nối Từ 1 vs 1…');
    }

    const lastSearch = Math.max(search.requested, search.lastSeen);
    if (now < search.readyAt || (search.requested && now - search.requested < queueRetryMs) ||
      (search.lastSeen && now - lastSearch < 500)) {
      return updateStatus('Đang chờ để tìm trận lại…');
    }

    const button = document.querySelector(selectors.queue);
    if (!visible(button) || button.disabled || !/1\s*vs\s*1/iu.test(button.textContent)) {
      return updateStatus('Đang đợi nút Nối Từ 1 vs 1…');
    }
    search.requested = now;
    search.lastSeen = 0;
    updateStatus('Đang vào hàng chờ Nối Từ 1 vs 1…');
    button.click();
  }

  function handleTurn(now, card, notices) {
    const word = readWord(card);
    const history = [...document.querySelectorAll(selectors.chip)].map((chip) => normalize(chip.textContent));
    const signature = `${history.length}/${history.at(-1) ?? ''}/${word}`;
    if (session.match.turn?.signature !== signature) {
      session.match.turn = { signature, attempted: new Set(), sent: 0 };
    }

    const input = card.querySelector(selectors.input);
    const button = card.querySelector(selectors.submit);
    const turn = session.match.turn;
    if (!visible(input) || input.disabled || input.readOnly || !visible(button) || button.disabled) {
      return updateStatus('Đang chờ tới lượt của bạn…');
    }

    const count = card.querySelector(selectors.remaining)?.textContent.match(/còn\s+([0-3])\s+lượt/iu);
    const remaining = count ? Number(count[1]) : maxAttempts;
    turn.nextReplyAt ??= now + replyDelayMs;
    if (turn.waitMessage) return updateStatus(turn.waitMessage);
    if (!remaining) return updateStatus('Đã hết lượt nhập. Đang chờ lượt hoặc ván tiếp theo…');

    if (turn.pending) {
      const pending = turn.pending;
      const lostAttempt = remaining < pending.remaining;
      const rejected = lostAttempt || !!input.closest('.anim-shake') || input.className.includes('inputError__');
      const loading = !!input.closest('.is-loading');
      if (loading || !rejected) {
        if (now - pending.since > 5000) {
          turn.waitMessage = 'Chưa xác nhận được đáp án. Đang chờ lượt hoặc ván tiếp theo…';
          updateStatus(turn.waitMessage);
        }
        return;
      }
      turn.pending = undefined;

      if (!pending.fallback && !lostAttempt && !wordError.test(notices)) {
        turn.waitMessage = 'Trang từ chối đáp án. Đang chờ lượt hoặc ván tiếp theo…';
        return updateStatus(turn.waitMessage);
      }
      turn.choice = undefined;
      if (!pending.fallback) turn.nextReplyAt = now + replyDelayMs;
    }

    if (turn.sent >= maxAttempts) {
      return updateStatus('Đã gửi tối đa 3 lần. Đang chờ lượt hoặc ván tiếp theo…');
    }

    if (turn.prepared) {
      const { answer, fallback, field } = turn.prepared;
      turn.prepared = undefined;
      if (input !== field || normalize(input.value) !== answer) return;
      if (!fallback) turn.attempted.add(answer);
      turn.sent++;
      turn.pending = { since: now, remaining, fallback };
      const attempt = Math.max(turn.sent, maxAttempts - remaining + 1);
      updateStatus(fallback
        ? `Hết từ để nối. Đã nhập “a” (${attempt}/${maxAttempts}).`
        : `Đã gửi “${answer}” (${attempt}/${maxAttempts}).`);
      button.click();
      return;
    }

    const prefix = ending(word);
    if (!word.includes(' ') || !prefix) return;
    if (normalize(input.value) && normalize(input.value) !== prefix) {
      return updateStatus('Đang chờ bạn nhập xong…');
    }
    if (turn.choice === undefined) {
      turn.choice = chooseWord(prefix, new Set([...history, word]), turn.attempted);
      showContinuations(turn.choice);
    }
    if (now < turn.nextReplyAt) return updateStatus('Đang chờ trước khi nối từ…');

    const answer = turn.choice?.word ?? `${prefix} a`;
    turn.prepared = { answer, fallback: !turn.choice, field: input };
    setInputValue.call(input, answer);
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }

  function tick() {
    const path = location.pathname;
    const now = Date.now();
    const inLobby = rankLobby(path);
    if (session.blocked) return updateStatus('Noitu.fun đã chặn thao tác. Tiện ích vẫn bật và đang chờ.');
    if (!inLobby && !rankedRoom(path)) {
      if (session.match) {
        session.match = undefined;
        session.search = newSearch();
        showContinuations(null);
      }
      return updateStatus('Vẫn bật. Đang chờ trang Nối Từ 1 vs 1…');
    }
    if (!inLobby && session.match?.path !== path) {
      session.match = { path, readyClicked: false };
      showContinuations(null);
    }

    const notices = normalize([...document.querySelectorAll(selectors.notice)]
      .filter(visible).map((node) => node.textContent).join(' '));
    const siteBlock = /phát hiện.*(?:bot|tự động)|thao tác bất thường|đã chặn thao tác|tạm khóa hàng chờ|tài khoản (?:của bạn )?đã bị khóa/u;
    if (siteBlock.test(notices)) {
      session.blocked = true;
      chrome.runtime.sendMessage({ type: 'noitu-online-blocked' }).catch(() => {});
      return updateStatus('Noitu.fun đã chặn thao tác. Tiện ích vẫn bật và đang chờ.');
    }
    const verificationNotice = /xác minh|verify (?:you are|that you are)|captcha/u;
    const needsVerification = [...document.querySelectorAll(selectors.verification)]
      .some((element) => visible(element) && !element.closest('[aria-hidden="true"]'));
    if (verificationNotice.test(notices) || needsVerification) {
      return updateStatus('Vẫn bật. Hãy xác minh CAPTCHA trên Noitu.fun để tiếp tục.');
    }
    if (document.querySelector('[data-testid="guest-verify"][data-phase="verifying"]')) {
      return updateStatus('Vẫn bật. Đang chờ Noitu.fun xác minh…');
    }
    if (visible(document.querySelector('[data-testid="ranked-versus"]'))) {
      return updateStatus('Đã tìm thấy đối thủ. Đang chờ bắt đầu…');
    }
    const result = document.querySelector(selectors.result);
    if (inLobby && visible(result)) {
      const close = result.querySelector('button[aria-label="Đóng kết quả"]');
      if (visible(close) && !close.disabled && session.closedResult !== result) {
        session.closedResult = result;
        updateStatus('Đang đóng kết quả để tìm trận tiếp theo…');
        close.click();
        return;
      }
    }
    const gameDialog = (element) => {
      const title = element.getAttribute('aria-label') ?? element.querySelector('h2, h3')?.textContent ?? '';
      return visible(element) && (element === result || /vòng quyết định|rời trận|thoát phòng/u.test(normalize(title)));
    };
    if ([...document.querySelectorAll(selectors.dialog)].some(gameDialog)) {
      return updateStatus('Đang chờ bạn xử lý hộp thoại trên trang…');
    }

    if (inLobby) return handleLobby(now);

    const card = document.querySelector(selectors.card);
    if (visible(card)) return handleTurn(now, card, notices);

    const ready = document.querySelector(selectors.ready);
    if (visible(ready) && !ready.disabled && !session.match.readyClicked) {
      session.match.readyClicked = true;
      ready.click();
    }
    updateStatus('Đang đợi ván bắt đầu…');
  }

  globalThis.noituOnline = {
    running: () => !!session,
    stop,
    start: ({ groups: [all, preferred], blocked, restored }) => {
      if (session) return;
      session = {
        all: new Map(all), preferred: new Set(preferred), blocked,
        search: newSearch(restored ? Date.now() + 1200 : 0),
      };
      updateStatus('Đã bật tự động nối từ.');
      showContinuations(null);
      timer = setInterval(tick, 240);
      tick();
    },
  };
})();
