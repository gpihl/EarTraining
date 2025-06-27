document.addEventListener('DOMContentLoaded', () => {
  const menu = document.createElement('div');
  menu.className = 'app-menu';

  const toggle = document.createElement('button');
  toggle.id = 'menuToggle';
  toggle.innerHTML = '&#9776;';
  menu.appendChild(toggle);

  const links = document.createElement('div');
  links.className = 'menu-links';

  const search = window.location.search;
  const prefix = search.startsWith('?https://')
    ? search.replace(/[^/]+\.html$/, '')
    : '';

  const items = [
    ['index.html', 'Home'],
    ['chord_training.html', 'Chords'],
    ['melody_training.html', 'Melody'],
    ['sight_singing.html', 'Sight-Singing'],
    ['tuning_training.html', 'Intonation']
  ];
  links.innerHTML = items
    .map(([file, text]) => `<a href="${prefix}${file}">${text}</a>`)
    .join('');
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
