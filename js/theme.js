(function () {
  var themeToggle = document.getElementById("themeToggle");
  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

  function getStoredTheme() {
    return localStorage.getItem("ez-uiu-theme");
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ez-uiu-theme", theme);
  }

  function initTheme() {
    var storedTheme = getStoredTheme();
    if (storedTheme) {
      setTheme(storedTheme);
    } else {
      setTheme("dark");
    }
  }

  function toggleTheme() {
    var currentTheme = document.documentElement.getAttribute("data-theme");
    var newTheme = currentTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  }

  themeToggle.addEventListener("click", toggleTheme);
  initTheme();
})();
