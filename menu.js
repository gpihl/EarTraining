document.addEventListener('DOMContentLoaded', () => {
  const menu = document.createElement('div');
  menu.className = 'app-menu';

  const toggle = document.createElement('button');
  toggle.id = 'menuToggle';
  toggle.innerHTML = '&#9776;';
  menu.appendChild(toggle);

  const links = document.createElement('div');
  links.className = 'menu-links';

  const pages = [
    ['index.html', 'Home'],
    ['chord_training.html', 'Chords'],
    ['melody_training.html', 'Melody'],
    ['sight_singing.html', 'SightSinging'],
    ['synth.html', 'Synth'],
    ['tuning_training.html', 'Intonation']
  ];

  const isHtmlPreview = location.hostname === 'htmlpreview.github.io';
  let rawBase = '';
  if (isHtmlPreview) {
    const rawUrl = location.search.slice(1);
    rawBase = rawUrl.substring(0, rawUrl.lastIndexOf('/') + 1);
  }

  pages.forEach(([href, text]) => {
    const a = document.createElement('a');
    a.textContent = text;
    a.href = isHtmlPreview ? `//htmlpreview.github.io/?${rawBase}${href}` : href;
    links.appendChild(a);
  });

  menu.appendChild(links);

  toggle.addEventListener('click', () => {
    menu.classList.toggle('open');
  });

  document.addEventListener('click', e => {
    if (!menu.contains(e.target)) {
      menu.classList.remove('open');
    }
  });

  document.body.appendChild(menu);
});
