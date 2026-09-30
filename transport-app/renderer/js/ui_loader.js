window.UI = {
  showLoading() {
    const el = document.getElementById("loading-overlay");
    el.classList.add("visible");
  },
  hideLoading() {
    const el = document.getElementById("loading-overlay");
    setTimeout(() => el.classList.remove("visible"), 200);
  }
};
