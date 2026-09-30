// Select the loader overlay element
const loader = document.getElementById("loading-overlay");

// Show loader
function showLoader() {
  if (loader) loader.classList.add("visible");
}

// Hide loader
function hideLoader() {
  if (loader) loader.classList.remove("visible");
}

// Show loader for a specific duration (ms)
function showLoaderFor(duration = 1000) {
  showLoader();
  setTimeout(hideLoader, duration);
}
