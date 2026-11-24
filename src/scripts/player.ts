import { formatDuration, formatTime } from "@/lib/format";
import { isUuid } from "@/lib/sermons";

type Track = {
  id: string;
  title: string;
  subtitle: string;
  duration: number;
  position: number;
  completed: boolean;
};

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
/** Also saved on pause, end and leaving the page; 30s keeps D1 writes low. */
const SAVE_EVERY_MS = 30_000;
const BACK_SECONDS = 15;
const FORWARD_SECONDS = 30;
/** Starting within this many seconds of the end restarts from the top. */
const NEAR_END_SECONDS = 20;
const LAST_TRACK_KEY = "player:last-sermon";
const RATE_KEY = "player:rate";

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked; this only affects convenience settings.
  }
}

function trackFrom(item: HTMLElement): Track {
  return {
    id: item.dataset.sermonId ?? "",
    title: item.dataset.title ?? "",
    subtitle: item.dataset.subtitle ?? "",
    duration: Number(item.dataset.duration) || 0,
    position: Number(item.dataset.position) || 0,
    completed: item.dataset.completed === "true",
  };
}

function query<T extends Element>(root: HTMLElement, selector: string) {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Player is missing ${selector}`);
  return element;
}

export function initPlayer() {
  const found = document.getElementById("player");
  if (!found) return;
  const root: HTMLElement = found;

  const audio = query<HTMLAudioElement>(root, "[data-player-audio]");
  const title = query<HTMLElement>(root, "[data-player-title]");
  const subtitle = query<HTMLElement>(root, "[data-player-subtitle]");
  const seek = query<HTMLInputElement>(root, "[data-player-seek]");
  const current = query<HTMLElement>(root, "[data-player-current]");
  const remaining = query<HTMLElement>(root, "[data-player-remaining]");
  const toggle = query<HTMLButtonElement>(root, "[data-player-toggle]");
  const playIcon = query<SVGElement>(toggle, "[data-icon-play]");
  const pauseIcon = query<SVGElement>(toggle, "[data-icon-pause]");
  const speed = query<HTMLButtonElement>(root, "[data-player-speed]");
  const status = query<HTMLElement>(root, "[data-player-status]");
  const items = () =>
    document.querySelectorAll<HTMLElement>("[data-sermon-id]");

  let track: Track | null = null;
  let lastSavedAt = 0;
  let isScrubbing = false;
  /** Set while "mark as played" pauses, so the pause doesn't save a position. */
  let isMarkingPlayed = false;
  let rate = Number(readStorage(RATE_KEY));
  if (!RATES.includes(rate)) rate = 1;

  const duration = () =>
    Number.isFinite(audio.duration) ? audio.duration : (track?.duration ?? 0);

  /** Scrolls a cut-off title back and forth, unless motion is reduced. */
  function updateMarquee() {
    delete title.dataset.marquee;
    const overflow = title.scrollWidth - title.clientWidth;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (overflow <= 1 || reduceMotion) return;
    title.style.setProperty("--marquee-distance", `-${overflow}px`);
    // ~30px a second while moving (60% of each pass), never rushed.
    const seconds = Math.max(4, overflow / 30 / 0.6);
    title.style.setProperty("--marquee-duration", `${seconds}s`);
    title.dataset.marquee = "";
  }

  function renderSpeed() {
    speed.textContent = `${rate}×`;
    speed.setAttribute("aria-label", `Playback speed: ${rate} times`);
  }

  function renderTime() {
    const total = duration();
    const now = audio.currentTime;
    if (!isScrubbing) seek.value = String(Math.floor(now));
    seek.max = String(Math.floor(total));
    seek.setAttribute(
      "aria-valuetext",
      `${formatTime(now)} of ${formatTime(total)}`
    );
    current.textContent = formatTime(now);
    remaining.textContent = `-${formatTime(Math.max(0, total - now))}`;
  }

  function renderPlaying() {
    const isPlaying = !audio.paused;
    playIcon.classList.toggle("hidden", isPlaying);
    pauseIcon.classList.toggle("hidden", !isPlaying);
    toggle.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
    for (const item of items()) {
      const isCurrent = item.dataset.sermonId === track?.id;
      item.toggleAttribute("data-active", isCurrent);
      // Shows the same play/pause icon as the player on this row.
      item.toggleAttribute("data-playing", isCurrent && isPlaying);
      const button = item.querySelector("[data-play-label]");
      if (button) {
        button.textContent = isCurrent && isPlaying ? "Pause" : "Play";
      }
    }
  }

  /** Keeps the list row's progress bar and label in step with the player. */
  function renderListProgress() {
    if (!track) return;
    const item = document.querySelector<HTMLElement>(
      `[data-sermon-id="${track.id}"]`
    );
    if (!item) return;
    item.dataset.position = String(track.position);
    item.dataset.completed = String(track.completed);
    const total = duration();
    const bar = item.querySelector<HTMLElement>("[data-progress-bar]");
    const label = item.querySelector<HTMLElement>("[data-progress-label]");
    const fraction = track.completed
      ? 1
      : total > 0
        ? Math.min(1, track.position / total)
        : 0;
    if (bar) bar.style.width = `${fraction * 100}%`;
    if (label) {
      label.textContent = track.completed
        ? "Played"
        : track.position > 0 && total > 0
          ? `${formatDuration(total - track.position)} left`
          : "";
    }
  }

  function updatePositionState() {
    if (!("mediaSession" in navigator)) return;
    const total = audio.duration;
    if (!Number.isFinite(total) || total <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: total,
        playbackRate: audio.playbackRate,
        position: Math.min(audio.currentTime, total),
      });
    } catch {
      // Some browsers reject position state mid-load; the next update fixes it.
    }
  }

  function save({ beacon = false, completed = false } = {}) {
    if (!track) return;
    const position = completed ? 0 : audio.currentTime;
    track.position = position;
    track.completed = completed;
    lastSavedAt = Date.now();
    renderListProgress();

    const body = JSON.stringify({ sermonId: track.id, position, completed });
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/progress",
        new Blob([body], { type: "application/json" })
      );
      return;
    }
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Offline: the next save catches up.
    });
  }

  function load(next: Track, autoplay: boolean) {
    if (track && track.id !== next.id && audio.currentTime > 0) save();
    track = next;
    root.hidden = false;
    title.textContent = next.title;
    updateMarquee();
    subtitle.textContent = next.subtitle;
    status.textContent = "";

    const total = next.duration;
    const start =
      next.completed || (total > 0 && next.position > total - NEAR_END_SECONDS)
        ? 0
        : next.position;
    // The #t fragment starts playback at the saved spot, including on iOS.
    audio.src = `/api/audio/${next.id}${start > 0 ? `#t=${Math.floor(start)}` : ""}`;
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
    writeStorage(LAST_TRACK_KEY, next.id);

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: next.title,
        artist: "Curt Dalaba",
        album: next.subtitle,
        artwork: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });
    }

    renderTime();
    renderPlaying();
    if (autoplay) play();
  }

  function play() {
    audio.play().catch(error => {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        return; // Autoplay blocked; the member taps play.
      }
      status.textContent = "Couldn't play this sermon. Check your connection.";
    });
  }

  function skip(seconds: number) {
    const total = duration();
    audio.currentTime = Math.min(
      Math.max(0, audio.currentTime + seconds),
      total || Number.MAX_SAFE_INTEGER
    );
  }

  // Controls
  toggle.addEventListener("click", () => {
    if (audio.paused) play();
    else audio.pause();
  });
  query<HTMLButtonElement>(root, "[data-player-back]").addEventListener(
    "click",
    () => skip(-BACK_SECONDS)
  );
  query<HTMLButtonElement>(root, "[data-player-forward]").addEventListener(
    "click",
    () => skip(FORWARD_SECONDS)
  );
  speed.addEventListener("click", () => {
    rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length] ?? 1;
    audio.playbackRate = rate;
    audio.defaultPlaybackRate = rate;
    writeStorage(RATE_KEY, String(rate));
    renderSpeed();
  });
  seek.addEventListener("pointerdown", () => {
    isScrubbing = true;
  });
  seek.addEventListener("input", () => {
    current.textContent = formatTime(Number(seek.value));
  });
  seek.addEventListener("change", () => {
    isScrubbing = false;
    audio.currentTime = Number(seek.value);
  });

  /** Lets the sermon list move the row into Played (and offer undo). */
  function announcePlayed(id: string, undo?: () => void) {
    document.dispatchEvent(
      new CustomEvent("sermon:played", { detail: { id, undo } })
    );
  }

  function postProgress(id: string, position: number, completed: boolean) {
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sermonId: id, position, completed }),
      keepalive: true,
    }).catch(() => {
      // Offline: the row still moves; it returns on reload if unsaved.
    });
  }

  function markPlayed(item: HTMLElement) {
    const id = item.dataset.sermonId ?? "";
    const isCurrent = track?.id === id;
    const previous = isCurrent
      ? audio.currentTime
      : Number(item.dataset.position) || 0;

    if (isCurrent) {
      if (!audio.paused) {
        isMarkingPlayed = true;
        audio.pause();
      }
      // Rewind so later saves (backgrounding, leaving) don't undo the mark.
      audio.currentTime = 0;
      save({ completed: true });
    } else {
      postProgress(id, 0, true);
    }

    announcePlayed(id, () => {
      if (track?.id === id) {
        audio.currentTime = previous;
        track.position = previous;
        track.completed = false;
      }
      postProgress(id, previous, false);
      document.dispatchEvent(
        new CustomEvent("sermon:unplayed", {
          detail: { id, position: previous },
        })
      );
    });
  }

  // Sermon list: tapping a row plays it, or toggles if it's already loaded.
  document.addEventListener("click", event => {
    const target = event.target as Element | null;
    const markButton = target?.closest<HTMLElement>("[data-mark-played]");
    const markItem = markButton?.closest<HTMLElement>("[data-sermon-id]");
    if (markItem) {
      markPlayed(markItem);
      return;
    }
    const button = target?.closest<HTMLElement>("[data-play-sermon]");
    const item = button?.closest<HTMLElement>("[data-sermon-id]");
    if (!item) return;
    if (track?.id === item.dataset.sermonId) {
      if (audio.paused) play();
      else audio.pause();
      return;
    }
    load(trackFrom(item), true);
  });

  // Audio events
  audio.addEventListener("loadedmetadata", () => {
    renderTime();
    updatePositionState();
  });
  audio.addEventListener("timeupdate", () => {
    renderTime();
    if (!audio.paused && Date.now() - lastSavedAt > SAVE_EVERY_MS) save();
  });
  audio.addEventListener("play", renderPlaying);
  audio.addEventListener("pause", () => {
    renderPlaying();
    if (isMarkingPlayed) isMarkingPlayed = false;
    else if (!audio.ended) save();
  });
  audio.addEventListener("ended", () => {
    renderPlaying();
    save({ completed: true });
    if (track) announcePlayed(track.id);
  });
  audio.addEventListener("ratechange", updatePositionState);
  audio.addEventListener("seeked", () => {
    updatePositionState();
    renderTime();
  });
  audio.addEventListener("waiting", () => {
    status.textContent = "Loading…";
  });
  audio.addEventListener("playing", () => {
    status.textContent = "";
    updatePositionState();
  });
  audio.addEventListener("error", () => {
    status.textContent =
      "This recording couldn't be loaded. You may need to sign in again.";
  });

  // Save when the app is backgrounded or closed.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && audio.currentTime > 0) {
      save({ beacon: true, completed: audio.ended });
    }
  });
  window.addEventListener("pagehide", () => {
    if (audio.currentTime > 0 && !audio.ended) save({ beacon: true });
  });

  // Lock screen, headphones and car controls.
  if ("mediaSession" in navigator) {
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => play()],
      ["pause", () => audio.pause()],
      ["seekbackward", details => skip(-(details.seekOffset ?? BACK_SECONDS))],
      ["seekforward", details => skip(details.seekOffset ?? FORWARD_SECONDS)],
      [
        "seekto",
        details => {
          if (details.seekTime !== undefined) {
            audio.currentTime = details.seekTime;
          }
        },
      ],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Action not supported by this browser.
      }
    }
  }

  renderSpeed();

  // Lets the page pad its bottom so the last row isn't hidden behind the player.
  new ResizeObserver(() => {
    document.documentElement.style.setProperty(
      "--player-height",
      `${root.offsetHeight}px`
    );
    updateMarquee();
  }).observe(root);

  // Bring back the last sermon (paused) so "continue listening" is one tap.
  const lastId = readStorage(LAST_TRACK_KEY);
  const lastItem = isUuid(lastId)
    ? document.querySelector<HTMLElement>(`[data-sermon-id="${lastId}"]`)
    : null;
  if (lastItem) load(trackFrom(lastItem), false);
}
