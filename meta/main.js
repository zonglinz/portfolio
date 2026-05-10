import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const GITHUB_USERNAME = 'zonglinz';
const LOCAL_REPO_FALLBACK = 'zonglinz.github.io';

let data = [];
let commits = [];
let xScale;
let yScale;

function getGithubRepoName() {
  const pathParts = location.pathname.split('/').filter(Boolean);
  const pageFolders = new Set(['projects', 'contact', 'resume', 'meta']);

  if (location.hostname === `${GITHUB_USERNAME}.github.io`) {
    const firstSegment = pathParts[0];

    if (firstSegment && !pageFolders.has(firstSegment)) {
      return firstSegment;
    }

    return `${GITHUB_USERNAME}.github.io`;
  }

  if (location.hostname.endsWith('github.io')) {
    return pathParts[0] || LOCAL_REPO_FALLBACK;
  }

  return LOCAL_REPO_FALLBACK;
}

function getCommitUrl(commit) {
  return `https://github.com/${GITHUB_USERNAME}/${getGithubRepoName()}/commit/${commit}`;
}

async function loadData() {
  return await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(`${row.date}T00:00${row.timezone}`),
    datetime: new Date(row.datetime),
  }));
}

function processCommits(linesData) {
  return d3
    .groups(linesData, (d) => d.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;

      const ret = {
        id: commit,
        url: getCommitUrl(commit),
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        configurable: true,
        writable: true,
        enumerable: false,
      });

      return ret;
    });
}

function getTimePeriod(date) {
  const hour = date.getHours();

  if (hour < 6) return 'Night';
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
}

function appendStat(dl, label, value, options = {}) {
  const stat = dl.append('div').attr('class', 'stat');
  const dt = stat.append('dt');

  if (options.htmlLabel) {
    dt.html(label);
  } else {
    dt.text(label);
  }

  stat.append('dd').text(value ?? 'N/A');
}

function renderCommitInfo(linesData, commitData) {
  const fileLengths = d3.rollups(
    linesData,
    (values) => d3.max(values, (d) => d.line),
    (d) => d.file,
  );

  const longestFile = d3.greatest(fileLengths, (d) => d[1]);
  const averageFileLength = d3.mean(fileLengths, (d) => d[1]);

  const workByPeriod = d3.rollups(
    linesData,
    (values) => values.length,
    (d) => getTimePeriod(d.datetime),
  );

  const mostActivePeriod = d3.greatest(workByPeriod, (d) => d[1]);

  const workByDay = d3.rollups(
    linesData,
    (values) => values.length,
    (d) => d.datetime.toLocaleDateString('en', { weekday: 'long' }),
  );

  const mostActiveDay = d3.greatest(workByDay, (d) => d[1]);

  const numberFormat = d3.format(',');
  const decimalFormat = d3.format('.1f');

  const dl = d3.select('#stats').html('').append('dl').attr('class', 'stats');

  appendStat(dl, 'Total <abbr title="Lines of code">LOC</abbr>', numberFormat(linesData.length), {
    htmlLabel: true,
  });
  appendStat(dl, 'Total commits', numberFormat(commitData.length));
  appendStat(dl, 'Files', numberFormat(d3.group(linesData, (d) => d.file).size));
  appendStat(
    dl,
    'Longest file',
    longestFile ? `${longestFile[0]} (${numberFormat(longestFile[1])} lines)` : 'N/A',
  );
  appendStat(
    dl,
    'Average file length',
    averageFileLength ? `${decimalFormat(averageFileLength)} lines` : 'N/A',
  );
  appendStat(
    dl,
    'Average line length',
    `${decimalFormat(d3.mean(linesData, (d) => d.length) || 0)} chars`,
  );
  appendStat(dl, 'Maximum depth', numberFormat(d3.max(linesData, (d) => d.depth) || 0));
  appendStat(
    dl,
    'Most active time',
    mostActivePeriod
      ? `${mostActivePeriod[0]} (${numberFormat(mostActivePeriod[1])} lines)`
      : 'N/A',
  );
  appendStat(
    dl,
    'Most active day',
    mostActiveDay ? `${mostActiveDay[0]} (${numberFormat(mostActiveDay[1])} lines)` : 'N/A',
  );
}

function renderTooltipContent(commit) {
  if (!commit || Object.keys(commit).length === 0) return;

  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-time');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime.toLocaleString('en', { dateStyle: 'full' });
  time.textContent = commit.datetime.toLocaleString('en', { timeStyle: 'medium' });
  author.textContent = commit.author;
  lines.textContent = d3.format(',')(commit.totalLines);
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX + 12}px`;
  tooltip.style.top = `${event.clientY + 12}px`;
}

function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }

  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);

  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function getSelectedCommits(selection) {
  return selection ? commits.filter((d) => isCommitSelected(selection, d)) : [];
}

function renderSelectionCount(selection) {
  const selectedCommits = getSelectedCommits(selection);
  const countElement = document.querySelector('#selection-count');

  countElement.textContent = `${selectedCommits.length || 'No'} commits selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = getSelectedCommits(selection);
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }

  const lines = selectedCommits.flatMap((d) => d.lines);

  const breakdown = d3.rollup(
    lines,
    (values) => values.length,
    (d) => d.type,
  );

  container.innerHTML = '';

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);

    container.innerHTML += `
      <div class="stat">
        <dt>${language}</dt>
        <dd>${count} lines (${formatted})</dd>
      </div>
    `;
  }
}

function brushed(event) {
  const selection = event.selection;

  d3.selectAll('.dots circle').classed('selected', (d) => isCommitSelected(selection, d));
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function createBrushSelector(svg, usableArea) {
  const brush = d3
    .brush()
    .extent([
      [usableArea.left, usableArea.top],
      [usableArea.right, usableArea.bottom],
    ])
    .on('start brush end', brushed);

  svg.call(brush);
  svg.selectAll('.dots, .overlay ~ *').raise();
}

function renderScatterPlot(linesData, commitData) {
  if (commitData.length === 0) {
    d3.select('#chart').html(
      '<p class="no-projects">No commit data found. Run the elocuent command to generate meta/loc.csv.</p>',
    );
    return;
  }

  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 35 };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3
    .select('#chart')
    .html('')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commitData, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);

  const [minLines, maxLines] = d3.extent(commitData, (d) => d.totalLines);

  const rScale = d3
    .scaleSqrt()
    .domain([minLines ?? 0, maxLines ?? 1])
    .range([2, 30]);

  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

  const xAxis = d3.axisBottom(xScale);

  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => `${String(d % 24).padStart(2, '0')}:00`);

  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis);

  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  const sortedCommits = d3.sort(commitData, (d) => -d.totalLines);
  const dots = svg.append('g').attr('class', 'dots');

  dots
    .selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => {
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });

  createBrushSelector(svg, usableArea);
}

async function init() {
  try {
    data = await loadData();
    commits = processCommits(data);
    renderCommitInfo(data, commits);
    renderScatterPlot(data, commits);
  } catch (error) {
    console.error(error);
    d3.select('#stats').html(
      '<p class="no-projects">Could not load <code>meta/loc.csv</code>. Run <code>npx elocuent -d . -o meta/loc.csv --spaces 2</code>, then view this page from a local server.</p>',
    );
  }
}

await init();
