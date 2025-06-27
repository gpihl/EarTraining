document.addEventListener('DOMContentLoaded', () => {
  const menu = document.createElement('div');
  menu.className = 'app-menu';

  const toggle = document.createElement('button');
  toggle.id = 'menuToggle';
  toggle.innerHTML = '&#9776;';
  menu.appendChild(toggle);

  const links = document.createElement('div');
  links.className = 'menu-links';
  links.innerHTML = `
    <a href="index.html">Home</a>
    <a href="chord_training.html">Chords</a>
    <a href="melody_training.html">Melody</a>
    <a href="sight_singing.html">Sight-Singing</a>
    <a href="tuning_training.html">Intonation</a>
  `;
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
