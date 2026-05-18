console.log("IT’S ALIVE!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

const isLocal =
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  location.hostname === '';

const pathSegments = location.pathname.split('/').filter(Boolean);
const repoName =
  !isLocal && location.hostname.endsWith('github.io') && pathSegments.length > 0
    ? pathSegments[0]
    : '';
const BASE_PATH = repoName ? `/${repoName}/` : '/';

const pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'contact/', title: 'Contact' },
  { url: 'resume/', title: 'Resume' },
  { url: 'meta/', title: 'Meta' },
  { url: 'https://github.com/zonglinz', title: 'GitHub' },
];

const nav = document.createElement('nav');
document.body.prepend(nav);

for (let p of pages) {
  let url = p.url;
  let title = p.title;

  if (!url.startsWith('http')) {
    url = BASE_PATH + url;
  }

  let a = document.createElement('a');
  a.href = url;
  a.textContent = title;

  a.classList.toggle(
    'current',
    a.host === location.host && a.pathname === location.pathname,
  );

  if (a.host !== location.host) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }

  nav.append(a);
}

document.body.insertAdjacentHTML(
  'afterbegin',
  `
    <label class="color-scheme">
      Theme:
      <select>
        <option value="light dark">Automatic</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  `,
);

const select = document.querySelector('.color-scheme select');

function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty('color-scheme', colorScheme);
  select.value = colorScheme;
}

if ('colorScheme' in localStorage) {
  setColorScheme(localStorage.colorScheme);
} else {
  select.value = 'light dark';
}

select.addEventListener('input', function (event) {
  const colorScheme = event.target.value;
  setColorScheme(colorScheme);
  localStorage.colorScheme = colorScheme;
});

const form = document.querySelector('form[action^="mailto:"]');

form?.addEventListener('submit', function (event) {
  event.preventDefault();

  let data = new FormData(form);
  let url = form.action + '?';
  let params = [];

  for (let [name, value] of data) {
    params.push(`${name}=${encodeURIComponent(value)}`);
  }

  location.href = url + params.join('&');
});

export async function fetchJSON(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
    return null;
  }
}

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  if (!containerElement) {
    console.error('renderProjects: containerElement is missing.');
    return;
  }

  containerElement.innerHTML = '';

  if (!Array.isArray(projects) || projects.length === 0) {
    containerElement.innerHTML = '<p class="no-projects">No projects match the current filters.</p>';
    return;
  }

  const validHeadings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  const heading = validHeadings.includes(headingLevel) ? headingLevel : 'h2';

  for (const project of projects) {
    const article = document.createElement('article');
    const title = project.title || 'Untitled Project';
    const image = project.image || 'https://vis-society.github.io/labs/2/images/empty.svg';
    const description = project.description || 'No description available.';
    const year = project.year || '';
    const url = typeof project.url === 'string' ? project.url.trim() : '';

    const headingElement = document.createElement(heading);

    if (url) {
      const titleLink = document.createElement('a');
      titleLink.href = url;
      titleLink.textContent = title;
      titleLink.target = '_blank';
      titleLink.rel = 'noreferrer noopener';
      headingElement.append(titleLink);
    } else {
      headingElement.textContent = title;
    }

    const imageElement = document.createElement('img');
    imageElement.src = image;
    imageElement.alt = title;

    const imageWrapper = url ? document.createElement('a') : null;

    if (imageWrapper) {
      imageWrapper.href = url;
      imageWrapper.target = '_blank';
      imageWrapper.rel = 'noreferrer noopener';
      imageWrapper.className = 'project-image-link';
      imageWrapper.append(imageElement);
    }

    const projectText = document.createElement('div');
    projectText.className = 'project-text';

    const descriptionElement = document.createElement('p');
    descriptionElement.className = 'project-description';
    descriptionElement.textContent = description;
    projectText.append(descriptionElement);

    if (year) {
      const yearElement = document.createElement('p');
      yearElement.className = 'project-year';
      yearElement.textContent = year;
      projectText.append(yearElement);
    }

    if (url) {
      const linkElement = document.createElement('a');
      linkElement.className = 'project-link';
      linkElement.href = url;
      linkElement.target = '_blank';
      linkElement.rel = 'noreferrer noopener';
      linkElement.textContent = 'View project';
      projectText.append(linkElement);
    }

    article.append(headingElement, imageWrapper || imageElement, projectText);
    containerElement.appendChild(article);
  }
}

export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}

export const fetchGithubData = fetchGitHubData;
