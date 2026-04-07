## Plan: Visualize Time Series Financial Data on GitHub Pages

Create a static web page on GitHub Pages to display interactive charts for time series financial data from JSON files in the index/ directory. Each JSON file gets its own chart except for the special case combining vix.json, vix_signal.json, and twa00.json into one chart with dual axes and signal markers.

**Steps**
1. Set up GitHub Pages: Enable Pages in repository settings, choose source branch (main) and folder (root or docs/).
2. Create HTML structure: Build index.html with sections for each chart, using a responsive layout.
3. Implement data fetching: Use JavaScript fetch API to load JSON data from GitHub raw URLs (e.g., https://raw.githubusercontent.com/alfred0630/----/main/index/filename.json).
4. Add charting library: Include Chart.js or Plotly.js via CDN for time series visualization.
5. Generate individual charts: For each JSON file (except special ones), create a line chart with date on x-axis and values on y-axis. Handle multiple columns by plotting multiple lines.
6. Implement special combined chart: For vix.json, vix_signal.json, twa00.json - create one chart with twa00 and vix as lines (dual y-axes), and overlay points on twa00 where vix_signal == 1.
7. Style the page: Add CSS for clean, professional look with chart titles, legends, and responsive design.
8. Test locally: Use a local server to verify charts render correctly before pushing.
9. Deploy: Push changes to GitHub to trigger Pages build.

**Relevant files**
- `index.html` — Main page structure and JavaScript for data fetching and chart rendering.
- `styles.css` — CSS for layout and styling.
- `script.js` — JavaScript logic for processing JSON and creating charts.
- Existing JSON files in `index/` — Data sources (e.g., [index/close.json](index/close.json), [index/vix.json](index/vix.json)).

**Verification**
1. Check GitHub Pages deployment: Visit the published URL and ensure all charts load without errors.
2. Validate data accuracy: Spot-check a few charts against raw JSON data to confirm correct plotting.
3. Test responsiveness: Resize browser window to ensure charts adapt to different screen sizes.
4. Verify special chart: Confirm vix and twa00 lines, dual axes, and signal points display correctly.

**Decisions**
- Use Chart.js for simplicity and performance in time series plotting.
- Fetch data directly from GitHub raw URLs to avoid CORS issues.
- Handle multiple columns in JSON by plotting each as a separate line in the same chart.
- For special chart: vix on right axis, twa00 on left; signal points as scatter plot overlaid on twa00 line.
- Scope: Only visualize existing JSON files; no data processing or updates.

**Further Considerations**
1. Performance: If many charts, consider lazy loading or pagination to improve page load time.
2. Error handling: Add try-catch for fetch failures and display user-friendly messages.
3. Customization: Allow users to toggle chart visibility or select date ranges if needed in future.
