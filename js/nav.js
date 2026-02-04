(function () {
  var mobileMenuBtn = document.getElementById("mobileMenuBtn");

  function toggleMobileMenu() {
    document.body.classList.toggle("mobile-menu-open");
    var icon = mobileMenuBtn.querySelector("i");
    if (document.body.classList.contains("mobile-menu-open")) {
      icon.className = "fas fa-times";
    } else {
      icon.className = "fas fa-bars";
    }
  }

  mobileMenuBtn.addEventListener("click", toggleMobileMenu);
})();
