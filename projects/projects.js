import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

const projects = (await fetchJSON('../lib/projects.json')) || [];
const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const searchInput = document.querySelector('.searchBar');
const filterSummary = document.querySelector('.filter-summary');

const svg = d3.select('#projects-pie-plot');
const legend = d3.select('.legend');
const allYears = Array.from(
  new Set(projects.map((project) => String(project.year)).filter(Boolean)),
);
const colors = d3.scaleOrdinal(allYears, d3.schemeTableau10);

let query = '';
let selectedIndex = -1;
let selectedYear = null;

function projectMatchesQuery(project, searchQuery) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const values = Object.values(project).join('\n').toLowerCase();
  return values.includes(normalizedQuery);
}

function getSearchFilteredProjects() {
  return projects.filter((project) => projectMatchesQuery(project, query));
}

function getVisibleProjects(searchFilteredProjects) {
  if (!selectedYear) {
    return searchFilteredProjects;
  }

  return searchFilteredProjects.filter(
    (project) => String(project.year) === selectedYear,
  );
}

function projectCountLabel(count) {
  return `${count} project${count === 1 ? '' : 's'}`;
}

function updateProjectsTitle(visibleProjects) {
  if (!projectsTitle) {
    return;
  }

  projectsTitle.textContent = `Projects (${visibleProjects.length})`;
}

function updateFilterSummary(visibleProjects) {
  if (!filterSummary) {
    return;
  }

  const activeFilters = [];

  if (query.trim()) {
    activeFilters.push(`search “${query.trim()}”`);
  }

  if (selectedYear) {
    activeFilters.push(`year ${selectedYear}`);
  }

  if (activeFilters.length === 0) {
    filterSummary.textContent = `Showing all ${projectCountLabel(projects.length)}.`;
  } else {
    filterSummary.textContent = `Showing ${projectCountLabel(
      visibleProjects.length,
    )} matching ${activeFilters.join(' and ')}.`;
  }
}

function handleActivation(event, year) {
  if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  selectedYear = selectedYear === year ? null : year;
  applyFilters();
}

function renderPieChart(projectsGiven) {
  const rolledData = d3
    .rollups(
      projectsGiven,
      (values) => values.length,
      (project) => project.year,
    )
    .sort(([yearA], [yearB]) => d3.descending(Number(yearA), Number(yearB)));

  const data = rolledData.map(([year, count]) => {
    return { value: count, label: String(year) };
  });

  const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  const sliceGenerator = d3.pie().value((d) => d.value).sort(null);
  const arcData = sliceGenerator(data);
  const arcs = arcData.map((d) => arcGenerator(d));

  selectedIndex = data.findIndex((d) => d.label === selectedYear);

  svg.selectAll('path').remove();
  legend.selectAll('li').remove();

  if (data.length === 0) {
    selectedIndex = -1;
    svg.attr('aria-label', 'No matching projects to visualize');
    legend
      .append('li')
      .attr('class', 'legend-item legend-empty')
      .text('No matching years');
    return;
  }

  svg.attr(
    'aria-label',
    `Pie chart showing ${projectCountLabel(projectsGiven.length)} by year`,
  );

  arcs.forEach((arc, i) => {
    const slice = arcData[i];
    const year = String(slice.data.label);
    const count = slice.data.value;
    const isSelected = selectedIndex === i;

    svg
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(year))
      .attr('class', isSelected ? 'selected' : '')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-pressed', isSelected)
      .attr(
        'aria-label',
        `${year}: ${projectCountLabel(count)}. ${
          isSelected ? 'Click to clear this year filter.' : 'Click to filter by this year.'
        }`,
      )
      .on('click', (event) => handleActivation(event, year))
      .on('keydown', (event) => handleActivation(event, year));
  });

  data.forEach((d, i) => {
    const year = String(d.label);
    const isSelected = selectedIndex === i;

    legend
      .append('li')
      .attr('style', `--color:${colors(year)}`)
      .attr('class', `legend-item${isSelected ? ' selected' : ''}`)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-pressed', isSelected)
      .attr(
        'aria-label',
        `${year}: ${projectCountLabel(d.value)}. ${
          isSelected ? 'Click to clear this year filter.' : 'Click to filter by this year.'
        }`,
      )
      .html(
        `<span class="swatch" aria-hidden="true"></span><span>${year}</span> <em>(${d.value})</em>`,
      )
      .on('click', (event) => handleActivation(event, year))
      .on('keydown', (event) => handleActivation(event, year));
  });
}

function applyFilters() {
  const searchFilteredProjects = getSearchFilteredProjects();
  const visibleProjects = getVisibleProjects(searchFilteredProjects);

  renderProjects(visibleProjects, projectsContainer, 'h2');
  renderPieChart(searchFilteredProjects);
  updateProjectsTitle(visibleProjects);
  updateFilterSummary(visibleProjects);
}

searchInput?.addEventListener('input', (event) => {
  query = event.target.value;
  applyFilters();
});

applyFilters();
