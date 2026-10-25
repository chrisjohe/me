const cards = [...document.querySelectorAll('.card')];
const cardGroup = document.querySelector('.cards');
const portraitCard = document.querySelector('[data-card="portrait"]');
const sectionView = document.querySelector('.section-view');
const sectionScroll = document.querySelector('.section-scroll');
const sectionTitle = document.querySelector('#section-title');
const backButton = document.querySelector('.section-back');
const siteFooter = document.querySelector('.site-footer');
const aboutButton = document.querySelector('.about-button');
const sectionContents = [...document.querySelectorAll('[data-section]')];
const perspectivesContent = document.querySelector('[data-section="perspectives"]');
const perspectivePosts = [...perspectivesContent.querySelectorAll('.perspective-post')];
const elsewhereContent = document.querySelector('[data-section="elsewhere"]');
const elsewhereIntro = elsewhereContent.querySelector('.elsewhere-intro');
const elsewhereRoadField = elsewhereContent.querySelector('.elsewhere-road');
const portraitContent = document.querySelector('#portrait-content');
const contactContent = document.querySelector('#contact-content');
const contactChat = contactContent.querySelector('.contact-chat');
const contactChatBubbles = [...contactChat.querySelectorAll('.contact-chat-bubble')];
const contactGreetings = [
  ['Hey, glad you’re here.', 'A question, an idea, or just saying hi?', 'Any of those works.'],
  ['Hey!', 'What’s something you could talk about for hours?', 'I’m always up for a good rabbit hole.'],
  ['I was going to write a very professional introduction.', 'But honestly…', 'A hello is a pretty good start.']
];
const portraitLanyardStage = document.querySelector('#portrait-lanyard');
const academiaChapters = [...document.querySelectorAll('.academia-chapter')];
const academiaButtons = [...document.querySelectorAll('[data-academia-target]')];
const experienceContent = document.querySelector('#experience-content');
const experienceSidebar = document.querySelector('.experience-sidebar');
const experienceEntries = [...document.querySelectorAll('.experience-entry')];
const experiencePeriods = [...document.querySelectorAll('.experience-period')];
const experienceButtons = [...document.querySelectorAll('[data-experience-target]')];
const experienceTrack = document.querySelector('.timeline-track');
const experienceAxis = document.querySelector('.timeline-axis');
const experienceDateFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const experienceWake = {
  bars: [],
  animations: new Map(),
  position: 0,
  previousPosition: null,
  previousTime: 0,
  pointerId: null,
  horizontal: null,
  present: 0,
  months: 0
};
const accordions = [...document.querySelectorAll('.experience-roles, .academia-details')];
const accordionAnimations = new Set();
const motion = window.portraitMotion;
const stackedLayout = window.matchMedia('(max-width: 900px)');
const compactDetailLayout = window.matchMedia('(max-width: 900px), (max-height: 600px)');
const curtainDuration = 660;
const curtainSplit = 420 / curtainDuration;
const curtainEase = 'cubic-bezier(0.65, 0, 0.35, 1)';
const navigationStateKey = 'cjPortraitNavigation';
const sectionKeys = new Set(['about', ...cards.map(card => card.dataset.card)]);
const focusTargets = [...document.querySelectorAll('button, a, summary, [tabindex]')];
const navigationEntries = new Map();

let view = 'cards';
let currentSection = null;
let navigationEntry = null;
let pendingNavigation = null;
let navigating = false;
let backPending = false;
let sectionSwitchAnimation = null;
let selectedCard = portraitCard;
let curtainAnimations = [];
let pausedTransitions = [];
let pointerReady = true;
let inputMode = 'mouse';
let mousePosition = null;
let cardsScrollY = 0;
let sectionFrame = null;
let perspectivesFrame = null;
let activeAcademia = 0;
let activeExperience = -1;
let experienceRanges = [];
let experienceViewportHeight = 0;
let portraitLanyard = null;
let portraitLanyardLoading = null;
let elsewhereRoad = null;
let elsewhereRoadLoading = null;
let previousContactGreeting = null;
let contactChatAnimations = [];
let contactChatVisible = false;

function finishContactChat() {
  for (const animation of contactChatAnimations) {
    animation.onfinish = null;
    animation.cancel();
  }
  contactChatAnimations = [];
}

function animateContactChat(element, frames, timing) {
  const animation = element.animate(frames, { ...timing, fill: 'both' });
  animation.pause();
  contactChatAnimations.push(animation);
  return animation;
}

function prepareContactChat() {
  finishContactChat();
  const choices = contactGreetings.filter(greeting => greeting !== previousContactGreeting);
  const greeting = choices[Math.floor(Math.random() * choices.length)];
  previousContactGreeting = greeting;
  let delay = 220;

  for (const [index, bubble] of contactChatBubbles.entries()) {
    bubble.textContent = greeting[index];
    if (!motion.enabled) continue;

    const typing = bubble.nextElementSibling;
    const duration = Math.min(1700, Math.max(1100, 900 + greeting[index].length * 14));
    animateContactChat(typing, [
      { opacity: 0, offset: 0 },
      { opacity: 1, offset: 0.08 },
      { opacity: 1, offset: 0.92 },
      { opacity: 0, offset: 1 }
    ], { delay, duration });
    for (const [dotIndex, dot] of [...typing.children].entries()) {
      animateContactChat(dot, [
        { opacity: 0.35, transform: 'translateY(0)' },
        { opacity: 1, transform: 'translateY(-3px)' },
        { opacity: 0.35, transform: 'translateY(0)' }
      ], { delay: delay + dotIndex * 100, duration: 540, iterations: Math.ceil(duration / 540), easing: 'ease-in-out' });
    }
    const reveal = animateContactChat(bubble, [
      { opacity: 0, transform: 'translateY(6px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { delay: delay + duration, duration: 280, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
    if (index === contactChatBubbles.length - 1) reveal.onfinish = finishContactChat;
    delay += duration + 650;
  }
}

function updateContactChat() {
  const active = view === 'section' && currentSection === 'contact' && contactChatVisible && !document.hidden;
  for (const animation of contactChatAnimations) {
    if (active && animation.playState === 'paused') animation.play();
    else if (!active && animation.playState === 'running') animation.pause();
  }
}

const contactChatObserver = new IntersectionObserver(entries => {
  contactChatVisible = entries[0].isIntersecting;
  updateContactChat();
}, { root: sectionScroll });
contactChatObserver.observe(contactChat);
document.addEventListener('visibilitychange', updateContactChat);

function updatePerspectivesLayout() {
  if (sectionView.hidden || perspectivesContent.hidden) return;
  const width = perspectivesContent.getBoundingClientRect().width;
  if (!width) return;

  const styles = getComputedStyle(perspectivesContent);
  const gap = parseFloat(styles.getPropertyValue('--post-gap'));
  const minWidth = parseFloat(styles.getPropertyValue('--post-min-width'));
  const staggered = width >= minWidth * 2 + gap;
  perspectivesContent.classList.toggle('is-staggered', staggered);
  if (!staggered) {
    perspectivesContent.style.removeProperty('--posts-height');
    return;
  }

  const heights = perspectivePosts.map(post => post.getBoundingClientRect().height);
  const columns = [0, 0];
  for (const [index, post] of perspectivePosts.entries()) {
    const column = index % 2;
    post.style.setProperty('--post-top', `${columns[column]}px`);
    columns[column] += heights[index] + gap;
  }
  perspectivesContent.style.setProperty('--posts-height', `${Math.max(...columns) - gap}px`);
}

function schedulePerspectivesLayout() {
  if (sectionView.hidden || perspectivesContent.hidden || perspectivesFrame !== null) return;
  perspectivesFrame = requestAnimationFrame(() => {
    perspectivesFrame = null;
    updatePerspectivesLayout();
  });
}

function updateElsewhereRoad() {
  const active = view === 'section' && currentSection === 'elsewhere';
  if (elsewhereRoad) {
    elsewhereRoad.setPaused(!active);
    return;
  }
  if (!active || elsewhereRoadLoading) return;

  elsewhereRoadLoading = import('./assets/elsewhere/road.js?v=20261025-warm-lights').then(({ mountRoad }) => {
    if (view !== 'section' || currentSection !== 'elsewhere') return;
    elsewhereRoad = mountRoad(elsewhereRoadField);
  }).catch(() => {
    elsewhereRoadField.querySelector('.elsewhere-road-fallback').hidden = false;
  }).finally(() => {
    elsewhereRoadLoading = null;
  });
}

function updatePortraitLanyard() {
  const active = view === 'section' && currentSection === 'portrait';
  if (portraitLanyard) {
    portraitLanyard.setPaused(!active);
    return;
  }
  if (!active || portraitLanyardLoading) return;

  portraitLanyardLoading = import('./assets/lanyard/lanyard.js?v=20261024-motion-toggle').then(({ mountLanyard }) => {
    if (view !== 'section' || currentSection !== 'portrait') return;
    portraitLanyard = mountLanyard(portraitLanyardStage);
    const canvas = portraitLanyardStage.querySelector('canvas');
    if (canvas) focusTargets.push(canvas);
  }).catch(() => {
    portraitLanyardStage.classList.remove('is-ready');
    portraitLanyardStage.querySelector('canvas')?.remove();
  }).finally(() => {
    portraitLanyardLoading = null;
  });
}

function trackPointer(event) {
  inputMode = event.pointerType;
  mousePosition = event.pointerType === 'mouse'
    ? { x: event.clientX, y: event.clientY }
    : null;
}

function activateCard(activeCard) {
  if (view !== 'cards' || activeCard.classList.contains('is-active')) return;

  for (const card of cards) {
    const isActive = card === activeCard;
    card.classList.toggle('is-active', isActive);
    card.setAttribute('aria-pressed', String(isActive));
  }
}

async function revealFocusedCard(card) {
  if (!stackedLayout.matches || view !== 'cards') return;

  const transitions = card.getAnimations().filter(
    animation => animation instanceof CSSTransition && animation.transitionProperty === 'flex-basis'
  );
  await Promise.allSettled(transitions.map(animation => animation.finished));

  if (view === 'cards' && stackedLayout.matches && card.classList.contains('is-active') && card.contains(document.activeElement)) {
    card.scrollIntoView({ block: 'nearest', behavior: motion.enabled ? 'smooth' : 'instant' });
  }
}

function curtainFrames(card) {
  if (card === selectedCard) {
    return [
      { opacity: 1, offset: 0 },
      { opacity: 1, offset: curtainSplit, easing: 'ease-in-out' },
      { opacity: 0, offset: 1 }
    ];
  }

  const selectedBounds = selectedCard.getBoundingClientRect();
  const vertical = stackedLayout.matches;
  const distance = cards.indexOf(card) < cards.indexOf(selectedCard)
    ? -Math.max(0, vertical ? selectedBounds.top : selectedBounds.left) - 8
    : Math.max(0, vertical
      ? window.innerHeight - selectedBounds.bottom
      : document.documentElement.clientWidth - selectedBounds.right) + 8;
  const axis = vertical ? 'Y' : 'X';
  const transform = `translate${axis}(${distance}px)`;

  return [
    { transform: `translate${axis}(0)`, offset: 0, easing: curtainEase },
    { transform, offset: curtainSplit },
    { transform, offset: 1 }
  ];
}

function blurWithin(element) {
  if (element.contains(document.activeElement)) {
    document.activeElement.blur();
  }
}

function sectionHeading(key) {
  const content = sectionContents.find(content => content.dataset.section === key);
  return content?.dataset.heading
    ?? cards.find(card => card.dataset.card === key).querySelector('.card-title').textContent;
}

function prepareExperienceScale() {
  const monthNumber = value => {
    const [year, month] = value.split('-').map(Number);
    return year * 12 + month - 1;
  };
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const present = today.getFullYear() * 12 + today.getMonth() + (today.getDate() - 1) / daysInMonth;
  const earliest = monthNumber(experienceEntries.at(-1).dataset.start);
  const totalMonths = present - earliest;
  stopExperienceWake();
  experienceWake.present = present;
  experienceWake.months = totalMonths;
  experienceWake.horizontal = null;

  experienceRanges = experienceEntries.map(entry => {
    const start = monthNumber(entry.dataset.start);
    const end = entry.dataset.end === 'present' ? present : monthNumber(entry.dataset.end);
    return { start: (present - end) / totalMonths, length: (end - start) / totalMonths };
  });

  const ticks = document.createDocumentFragment();
  const addTick = (position, label, endpoint = false, major = false) => {
    const tick = document.createElement('span');
    tick.className = 'timeline-tick';
    tick.classList.toggle('is-major', major);
    tick.classList.toggle('is-endpoint', endpoint);
    tick.style.setProperty('--tick-position', `${position * 100}%`);
    if (label) {
      const text = document.createElement('span');
      text.textContent = label;
      tick.append(text);
    }
    ticks.append(tick);
  };
  addTick(0, 'now', true);
  for (let year = today.getFullYear(); year * 12 > earliest; year -= 1) {
    const position = (present - year * 12) / totalMonths;
    if (position > 0 && year % 5 === 0) addTick(position, String(year), false, true);
  }
  addTick(1, String(Math.floor(earliest / 12)), true);
  experienceAxis.replaceChildren(ticks);
  activeExperience = -1;
}

function stopExperienceWake() {
  for (const animation of experienceWake.animations.values()) animation.cancel();
  experienceWake.animations.clear();
  experienceWake.previousPosition = null;
}

function buildExperienceBars() {
  const horizontal = compactDetailLayout.matches;
  const length = horizontal ? experienceTrack.clientWidth : experienceTrack.clientHeight;
  const count = Math.max(18, Math.min(80, Math.round(length / 6) + 1));
  if (experienceWake.bars.length === count && experienceWake.horizontal === horizontal) return;

  stopExperienceWake();
  experienceWake.horizontal = horizontal;
  experienceTrack.setAttribute('aria-orientation', horizontal ? 'horizontal' : 'vertical');
  experienceWake.bars = Array.from({ length: count }, (_, index) => {
    const position = index / (count - 1);
    let careerIndex = experienceRanges.findIndex(range => position < range.start + range.length);
    if (careerIndex < 0) careerIndex = experienceEntries.length - 1;
    const bar = document.createElement('span');
    bar.className = 'timeline-bar';
    bar.dataset.career = experienceEntries[careerIndex].dataset.career;
    bar.setAttribute('aria-hidden', 'true');
    bar.style.setProperty('--bar-position', `${position * 100}%`);
    return bar;
  });
  experienceTrack.replaceChildren(...experienceWake.bars);
}

function paintExperienceBars(position) {
  const now = performance.now();
  const previous = experienceWake.previousPosition;
  const delta = previous === null ? 0 : position - previous;
  const elapsed = Math.max(16, Math.min(160, now - experienceWake.previousTime));
  const strength = Math.min(1, Math.abs(delta) * 2200 / elapsed);
  const head = position * (experienceWake.bars.length - 1);
  const current = Math.round(head);
  const canAnimate = motion.enabled && !document.hidden && view === 'section';
  experienceWake.position = position;
  experienceWake.previousPosition = canAnimate ? position : null;
  experienceWake.previousTime = now;

  experienceWake.bars.forEach((bar, index) => {
    bar.classList.toggle('is-future', index < current);
    bar.classList.toggle('is-current', index === current);
    if (!canAnimate || strength < 0.025) return;

    const distance = index - head;
    const reach = (3 + strength * 5) * (distance * delta < 0 ? 1.4 : 0.65);
    if (Math.abs(distance) > reach) return;
    const rest = index === current ? 1.45 : 1;
    const peak = rest + 1.3 * strength * Math.exp(-2 * (distance / reach) ** 2);
    const scale = value => experienceWake.horizontal ? `1 ${value}` : `${value} 1`;
    const initial = getComputedStyle(bar).scale;
    experienceWake.animations.get(bar)?.cancel();
    const animation = bar.animate([
      { scale: initial },
      { scale: scale(peak), offset: 0.18 },
      { scale: scale(rest) }
    ], { duration: 430, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
    experienceWake.animations.set(bar, animation);
    animation.onfinish = () => {
      if (experienceWake.animations.get(bar) === animation) experienceWake.animations.delete(bar);
    };
  });
}

function selectAcademiaTab(index) {
  activeAcademia = Number.isInteger(index) && academiaChapters[index] ? index : 0;
  academiaButtons.forEach((button, index) => {
    const selected = index === activeAcademia;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    academiaChapters[index].classList.remove('is-visible');
    academiaChapters[index].hidden = !selected;
  });
}

function revealAcademiaChapter() {
  if (currentSection !== 'academia') return;

  const chapter = academiaChapters[activeAcademia];
  chapter.getBoundingClientRect();
  chapter.classList.add('is-visible');
}

function measureExperienceTimeline() {
  const viewportHeight = Math.max(0, sectionScroll.clientHeight - siteFooter.offsetHeight);
  if (experienceViewportHeight !== viewportHeight) {
    experienceViewportHeight = viewportHeight;
    experienceContent.style.setProperty('--experience-viewport-height', `${viewportHeight}px`);
  }
  const viewportTop = sectionScroll.getBoundingClientRect().top;
  const readingOffset = Math.max(viewportHeight * 0.3,
    compactDetailLayout.matches ? experienceSidebar.offsetHeight + 24 : 32);
  const maxScroll = Math.max(0, sectionScroll.scrollHeight - sectionScroll.clientHeight);
  const scrollTop = Math.max(0, Math.min(sectionScroll.scrollTop, maxScroll));
  const thresholds = experienceEntries.map((entry, index) => index === 0 ? 0
    : Math.max(0, Math.min(maxScroll, sectionScroll.scrollTop + entry.getBoundingClientRect().top - viewportTop - readingOffset)));
  return { thresholds, maxScroll, scrollTop };
}

function updateExperienceTimeline() {
  if (experienceContent.hidden || sectionView.hidden) return;

  const { thresholds, maxScroll, scrollTop } = measureExperienceTimeline();
  buildExperienceBars();
  let activeIndex = 0;
  thresholds.forEach((threshold, index) => {
    if (scrollTop >= threshold) activeIndex = index;
  });
  const start = thresholds[activeIndex];
  const end = thresholds[activeIndex + 1] ?? maxScroll;
  const progress = end > start ? Math.max(0, Math.min(1, (scrollTop - start) / (end - start))) : 1;
  const range = experienceRanges[activeIndex];
  const position = range.start + range.length * progress;
  paintExperienceBars(position);
  const month = Math.floor(experienceWake.present - position * experienceWake.months);
  const date = position < 0.0001 ? 'Present'
    : experienceDateFormat.format(new Date(Math.floor(month / 12), month % 12, 1));
  const company = experienceButtons[activeIndex].querySelector('.timeline-company').textContent;
  experienceTrack.setAttribute('aria-valuenow', (position * 100).toFixed(1));
  experienceTrack.setAttribute('aria-valuetext', `${date} · ${company}`);

  if (activeExperience === activeIndex) return;
  activeExperience = activeIndex;
  experiencePeriods.forEach((period, index) => period.classList.toggle('is-active', index === activeIndex));
  experienceButtons.forEach((button, index) => {
    if (index === activeIndex) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
}

function seekExperienceTimeline(position) {
  if (view !== 'section' || currentSection !== 'experience') return;

  position = Math.max(0, Math.min(1, position));
  const { thresholds, maxScroll } = measureExperienceTimeline();
  let index = experienceRanges.findIndex(range => position < range.start + range.length);
  if (index < 0) index = experienceRanges.length - 1;
  const range = experienceRanges[index];
  const progress = Math.max(0, Math.min(1, (position - range.start) / range.length));
  const start = thresholds[index];
  const end = thresholds[index + 1] ?? maxScroll;
  sectionScroll.scrollTo({ top: start + (end - start) * progress, behavior: 'instant' });
  updateExperienceTimeline();
}

function seekExperiencePointer(event) {
  const bounds = experienceTrack.getBoundingClientRect();
  const position = compactDetailLayout.matches
    ? (event.clientX - bounds.left) / bounds.width
    : (event.clientY - bounds.top) / bounds.height;
  seekExperienceTimeline(position);
}

function finishExperienceDrag() {
  const pointerId = experienceWake.pointerId;
  experienceWake.pointerId = null;
  experienceTrack.classList.remove('is-dragging');
  if (pointerId !== null && experienceTrack.hasPointerCapture(pointerId)) {
    experienceTrack.releasePointerCapture(pointerId);
  }
}

function scheduleSectionUpdate() {
  if (sectionView.hidden || experienceContent.hidden || sectionFrame !== null) return;
  sectionFrame = requestAnimationFrame(() => {
    sectionFrame = null;
    updateExperienceTimeline();
  });
}

function sectionFromLocation() {
  const key = window.location.hash.slice(1);
  return sectionKeys.has(key) ? key : null;
}

function readNavigationEntry(state = history.state) {
  const entry = state?.[navigationStateKey];
  return entry && Number.isInteger(entry.index) && entry.index >= 0
    && (entry.key === null || sectionKeys.has(entry.key)) ? entry : null;
}

function createNavigationEntry(key, index, previous = null) {
  return {
    index,
    key,
    previousKey: previous?.key ?? null,
    origin: previous?.key ? previous.origin : key,
    overviewScrollTop: previous?.key ? previous.overviewScrollTop : previous?.scrollTop ?? 0,
    scrollTop: 0,
    focusIndex: -1
  };
}

function writeNavigationEntry(entry, replace = false) {
  const url = new URL(window.location.href);
  url.hash = entry.key ?? '';
  history[replace ? 'replaceState' : 'pushState']({ [navigationStateKey]: entry }, '', url);
}

function rememberNavigation(trigger = document.activeElement) {
  if (!navigationEntry || navigating) return;

  navigationEntry = {
    ...navigationEntry,
    ...(currentSection === 'academia' ? { academiaTab: activeAcademia } : {}),
    scrollTop: view === 'cards' ? window.scrollY : sectionScroll.scrollTop,
    focusIndex: focusTargets.indexOf(trigger)
  };
  navigationEntries.set(navigationEntry.index, navigationEntry);
}

async function renderNavigation(entry, instant = false) {
  pendingNavigation = { entry, instant };
  if (navigating) return;

  navigating = true;
  try {
    while (pendingNavigation) {
      const next = pendingNavigation;
      pendingNavigation = null;
      navigationEntry = next.entry;
      navigationEntries.set(navigationEntry.index, navigationEntry);

      if (navigationEntry.key === null) {
        if (view === 'section') await closeSection(navigationEntry);
        else window.scrollTo({ top: navigationEntry.scrollTop, behavior: 'instant' });
      } else if (view === 'cards') {
        const card = cards.find(card => card.dataset.card === navigationEntry.origin) ?? null;
        if (card) activateCard(card);
        await openSection(card, navigationEntry, next.instant);
      } else {
        await switchSection(navigationEntry.key, navigationEntry);
      }
    }
  } finally {
    navigating = false;
    backPending = false;
  }
}

function navigateTo(key, trigger = document.activeElement) {
  if (!sectionKeys.has(key) || navigating || backPending || currentSection === key) return;

  rememberNavigation(trigger);
  writeNavigationEntry(navigationEntry, true);
  for (const index of navigationEntries.keys()) {
    if (index > navigationEntry.index) navigationEntries.delete(index);
  }
  const entry = createNavigationEntry(key, navigationEntry.index + 1, navigationEntry);
  writeNavigationEntry(entry);
  renderNavigation(entry);
}

function goBack() {
  if (view !== 'section' || navigating || backPending) return;

  backPending = true;
  history.back();
}

function initializeNavigation() {
  history.scrollRestoration = 'manual';
  const key = sectionFromLocation();
  const saved = readNavigationEntry();
  if (saved && saved.key === key) {
    navigationEntry = saved;
    renderNavigation(saved, true);
    return;
  }

  navigationEntry = createNavigationEntry(null, 0);
  navigationEntry.scrollTop = key ? 0 : window.scrollY;
  navigationEntries.set(0, navigationEntry);
  writeNavigationEntry(navigationEntry, true);
  if (key) {
    const entry = createNavigationEntry(key, 1, navigationEntry);
    writeNavigationEntry(entry);
    renderNavigation(entry, true);
  }
}

window.addEventListener('popstate', event => {
  rememberNavigation();
  const saved = readNavigationEntry(event.state);
  if (saved) {
    renderNavigation(navigationEntries.get(saved.index) ?? saved);
  } else {
    const entry = createNavigationEntry(sectionFromLocation(), navigationEntry.index + 1, navigationEntry);
    writeNavigationEntry(entry, true);
    renderNavigation(entry);
  }
});

function showSection(key) {
  currentSection = key;
  sectionTitle.textContent = sectionHeading(key);
  for (const content of sectionContents) content.hidden = content.dataset.section !== key;
  if (key === 'academia') selectAcademiaTab(navigationEntry.academiaTab ?? 0);
  if (key === 'experience') prepareExperienceScale();
  if (key === 'contact') prepareContactChat();
  else finishContactChat();
  portraitContent.classList.remove('is-visible');
  elsewhereIntro.classList.remove('is-visible');
  const previousKey = navigationEntry.previousKey;
  const backLabel = previousKey
    ? previousKey === 'portrait' ? 'Back to portrait' : `Back to ${sectionHeading(previousKey)}`
    : 'Back to overview';
  backButton.setAttribute('aria-label', backLabel);
  backButton.title = backLabel;
  if (key === 'about') {
    aboutButton.setAttribute('aria-current', 'page');
  } else {
    aboutButton.removeAttribute('aria-current');
  }
}

function finishSection(focusTarget = sectionView) {
  sectionView.inert = false;
  siteFooter.inert = false;
  view = 'section';
  focusTarget.focus({ preventScroll: true });
  if (!portraitContent.hidden) portraitContent.classList.add('is-visible');
  if (!elsewhereContent.hidden) {
    elsewhereIntro.getBoundingClientRect();
    elsewhereIntro.classList.add('is-visible');
  }
  revealAcademiaChapter();
  updatePortraitLanyard();
  updateElsewhereRoad();
  updateExperienceTimeline();
  updateContactChat();
}

async function fadeSection(from, to) {
  if (!motion.enabled) return;

  sectionSwitchAnimation = sectionView.animate([
    { opacity: from },
    { opacity: to }
  ], { duration: 130, easing: 'ease-in-out', fill: 'forwards' });
  await Promise.allSettled([sectionSwitchAnimation.finished]);
  sectionSwitchAnimation.cancel();
  sectionSwitchAnimation = null;
}

async function switchSection(key, entry) {
  if (view !== 'section') return;
  view = 'switching';
  updateContactChat();
  finishExperienceDrag();
  stopExperienceWake();
  updatePortraitLanyard();
  updateElsewhereRoad();
  blurWithin(sectionView);
  blurWithin(siteFooter);
  sectionView.inert = true;
  siteFooter.inert = true;
  await fadeSection(1, 0);
  showSection(key);
  updatePerspectivesLayout();
  sectionScroll.scrollTop = entry.scrollTop;
  updateExperienceTimeline();
  await fadeSection(0, 1);
  finishSection(focusTargets[entry.focusIndex] ?? sectionView);
}

async function openSection(card, entry, instant = false) {
  if (view !== 'cards') return;

  view = 'opening';
  selectedCard = card;
  cardsScrollY = entry.overviewScrollTop;
  document.documentElement.style.setProperty('--cards-scroll-offset', `${-cardsScrollY}px`);
  document.documentElement.classList.add('is-section-open');
  blurWithin(cardGroup);
  blurWithin(siteFooter);
  cardGroup.inert = true;
  siteFooter.inert = true;
  pausedTransitions = cardGroup.getAnimations({ subtree: true }).filter(
    animation => animation instanceof CSSTransition && animation.playState === 'running'
  );
  for (const animation of pausedTransitions) animation.pause();

  showSection(entry.key);
  sectionView.hidden = false;
  updatePerspectivesLayout();
  sectionScroll.scrollTop = entry.scrollTop;
  updateExperienceTimeline();

  if (!instant && motion.enabled) {
    const timing = { duration: card ? curtainDuration : 220, fill: 'both' };
    curtainAnimations = card
      ? cards.map(card => card.animate(curtainFrames(card), timing))
      : [];
    curtainAnimations.push(sectionView.animate([
      { opacity: 0, offset: 0 },
      { opacity: 0, offset: card ? curtainSplit : 0, easing: 'ease-in-out' },
      { opacity: 1, offset: 1 }
    ], timing));
    await Promise.allSettled(curtainAnimations.map(animation => animation.finished));
  }

  cardGroup.classList.add('is-concealed');
  finishSection(focusTargets[entry.focusIndex] ?? sectionView);
}

async function closeSection(entry) {
  if (view !== 'section') return;

  view = 'closing';
  updateContactChat();
  finishExperienceDrag();
  stopExperienceWake();
  updatePortraitLanyard();
  updateElsewhereRoad();
  blurWithin(sectionView);
  blurWithin(siteFooter);
  sectionView.inert = true;
  siteFooter.inert = true;
  cardGroup.classList.remove('is-concealed');

  if (motion.enabled && curtainAnimations.length) {
    if (selectedCard) {
      cards.forEach((card, index) => {
        curtainAnimations[index].effect.setKeyframes(curtainFrames(card));
      });
    }
    for (const animation of curtainAnimations) animation.reverse();
    await Promise.allSettled(curtainAnimations.map(animation => animation.finished));
  }

  sectionView.hidden = true;
  currentSection = null;
  finishContactChat();
  aboutButton.removeAttribute('aria-current');
  for (const animation of curtainAnimations) animation.cancel();
  curtainAnimations = [];
  for (const animation of pausedTransitions) {
    if (animation.playState === 'paused') animation.play();
  }
  pausedTransitions = [];
  pointerReady = false;
  cardGroup.inert = false;
  siteFooter.inert = false;
  document.documentElement.classList.remove('is-section-open');
  document.documentElement.style.removeProperty('--cards-scroll-offset');
  window.scrollTo({ top: entry.scrollTop, behavior: 'instant' });
  const hoveredCard = mousePosition
    ? document.elementFromPoint(mousePosition.x, mousePosition.y)?.closest('.card')
    : null;
  const returnCard = hoveredCard || portraitCard;
  const returnButton = selectedCard ? returnCard : aboutButton;
  returnButton.focus({ preventScroll: true });
  view = 'cards';
  activateCard(returnCard);
  if (selectedCard) revealFocusedCard(returnCard);
}

for (const link of document.querySelectorAll('[data-email-user]')) {
  const address = `${link.dataset.emailUser}@${link.dataset.emailDomain}`;
  link.href = `mailto:${address}`;
  if (link.dataset.emailDisplay !== 'icon') link.append(address);
}

aboutButton.addEventListener('click', () => navigateTo('about', aboutButton));

for (const trigger of document.querySelectorAll('[data-section-target]')) {
  trigger.addEventListener('click', event => {
    if (trigger instanceof HTMLAnchorElement) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
    }
    navigateTo(trigger.dataset.sectionTarget, trigger);
  });
}

sectionScroll.addEventListener('scroll', scheduleSectionUpdate, { passive: true });
window.addEventListener('resize', scheduleSectionUpdate);
experienceContent.addEventListener('toggle', scheduleSectionUpdate, true);

experienceTrack.addEventListener('pointerdown', event => {
  if (event.button !== 0 || experienceWake.pointerId !== null
    || view !== 'section' || currentSection !== 'experience') return;

  event.preventDefault();
  experienceWake.pointerId = event.pointerId;
  experienceTrack.setPointerCapture(event.pointerId);
  experienceTrack.classList.add('is-dragging');
  experienceTrack.focus({ preventScroll: true });
  seekExperiencePointer(event);
});

experienceTrack.addEventListener('pointermove', event => {
  if (event.pointerId === experienceWake.pointerId) seekExperiencePointer(event);
});

for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  experienceTrack.addEventListener(type, event => {
    if (event.pointerId === experienceWake.pointerId) finishExperienceDrag();
  });
}

experienceTrack.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || !experienceWake.months) return;
  const step = 1 / experienceWake.months;
  const position = experienceWake.position;
  const targets = {
    ArrowUp: position - step,
    ArrowLeft: position - step,
    ArrowDown: position + step,
    ArrowRight: position + step,
    PageUp: position - step * 12,
    PageDown: position + step * 12,
    Home: 0,
    End: 1
  };
  if (!(event.key in targets)) return;
  event.preventDefault();
  seekExperienceTimeline(targets[event.key]);
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  finishExperienceDrag();
  stopExperienceWake();
});

const perspectivesResize = new ResizeObserver(schedulePerspectivesLayout);
perspectivesResize.observe(perspectivesContent);
for (const post of perspectivePosts) perspectivesResize.observe(post);

const accordionResize = new ResizeObserver(scheduleSectionUpdate);

for (const [index, details] of accordions.entries()) {
  const summary = details.querySelector('summary');
  const content = details.querySelector('.accordion-content');
  let expanded = details.open;
  let animation = null;

  content.id = `accordion-content-${index + 1}`;
  content.inert = !expanded;
  summary.setAttribute('aria-controls', content.id);
  summary.setAttribute('aria-expanded', String(expanded));
  accordionResize.observe(content);

  const cancelAnimation = () => {
    if (!animation) return;
    accordionAnimations.delete(animation);
    animation.cancel();
    animation = null;
  };

  const finish = () => {
    details.open = expanded;
    details.removeAttribute('data-closing');
    cancelAnimation();
    scheduleSectionUpdate();
  };

  summary.addEventListener('click', event => {
    event.preventDefault();
    const startHeight = details.open ? content.getBoundingClientRect().height : 0;
    expanded = !expanded;
    cancelAnimation();
    summary.setAttribute('aria-expanded', String(expanded));
    content.inert = !expanded;
    details.toggleAttribute('data-closing', !expanded);
    details.open = true;

    if (!motion.enabled) {
      finish();
      return;
    }

    const endHeight = expanded ? content.scrollHeight : 0;
    animation = content.animate(
      [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
      { duration: 200, easing: 'ease-out', fill: 'both' }
    );
    const currentAnimation = animation;
    accordionAnimations.add(animation);
    animation.onfinish = () => {
      if (animation === currentAnimation) finish();
    };
  });

  details.addEventListener('toggle', () => {
    if (animation) return;
    expanded = details.open;
    content.inert = !expanded;
    summary.setAttribute('aria-expanded', String(expanded));
  });
}

for (const [index, button] of academiaButtons.entries()) {
  const activate = targetIndex => {
    if (view !== 'section' || currentSection !== 'academia' || navigating || backPending) return;

    if (targetIndex !== activeAcademia) {
      selectAcademiaTab(targetIndex);
      sectionScroll.scrollTo({ top: 0, behavior: 'instant' });
      revealAcademiaChapter();
    }
    academiaButtons[targetIndex].focus({ preventScroll: true });
    rememberNavigation(academiaButtons[targetIndex]);
  };

  button.addEventListener('click', () => activate(index));
  button.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    let targetIndex;
    if (event.key === 'ArrowRight') targetIndex = (index + 1) % academiaButtons.length;
    else if (event.key === 'ArrowLeft') targetIndex = (index - 1 + academiaButtons.length) % academiaButtons.length;
    else if (event.key === 'Home') targetIndex = 0;
    else if (event.key === 'End') targetIndex = academiaButtons.length - 1;
    else return;

    event.preventDefault();
    activate(targetIndex);
  });
}

for (const button of experienceButtons) {
  button.addEventListener('click', () => {
    if (view !== 'section' || currentSection !== 'experience') return;

    const entry = document.getElementById(button.dataset.experienceTarget);
    const offset = compactDetailLayout.matches ? experienceSidebar.offsetHeight + 24 : 32;
    const top = sectionScroll.scrollTop + entry.getBoundingClientRect().top
      - sectionScroll.getBoundingClientRect().top - offset;
    entry.focus({ preventScroll: true });
    sectionScroll.scrollTo({ top, behavior: motion.enabled ? 'smooth' : 'instant' });
  });
}

for (const card of cards) {
  card.addEventListener('pointerenter', event => {
    if (pointerReady && inputMode === 'mouse' && event.pointerType === 'mouse') {
      activateCard(card);
    }
  });
  card.addEventListener('focusin', () => {
    if (inputMode === 'keyboard') {
      activateCard(card);
      revealFocusedCard(card);
    }
  });
  card.addEventListener('click', () => {
    if (view !== 'cards') return;

    if (card.classList.contains('is-active')) {
      navigateTo(card.dataset.card, card);
    } else {
      activateCard(card);
    }
  });
}

document.addEventListener('pointerdown', event => {
  trackPointer(event);
  if (event.pointerType !== 'mouse' && !cardGroup.contains(event.target)) {
    activateCard(portraitCard);
  }
}, { capture: true });

document.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse') return;

  trackPointer(event);
  if (view !== 'cards') return;

  pointerReady = true;
  const card = event.target.closest('.card');
  if (card) {
    activateCard(card);
  } else if (!cardGroup.contains(event.target)) {
    activateCard(portraitCard);
  }
});

document.addEventListener('pointerleave', event => {
  if (event.pointerType === 'mouse') mousePosition = null;
});

cardGroup.addEventListener('pointerleave', event => {
  if (event.pointerType === 'mouse') activateCard(portraitCard);
});

backButton.addEventListener('click', goBack);

document.addEventListener('keydown', event => {
  inputMode = 'keyboard';
  if (event.repeat && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
  }
  if (event.key === 'Escape' && view === 'section') {
    event.preventDefault();
    goBack();
  }
});

motion.addEventListener('change', () => {
  if (motion.enabled) return;

  finishContactChat();
  stopExperienceWake();
  if (sectionSwitchAnimation) sectionSwitchAnimation.finish();
  for (const animation of accordionAnimations) animation.finish();
  for (const animation of curtainAnimations) animation.finish();
  for (const animation of pausedTransitions) {
    if (animation.playState === 'paused') animation.finish();
  }
  window.scrollTo({ top: window.scrollY, behavior: 'instant' });
  sectionScroll.scrollTo({ top: sectionScroll.scrollTop, behavior: 'instant' });
});

window.addEventListener('pagehide', event => {
  finishContactChat();
  finishExperienceDrag();
  stopExperienceWake();
  if (event.persisted) portraitLanyard?.setPaused(true);
  else portraitLanyard?.destroy();
});

window.addEventListener('pageshow', event => {
  if (event.persisted) updatePortraitLanyard();
});

initializeNavigation();
